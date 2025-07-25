import type { Plugin } from '@elizaos/core';

// actions
import { userRegistration } from "./actions/act_reg_start";
//import { checkRegistration } from "./actions/act_reg_query";
import { checkRegistrationCode } from "./actions/act_reg_confirmemail";
import { deleteRegistration } from "./actions/act_reg_delete";

//import actEmailUuid from "./actions/act_email_uuid";

import turnOnNotificationsAction from "./actions/act_turnon_notifications";
import turnOffNotificationsAction from "./actions/act_turnoff_notifications";

// Providers

import { accountProvider } from "./providers/account";
import { userProvider } from "./providers/user";

// Services
import { InterfaceUserService } from './services/srv_users';
import { InterfaceAccountService } from './services/srv_accounts';

export const accountRegPlugin: Plugin = {
  name: 'account registration',
  description: 'Register accounts with elizaOS',
  evaluators: [],
  providers: [accountProvider, userProvider],
  actions: [
    userRegistration, checkRegistrationCode, deleteRegistration,
    //devFix,
    //actEmailUuid,
    turnOnNotificationsAction, turnOffNotificationsAction,
  ],
  services: [InterfaceUserService, InterfaceAccountService],
};

export default accountRegPlugin;
