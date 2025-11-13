import type {
  Action, Evaluator, IAgentRuntime, OnboardingConfig, Provider, UUID, World,
} from '@elizaos/core';
import {
  logger, Role, ChannelType, createUniqueUuid, EventType, initializeOnboarding, ServiceTypeName
} from '@elizaos/core';
import type { Guild } from 'discord.js';

import { resolve } from 'path';
import { mkdirSync, appendFileSync } from 'fs';
import { generateNewPost } from './tasks/tsk_discord_post'

/**
 * Parse safe integer with fallback
 */
function safeParseInt(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get a random interval between min and max values
 * If min/max are not configured, falls back to the fixed interval
 *
 * @param runtime - The agent runtime
 * @param type - The type of interval ('post', 'engagement', 'discovery')
 * @returns Random interval in minutes
 */
export function getRandomInterval(
  runtime: IAgentRuntime,
  type: 'post' | 'engagement' | 'discovery',
): number {
  let minInterval: number | undefined;
  let maxInterval: number | undefined;
  let fallbackInterval: number;

  switch (type) {
    case 'post':
      const postMin = runtime.getSetting("DISCORD_POST_INTERVAL_MIN") as string;
      const postMax = runtime.getSetting("DISCORD_POST_INTERVAL_MAX") as string;
      minInterval = postMin ? safeParseInt(postMin, 0) : undefined;
      maxInterval = postMax ? safeParseInt(postMax, 0) : undefined;
      fallbackInterval = safeParseInt(
        runtime.getSetting("DISCORD_POST_INTERVAL") as string,
        120
      );
      break;
    case 'engagement':
      const engagementMin = runtime.getSetting("DISCORD_ENGAGEMENT_INTERVAL_MIN") as string;
      const engagementMax = runtime.getSetting("DISCORD_ENGAGEMENT_INTERVAL_MAX") as string;
      minInterval = engagementMin ? safeParseInt(engagementMin, 0) : undefined;
      maxInterval = engagementMax ? safeParseInt(engagementMax, 0) : undefined;
      fallbackInterval = safeParseInt(
        runtime.getSetting("DISCORD_ENGAGEMENT_INTERVAL") as string,
        30
      );
      break;
    case 'discovery':
      const discoveryMin = runtime.getSetting("DISCORD_DISCOVERY_INTERVAL_MIN") as string;
      const discoveryMax = runtime.getSetting("DISCORD_DISCOVERY_INTERVAL_MAX") as string;
      minInterval = discoveryMin ? safeParseInt(discoveryMin, 0) : undefined;
      maxInterval = discoveryMax ? safeParseInt(discoveryMax, 0) : undefined;
      fallbackInterval = 20; // Default discovery interval
      break;
    default:
      throw new Error(`Unknown interval type: ${type}`);
  }
  //console.log(type, 'range', minInterval, maxInterval)

  // If MIN/MAX are properly configured, use random value between them
  if (minInterval !== undefined && maxInterval !== undefined && minInterval < maxInterval) {
    const randomInterval = Math.random() * (maxInterval - minInterval) + minInterval;
    runtime.logger.debug(`Random ${type} interval: ${randomInterval.toFixed(1)} minutes (between ${minInterval}-${maxInterval})`);
    return randomInterval;
  }
  if (minInterval !== undefined && maxInterval !== undefined && minInterval <= maxInterval) {
    runtime.logger.warn(`DISCORD_${type}_INTERVAL_MIN is equal or less than INTERVAL_MAX`);
  }

  // Otherwise, fall back to fixed interval
  runtime.logger.debug(`Using fixed ${type} interval: ${fallbackInterval} minutes`);
  return fallbackInterval;
}

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

/**
 * Initializes the character with the provided runtime, configuration, actions, providers, and evaluators.
 * Registers actions, providers, and evaluators to the runtime. Registers runtime events for "DISCORD_WORLD_JOINED" and "DISCORD_SERVER_CONNECTED".
 *
 * @param {Object} param - Object containing runtime, config, actions, providers, and evaluators.
 * @param {IAgentRuntime} param.runtime - The runtime instance to use.
 * @param {OnboardingConfig} param.config - The configuration for onboarding.
 * @param {Action[]} [param.actions] - Optional array of actions to register.
 * @param {Provider[]} [param.providers] - Optional array of providers to register.
 * @param {Evaluator[]} [param.evaluators] - Optional array of evaluators to register.
 */
export const initCharacter = async ({
  runtime,
  config,
  actions,
  providers,
  evaluators,
}: {
  runtime: IAgentRuntime;
  config: OnboardingConfig;
  actions?: Action[];
  providers?: Provider[];
  evaluators?: Evaluator[];
}): Promise<void> => {
  // Spartan doesn't use these
  /*
  if (actions) {
    for (const action of actions) {
      runtime.registerAction(action);
    }
  }

  if (providers) {
    for (const provider of providers) {
      runtime.registerProvider(provider);
    }
  }

  if (evaluators) {
    for (const evaluator of evaluators) {
      runtime.registerEvaluator(evaluator);
    }
  }
  */

  //
  // MARK: tasks init
  //

  const worldId = runtime.agentId; // this is global data for the agent
  // wait for this.adapter is available
  const taskReadyPromise = new Promise<void>(resolve => {
    runtime.initPromise.then(async () => {

      // first, get all tasks with all tags and delete them
      const tasks = await runtime.getTasks({
        tags: ['queue', 'repeat', 'spartan'],
      });
      for (const task of tasks) {
        if (task.id) {
          await runtime.deleteTask(task.id);
        }
      }
      resolve()
    })
  })

  //
  // MARK: discord posting
  //

  // require discord plugin
  const p = runtime.getServiceLoadPromise('discord' as ServiceTypeName)
  if (p) {
    p.then(async () => {
      const enablePost = runtime.getSetting('DISCORD_POST_CHANNEL_IDS')
      // has a correctish state
      if (enablePost && Array.isArray(enablePost) && enablePost.length) {
        runtime.logger.info('discord post enabled')
        // create a task to make this post?

        // have to wait for adapter to be initialize
        await taskReadyPromise

        runtime.registerTaskWorker({
          name: 'SPARTAN_DISCORD_POST_TASK',
          validate: async (_runtime, _message, _state) => {
            return true; // TODO: validate after certain time
          },
          execute: async (runtime, _options, _task) => {
            try {
              generateNewPost(runtime)
            } catch (error) {
              console.error('Failed to make discord post', error)
              //runtime.logger.error({ error }, 'Failed to make discord post');
            }
          },
        });

        // Get random post interval in minutes
        const postIntervalMinutes = getRandomInterval(runtime, 'post');
        const intervalInMs = postIntervalMinutes * 60 * 1000;

        runtime.createTask({
          name: 'SPARTAN_DISCORD_POST_TASK',
          description: 'Make periodic posts on Discord',
          worldId,
          metadata: {
            createdAt: Date.now(),
            updatedAt: Date.now(),
            updateInterval: intervalInMs,
          },
          tags: ['queue', 'repeat', 'spartan'],
        });


      }

      // Check if we should generate a post immediately
      const postImmediately: boolean = runtime.getSetting("DISCORD_POST_IMMEDIATELY")
      console.log('postImmediately', postImmediately)

      if (postImmediately) {
        runtime.logger.info(
          "DISCORD_POST_IMMEDIATELY is true, generating initial post when ready",
        );
        generateNewPost(runtime)
      }
    })
  }

  //
  // MARK: discord alpha gathering
  //

  runtime.registerEvent('DISCORD_LISTEN_CHANNEL_MESSAGE', async (params) => {
    const newMessage = params.message
    //console.log('DISCORD_LISTEN_CHANNEL_MESSAGE - message', newMessage)
    // we don't need to two copies because we can query by roomId anytime
    /*
    const remapTable = this.runtime.getSetting('DISCORD_LISTEN_REMAP_TABLE')
    if (remapTable) {
    */
    // just make a smaller bucket for searching these
    runtime.logger.info({ newMessage }, 'saving to discord-alpha')

    await runtime.createMemory(newMessage, 'discord-alpha');

    const state = await runtime.composeState(newMessage, ['RECENT_MESSAGES', 'EVALUATORS']);
    // we usually don't respond if we're using this functionality
    const didRespond = false // but has to be true for evaluators to work
    // trust evaluators?
    await runtime.evaluate(
      newMessage,
      state,
      didRespond,
      async (content) => {
        runtime.logger.debug({ content }, 'evaluate callback');
        /*
        if (responseContent) {
          responseContent.evalCallbacks = content;
        }
        return callback(content);
        */
        return []; // Return empty Memory array as required by HandlerCallback
      },
      [newMessage]
    );
    /*
    } else {
      await this.runtime.createMemory(newMessage, 'messages');
    }
    */
  })

  //
  // MARK: org world stuff
  //

  // Register runtime events
  runtime.registerEvent('DISCORD_WORLD_JOINED', async (params: { server: Guild }) => {
    // TODO: Save settings config to runtime
    await initializeAllSystems(runtime, [params.server], config);
  });

  // when booting up into a server we're in, fire a connected event
  runtime.registerEvent('DISCORD_SERVER_CONNECTED', async (params: { server: Guild }) => {
    await initializeAllSystems(runtime, [params.server], config);
  });

  // Register runtime events
  runtime.registerEvent(
    'TELEGRAM_WORLD_JOINED',
    async (params: { world: World; entities: any[]; chat: any; botUsername: string }) => {
      await initializeOnboarding(runtime, params.world, config);
      await startTelegramOnboarding(
        runtime,
        params.world,
        params.chat,
        params.entities,
        params.botUsername
      );
    }
  );

  //
  // MARK: Logging subsystem
  //

  runtime.registerEvent(EventType.RUN_STARTED, async (params) => {
    // runtime, messageId, roomId, entityId, startTime, status, source
    console.log('RUN_STARTED', params.entityId, params.metadata)
  })

  runtime.registerEvent(EventType.RUN_ENDED, async (params) => {
    // runtime, messageId, roomId, entityId, startTime, status, source
    //console.log('RUN_ENDED', params.entityId, params.entityName, params.metadata)

    if (!params.metadata) {
      // if no data to save, don't save it
      console.log('no metadata in', params.messageId, params.roomId, params.entityId, params.status)
      return
    }

    const logData = params.metadata

    if (!logData.channelType || !logData.source) {
      console.log(
        'incomplete metadata in RUN_ENDED (missing channelType or source)',
        params.messageId,
        params.roomId
      )
      return
    }

    const isDM = logData.channelType.toUpperCase() === 'DM'
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

  //
  // MARK: onboarding (slash start)
  //

  // Register slash commands with Discord (batched for performance)
  runtime.emitEvent(['DISCORD_REGISTER_COMMANDS'], {
    commands: [
      {
        name: 'start',
        description: 'Get started with Spartan',
      },
      // Add more commands here as needed
    ],
  });

  runtime.registerEvent('DISCORD_SLASH_COMMAND', async (params) => {
    //const client = params.client
    if (params.interaction.commandName !== 'start') return
    console.log('discord command /start handler fire!')
    const message = `
⚠️ WARNING: DO NOT CLICK on any ADs at the bottom of Discord,
they are NOT from us and most likely SCAMS.

Discord now display ADS in our bots without our approval. Eliza Labs will NEVER advertise any links, airdrops, groups or discounts on fees.

You can find all our official bots on elizalabs.ai. Please do not search discord for our bots. there are many impersonators.

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
    params.interaction.reply(message)
  })

  // old way
  runtime.registerEvent('DISCORD_SLASH_START', async (params) => {
    //const client = params.client
    console.log('discord slash /start handler fire!')
    const message = `
⚠️ WARNING: DO NOT CLICK on any ADs at the bottom of Discord,
they are NOT from us and most likely SCAMS.

Discord now display ADS in our bots without our approval. Eliza Labs will NEVER advertise any links, airdrops, groups or discounts on fees.

You can find all our official bots on elizalabs.ai. Please do not search discord for our bots. there are many impersonators.

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
    params.interaction.reply(message)
  })

  runtime.registerEvent('TELEGRAM_SLASH_START', async (params) => {
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
};

/**
 * Initializes all systems for the given servers with the provided runtime, servers, and onboarding configuration.
 *
 * @param {IAgentRuntime} runtime - The runtime object that provides functionalities for the agent.
 * @param {Guild[]} servers - The list of servers to initialize systems for.
 * @param {OnboardingConfig} config - The configuration settings for onboarding.
 * @returns {Promise<void>} - A Promise that resolves when all systems have been initialized.
 */
export async function initializeAllSystems(
  runtime: IAgentRuntime,
  servers: Guild[],
  config: OnboardingConfig
): Promise<void> {
  // TODO: Remove this
  // wait 2 seconds
  await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    for (const server of servers) {
      const worldId = createUniqueUuid(runtime, server.id);
      const ownerId = createUniqueUuid(runtime, server.ownerId);

      const existingWorld = await runtime.getWorld(worldId);
      if (!existingWorld) {
        logger.debug('Onboarding not initialized for server', server.id);
        continue;
      }
      if (existingWorld?.metadata?.settings) {
        logger.debug('Onboarding already initialized for server', server.id);
        continue;
      }

      // Initialize onboarding for this server
      const world: World = {
        id: worldId,
        name: server.name,
        serverId: server.id,
        agentId: runtime.agentId,
        metadata: {
          roles: {
            [ownerId]: Role.OWNER,
          },
          ownership: {
            ownerId: ownerId,
          },
        },
      };
      await runtime.ensureWorldExists(world);
      // await initializeOnboarding(runtime, world, config);
      // await startOnboardingDM(runtime, server, worldId);
      //console.log('init world', world);
    }
  } catch (error) {
    logger.error('Error initializing systems:', String(error));
    throw error;
  }
}

/**
 * Starts the settings DM with the server owner
 */
export async function startOnboardingDM(
  runtime: IAgentRuntime,
  guild: Guild,
  worldId: UUID
): Promise<void> {
  logger.info('startOnboardingDM - worldId', worldId);
  try {
    const owner = await guild.members.fetch(guild.ownerId);
    if (!owner) {
      logger.error(`Could not fetch owner with ID ${guild.ownerId} for server ${guild.id}`);
      throw new Error(`Could not fetch owner with ID ${guild.ownerId}`);
    }

    const onboardingMessages = [
      'Hi! I need to collect some information to get set up. Is now a good time?',
      'Hey there! I need to configure a few things. Do you have a moment?',
      'Hello! Could we take a few minutes to get everything set up?',
    ];

    const randomMessage = onboardingMessages[Math.floor(Math.random() * onboardingMessages.length)];
    const msg = await owner.send(randomMessage);
    const roomId = createUniqueUuid(runtime, msg.channel.id);

    await runtime.ensureRoomExists({
      id: roomId,
      name: `Chat with ${owner.user.username}`,
      source: 'discord',
      type: ChannelType.DM,
      channelId: msg.channelId,
      serverId: guild.id,
      worldId: worldId,
    });

    const entity = await runtime.getEntityById(runtime.agentId);

    if (!entity) {
      await runtime.createEntity({
        id: runtime.agentId,
        names: [runtime.character.name],
        agentId: runtime.agentId,
        metadata: {},
      });
    }
    // Create memory of the initial message
    await runtime.createMemory(
      {
        agentId: runtime.agentId,
        entityId: runtime.agentId,
        roomId: roomId,
        content: {
          text: randomMessage,
          actions: ['BEGIN_ONBOARDING'],
        },
        createdAt: Date.now(),
      },
      'messages'
    );

    logger.info(`Started settings DM with owner ${owner.id} for server ${guild.id}`);
  } catch (error) {
    logger.error(`Error starting DM with owner: ${error}`);
    throw error;
  }
}

/**
 * Starts onboarding for Telegram users by sending a deep link message to the group chat.
 *
 * @param {IAgentRuntime} runtime - The runtime instance for the agent
 * @param {World} world - The world object containing configuration
 * @param {any} chat - The Telegram chat object
 * @param {any[]} entities - Array of entities to search for the owner
 * @param {string} botUsername - Username of the Telegram bot
 * @returns {Promise<void>} A promise that resolves when the message is sent
 */
export async function startTelegramOnboarding(
  runtime: IAgentRuntime,
  world: World,
  chat: any,
  entities: any[],
  botUsername: string
): Promise<void> {
  let ownerId = null;
  let ownerUsername = null;

  entities.forEach((entity) => {
    if (entity.metadata?.telegram?.adminTitle === 'Owner') {
      ownerId = entity?.metadata?.telegram?.id;
      ownerUsername = entity?.metadata?.telegram?.username;
    }
  });

  if (!ownerId) {
    logger.warn('no ownerId found');
  }

  const telegramClient = runtime.getService('telegram') as any;

  // Fallback: send deep link to the group chat
  const onboardingMessageDeepLink = [
    `Hello @${ownerUsername}! Could we take a few minutes to get everything set up?`,
    `Please click this link to start chatting with me: https://t.me/${botUsername}?start=onboarding`,
  ].join(' ');

  await telegramClient.messageManager.sendMessage(chat.id, { text: onboardingMessageDeepLink });
  logger.info(`Sent deep link to group chat ${chat.id} for owner ${ownerId || 'unknown'}`);
}
