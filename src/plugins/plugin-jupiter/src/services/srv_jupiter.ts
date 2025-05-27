import { Service, logger, type IAgentRuntime } from '@elizaos/core';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  createJupiterApiClient,
  type SwapApi,
  type QuoteResponse,
  type SwapRequest,
  type SwapResponse,
} from '@jup-ag/api';

export class JupiterService extends Service {
  private isRunning = false;
  private connection: Connection | null = null;
  private registry: Record<number, any> = {};
  private swapApi: SwapApi | null = null;
  private feeAccount: PublicKey | null = null;

  static serviceType = 'JUPITER_SERVICE';
  capabilityDescription = 'Provides Jupiter DEX integration for token swaps';

  // Configuration constants
  private readonly CONFIRMATION_CONFIG = {
    MAX_ATTEMPTS: 12,
    INITIAL_TIMEOUT: 2000,
    MAX_TIMEOUT: 20000,
    getDelayForAttempt: (attempt: number) => Math.min(2000 * 1.5 ** attempt, 20000),
  };

  constructor(public runtime: IAgentRuntime) {
    super(runtime);
    this.registry = {};
    console.log('JUPITER_SERVICE cstr');
  }

  // return Jupiter Provider handle
  async registerProvider(provider: any) {
    // add to registry
    const id = Object.values(this.registry).length + 1;
    console.log('registered', provider.name, 'as Jupiter provider #' + id);
    this.registry[id] = provider;
    return id;
  }

  async getQuote({
    inputMint,
    outputMint,
    amount,
    slippageBps,
    platformFeeBps = 200,
  }: {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps: number;
    platformFeeBps?: number;
  }): Promise<{
    outAmount: string;
    priceImpactPct: number;
    marketInfos: any;
    otherAmountThreshold: string;
    swapMode: any;
    originalQuoteResponse: QuoteResponse;
  }> {
    try {
      if (!this.swapApi) {
        throw new Error('Jupiter API client not initialized');
      }

      const quoteResponseData = await this.swapApi.quoteGet({
        inputMint,
        outputMint,
        amount,
        slippageBps,
        platformFeeBps,
      });

      if (!quoteResponseData) {
        throw new Error('No routes found');
      }

      return {
        outAmount: quoteResponseData.outAmount,
        priceImpactPct: Number(quoteResponseData.priceImpactPct ?? 0),
        marketInfos: quoteResponseData.routePlan,
        otherAmountThreshold: quoteResponseData.otherAmountThreshold,
        swapMode: quoteResponseData.swapMode,
        originalQuoteResponse: quoteResponseData,
      };
    } catch (error) {
      logger.error('Error getting Jupiter quote:', error);
      throw error;
    }
  }

  async executeSwap({
    quoteResponse,
    userPublicKey,
  }: {
    quoteResponse: QuoteResponse;
    userPublicKey: string;
  }): Promise<SwapResponse> {
    try {
      if (!this.swapApi) {
        throw new Error('Jupiter API client not initialized');
      }

      const swapRequestBody: SwapRequest = {
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        computeUnitPriceMicroLamports: 50000,
      };

      const swapResponseData = await this.swapApi.swapPost({
        swapRequest: swapRequestBody,
      });

      return swapResponseData;
    } catch (error) {
      logger.error('Error executing Jupiter swap:', error);
      throw error;
    }
  }

  async confirmTransaction(connection: Connection, signature: string): Promise<boolean> {
    for (let i = 0; i < this.CONFIRMATION_CONFIG.MAX_ATTEMPTS; i++) {
      try {
        const status = await connection.getSignatureStatus(signature);
        if (
          status.value?.confirmationStatus === 'confirmed' ||
          status.value?.confirmationStatus === 'finalized'
        ) {
          return true;
        }

        const delay = this.CONFIRMATION_CONFIG.getDelayForAttempt(i);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } catch (error) {
        logger.warn(`Confirmation check ${i + 1} failed:`, error);

        if (i === this.CONFIRMATION_CONFIG.MAX_ATTEMPTS - 1) {
          throw new Error('Could not confirm transaction status');
        }

        const delay = this.CONFIRMATION_CONFIG.getDelayForAttempt(i);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    return false;
  }

  // Get token price in terms of quote token
  async getTokenPrice(
    tokenMint: string,
    quoteMint: string,
    inputDecimals: number = 6
  ): Promise<number> {
    try {
      const baseAmount = 10 ** inputDecimals;
      const quote = await this.getQuote({
        inputMint: tokenMint,
        outputMint: quoteMint,
        amount: baseAmount,
        slippageBps: 50,
      });
      return Number(quote.outAmount) / 10 ** inputDecimals;
    } catch (error) {
      logger.error('Failed to get token price:', error);
      return 0;
    }
  }

  // Get best swap route
  async getBestRoute({
    inputMint,
    outputMint,
    amount,
  }: {
    inputMint: string;
    outputMint: string;
    amount: number;
  }) {
    try {
      const quoteResult = await this.getQuote({
        inputMint,
        outputMint,
        amount,
        slippageBps: 50,
      });
      return quoteResult.originalQuoteResponse;
    } catch (error) {
      logger.error('Failed to get best route:', error);
      throw error;
    }
  }

  async getPriceImpact({
    inputMint,
    outputMint,
    amount,
  }: {
    inputMint: string;
    outputMint: string;
    amount: number;
  }): Promise<number> {
    try {
      const quoteResult = await this.getQuote({
        inputMint,
        outputMint,
        amount,
        slippageBps: 50,
      });
      return Number(quoteResult.priceImpactPct);
    } catch (error) {
      logger.error('Failed to get price impact:', error);
      throw error;
    }
  }

  async getMinimumReceived({
    inputMint,
    outputMint,
    amount,
    slippageBps,
  }: {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps: number;
  }): Promise<number> {
    try {
      const quoteResult = await this.getQuote({
        inputMint,
        outputMint,
        amount,
        slippageBps,
      });
      const minReceived = Number(quoteResult.outAmount) * (1 - slippageBps / 10000);
      return minReceived;
    } catch (error) {
      logger.error('Failed to calculate minimum received:', error);
      throw error;
    }
  }

  async estimateGasFees({
    inputMint,
    outputMint,
    amount,
  }: {
    inputMint: string;
    outputMint: string;
    amount: number;
  }): Promise<{ lamports: number; sol: number }> {
    try {
      const quoteResult = await this.getQuote({
        inputMint,
        outputMint,
        amount,
        slippageBps: 50,
      });
      const estimatedFee = Number(quoteResult.otherAmountThreshold || 5000);
      return {
        lamports: estimatedFee,
        sol: estimatedFee / 1e9,
      };
    } catch (error) {
      logger.error('Failed to estimate gas fees:', error);
      throw error;
    }
  }

  async findBestSlippage({
    inputMint,
    outputMint,
    amount,
  }: {
    inputMint: string;
    outputMint: string;
    amount: number;
  }): Promise<number> {
    try {
      const quoteResult = await this.getQuote({
        inputMint,
        outputMint,
        amount,
        slippageBps: 50,
      });

      const priceImpact = Number(quoteResult.priceImpactPct);
      let recommendedSlippage: number;

      if (priceImpact < 0.5) {
        recommendedSlippage = 50;
      } else if (priceImpact < 1) {
        recommendedSlippage = 100;
      } else {
        recommendedSlippage = 200;
      }

      return recommendedSlippage;
    } catch (error) {
      logger.error('Failed to find best slippage:', error);
      throw error;
    }
  }

  async getTokenPair({
    inputMint,
    outputMint,
  }: {
    inputMint: string;
    outputMint: string;
  }): Promise<{
    inputToken: any;
    outputToken: any;
    liquidity: number;
    volume24h: number;
  }> {
    try {
      // Fetch token pair information from Jupiter API
      const response = await fetch(
        `https://public.jupiterapi.com/v1/pairs/${inputMint}/${outputMint}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch token pair data');
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to get token pair information:', error);
      throw error;
    }
  }

  async getHistoricalPrices({
    inputMint,
    outputMint,
    timeframe = '24h', // Options: 1h, 24h, 7d, 30d
  }: {
    inputMint: string;
    outputMint: string;
    timeframe?: string;
  }): Promise<Array<{ timestamp: number; price: number }>> {
    try {
      // Fetch historical price data from Jupiter API
      const response = await fetch(
        `https://public.jupiterapi.com/v1/prices/${inputMint}/${outputMint}?timeframe=${timeframe}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch historical prices');
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to get historical prices:', error);
      throw error;
    }
  }

  async findArbitragePaths({
    startingMint,
    amount,
    maxHops = 3,
  }: {
    startingMint: string;
    amount: number;
    maxHops?: number;
  }): Promise<
    Array<{
      path: string[];
      expectedReturn: number;
      priceImpact: number;
    }>
  > {
    try {
      // Common tokens to check for arbitrage
      const commonTokens = [
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        'So11111111111111111111111111111111111111112', // SOL
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
      ];

      const paths: Array<{
        path: string[];
        expectedReturn: number;
        priceImpact: number;
      }> = [];

      // Find potential arbitrage paths
      for (const token1 of commonTokens) {
        if (token1 === startingMint) continue;

        const quote1Result = await this.getQuote({
          inputMint: startingMint,
          outputMint: token1,
          amount,
          slippageBps: 50,
        });

        for (const token2 of commonTokens) {
          if (token2 === token1 || token2 === startingMint) continue;

          const quote2Result = await this.getQuote({
            inputMint: token1,
            outputMint: token2,
            amount: Number(quote1Result.outAmount),
            slippageBps: 50,
          });

          const finalQuoteResult = await this.getQuote({
            inputMint: token2,
            outputMint: startingMint,
            amount: Number(quote2Result.outAmount),
            slippageBps: 50,
          });

          const expectedReturn = Number(finalQuoteResult.outAmount) - amount;
          const totalPriceImpact =
            Number(quote1Result.priceImpactPct) +
            Number(quote2Result.priceImpactPct) +
            Number(finalQuoteResult.priceImpactPct);

          if (expectedReturn > 0) {
            paths.push({
              path: [startingMint, token1, token2, startingMint],
              expectedReturn,
              priceImpact: totalPriceImpact,
            });
          }
        }
      }

      // Sort by expected return (highest first)
      return paths.sort((a, b) => b.expectedReturn - a.expectedReturn);
    } catch (error) {
      logger.error('Failed to find arbitrage paths:', error);
      throw error;
    }
  }

  static async start(runtime: IAgentRuntime) {
    console.log('JUPITER_SERVICE trying to start');
    const service = new JupiterService(runtime);
    await service.start();
    return service;
  }

  static async stop(runtime: IAgentRuntime) {
    const service = runtime.getService(this.serviceType) as JupiterService;
    if (!service) {
      throw new Error(this.serviceType + ' service not found');
    }
    await service.stop();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Jupiter service is already running');
      return;
    }
    console.log('JUPITER_SERVICE starting');

    try {
      logger.info('Starting Jupiter service...');
      
      if (!this.connection) {
        this.connection = new Connection(this.runtime.getSetting('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com', 'confirmed');
      }
      
      this.swapApi = createJupiterApiClient();

      const platformFeeAccount = this.runtime.getSetting('JUPITER_FEE_ACCOUNT');
      if (platformFeeAccount) {
        this.feeAccount = new PublicKey(platformFeeAccount);
      }

      this.isRunning = true;
      logger.info('Jupiter service started successfully');
    } catch (error) {
      logger.error('Error starting Jupiter service:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Jupiter service is not running');
      return;
    }

    try {
      logger.info('Stopping Jupiter service...');
      this.isRunning = false;
      logger.info('Jupiter service stopped successfully');
    } catch (error) {
      logger.error('Error stopping Jupiter service:', error);
      throw error;
    }
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }
}