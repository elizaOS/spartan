import type { IAgentRuntime, Plugin } from '@elizaos/core';
import routes from './apis';
import { registerTasks } from './tasks';
import { logger } from '@elizaos/core';

import { sentimentProvider } from './providers/sentiment';
import { cmcMarketProvider } from './providers/cmcMarket';
import { birdeyeTrendingProvider } from './providers/birdeyeTrending';
import { birdeyeTradePortfolioProvider } from './providers/birdeyeWallet';
// INTEL_SYNC_WALLET provider? or solana handles this?

// create a new plugin
export const degenIntelPlugin: Plugin = {
  name: 'degen-intel',
  description: 'Degen Intel plugin',
  routes,
  providers: [],
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
    // Check if plugin should run in simulation mode (no real keys/services)
    const simFlag = String(
      runtime.getSetting('DEGEN_INTEL_SIMULATE_DATA') ||
        (process.env as Record<string, any>).DEGEN_INTEL_SIMULATE_DATA ||
        ''
    ).toLowerCase();

    const simulationEnabled = ['true', '1', 'yes'].includes(simFlag);

    await registerTasks(runtime);

    const plugins = runtime.plugins.map((p) => p.name);
    let notUsed = true;

    // Register CMC provider when API key exists OR simulation is enabled
    if (runtime.getSetting('COINMARKETCAP_API_KEY') || simulationEnabled) {
      runtime.registerProvider(cmcMarketProvider);
      notUsed = false;
    }

    // Register Birdeye providers when API key exists OR simulation is enabled
    if (runtime.getSetting('BIRDEYE_API_KEY') || simulationEnabled) {
      runtime.registerProvider(birdeyeTrendingProvider);
      runtime.registerProvider(birdeyeTradePortfolioProvider);
      notUsed = false;
    }

    // Twitter sentiment provider – rely on actual twitter plugin OR simulation data
    if (plugins.indexOf('twitter') !== -1 || simulationEnabled) {
      runtime.registerProvider(sentimentProvider);
      notUsed = false;
    }

    // Emit helpful logs if we are in simulation mode
    if (simulationEnabled) {
      logger.warn(
        'degen-intel plugin running in SIMULATION mode – mock data will be generated because required keys/services are missing.'
      );
    }

    if (notUsed && !simulationEnabled) {
      logger.warn(
        'degen-intel plugin is included but not providing any value (COINMARKETCAP_API_KEY/BIRDEYE_API_KEY or twitter are suggested)'
      );
    }
  },
};
