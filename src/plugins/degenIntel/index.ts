import type { IAgentRuntime, Plugin } from '@elizaos/core';
import routes from './apis';
import { registerTasks } from './tasks';
import { logger } from '@elizaos/core';

import { sentimentProvider } from './providers/sentiment';
import { cmcMarketProvider } from './providers/cmcMarket';
import { birdeyeTrendingProvider } from './providers/birdeyeTrending';
import { birdeyeTradePortfolioProvider } from './providers/birdeyeWallet';
// INTEL_SYNC_WALLET provider? or solana handles this?

// Services
import { TradeChainService } from './services/srv_chain';
import { TradeDataProviderService } from './services/srv_dataprovider';
import { TradeStrategyService } from './services/srv_strategy';

// Strategies
import { llmStrategy } from './strategies/strategy_llm';
import { copyStrategy } from './strategies/strategy_copy';

// create a new plugin
export const degenIntelPlugin: Plugin = {
  name: 'degen-intel',
  description: 'Degen Intel plugin',
  routes,
  providers: [],
  services: [TradeChainService, TradeDataProviderService, TradeStrategyService],
  tests: [
    {
      name: 'test suite for degen-intel',
      tests: [
        {
          name: 'test for degen-intel',
          fn: async (runtime: IAgentRuntime) => {
            logger.info('test in degen-intel working');
          },
        },
      ],
    },
  ],
  init: async (_, runtime: IAgentRuntime) => {
    console.log('degenIntel init');
    // register strategies
    llmStrategy(runtime); // is async
    copyStrategy(runtime); // is async

    await registerTasks(runtime);

    const plugins = runtime.plugins.map((p) => p.name);
    let notUsed = true;

    // check for cmc key, if have then register provider
    if (runtime.getSetting('COINMARKETCAP_API_KEY')) {
      runtime.registerProvider(cmcMarketProvider);
      notUsed = false;
    }

    // check for birdeeye key, if have then register provider
    if (runtime.getSetting('BIRDEYE_API_KEY')) {
      runtime.registerProvider(birdeyeTrendingProvider);
      runtime.registerProvider(birdeyeTradePortfolioProvider);
      notUsed = false;
    }

    // twitter for sentiment
    if (plugins.indexOf('twitter') !== -1) {
      runtime.registerProvider(sentimentProvider);
      notUsed = false;
    }

    if (notUsed) {
      logger.warn(
        'degen-intel plugin is included but not providing any value (COINMARKETCAP_API_KEY/BIRDEYE_API_KEY or twitter are suggested)'
      );
    }
  },
};
