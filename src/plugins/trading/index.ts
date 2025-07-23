import type { Plugin } from '@elizaos/core';

// actions
import { setStrategy } from "./actions/act_wallet_setstrategy";
import { changeStrategy } from "./actions/act_wallet_changestrategy";

import { positionSettings } from "./actions/act_position_settings";

//import actionPositionList from "./actions/act_position_list";
import openPositionAction from "./actions/act_open_position";

// Providers
import { analyticsProvider } from "./providers/analytics";
import { positionProvider } from "./providers/position";

// Strategies
import { llmStrategy } from './strategies/strategy_llm';
import { copyStrategy } from './strategies/strategy_copy';
import { noneStrategy } from './strategies/strategy_none';

// Services
import { InterfacePositionsService } from './services/srv_positions';

function escapeMdV2(text) {
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

export const traderPlugin: Plugin = {
  name: 'trader',
  description: 'Agent trading plugin',
  evaluators: [],
  providers: [positionProvider, analyticsProvider],
  actions: [
    setStrategy, changeStrategy,
    //actionPositionList,
    openPositionAction, positionSettings,
  ],
  services: [InterfacePositionsService],
  init: async (_, runtime: IAgentRuntime) => {
    // register strategies (are async)
    noneStrategy(runtime);
    llmStrategy(runtime);
    copyStrategy(runtime);
  }
};

export default traderPlugin;
