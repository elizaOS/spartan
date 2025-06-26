import type { Plugin } from '@elizaos/core';

// actions
import { userRegistration } from "./actions/act_reg_start";
import { checkRegistration } from "./actions/act_reg_query";
import { checkRegistrationCode } from "./actions/act_reg_confirmemail";
import { deleteRegistration } from "./actions/act_reg_delete";
import { servicesMenu } from "./actions/act_menu";
import { walletCreate } from "./actions/act_wallet_create";
import { setStrategy } from "./actions/act_wallet_setstrategy";
import { userMetawalletList } from "./actions/act_wallet_list";
import { walletImportAction } from "./actions/act_wallet_import";

import { devFix } from "./actions/devfix";
import userMetawalletSwap from "./actions/act_wallet_swap";
import userMetawalletSweep from "./actions/act_wallet_sweep";
import userMetawalletXfer from "./actions/act_wallet_xfer";
import userMetawalletBalance from "./actions/act_wallet_balance";

// Strategies
import { llmStrategy } from './strategies/strategy_llm';
import { copyStrategy } from './strategies/strategy_copy';
import { noneStrategy } from './strategies/strategy_none';

// Services
import { InterfaceUserService } from './services/srv_users';
import { InterfaceWalletService } from './services/srv_wallets';
import { InterfacePositionsService } from './services/srv_positions';

function escapeMdV2(text) {
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

export const autonomousTraderPlugin: Plugin = {
  name: 'autonomous-trader',
  description: 'Spartan Autonomous trading agent plugin',
  evaluators: [],
  providers: [],
  actions: [
    userRegistration, checkRegistrationCode, checkRegistration, deleteRegistration,
    servicesMenu, walletCreate, setStrategy, userMetawalletList, devFix,
    userMetawalletSwap, userMetawalletSweep, userMetawalletXfer, walletImportAction, userMetawalletBalance
  ],
  services: [InterfaceUserService, InterfaceWalletService, InterfacePositionsService],
  init: async (_, runtime: IAgentRuntime) => {
    //console.log('autonomous-trader init');

    runtime.registerEvent('TELEGRAM_SLASH_START', (params) => {
      //console.log('params', params)
      const ctx = params.ctx
      const botUsername = ctx.botInfo.username; // e.g. 'MyCoolBot'
      console.log('multiwallet telegram /start handler fire!', botUsername)

      ctx.reply(
        `
⚠️ WARNING: DO NOT CLICK on any ADs at the top of Telegram,
they are NOT from us and most likely SCAMS.

Telegram now display ADS in our bots without our approval. Eliza Labs will NEVER advertise any links, airdrops, groups or discounts on fees.

You can find all our official bots on elizalabs.ai. Please do not search telegram for our bots. there are many impersonators.

===

Welcome to Spartan, the Telegram bot. Spartan enables you to manage a wallet where you can put your funds.

By continuing you'll create a crypto wallet that interacts with Spartan to power it up with instant swaps and live data.
By pressing "Continue" you confirm that you accept our Terms of Use and Privacy Policy


`,
        { parse_mode: 'HTML' }
      );

      /*
      ctx.replyWithMarkdownV2(`
      *What can this bot do?*

      “I trade. You cope.”

      no charts
      no dreams
      no wagmi

      just cold, dead-eyed execution
      front-running your emotions
      and dumping on your confirmation bias

      🧠 powered by rage
      📉 trained on tears
      🧾 0% empathy, 100% efficiency

      you hold bags
      i hold conviction

      subscribe now or keep LARPing
      not responsible for feelings, girlfriends lost, or portfolio ruin
      (this is not financial advice — this is a personality disorder with API access)

      Want to learn more about us?
      Click here: [@${botUsername}](t.me/${botUsername})

      Link Tree: https://bento.me/SpartanVersus

      Bot Commands
      /start
      `);
      */
    })

    // register strategies (are async)
    noneStrategy(runtime);
    llmStrategy(runtime);
    //copyStrategy(runtime);
  }
};

export default autonomousTraderPlugin;
