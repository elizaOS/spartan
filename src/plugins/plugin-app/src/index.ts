import type { Plugin } from "@elizaos/core";

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

export const appPlugin: Plugin = {
    name: "AppDev",
    description: "application development framework for ElizaOS",
    actions: [
      userRegistration, checkRegistrationCode, checkRegistration, deleteRegistration,
      servicesMenu, walletCreate, setStrategy, userMetawalletList, devFix
    ],
    evaluators: [],
    providers: [],
};

export default appPlugin;
