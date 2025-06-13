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
//import { devFix } from "./actions/devfix";
import userMetawalletSwap from "./actions/act_wallet_swap";
import userMetawalletSweep from "./actions/act_wallet_sweep";
import userMetawalletXfer from "./actions/act_wallet_xfer";

// Strategies
import { llmStrategy } from './strategies/strategy_llm';
import { copyStrategy } from './strategies/strategy_copy';
import { noneStrategy } from './strategies/strategy_none';

// Services
import { InterfaceUserService } from './services/srv_users';
import { InterfaceWalletService } from './services/srv_wallets';

export const autonomousTraderPlugin: Plugin = {
  name: 'autonomous-trader',
  description: 'Spartan Autonomous trading agent plugin',
  evaluators: [],
  providers: [],
  actions: [
    userRegistration, checkRegistrationCode, checkRegistration, deleteRegistration,
    servicesMenu, walletCreate, setStrategy, userMetawalletList, userMetawalletSwap,
    userMetawalletSweep, userMetawalletXfer
  ],
  services: [InterfaceUserService, InterfaceWalletService],
  init: async (_, runtime: IAgentRuntime) => {
    //console.log('autonomous-trader init');

    // register strategies (are async)
    noneStrategy(runtime);
    llmStrategy(runtime);
    //copyStrategy(runtime);
  }
};

export default autonomousTraderPlugin;
