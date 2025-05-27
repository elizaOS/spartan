import type { Plugin } from '@elizaos/core';

// actions
import { userRegistration }  from "./actions/act_reg_start";
import { checkRegistration } from "./actions/act_reg_query";
import { checkRegistrationCode } from "./actions/act_reg_confirmemail";
import { deleteRegistration } from "./actions/act_reg_delete";
import { servicesMenu } from "./actions/act_menu";
import { walletCreate } from "./actions/act_wallet_create";
import { setStrategy } from "./actions/act_wallet_setstrategy";
import { userMetawalletList } from "./actions/act_wallet_list";
import { devFix } from "./actions/devfix";

// Strategies
import { llmStrategy } from './strategies/strategy_llm';
import { copyStrategy } from './strategies/strategy_copy';

export const autonomousTraderPlugin: Plugin = {
  name: 'autonomous-trader',
  description: 'Spartan Autonomous trading agent plugin',
  evaluators: [],
  providers: [],
  actions: [
    userRegistration, checkRegistrationCode, checkRegistration, deleteRegistration,
    servicesMenu, walletCreate, setStrategy, userMetawalletList, devFix
  ],
  services: [],
  init: async (_, runtime: IAgentRuntime) => {
    console.log('autonomous-trader init');
    // register strategies
    llmStrategy(runtime); // is async
    copyStrategy(runtime); // is async
  }
};

export default autonomousTraderPlugin;
