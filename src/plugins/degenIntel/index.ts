import type { IAgentRuntime, Plugin } from '@elizaos/core';
//import { logger } from '@elizaos/core';
import routes from './apis';
import { registerTasks } from './tasks';

// Providers
import { tokenResearchProvider } from './providers/act_token_research';
import { sentimentProvider } from './providers/sentiment';
// INTEL_SYNC_WALLET provider? or solana handles this?

// Evaluators
import { tokenSnifferEvaluator } from './evaluators/evl_token_sniffer';

// Services
import { TradeChainService } from './services/srv_chain';
import { TradeDataProviderService } from './services/srv_dataprovider';
import { TradeStrategyService } from './services/srv_strategy';
import { TradeLpService } from './services/srv_liquiditypooling';

// create a new plugin
export const degenIntelPlugin: Plugin = {
  name: 'spartan-intel',
  description: 'Spartan Intel plugin',
  routes,
  providers: [tokenResearchProvider],
  services: [TradeChainService, TradeDataProviderService, TradeStrategyService, TradeLpService],
  evaluators: [tokenSnifferEvaluator],
  tests: [
    {
      name: 'test suite for intel',
      tests: [
        {
          name: 'test for intel',
          fn: async (runtime: IAgentRuntime) => {
            runtime.logger.info('test in intel working');
          },
        },
      ],
    },
  ],
  init: async (_, runtime: IAgentRuntime) => {
    runtime.logger.log('intel init');

    const taskReadyPromise = new Promise(resolve => {
      runtime.initPromise.then(async () => {
        await registerTasks(runtime);
        runtime.logger.log('intel init - tasks registered');
        resolve(undefined);
      });
      const plugins = runtime.plugins.map((p) => p.name);
      // twitter for sentiment
      if (plugins.indexOf('twitter') !== -1) {
        runtime.registerProvider(sentimentProvider);
      }
    });
  },
};
