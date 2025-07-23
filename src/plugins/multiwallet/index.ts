import type { Plugin } from '@elizaos/core';

// actions
import { userRegistration } from "./actions/act_reg_start";
import { checkRegistration } from "./actions/act_reg_query";
import { checkRegistrationCode } from "./actions/act_reg_confirmemail";
import { deleteRegistration } from "./actions/act_reg_delete";

import { servicesMenu } from "./actions/act_menu";

import { verifyHolder } from "./actions/act_holder_verify";
import { actHolderQuery } from "./actions/act_holder_query";
import actEmailUuid from "./actions/act_email_uuid";

import { actionFrequentlyAsked } from "./actions/act_faq";
import { actionLinks } from "./actions/act_links";

import { walletCreate } from "./actions/act_wallet_create";
import { userMetawalletDelete } from "./actions/act_wallet_delete";

//import { setStrategy } from "./actions/act_wallet_setstrategy";
//import { changeStrategy } from "./actions/act_wallet_changestrategy";

import { userMetawalletList } from "./actions/act_wallet_list";
import { walletImportAction } from "./actions/act_wallet_import";
import userMetawalletSwap from "./actions/act_wallet_swap";
import userMetawalletSweep from "./actions/act_wallet_sweep";
import userMetawalletXfer from "./actions/act_wallet_xfer";
import userMetawalletBalance from "./actions/act_wallet_balance";
import userMetawalletPnl from "./actions/act_wallet_pnl";

import userMetawalletSwapAll from "./actions/act_wallet_swap_all";

import actionPositionList from "./actions/act_position_list";
import openPositionAction from "./actions/act_open_position";

//import actionTokenScam from "./actions/act_token_scam";
//import actionTokenRug from "./actions/act_token_rug";

import turnOnNotificationsAction from "./actions/act_turnon_notifications";
import turnOffNotificationsAction from "./actions/act_turnoff_notifications";

import { devFix } from "./actions/devfix";

// Providers

import { multiwalletProvider } from "./providers/multiwallet";
import { walletProvider } from "./providers/wallet";
import { accountProvider } from "./providers/account";
//import { positionProvider } from "./providers/position";
import { tokenProvider } from "./providers/token";
//import { analyticsProvider } from "./providers/analytics";

// Services
import { InterfaceUserService } from './services/srv_users';
import { InterfaceAccountService } from './services/srv_accounts';
import { InterfaceWalletService } from './services/srv_wallets';
//import { InterfacePositionsService } from './services/srv_positions';

function escapeMdV2(text) {
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

export const multiwalletPlugin: Plugin = {
  name: 'multitenant wallet',
  description: 'Enduser wallet plugin',
  evaluators: [],
  providers: [multiwalletProvider, walletProvider, accountProvider, tokenProvider, analyticsProvider],
  actions: [
    userRegistration, checkRegistrationCode, checkRegistration, deleteRegistration,
    actionFrequentlyAsked, actionLinks, servicesMenu,
    //devFix,
    verifyHolder, actHolderQuery,
    //actEmailUuid,
    walletCreate, setStrategy, changeStrategy, walletImportAction, userMetawalletDelete,
    userMetawalletXfer, userMetawalletSwap, userMetawalletSweep, userMetawalletSwapAll,
    userMetawalletList,
    //userMetawalletBalance, userMetawalletPnl,
    //actionPositionList,
    //openPositionAction,
    //actionTokenScam, actionTokenRug,
    turnOnNotificationsAction, turnOffNotificationsAction,
  ],
  services: [InterfaceUserService, InterfaceAccountService, InterfaceWalletService],
};

export default multiwalletPlugin;
