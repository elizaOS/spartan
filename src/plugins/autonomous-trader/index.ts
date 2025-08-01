import type { Plugin } from '@elizaos/core';
import { EventType } from '@elizaos/core';

import { resolve } from 'path';
import { mkdirSync, appendFileSync } from 'fs';

function formatMMDD_HH(date) {
  const pad2 = num => num.toString().padStart(2, '0');

  const month = date.getMonth() + 1;          // 0-based
  const day = date.getDate();

  const hours = date.getHours();

  return (
    pad2(month) +
    pad2(day) +
    '_' +
    pad2(hours)
  );
}

function formatYY(date) {
  const pad2 = num => num.toString().padStart(2, '0');

  const year = date.getFullYear() % 100;      // last two digits

  return (
    pad2(year)
  );
}


function jsonToYaml(json: any, indentLevel = 0): string {
  const indent = '  '.repeat(indentLevel);
  if (typeof json === 'object' && !Array.isArray(json) && json !== null) {
    return Object.entries(json)
      .map(([key, value]) => {
        const child = jsonToYaml(value, indentLevel + 1);
        if (typeof value === 'object' && value !== null) {
          return `${indent}${key}:\n${child}`;
        } else {
          return `${indent}${key}: ${child.trim()}`;
        }
      })
      .join('\n');
  } else if (Array.isArray(json)) {
    return json
      .map(item => `${indent}- ${jsonToYaml(item, indentLevel + 1).trim()}`)
      .join('\n');
  } else {
    return `${json}`;
  }
}

function convertYamlBlockToListItem(yamlBlock) {
  const lines = yamlBlock.trim().split('\n');

  return lines
    .map((line, index) => {
      if (index === 0) {
        return `- ${line}`; // prefix the first line with a dash
      } else {
        return `  ${line}`; // indent all other lines
      }
    })
    .join('\n');
}

function sanitizeChatNameToFilename(name, replacement = '-') {
  // Strip control characters (U+0000–U+001F)
  const controlChars = /[\u0000-\u001F]/g;

  // Disallowed Windows file/dir characters: < > : " / \\ | ? *
  const illegalChars = /[<>:"\/\\|?*]/g;

  // Names like NUL, COM1, AUX, etc. are reserved on Windows, so prefix them if matched
  const windowsReserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

  // Remove trailing spaces or dots (Windows doesn’t allow these)
  const trailing = /[ .]+$/;

  let cleaned = name
    .replace(controlChars, '')
    .replace(illegalChars, replacement);

  // Replace multiple replacements with a single one
  cleaned = cleaned.replace(new RegExp(replacement + '+', 'g'), replacement);

  // Trim whitespace or replacements at ends
  cleaned = cleaned.replace(new RegExp(`^${replacement}+|${replacement}+$`, 'g'), '');

  // Avoid reserved names
  if (windowsReserved.test(cleaned)) {
    cleaned = replacement + cleaned;
  }

  // Remove trailing spaces or dots
  cleaned = cleaned.replace(trailing, '');

  // Optionally, limit to safe character set (ASCII alphanumeric, dash, underscore, dot)
  // cleaned = cleaned.replace(/[^a-zA-Z0-9\-_.]/g, replacement);

  return cleaned || 'untitled';
}


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

    runtime.registerEvent(EventType.RUN_STARTED, (params) => {
      // runtime, messageId, roomId, entityId, startTime, status, source
      console.log('RUN_STARTED', params.entityId, params.metadata)
    })

    runtime.registerEvent(EventType.RUN_ENDED, (params) => {
      // runtime, messageId, roomId, entityId, startTime, status, source
      //console.log('RUN_ENDED', params.entityId, params.entityName, params.metadata)

      if (!params.metadata) {
        // if no data to save, don't save it
        console.log('no metadata in', params.messageId, params.roomId, params.entityId, params.status)
        return
      }

      const logData = params.metadata
      //const first = message.content.source + '_' + message.content.channelType + '/'
      const isDM = logData.channelType.toUpperCase() === 'DM'
      // sanitizeChatNameToFilename
      const first = sanitizeChatNameToFilename(logData.source + '_' + logData.channelType) + '/'
      const roomName = logData.roomName
      //const entityName =

      const date = new Date(logData.timestamp * 1000)

      // clean up non-filename data
      delete logData.channelType
      delete logData.source
      delete logData.roomName
      // only delete entityName on DMs

      const logYaml = jsonToYaml(logData)
      //console.log('logYaml', logYaml)

      // how many messages can you send an an hour
      // how many names per service, a lot...
      // discord_dm (only a few of these)/entityName (10k users...)/YY/date (8760 hours in a year, perfect)
      const lentityName = logData.entityName.toLowerCase()

      const mid = isDM ?
        (sanitizeChatNameToFilename(lentityName[0]) + '/' + sanitizeChatNameToFilename(lentityName[1]) + '/' + sanitizeChatNameToFilename(lentityName) + '/') :
        (roomName + '/')
      const last = formatYY(date) + '/' // always a sane number
      const key = first + mid + last
      const filename = formatMMDD_HH(date)

      // base dir?
      // spartan compiles to a module, so this is always the spartan
      const targetPath = resolve(__dirname, '../../../logs/' + key);
      console.log('targetPath', targetPath, filename + '.yml')

      // ensure directory exist
      mkdirSync(targetPath, { recursive: true });

      // append to existing file
      appendFileSync(targetPath + '/' + filename + '.yml', convertYamlBlockToListItem(logYaml) + "\n"); // make sure it ends on a new line
    })


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
