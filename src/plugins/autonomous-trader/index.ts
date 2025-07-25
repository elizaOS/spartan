import type { Plugin } from '@elizaos/core';


import { verifyHolder } from "./actions/act_holder_verify";
// FIXME: remove/change holder address

// convert to providers
//import { servicesMenu } from "./actions/act_menu";
//import { actionFrequentlyAsked } from "./actions/act_faq";
//import { actionLinks } from "./actions/act_links";
import spartanNews from "./actions/act_spartan_news";

// odi utility
//import { devFix } from "./actions/devfix";

// account provider had this
import { holderProvider } from "./providers/holder";

function escapeMdV2(text) {
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

export const autonomousTraderPlugin: Plugin = {
  name: 'autonomous-trader',
  description: 'Spartan Autonomous trading agent plugin',
  evaluators: [],
  providers: [holderProvider],
  actions: [verifyHolder, spartanNews],
  services: [],
  init: async (_, runtime: IAgentRuntime) => {
    //console.log('autonomous-trader init');

    runtime.registerEvent('DISCORD_SLASH_START', (params) => {
      //const client = params.client
      console.log('multiwallet discord /start handler fire!')
      const message = `
⚠️ WARNING: DO NOT CLICK on any ADs at the bottom of Discord,
they are NOT from us and most likely SCAMS.

Discord now display ADS in our bots without our approval. Eliza Labs will NEVER advertise any links, airdrops, groups or discounts on fees.

You can find all our official bots on elizalabs.ai. Please do not search telegram for our bots. there are many impersonators.

===

Welcome to Spartan, the Discord bot. Spartan enables you to manage a wallet where you can put your funds.

By continuing you'll create a crypto wallet that interacts with Spartan to power it up with instant swaps and live data.
By pressing "Continue" you confirm that you accept our Terms of Use and Privacy Policy

**Terms of Use:** https://spartan.elizaos.ai/tc.html
**Privacy Policy:** https://spartan.elizaos.ai/pp.html

`
      /*
      const channel = params.interaction.channel
      const options: any = {
        content: message.trim(),
      };
      channel.send(options);
      */
      params.interaction.editReply(message)
    })

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

<b>Terms of Use:</b> https://spartan.elizaos.ai/tc.html
<b>Privacy Policy:</b> https://spartan.elizaos.ai/pp.html

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
  }
};

export default autonomousTraderPlugin;
