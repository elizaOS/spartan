import { Plugin, logger } from "@elizaos/core";
import {
  getTokenBalanceAction,
  getWalletBalancesAction,
  swapTokensAction,
  chatWithSpartanAction,
} from "./actions";
import { defiProvider } from "./providers";
import { spartanDefiConfigSchema } from "./types";

export const spartanDefiPlugin: Plugin = {
  name: "plugin-spartan-defi",
  description:
    "Spartan DeFi integration plugin - token balances, swaps, and AI-powered trading insights using existing degenIntel services",

  // No services needed - we'll use existing degenIntel services
  services: [],
  actions: [getTokenBalanceAction, getWalletBalancesAction, swapTokensAction, chatWithSpartanAction],
  providers: [defiProvider],

  config: {
    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL,
    JUPITER_API_URL: process.env.JUPITER_API_URL,
    BIRDEYE_API_KEY: process.env.BIRDEYE_API_KEY,
    SPARTAN_CHAT_MODEL: process.env.SPARTAN_CHAT_MODEL,
  },

  async init(config: Record<string, string>, runtime?: any): Promise<void> {
    logger.info("Initializing Spartan DeFi plugin...");

    try {
      // Validate configuration
      const validatedConfig = {
        SOLANA_RPC_URL:
          runtime?.getSetting("SOLANA_RPC_URL") ||
          config.SOLANA_RPC_URL ||
          process.env.SOLANA_RPC_URL ||
          "https://api.mainnet-beta.solana.com",
        JUPITER_API_URL:
          runtime?.getSetting("JUPITER_API_URL") ||
          config.JUPITER_API_URL ||
          process.env.JUPITER_API_URL ||
          "https://quote-api.jup.ag/v6",
        BIRDEYE_API_KEY:
          runtime?.getSetting("BIRDEYE_API_KEY") ||
          config.BIRDEYE_API_KEY ||
          process.env.BIRDEYE_API_KEY ||
          "",
        SPARTAN_CHAT_MODEL:
          runtime?.getSetting("SPARTAN_CHAT_MODEL") ||
          config.SPARTAN_CHAT_MODEL ||
          process.env.SPARTAN_CHAT_MODEL ||
          "gpt-4",
      };

      // Validate with schema
      await spartanDefiConfigSchema.parseAsync(validatedConfig);

      logger.info("Spartan DeFi plugin configuration validated successfully");

      // Store config in runtime if available
      if (runtime) {
        runtime.character.settings = runtime.character.settings || {};
        runtime.character.settings.spartanDefiConfig = validatedConfig;
      }

      // Check for required degenIntel services
      const requiredServices = [
        'TRADER_DATAPROVIDER',
        'TRADER_CHAIN',
        'chain_solana'
      ];

      for (const serviceName of requiredServices) {
        const service = runtime?.getService(serviceName);
        if (!service) {
          logger.warn(`Required service ${serviceName} not found. Some functionality may be limited.`);
        } else {
          logger.info(`Found required service: ${serviceName}`);
        }
      }

    } catch (error) {
      logger.error(
        "Spartan DeFi plugin configuration validation failed:",
        error,
      );
      throw new Error(
        `Invalid Spartan DeFi plugin configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  dependencies: ["spartan-intel"], // Depends on the degenIntel plugin
};

export default spartanDefiPlugin;

// Export types and utilities for external use
export * from "./types";
