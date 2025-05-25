// src/services/srv_jupiter.ts
import { Service, logger } from "@elizaos/core";
var JupiterService = class _JupiterService extends Service {
  constructor(runtime) {
    super(runtime);
    this.runtime = runtime;
    this.registry = {};
    console.log("JUPITER_SERVICE cstr");
  }
  isRunning = false;
  connection = null;
  keypair = null;
  registry = {};
  static serviceType = "JUPITER_SERVICE";
  capabilityDescription = "Provides Jupiter DEX integration for token swaps";
  // Configuration constants
  CONFIRMATION_CONFIG = {
    MAX_ATTEMPTS: 12,
    INITIAL_TIMEOUT: 2e3,
    MAX_TIMEOUT: 2e4,
    getDelayForAttempt: (attempt) => Math.min(2e3 * 1.5 ** attempt, 2e4)
  };
  // return Jupiter Provider handle
  async registerProvider(provider) {
    const id = Object.values(this.registry).length + 1;
    console.log("registered", provider.name, "as Jupiter provider #" + id);
    this.registry[id] = provider;
    return id;
  }
  async getQuote({
    inputMint,
    outputMint,
    amount,
    slippageBps
  }) {
    try {
      const quoteResponse = await fetch(
        `https://public.jupiterapi.com/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&platformFeeBps=200`
      );
      if (!quoteResponse.ok) {
        const error = await quoteResponse.text();
        logger.warn("Quote request failed:", {
          status: quoteResponse.status,
          error
        });
        throw new Error(`Failed to get quote: ${error}`);
      }
      const quoteData = await quoteResponse.json();
      return quoteData;
    } catch (error) {
      logger.error("Error getting Jupiter quote:", error);
      throw error;
    }
  }
  async executeSwap({
    quoteResponse,
    userPublicKey,
    slippageBps
  }) {
    try {
      const swapResponse = await fetch("https://public.jupiterapi.com/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: {
            ...quoteResponse,
            slippageBps
          },
          userPublicKey,
          wrapAndUnwrapSol: true,
          computeUnitPriceMicroLamports: 5e6,
          dynamicComputeUnitLimit: true
        })
      });
      if (!swapResponse.ok) {
        const error = await swapResponse.text();
        throw new Error(`Failed to get swap transaction: ${error}`);
      }
      return await swapResponse.json();
    } catch (error) {
      logger.error("Error executing Jupiter swap:", error);
      throw error;
    }
  }
  async confirmTransaction(connection, signature) {
    var _a, _b;
    for (let i = 0; i < this.CONFIRMATION_CONFIG.MAX_ATTEMPTS; i++) {
      try {
        const status = await connection.getSignatureStatus(signature);
        if (((_a = status.value) == null ? void 0 : _a.confirmationStatus) === "confirmed" || ((_b = status.value) == null ? void 0 : _b.confirmationStatus) === "finalized") {
          return true;
        }
        const delay = this.CONFIRMATION_CONFIG.getDelayForAttempt(i);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } catch (error) {
        logger.warn(`Confirmation check ${i + 1} failed:`, error);
        if (i === this.CONFIRMATION_CONFIG.MAX_ATTEMPTS - 1) {
          throw new Error("Could not confirm transaction status");
        }
        const delay = this.CONFIRMATION_CONFIG.getDelayForAttempt(i);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    return false;
  }
  // Get token price in USDC
  async getTokenPrice(tokenMint, quoteMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", inputDecimals = 6) {
    try {
      const baseAmount = 10 ** inputDecimals;
      const quote = await this.getQuote({
        inputMint: tokenMint,
        outputMint: quoteMint,
        amount: baseAmount,
        // Dynamic amount based on token decimals
        slippageBps: 50
      });
      return Number(quote.outAmount) / 10 ** inputDecimals;
    } catch (error) {
      logger.error("Failed to get token price:", error);
      return 0;
    }
  }
  // Get best swap route
  async getBestRoute({
    inputMint,
    outputMint,
    amount
  }) {
    try {
      const quote = await this.getQuote({
        inputMint,
        outputMint,
        amount,
        slippageBps: 50
      });
      return quote.routePlan;
    } catch (error) {
      logger.error("Failed to get best route:", error);
      throw error;
    }
  }
  async getPriceImpact({
    inputMint,
    outputMint,
    amount
  }) {
    try {
      const quote = await this.getQuote({
        inputMint,
        outputMint,
        amount,
        slippageBps: 50
      });
      return Number(quote.priceImpactPct);
    } catch (error) {
      logger.error("Failed to get price impact:", error);
      throw error;
    }
  }
  async getMinimumReceived({
    inputMint,
    outputMint,
    amount,
    slippageBps
  }) {
    try {
      const quote = await this.getQuote({
        inputMint,
        outputMint,
        amount,
        slippageBps
      });
      const minReceived = Number(quote.outAmount) * (1 - slippageBps / 1e4);
      return minReceived;
    } catch (error) {
      logger.error("Failed to calculate minimum received:", error);
      throw error;
    }
  }
  async estimateGasFees({
    inputMint,
    outputMint,
    amount
  }) {
    try {
      const quote = await this.getQuote({
        inputMint,
        outputMint,
        amount,
        slippageBps: 50
      });
      const estimatedFee = quote.otherAmountThreshold || 5e3;
      return {
        lamports: estimatedFee,
        sol: estimatedFee / 1e9
        // Convert lamports to SOL
      };
    } catch (error) {
      logger.error("Failed to estimate gas fees:", error);
      throw error;
    }
  }
  async findBestSlippage({
    inputMint,
    outputMint,
    amount
  }) {
    try {
      const quote = await this.getQuote({
        inputMint,
        outputMint,
        amount,
        slippageBps: 50
      });
      const priceImpact = Number(quote.priceImpactPct);
      let recommendedSlippage;
      if (priceImpact < 0.5) {
        recommendedSlippage = 50;
      } else if (priceImpact < 1) {
        recommendedSlippage = 100;
      } else {
        recommendedSlippage = 200;
      }
      return recommendedSlippage;
    } catch (error) {
      logger.error("Failed to find best slippage:", error);
      throw error;
    }
  }
  async getTokenPair({
    inputMint,
    outputMint
  }) {
    try {
      const response = await fetch(
        `https://public.jupiterapi.com/v1/pairs/${inputMint}/${outputMint}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch token pair data");
      }
      return await response.json();
    } catch (error) {
      logger.error("Failed to get token pair information:", error);
      throw error;
    }
  }
  async getHistoricalPrices({
    inputMint,
    outputMint,
    timeframe = "24h"
    // Options: 1h, 24h, 7d, 30d
  }) {
    try {
      const response = await fetch(
        `https://public.jupiterapi.com/v1/prices/${inputMint}/${outputMint}?timeframe=${timeframe}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch historical prices");
      }
      return await response.json();
    } catch (error) {
      logger.error("Failed to get historical prices:", error);
      throw error;
    }
  }
  async findArbitragePaths({
    startingMint,
    amount,
    maxHops = 3
  }) {
    try {
      const commonTokens = [
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        // USDC
        "So11111111111111111111111111111111111111112",
        // SOL
        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
        // USDT
      ];
      const paths = [];
      for (const token1 of commonTokens) {
        if (token1 === startingMint) continue;
        const quote1 = await this.getQuote({
          inputMint: startingMint,
          outputMint: token1,
          amount,
          slippageBps: 50
        });
        for (const token2 of commonTokens) {
          if (token2 === token1 || token2 === startingMint) continue;
          const quote2 = await this.getQuote({
            inputMint: token1,
            outputMint: token2,
            amount: Number(quote1.outAmount),
            slippageBps: 50
          });
          const finalQuote = await this.getQuote({
            inputMint: token2,
            outputMint: startingMint,
            amount: Number(quote2.outAmount),
            slippageBps: 50
          });
          const expectedReturn = Number(finalQuote.outAmount) - amount;
          const totalPriceImpact = Number(quote1.priceImpactPct) + Number(quote2.priceImpactPct) + Number(finalQuote.priceImpactPct);
          if (expectedReturn > 0) {
            paths.push({
              path: [startingMint, token1, token2, startingMint],
              expectedReturn,
              priceImpact: totalPriceImpact
            });
          }
        }
      }
      return paths.sort((a, b) => b.expectedReturn - a.expectedReturn);
    } catch (error) {
      logger.error("Failed to find arbitrage paths:", error);
      throw error;
    }
  }
  static async start(runtime) {
    console.log("JUPITER_SERVICE trying to start");
    const service = new _JupiterService(runtime);
    await service.start();
    return service;
  }
  static async stop(runtime) {
    const service = runtime.getService(this.serviceType);
    if (!service) {
      throw new Error(this.serviceType + " service not found");
    }
    await service.stop();
  }
  async start() {
    if (this.isRunning) {
      logger.warn("Jupiter service is already running");
      return;
    }
    console.log("JUPITER_SERVICE starting");
    try {
      logger.info("Starting Jupiter service...");
      this.isRunning = true;
      logger.info("Jupiter service started successfully");
    } catch (error) {
      logger.error("Error starting Jupiter service:", error);
      throw error;
    }
  }
  async stop() {
    if (!this.isRunning) {
      logger.warn("Jupiter service is not running");
      return;
    }
    try {
      logger.info("Stopping Jupiter service...");
      this.isRunning = false;
      logger.info("Jupiter service stopped successfully");
    } catch (error) {
      logger.error("Error stopping Jupiter service:", error);
      throw error;
    }
  }
  isServiceRunning() {
    return this.isRunning;
  }
};

// src/index.ts
var jupiterPlugin = {
  name: "jupiterOS",
  description: "jupiter plugin",
  actions: [],
  evaluators: [],
  providers: [],
  services: [JupiterService],
  init: async (_, runtime) => {
    console.log("jupiter init");
    const asking = "jupiter";
    const serviceType = "solana";
    let solanaService = runtime.getService(serviceType);
    while (!solanaService) {
      console.log(asking, "waiting for", serviceType, "service...");
      solanaService = runtime.getService(serviceType);
      if (!solanaService) {
        await new Promise((waitResolve) => setTimeout(waitResolve, 1e3));
      } else {
        console.log(asking, "Acquired", serviceType, "service...");
      }
    }
    const me = {
      name: "Jupiter DEX services"
    };
    solanaService.registerExchange(me);
    console.log("jupiter init done");
  }
};
var index_default = jupiterPlugin;
export {
  index_default as default,
  jupiterPlugin
};
//# sourceMappingURL=index.js.map