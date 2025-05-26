import type { Plugin } from '@elizaos/core';
import { DegenTradingService } from './tradingService';
import degenTraderTestSuite from './tests';

export const degenTraderPlugin: Plugin = {
  name: 'Degen Trader Plugin',
  description: 'Autonomous trading agent plugin',
  evaluators: [],
  providers: [],
  actions: [],
  services: [DegenTradingService],
  tests: [degenTraderTestSuite],
};

export default degenTraderPlugin;
