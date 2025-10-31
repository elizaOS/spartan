import type { Plugin, IAgentRuntime } from '@elizaos/core';

export const kolPlugin: Plugin = {
  name: 'KOL',
  description: 'Spartan Autonomous KOL plugin',
  evaluators: [],
  providers: [],
  actions: [],
  services: [],
  init: async (_, runtime: IAgentRuntime) => {
    console.log('KOL init');
  }
};

export default kolPlugin;
