import { type AgentRuntime, IAgentRuntime, logger, UUID } from '@elizaos/core';
import { CacheManager } from '../utils/cacheManager';
import { PortfolioStatus, TokenSignal, ServiceTypes } from '../types';
import { AnalyticsService } from './analyticsService';
import { BirdeyeService } from './calculation/birdeye';
import { TechnicalAnalysisService } from './calculation/technicalAnalysis';
import { SignalCalculationService } from './calculation/signalCalculation';
import { TokenSecurityService } from './validation/tokenSecurity';
import { TradeCalculationService } from './calculation/tradeCalculation';
import { WalletService } from './walletService';
// import { BirdeyeClient } from '../api/birdeyeClient';

export class DataService {
  public static readonly serviceType = ServiceTypes.DATA;
  public capabilityDescription =
    'Manages data fetching and caching from various sources including Birdeye.';
  private cacheManager: CacheManager;
  private birdeyeService: BirdeyeService;
  private analyticsService: AnalyticsService;
  private technicalAnalysisService: TechnicalAnalysisService;
  private signalCalculationService: SignalCalculationService;
  private tokenSecurityService: TokenSecurityService;
  private tradeCalculationService: TradeCalculationService;
  private runtime: IAgentRuntime;
  private walletService: WalletService;

  constructor(runtime: IAgentRuntime, walletService: WalletService) {
    this.runtime = runtime;
    this.walletService = walletService;
    this.cacheManager = new CacheManager();
    const apiKey = this.runtime.getSetting('BIRDEYE_API_KEY');
    if (!apiKey || apiKey.trim() === '') {
      const errorMessage =
        'Birdeye API key not found in settings or is empty. DataService cannot be initialized.';
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    this.birdeyeService = new BirdeyeService(apiKey);
    this.analyticsService = new AnalyticsService(runtime);
    this.technicalAnalysisService = new TechnicalAnalysisService(
      runtime,
      walletService,
      this,
      this.analyticsService
    );
    this.signalCalculationService = new SignalCalculationService(
      runtime,
      walletService,
      this,
      this.analyticsService
    );
    this.tokenSecurityService = new TokenSecurityService(
      runtime,
      walletService,
      this,
      this.analyticsService
    );
    this.tradeCalculationService = new TradeCalculationService(
      runtime,
      walletService,
      this,
      this.analyticsService
    );
  }

  async initialize(): Promise<void> {
    logger.info('DataService initialized');
  }

  async stop(): Promise<void> {
    await this.cacheManager.clear();
    logger.info('DataService stopped and cache cleared');
  }

  async getBirdeyeSignals(): Promise<TokenSignal[]> {
    try {
      const trendingTokens = (await this.cacheManager.get<any[]>('birdeye_trending_tokens')) || [];
      return Promise.all(
        trendingTokens.map(async (token) => {
          const marketData = await this.getTokenMarketData(token.address);
          const technicalSignals =
            await this.technicalAnalysisService.calculateTechnicalSignals(marketData);
          return {
            address: token.address,
            symbol: token.symbol,
            marketCap: marketData.marketCap,
            volume24h: marketData.volume24h,
            price: marketData.price,
            liquidity: marketData.liquidity,
            score: 0,
            reasons: [`Trending on Birdeye with ${marketData.volume24h}$ 24h volume`],
            technicalSignals: {
              ...technicalSignals,
              macd: {
                value: technicalSignals.macd.macd,
                signal: technicalSignals.macd.signal,
                histogram: technicalSignals.macd.histogram,
              },
            },
          };
        })
      );
    } catch (error) {
      logger.error('Error getting Birdeye signals:', error);
      return [];
    }
  }

  async getTwitterSignals(): Promise<TokenSignal[]> {
    try {
      const twitterSignals = (await this.cacheManager.get<any[]>('twitter_parsed_signals')) || [];
      return twitterSignals.map((signal) => ({
        address: signal.tokenAddress,
        symbol: signal.symbol,
        marketCap: signal.marketCap,
        volume24h: signal.volume24h,
        price: signal.price,
        liquidity: signal.liquidity,
        score: 0,
        reasons: [`High social activity: ${signal.mentionCount} mentions`],
        socialMetrics: {
          mentionCount: signal.mentionCount,
          sentiment: signal.sentiment,
          influencerMentions: signal.influencerMentions,
        },
      }));
    } catch (error) {
      logger.error('Error getting Twitter signals:', error);
      return [];
    }
  }

  async getCMCSignals(): Promise<TokenSignal[]> {
    try {
      const cmcTokens = (await this.cacheManager.get<any[]>('cmc_trending_tokens')) || [];
      return cmcTokens.map((token) => ({
        address: token.address,
        symbol: token.symbol,
        marketCap: token.marketCap,
        volume24h: token.volume24h,
        price: token.price,
        liquidity: token.liquidity,
        score: 0,
        reasons: [`Trending on CMC: ${token.cmcRank} rank`],
        cmcMetrics: {
          rank: token.cmcRank,
          priceChange24h: token.priceChange24h,
          volumeChange24h: token.volumeChange24h,
        },
      }));
    } catch (error) {
      logger.error('Error getting CMC signals:', error);
      return [];
    }
  }

  async getTokenMarketData(tokenAddress: string): Promise<{
    price: number;
    marketCap: number;
    liquidity: number;
    volume24h: number;
    priceHistory: number[];
    volumeHistory?: number[];
  }> {
    const cacheKey = `market_data_${tokenAddress}`;
    const cached = await this.cacheManager.get<any>(cacheKey);
    if (cached) return cached;

    const resultFromBirdeye = (await this.birdeyeService.getTokenMarketData(tokenAddress)) as any;

    const marketDataToReturn: {
      price: number;
      marketCap: number;
      liquidity: number;
      volume24h: number;
      priceHistory: number[];
      volumeHistory?: number[];
    } = {
      price: resultFromBirdeye.price,
      marketCap: resultFromBirdeye.marketCap,
      liquidity: resultFromBirdeye.liquidity,
      volume24h: resultFromBirdeye.volume24h,
      priceHistory: resultFromBirdeye.priceHistory,
    };

    if (resultFromBirdeye.volumeHistory) {
      marketDataToReturn.volumeHistory = resultFromBirdeye.volumeHistory;
    }

    await this.cacheManager.set(cacheKey, marketDataToReturn, 10 * 60 * 1000);
    return marketDataToReturn;
  }

  async getTokensMarketData(tokenAddresses: string[]): Promise<Record<string, any>> {
    const missing: string[] = [];
    const tokenDb: Record<string, any> = {};

    for (const ca of tokenAddresses) {
      const cached = await this.cacheManager.get<any>(`market_data_${ca}`);
      if (!cached) {
        missing.push(ca);
      } else {
        tokenDb[ca] = cached;
      }
    }

    if (missing.length > 0) {
      const newData = await this.birdeyeService.getTokensMarketData(missing);
      for (const [address, data] of Object.entries(newData)) {
        await this.cacheManager.set(`market_data_${address}`, data, 10 * 60 * 1000);
        tokenDb[address] = data;
      }
    }
    return tokenDb;
  }

  async getMonitoredTokens(): Promise<string[]> {
    try {
      const tasks = await this.runtime.getTasks({
        tags: ['degen_trader', 'EXECUTE_SELL'],
      });

      const tokenAddresses = new Set<string>();
      tasks.forEach((task) => {
        const metadata = task.metadata as { [key: string]: any };
        if (metadata?.signal?.tokenAddress) {
          tokenAddresses.add(metadata.signal.tokenAddress);
        }
      });

      return Array.from(tokenAddresses);
    } catch (error) {
      logger.error('Error getting monitored tokens:', error);
      return [];
    }
  }

  async getPositions(): Promise<any[]> {
    try {
      const monitoredTokens = await this.getMonitoredTokens();

      if (!monitoredTokens.length) {
        return [];
      }

      const positions = await Promise.all(
        monitoredTokens.map(async (tokenAddress) => {
          try {
            const balance = await this.walletService.getTokenBalance(tokenAddress);
            const marketData = await this.getTokenMarketData(tokenAddress);

            return {
              tokenAddress,
              balance,
              currentPrice: marketData.price,
              value: balance ? Number(balance.amount) * marketData.price : 0,
              lastUpdated: new Date().toISOString(),
            };
          } catch (error) {
            logger.error(`Error getting position for token ${tokenAddress}:`, error);
            return null;
          }
        })
      );

      return positions.filter((position) => position !== null);
    } catch (error) {
      logger.error('Error getting positions:', error);
      return [];
    }
  }

  private getDefaultRecommendation() {
    return {
      recommended_buy: 'SOL',
      recommend_buy_address: 'So11111111111111111111111111111111111111112',
      reason: 'Default recommendation',
      marketcap: 0,
      buy_amount: 0.1,
    };
  }

  async getCmcSignals(): Promise<TokenSignal[]> {
    try {
      const cmcData = (await this.cacheManager.get<any[]>('cmc_top_gainers')) || [];
      return cmcData.map((token) => ({
        address: token.platform?.token_address || token.id.toString(),
        symbol: token.symbol,
        marketCap: token.quote?.USD?.market_cap || 0,
        volume24h: token.quote?.USD?.volume_24h || 0,
        price: token.quote?.USD?.price || 0,
        liquidity: 0,
        score: 0,
        reasons: [
          `Top gainer on CoinMarketCap with ${token.quote?.USD?.percent_change_24h}% change`,
        ],
      }));
    } catch (error) {
      logger.error('Error getting CMC signals:', error);
      return [];
    }
  }

  async getWalletBalance(walletAddress?: string): Promise<number> {
    if (walletAddress && walletAddress !== (await this.walletService.getPublicKey())) {
      logger.warn(
        `DataService.getWalletBalance called for a specific address (${walletAddress}) not matching the primary service wallet. This might require direct Solana plugin access for arbitrary addresses.`
      );
      // Potentially, call solanaPluginService.getSolBalance(walletAddress) directly if DataService has access to it,
      // or this feature might be out of scope for DataService if it's tied to the plugin's own wallet.
      // For now, falling back to the plugin's wallet balance as a default or throwing an error.
      // throw new Error(`Querying balance for arbitrary address ${walletAddress} not yet fully supported via DataService.`);
    }

    const addressToUse = walletAddress || (await this.walletService.getPublicKey());
    const cacheKey = `wallet_balance_${addressToUse}`;
    const cachedBalance = await this.cacheManager.get<number>(cacheKey);
    if (cachedBalance !== null && cachedBalance !== undefined) {
      return cachedBalance;
    }

    const balance = await this.walletService.getBalance();
    await this.cacheManager.set(cacheKey, balance, 5 * 60 * 1000);
    return balance;
  }

  async getTokenBalance(
    tokenAddress: string,
    walletAddress?: string
  ): Promise<{ balance: string; decimals: number } | null> {
    if (walletAddress && walletAddress !== (await this.walletService.getPublicKey())) {
      logger.warn(
        `DataService.getTokenBalance called for a specific address (${walletAddress}) not matching the primary service wallet. This may require direct Solana plugin access.`
      );
      // Similar to getWalletBalance, direct solanaPluginService.getTokenBalance(walletAddress, tokenAddress) might be needed.
      // Fallback or error for now.
    }

    const addressToUse = walletAddress || (await this.walletService.getPublicKey());
    const cacheKey = `token_balance_${tokenAddress}_${addressToUse}`;
    const cached = await this.cacheManager.get<{ balance: string; decimals: number }>(cacheKey);
    if (cached) return cached;

    const balanceData = await this.walletService.getTokenBalance(tokenAddress);
    if (balanceData) {
      const ensuredBalanceData = {
        balance: balanceData.amount,
        decimals: balanceData.decimals,
      };
      await this.cacheManager.set(cacheKey, ensuredBalanceData, 5 * 60 * 1000);
      return ensuredBalanceData;
    }
    return null;
  }

  async getPortfolioStatus(
    walletAddress: string,
    positions: Array<{ tokenAddress: string; amount: string; purchasePrice?: number }>
  ): Promise<PortfolioStatus> {
    let totalValueUsd = 0;
    const tokenDetails: any[] = [];

    const tokenAddresses = positions.map((p) => p.tokenAddress);
    const marketDataMap = await this.getTokensMarketData(tokenAddresses);

    for (const position of positions) {
      const marketData = marketDataMap[position.tokenAddress];
      const price = marketData?.priceUsd || marketData?.price || 0;
      const valueUsd = parseFloat(position.amount) * price;
      totalValueUsd += valueUsd;
      tokenDetails.push({
        ...position,
        currentPrice: price,
        valueUsd,
        pnl: position.purchasePrice
          ? (price - position.purchasePrice) * parseFloat(position.amount)
          : undefined,
      });
    }

    return {
      totalValue: totalValueUsd,
      positions: tokenDetails.reduce((acc, detail) => {
        acc[detail.tokenAddress] = {
          amount: parseFloat(detail.amount),
          value: detail.valueUsd,
          price: detail.currentPrice,
        };
        return acc;
      }, {}),
      solBalance: await this.getWalletBalance(walletAddress),
      drawdown: 0,
    };
  }

  async getCachedOrFetch<T>(
    cacheKey: string,
    fetchFunction: () => Promise<T>,
    ttlMinutes: number = 5
  ): Promise<T> {
    const cachedData = await this.cacheManager.get<T>(cacheKey);
    if (cachedData !== null && cachedData !== undefined) {
      return cachedData;
    }
    const freshData = await fetchFunction();
    await this.cacheManager.set(cacheKey, freshData, ttlMinutes * 60 * 1000);
    return freshData;
  }

  async getSocialSentiment(tokenAddress: string): Promise<any> {
    logger.info(`Fetching social sentiment for ${tokenAddress}`);
    return { sentimentScore: 0.75, trending: true }; // Mock
  }

  async getTransactionVolume(tokenAddress: string): Promise<any> {
    logger.info(`Fetching transaction volume for ${tokenAddress}`);
    return { volume24h: 1000000, transactionCount: 500 }; // Mock
  }

  async getTokenSecurityInfo(tokenAddress: string): Promise<any> {
    logger.info(`Fetching security info for ${tokenAddress}`);
    return { isRugPull: false, auditScore: 85 }; // Mock
  }
}
