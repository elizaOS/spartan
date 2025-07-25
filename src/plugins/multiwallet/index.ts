import type { Plugin } from '@elizaos/core';

// actions
import { walletCreate } from "./actions/act_wallet_create";
import { userMetawalletDelete } from "./actions/act_wallet_delete";

import { userMetawalletList } from "./actions/act_wallet_list";
import { walletImportAction } from "./actions/act_wallet_import";
import userMetawalletSwap from "./actions/act_wallet_swap";
import userMetawalletSweep from "./actions/act_wallet_sweep";
import userMetawalletXfer from "./actions/act_wallet_xfer";
import userMetawalletBalance from "./actions/act_wallet_balance";

import userMetawalletSwapAll from "./actions/act_wallet_swap_all";

//import actionPositionList from "./actions/act_position_list";
//import openPositionAction from "./actions/act_open_position";

//import actionTokenScam from "./actions/act_token_scam";
//import actionTokenRug from "./actions/act_token_rug";

// Providers

import { multiwalletProvider } from "./providers/multiwallet";
import { walletProvider } from "./providers/wallet";
import { tokenProvider } from "./providers/token";
//import { analyticsProvider } from "./providers/analytics";

// Services
import { InterfaceWalletService } from './services/srv_wallets';

export const multiwalletPlugin: Plugin = {
  name: 'multitenant wallet',
  description: 'Enduser wallet plugin',
  evaluators: [],
  providers: [multiwalletProvider, walletProvider, tokenProvider],
  actions: [
    walletCreate, walletImportAction, userMetawalletDelete,
    userMetawalletXfer, userMetawalletSwap, userMetawalletSweep, userMetawalletSwapAll,
    userMetawalletList, // keep this enabled for the special formatting
    //userMetawalletBalance,
    //actionPositionList,
    //openPositionAction,
    //actionTokenScam, actionTokenRug,
    //spartanNews
  ],
  services: [InterfaceWalletService],
};

export default multiwalletPlugin;
