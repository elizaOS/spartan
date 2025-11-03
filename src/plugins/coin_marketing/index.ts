import type { Plugin, IAgentRuntime } from '@elizaos/core';
import { coinProvider } from './providers/coins';

export const coinMarketingPlugin: Plugin = {
  name: 'coin_marketer',
  description: 'Spartan coin marketing plugin',
  evaluators: [],
  providers: [coinProvider],
  actions: [],
  services: [],
  init: async (_, runtime: IAgentRuntime) => {
    console.log('Coin marketer init');
  }
};

export default coinMarketingPlugin;
