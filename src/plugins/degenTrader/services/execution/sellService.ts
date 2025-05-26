import { type IAgentRuntime, logger, type UUID } from '@elizaos/core';
import { BaseTradeService } from '../base/BaseTradeService';
import { TokenValidationService } from '../validation/TokenValidationService';
import { TradeCalculationService } from '../calculation/tradeCalculation';
import { SellSignalMessage, ServiceTypes } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { BN, toBN } from '../../utils/bignumber';
import { TradeMemoryService } from '../tradeMemoryService';
import { WalletService, WalletOperationResult } from '../walletService';
import { DataService } from '../dataService';
import { AnalyticsService } from '../analyticsService';

export class SellService extends BaseTradeService {
  public static readonly serviceType = ServiceTypes.SELL;
  public capabilityDescription = 'Handles the execution of sell trades.';
  private pendingSells: { [tokenAddress: string]: BN } = {};
  private validationService: TokenValidationService;
  private calculationService: TradeCalculationService;
  private tradeMemoryService: TradeMemoryService;

  constructor(
    runtime: IAgentRuntime,
    walletService: WalletService,
    dataService: DataService,
    analyticsService: AnalyticsService,
    tradeMemoryService: TradeMemoryService
  ) {
    super(runtime, walletService, dataService, analyticsService);
    this.validationService = new TokenValidationService(
      runtime,
      walletService,
      dataService,
      analyticsService
    );
    this.calculationService = new TradeCalculationService(
      runtime,
      walletService,
      dataService,
      analyticsService
    );
    this.tradeMemoryService = tradeMemoryService;
  }

  async initialize(): Promise<void> {
    logger.info('Initializing sell service');
    this.runtime.registerEvent('SPARTAN_TRADE_SELL_SIGNAL', this.handleSellSignal.bind(this));
  }

  async stop(): Promise<void> {
    this.pendingSells = {};
  }

  public async handleSellSignal(params: any): Promise<void> {
    const TRADER_SELL_KUMA = this.runtime.getSetting('TRADER_SELL_KUMA');
    if (TRADER_SELL_KUMA) {
      fetch(TRADER_SELL_KUMA).catch((e) => {
        logger.error('TRADER_SELL_KUMA err', e);
      });
    }
    const signal: SellSignalMessage = {
      positionId: uuidv4() as UUID,
      tokenAddress: params.recommend_sell_address,
      amount: params.sell_amount,
      entityId: 'default',
      slippage: params.slippage || 100,
    };

    await this.updateExpectedOutAmount(signal);
    this.executeSell(signal).then((result) => {
      logger.info('executeSell - result', result);
    });
  }

  private async updateExpectedOutAmount(
    signal: SellSignalMessage & { expectedOutAmount?: string }
  ): Promise<void> {
    if (!signal.amount) return;

    try {
      const quoteResponse = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${
          signal.tokenAddress
        }&outputMint=So11111111111111111111111111111111111111112&amount=${Math.round(
          Number(signal.amount) * 1e9
        )}&slippageBps=${signal.slippage || 100}`
      );

      if (quoteResponse.ok) {
        const quoteData = await quoteResponse.json();
        signal.expectedOutAmount = quoteData.outAmount;
      }
    } catch (error) {
      logger.warn('Failed to get expected out amount for sell', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async executeSell(
    signal: SellSignalMessage & { expectedOutAmount?: string }
  ): Promise<WalletOperationResult> {
    let tokenBalanceInfo;
    let sellAmountNum = 0;
    try {
      if (!signal) {
        throw new Error('No signal data in sell task');
      }

      tokenBalanceInfo = await this.walletService.getTokenBalance(signal.tokenAddress);
      if (!tokenBalanceInfo) {
        return { success: false, error: 'No token balance found' };
      }

      const availableBalance = parseFloat(tokenBalanceInfo.amount);
      if (availableBalance === 0) {
        return { success: false, error: 'Insufficient token balance' };
      }

      sellAmountNum = Math.min(availableBalance, parseFloat(signal.amount));

      try {
        this.pendingSells[signal.tokenAddress] = (
          this.pendingSells[signal.tokenAddress] || toBN(0)
        ).plus(toBN(sellAmountNum).times(10 ** tokenBalanceInfo.decimals));

        const slippageBps = await this.calculationService.calculateDynamicSlippage(
          signal.tokenAddress,
          sellAmountNum,
          true
        );

        const wallet = await this.walletService.getWallet();
        const result: WalletOperationResult = await wallet.sell({
          tokenAddress: signal.tokenAddress,
          tokenAmount: sellAmountNum.toString(),
          slippageBps,
        });

        if (result.success && result.signature) {
          const marketData = await this.dataService.getTokenMarketData(signal.tokenAddress);
          logger.info(`Sell executed successfully: ${result.signature}`);

          await this.tradeMemoryService.createTrade({
            tokenAddress: signal.tokenAddress,
            chain: 'solana',
            type: 'SELL',
            amount: sellAmountNum.toString(),
            price: marketData.price.toString(),
            txHash: result.signature,
          });

          await this.analyticsService.trackTradeExecution({
            type: 'sell',
            tokenAddress: signal.tokenAddress,
            amount: result.outAmount || sellAmountNum.toString(),
            signature: result.signature,
          });
          return result;
        }
        return result;
      } catch (error) {
        logger.error('Error executing sell:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      } finally {
        if (tokenBalanceInfo) {
          this.pendingSells[signal.tokenAddress] = (
            this.pendingSells[signal.tokenAddress] || toBN(0)
          ).minus(toBN(sellAmountNum).times(10 ** tokenBalanceInfo.decimals));
          if (this.pendingSells[signal.tokenAddress].lte(toBN(0))) {
            delete this.pendingSells[signal.tokenAddress];
          }
        }
      }
    } catch (error) {
      logger.error('Error executing sell task:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
