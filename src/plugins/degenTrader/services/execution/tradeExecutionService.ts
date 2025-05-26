import { type AgentRuntime, IAgentRuntime, logger } from '@elizaos/core';
// import { executeTrade } from '../../utils/wallet'; // OBSOLETE
import { WalletService } from '../walletService';
import { DataService } from '../dataService';
import { AnalyticsService } from '../analyticsService';

export class TradeExecutionService {
  constructor(
    protected runtime: IAgentRuntime,
    protected walletService: WalletService,
    protected dataService: DataService,
    protected analyticsService: AnalyticsService
  ) {}

  async initialize(): Promise<void> {
    logger.info('Initializing trade execution service');
  }

  async stop(): Promise<void> {
    // Cleanup if needed
  }

  // executeBuyTrade and executeSellTrade are removed as BuyService/SellService handle this via WalletService
  /*
  async executeBuyTrade({ ... }) { ... }
  async executeSellTrade({ ... }) { ... }
  */

  async calculateExpectedAmount(
    tokenAddress: string,
    amount: number, // Amount of input currency (SOL for buy, Token for sell)
    isSell: boolean
  ): Promise<string> {
    try {
      const marketData = await this.dataService.getTokenMarketData(tokenAddress);
      if (marketData.price === 0 && !isSell) {
        logger.warn(`Cannot calculate expected buy amount for ${tokenAddress}, price is zero.`);
        return '0'; // Avoid division by zero if price is 0 for a buy
      }
      const expectedAmount = isSell ? amount * marketData.price : amount / marketData.price;

      return expectedAmount.toString();
    } catch (error) {
      logger.error('Error calculating expected amount:', error);
      return '0';
    }
  }
}
