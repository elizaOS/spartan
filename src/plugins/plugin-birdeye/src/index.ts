import { logger, type IAgentRuntime, type Plugin } from '@elizaos/core';

import { BIRDEYE_SERVICE_NAME } from './constants';

import { tokenSearchAddressAction } from "./actions/token-search-address";
import { tokenSearchSymbolAction } from "./actions/token-search-symbol";
import { walletSearchAddressAction } from "./actions/wallet-search-address";

import Birdeye from './tasks/birdeye';

import { BirdeyeService } from './service';

import { agentPortfolioProvider } from "./providers/agent-portfolio-provider";
import { trendingProvider } from './providers/trending';
// SYNC_WALLET provider? or solana handles this?
import { tradePortfolioProvider } from './providers/wallet';

// create a new plugin
export const birdeyePlugin: Plugin = {
  name: 'birdeye',
  description: 'birdeye plugin',
  routes: [],
  actions: [
      tokenSearchAddressAction,
      tokenSearchSymbolAction,
      walletSearchAddressAction,
      // testAllEndpointsAction, // this action can be used to optionally test all endpoints
  ],
  providers: [
    agentPortfolioProvider,
    trendingProvider,
    tradePortfolioProvider,
  ],
  services: [BirdeyeService],
  tests: [],
  init: async (_, runtime: IAgentRuntime) => {

    // is plugin-trader active
    let hasPluginTrader = true

    //
    // trader support
    //

    // FIXME: only if plugin-trader is active
    if (hasPluginTrader) {
      // don't block init from finishing
      new Promise<void>(async (resolve) => {
        resolve();
        console.log('birdeyeStartIn');
        let service = runtime.getService('TRADER_DATAPROVIDER') as any;
        // FIXME: maybe a max retry?
        while (!service) {
          console.log('birdeye waiting for Trading info service...');
          service = runtime.getService('TRADER_DATAPROVIDER') as any;
          if (!service) {
            await new Promise((waitResolve) => setTimeout(waitResolve, 1000));
          } else {
            console.log('birdeye Acquired trading chain service...');
          }
        }
        const me = {
          name: 'Birdeye',
          trendingService: BIRDEYE_SERVICE_NAME,
        };
        await service.registerDataProvder(me);

        console.log('birdeyeStart done');
      });
    }

    //
    // tasks
    //
    const worldId = runtime.agentId; // this is global data for the agent

    // first, get all tasks with tags "queue", "repeat", "degen_intel" and delete them
    const tasks = await runtime.getTasks({
      tags: ['queue', 'repeat', 'plugin_birdeye'],
    });

    for (const task of tasks) {
      await runtime.deleteTask(task.id);
    }

    if (hasPluginTrader) {
      // how do we turn this on and off?
      // I guess we can check for the plugin-trader service
      runtime.registerTaskWorker({
        name: 'BIRDEYE_SYNC_TRENDING',
        validate: async (_runtime, _message, _state) => {
          return true; // TODO: validate after certain time
        },
        execute: async (runtime, _options, task) => {
          const birdeye = new Birdeye(runtime);
          try {
            await birdeye.syncTrendingTokens('solana');
            //await birdeye.syncTrendingTokens('base');
          } catch (error) {
            logger.error('Failed to sync trending tokens', error);
            // kill this task
            runtime.deleteTask(task.id);
          }
        },
      });

      runtime.createTask({
        name: 'BIRDEYE_SYNC_TRENDING',
        description: 'Sync trending tokens from Birdeye',
        worldId,
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          updateInterval: 1000 * 60 * 60, // 1 hour
        },
        tags: ['queue', 'repeat', 'plugin_birdeye', 'immediate'],
      });
    }



    // shouldn't plugin-solana and plugin-evm handle this?
    runtime.registerTaskWorker({
      name: 'BIRDEYE_SYNC_WALLET',
      validate: async (_runtime, _message, _state) => {
        return true; // TODO: validate after certain time
      },
      execute: async (runtime, _options, task) => {
        const birdeye = new Birdeye(runtime);
        try {
          await birdeye.syncWallet();
        } catch (error) {
          logger.error('Failed to sync wallet', error);
          // kill this task
          await runtime.deleteTask(task.id);
        }
      },
    });

    runtime.createTask({
      name: 'BIRDEYE_SYNC_WALLET',
      description: 'Sync wallet from Birdeye',
      worldId,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updateInterval: 1000 * 60 * 5, // 5 minutes
      },
      tags: ['queue', 'repeat', 'plugin_birdeye', 'immediate'],
    });

    /*
    const plugins = runtime.plugins.map((p) => p.name);
    let notUsed = true;

    // check for birdeeye key, if have then register provider
    if (runtime.getSetting('BIRDEYE_API_KEY')) {
      runtime.registerContextProvider(birdeyeTrendingProvider);
      runtime.registerContextProvider(birdeyeTradePortfolioProvider);
      notUsed = false;
    }

    if (notUsed) {
      logger.warn(
        'degen-intel plugin is included but not providing any value (COINMARKETCAP_API_KEY/BIRDEYE_API_KEY or twitter are suggested)'
      );
    }
    */
  },
};
