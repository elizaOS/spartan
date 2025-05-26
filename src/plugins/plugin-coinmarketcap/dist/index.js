// src/index.ts
import { logger as logger3 } from "@elizaos/core";

// src/actions/getPrice/index.ts
import {
  logger as logger2
} from "@elizaos/core";

// src/environment.ts
import { z } from "zod";
var coinmarketcapEnvSchema = z.object({
  COINMARKETCAP_API_KEY: z.string().min(1, "CoinMarketCap API key is required")
});
async function validateCoinMarketCapConfig(runtime) {
  try {
    const config = {
      COINMARKETCAP_API_KEY: runtime.getSetting("COINMARKETCAP_API_KEY")
    };
    return coinmarketcapEnvSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join("\n");
      throw new Error(
        `CoinMarketCap configuration validation failed:
${errorMessages}`
      );
    }
    throw error;
  }
}

// src/actions/getPrice/examples.ts
var priceExamples = [
  [
    {
      user: "{{user1}}",
      content: {
        text: "What's the current price of Bitcoin?"
      }
    },
    {
      user: "{{agent}}",
      content: {
        text: "Let me check the current Bitcoin price for you.",
        action: "GET_PRICE"
      }
    },
    {
      user: "{{agent}}",
      content: {
        text: "The current price of BTC is 65,432.21 USD"
      }
    }
  ],
  [
    {
      user: "{{user1}}",
      content: {
        text: "Check ETH price in EUR"
      }
    },
    {
      user: "{{agent}}",
      content: {
        text: "I'll check the current Ethereum price in EUR.",
        action: "GET_PRICE"
      }
    },
    {
      user: "{{agent}}",
      content: {
        text: "The current price of ETH is 2,345.67 EUR"
      }
    }
  ]
];

// src/actions/getPrice/service.ts
import axios from "axios";
var BASE_URL = "https://pro-api.coinmarketcap.com/v1";
var createPriceService = (apiKey) => {
  const client = axios.create({
    baseURL: BASE_URL,
    headers: {
      "X-CMC_PRO_API_KEY": apiKey,
      Accept: "application/json"
    }
  });
  const getPrice = async (symbol, currency) => {
    var _a, _b, _c;
    const normalizedSymbol = symbol.toUpperCase().trim();
    const normalizedCurrency = currency.toUpperCase().trim();
    try {
      const response = await client.get(
        "/cryptocurrency/quotes/latest",
        {
          params: {
            symbol: normalizedSymbol,
            convert: normalizedCurrency
          }
        }
      );
      console.log(
        "API Response:",
        JSON.stringify(response.data, null, 2)
      );
      const symbolData = response.data.data[normalizedSymbol];
      if (!symbolData) {
        throw new Error(
          `No data found for symbol: ${normalizedSymbol}`
        );
      }
      const quoteData = symbolData.quote[normalizedCurrency];
      if (!quoteData) {
        throw new Error(
          `No quote data found for currency: ${normalizedCurrency}`
        );
      }
      return {
        price: quoteData.price,
        marketCap: quoteData.market_cap,
        volume24h: quoteData.volume_24h,
        percentChange24h: quoteData.percent_change_24h
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = ((_c = (_b = (_a = error.response) == null ? void 0 : _a.data) == null ? void 0 : _b.status) == null ? void 0 : _c.error_message) || error.message;
        console.error("API Error:", errorMessage);
        throw new Error(`API Error: ${errorMessage}`);
      }
      throw error;
    }
  };
  return { getPrice };
};

// src/actions/getPrice/template.ts
var getPriceTemplate = `Respond with a JSON object containing BOTH symbol and currency. Currency must default to "USD" if not specified.

Here are the cryptocurrency symbol mappings:
- bitcoin/btc -> BTC
- ethereum/eth -> ETH
- solana/sol -> SOL
- cardano/ada -> ADA
- ripple/xrp -> XRP
- dogecoin/doge -> DOGE
- polkadot/dot -> DOT
- usdc -> USDC
- tether/usdt -> USDT

IMPORTANT: Response must ALWAYS include both "symbol" and "currency" fields.

Example response:
\`\`\`json
{
    "symbol": "BTC",
    "currency": "USD"
}
\`\`\`

{{recentMessages}}

Extract the cryptocurrency from the most recent message. Always include currency (default "USD").
Respond with a JSON markdown block containing both symbol and currency.`;

// src/actions/getPrice/validation.ts
import { z as z2 } from "zod";
var GetPriceSchema = z2.object({
  symbol: z2.string(),
  currency: z2.string().default("USD")
});
function isGetPriceContent(content) {
  return typeof content.symbol === "string" && typeof content.currency === "string";
}

// src/actions/getPrice/index.ts
var getPrice_default = {
  name: "GET_PRICE",
  similes: [
    "CHECK_PRICE",
    "PRICE_CHECK",
    "GET_CRYPTO_PRICE",
    "CHECK_CRYPTO_PRICE",
    "GET_TOKEN_PRICE",
    "CHECK_TOKEN_PRICE"
  ],
  // eslint-disable-next-line
  validate: async (runtime, _message) => {
    await validateCoinMarketCapConfig(runtime);
    return true;
  },
  description: "Get the current price of a cryptocurrency from CoinMarketCap",
  handler: async (runtime, message, state, _options, callback) => {
    logger2.log("Starting CoinMarketCap GET_PRICE handler...");
    let currentState = state;
    if (!currentState) {
      currentState = await runtime.composeState(message);
    } else {
    }
    try {
      const priceContext = composeContext({
        state: currentState,
        template: getPriceTemplate
      });
      const content = await runtime.useModel(ModelType.OBJECT_SMALL, {
        prompt: priceContext
      });
      if (!isGetPriceContent(content)) {
        throw new Error("Invalid price check content");
      }
      const config = await validateCoinMarketCapConfig(runtime);
      const priceService = createPriceService(
        config.COINMARKETCAP_API_KEY
      );
      try {
        const priceData = await priceService.getPrice(
          content.symbol,
          content.currency
        );
        logger2.success(
          `Price retrieved successfully! ${content.symbol}: ${priceData.price} ${content.currency.toUpperCase()}`
        );
        if (callback) {
          callback({
            text: `The current price of ${content.symbol} is ${priceData.price} ${content.currency.toUpperCase()}`,
            content: {
              symbol: content.symbol,
              currency: content.currency,
              ...priceData
            }
          });
        }
        return true;
      } catch (error) {
        logger2.error("Error in GET_PRICE handler:", error);
        if (callback) {
          callback({
            text: `Error fetching price: ${error.message}`,
            content: { error: error.message }
          });
        }
        return false;
      }
    } catch (error) {
      logger2.error("Error in GET_PRICE handler:", error);
      if (callback) {
        callback({
          text: `Error fetching price: ${error.message}`,
          content: { error: error.message }
        });
      }
      return false;
    }
  },
  examples: priceExamples
};

// src/tasks/coinmarketcap.ts
var Coinmarketcap = class {
  runtime;
  constructor(runtime) {
    this.runtime = runtime;
  }
  async syncTokens() {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const options = {
      method: "GET",
      headers: {
        accept: "application/json",
        "X-CMC_PRO_API_KEY": this.runtime.getSetting("COINMARKETCAP_API_KEY")
      }
    };
    const res = await fetch(
      "https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest",
      options
    );
    const resp = await res.json();
    const data = resp == null ? void 0 : resp.data;
    const ops = [];
    const tokens = [];
    for (const token of data) {
      if (token.platform !== null) {
        const allowed = ["solana", "base", "ethereum"];
        if (!allowed.includes(token.platform.slug)) {
          continue;
        }
      }
      const address = ((_a = token == null ? void 0 : token.platform) == null ? void 0 : _a.token_address) ?? token.slug;
      const data2 = {
        provider: "coinmarketcap",
        chain: ((_b = token == null ? void 0 : token.platform) == null ? void 0 : _b.slug) ?? "L1",
        address,
        decimals: null,
        liquidity: null,
        logoURI: `https://s2.coinmarketcap.com/static/img/coins/128x128/${token.id}.png`,
        name: token.name,
        symbol: token.symbol,
        volume24hUSD: (_d = (_c = token == null ? void 0 : token.quote) == null ? void 0 : _c.USD) == null ? void 0 : _d.volume_24h,
        rank: token.cmc_rank,
        marketcap: 0,
        price: (_f = (_e = token == null ? void 0 : token.quote) == null ? void 0 : _e.USD) == null ? void 0 : _f.price,
        price24hChangePercent: (_h = (_g = token == null ? void 0 : token.quote) == null ? void 0 : _g.USD) == null ? void 0 : _h.percent_change_24h,
        last_updated: new Date(token.last_updated)
      };
      tokens.push(data2);
      ops.push({
        updateOne: {
          filter: {
            provider: "coinmarketcap",
            rank: data2.rank
          },
          update: {
            $set: data2
          },
          upsert: true
        }
      });
    }
    await this.runtime.setCache("coinmarketcap_sync", tokens);
    return true;
  }
};

// src/providers/trending.ts
var trendingProvider = {
  name: "COINMARKETCAP_CURRENCY_LATEST",
  description: "Coinmarketcaps latest information about the cryptocurrencies",
  dynamic: true,
  //position: -1,
  get: async (runtime, message, state) => {
    const tokens = await runtime.getCache("coinmarketcap_sync") || [];
    if (!tokens.length) {
      logger.warn("No CMC token data found");
      return false;
    }
    let latestTxt = "\nCurrent CoinMarketCap list of all active cryptocurrencies with latest market data:";
    let idx = 1;
    const reduceTokens = tokens.map((t) => {
      const obj = {
        name: t.name,
        rank: t.rank,
        chain: t.chain,
        priceUsd: t.price,
        symbol: t.symbol,
        address: t.address,
        // skip logo, decimals
        // liquidity/marketcap are optimal
        // last_updated
        volume24hUSD: t.volume24hUSD,
        price24hChangePercent: t.price24hChangePercent
      };
      if (t.liquidity !== null) obj.liquidity = t.liquidity;
      if (t.marketcap !== 0) obj.marketcap = t.marketcap;
      return obj;
    });
    latestTxt += "\n" + JSON.stringify(reduceTokens) + "\n";
    const data = {
      tokens
    };
    const values = {};
    const text = latestTxt + "\n";
    return {
      data,
      values,
      text
    };
    return false;
  }
};

// src/index.ts
var coinmarketcapPlugin = {
  name: "coinmarketcap",
  description: "CoinMarketCap Plugin for Eliza",
  actions: [getPrice_default],
  evaluators: [],
  providers: [trendingProvider],
  init: async (_, runtime) => {
    const worldId = runtime.agentId;
    const tasks = await runtime.getTasks({
      tags: ["queue", "repeat", "plugin_coinmarketcap"]
    });
    for (const task of tasks) {
      await runtime.deleteTask(task.id);
    }
    runtime.registerTaskWorker({
      name: "COINMARKETCAP_SYNC_TRENDING",
      validate: async (_runtime, _message, _state) => {
        return true;
      },
      execute: async (runtime2, _options, task) => {
        const cmc = new Coinmarketcap(runtime2);
        try {
          await cmc.syncTokens();
        } catch (error) {
          logger3.error("Failed to sync trending tokens", error);
          runtime2.deleteTask(task.id);
        }
      }
    });
    runtime.createTask({
      name: "COINMARKETCAP_SYNC_TRENDING",
      description: "Sync trending tokens from Birdeye",
      worldId,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updateInterval: 1e3 * 60 * 60
        // 1 hour
      },
      tags: ["queue", "repeat", "plugin_birdeye", "immediate"]
    });
  }
};
var index_default = coinmarketcapPlugin;
export {
  coinmarketcapPlugin,
  index_default as default
};
//# sourceMappingURL=index.js.map