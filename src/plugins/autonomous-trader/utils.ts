import {
  type IAgentRuntime,
  type Content,
  ModelType,
  logger,
  parseJSONObjectFromText,
  createUniqueUuid,
} from '@elizaos/core';
import { interface_users_ByIds } from './interfaces/int_users'
import { interface_accounts_ByIds } from './interfaces/int_accounts'

// we used to use message.entityId
// this is the user entity id
export async function getEntityIdFromMessage(runtime, message) {
  //return createUniqueUuid(runtime, message.metadata.fromId);
  //console.log('getEntityIdFromMessage message', message)

  // ensureEntity because I don't think the clients are going to build it
  if (message?.metadata?.sourceId) {
    const entityId = message.metadata.sourceId
    const entity = await runtime.getEntityById(entityId);
    if (!entity) {
      const success = await runtime.createEntity({
        id: entityId,
        //names: [message.names],
        //metadata: entityMetadata,
        agentId: runtime.agentId,
      });
    }
  }
  return message?.metadata?.sourceId
}

export async function HasEntityIdFromMessage(runtime, message) {
  /*
  if (!message?.metadata?.fromId) {
    console.log('WALLET_IMPORT validate - author not found')
    return false
  }
  */
  //console.log('HasEntityIdFromMessage message', message)
  return !!await getEntityIdFromMessage(runtime, message)
}

// they've started the registered process by providing an email
export async function getDataFromMessage(runtime, message) {
  //return createUniqueUuid(runtime, message.metadata.fromId);
  const entityId = await getEntityIdFromMessage(runtime, message)
  //console.debug('autotrade::getDataFromMessage - entityId', entityId)
  if (!entityId) {
    console.error('autotrade::getDataFromMessage - no entityId found')
    return false // avoid database look up
  }
  const components = await interface_users_ByIds(runtime, [entityId])
  //console.debug('autotrade::getDataFromMessage - user components', components)
  // .componentId
  return components[entityId]
}

// they have a verified email
// returns componentData
export async function getAccountFromMessage(runtime, message) {
  const componentData = await getDataFromMessage(runtime, message)
  if (componentData?.verified) {
    const emailAddr = componentData.address
    const emailEntityId = createUniqueUuid(runtime, emailAddr);
    const accounts = await interface_accounts_ByIds(runtime, [emailEntityId])
    if (accounts[emailEntityId]) {
      // accounts[emailEntityId] is componentData
      // .componentId
      // not really a concern
      /*
      if (emailEntityId !== accounts[emailEntityId].entityId) {
        console.warn('entityId mismatch', emailEntityId, accounts[emailEntityId])
      }
      */
      // probably don't need to include accountEntityId because it will contain entityId
      return {...accounts[emailEntityId], accountEntityId: emailEntityId }
    } else {
      // verified just no component yet
      // should we just ensure it here?
      return { accountEntityId: emailEntityId }
    }
  }
  // not verified
  return false
}

        /*
const sourceAddressTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Recent Messages:
{{recentMessages}}

Extract the following information about the requested swap:
- Source wallet address to use for the swap

Example response:
\`\`\`json
{
    "sourceWalletAddress": "FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1"
}
\`\`\`

Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the JSON response format without any preamble or explanation.

IMPORTANT: Your response must ONLY contain the json block above. Do not include any text, thinking, or reasoning before or after this JSON block. Start your response immediately with { and end with }.`;

        const sourcePrompt = composePromptFromState({
            state: state,
            template: sourceAddressTemplate,
        });
        const sourceResult = await runtime.useModel(ModelType.OBJECT_LARGE, {
            prompt: sourcePrompt,
        });
        console.log('MULTIWALLET_SWAP sourceResult', sourceResult);
        */

/// wallet vs pubkey address?
// is a wallet required? , required = 0
// max wallets? 1, 2 for transfer
// we return an array of what?
export async function getWalletsFromText(runtime, message) {
  // what about partial?
  // only works in the source context...
  const solanaService = runtime.getService('chain_solana') as any;
  if (!solanaService) {
    console.error('getWalletsFromText - CANT FIND chain_solana service')
    return []
  }
  const sources = solanaService.detectPubkeysFromString(message.content.text)
  // get by wallet name
  return sources
}

export async function acquireService(
  runtime: IAgentRuntime,
  serviceType,
  asking = '',
  retries = 10
) {
  let service = runtime.getService(serviceType) as any;
  while (!service) {
    console.log(asking, 'waiting for', serviceType, 'service...');
    service = runtime.getService(serviceType) as any;
    if (!service) {
      await new Promise((waitResolve) => setTimeout(waitResolve, 1000));
    } else {
      console.log(asking, 'Acquired', serviceType, 'service...');
    }
  }
  return service;
}

export async function askLlmObject(
  runtime: IAgentRuntime,
  ask: Object,
  requiredFields: string[],
  maxRetries = 3
) {
  let responseContent: any | null = null;
  // Retry if missing required fields
  let retries = 0;

  function checkRequired(resp) {
    if (!resp) {
      console.log('No response')
      return false;
    }
    let hasAll = true;
    for (const f of requiredFields) {
      // allow nulls
      if (resp[f] === undefined) {
        console.log('resp is missing', f, resp[f], resp)
        hasAll = false;
        break;
      }
    }
    return hasAll;
  }

  let good = false;
  while (retries < maxRetries && !good) {
    const response = await runtime.useModel(ModelType.TEXT_LARGE, {
      ...ask, // prompt, system
      temperature: 0.2,
      maxTokens: 4096,
      object: true,
    });

    // too coarse
    //console.log('trader::utils:askLlmObject - response', response);

    // we do not need the backtic stuff .replace('```json', '').replace('```', '')
    let cleanResponse = response.replace(/<think>[\s\S]*?<\/think>/g, '')
    responseContent = parseJSONObjectFromText(cleanResponse) as any;

    retries++;
    good = checkRequired(responseContent);
    if (!good) {
      logger.warn(
        '*** Missing required fields',
        responseContent,
        'needs',
        requiredFields,
        ', retrying... ***'
      );
    }
  }
  // can run null
  return responseContent;
}

export async function messageReply(runtime, message, reply) {
  const responseContent = {
    text: reply,
    attachments: [],
    source: message.source,
    // keep channelType the same
    channelType: message.channelType,
    inReplyTo: createUniqueUuid(runtime, message.id)
    // for the web UI
    //actions: ['REPLY'],
  };
  // embedding
  // metadata: entityName, type, authorId
  return responseContent
}

export function takeItPrivate(runtime, message, reply): Content {
  const responseContent = {
    text: reply,
    channelType: 'DM',
    inReplyTo: createUniqueUuid(runtime, message.id)
    // for the web UI
    //actions: ['REPLY'],
  };
  return responseContent
}

function splitTextBySentence(text, maxLength = 4096) {
  if (!text) return [];

  const sentenceRegex = /[^.!?]+[.!?]+[\])'"`’”]*|[^.!?]+$/g;
  const sentences = text.match(sentenceRegex) || [];

  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence;
    } else {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      if (sentence.length > maxLength) {
        // Split long sentence if it alone exceeds the limit
        for (let i = 0; i < sentence.length; i += maxLength) {
          chunks.push(sentence.slice(i, i + maxLength).trim());
        }
        currentChunk = '';
      } else {
        currentChunk = sentence;
      }
    }
  }

  if (currentChunk.trim()) chunks.push(currentChunk.trim());

  return chunks;
}

export function takeItPrivate2(runtime, message, reply, callback): Content {
  console.log('takeItPrivate2 input', reply.length)
  //console.log('source', message)
  if (message.content.source === 'discord') {
    // content[BASE_TYPE_MAX_LENGTH]: Must be 2000 or fewer in length
    //console.log('discord input', reply.length)
    const chunks = splitTextBySentence(reply, 2000)
    for(const c of chunks) {
      console.log('discord split chunk', c.length)
      if (c) {
        const responseContent = {
          text: c,
          channelType: 'DM',
          inReplyTo: createUniqueUuid(runtime, message.id)
          // for the web UI
          //actions: ['REPLY'],
        };
        callback(responseContent)
      }
    }
  } else if (message.content.source === 'telegram') {
    // what's telegram limit? 4k
    const chunks = splitTextBySentence(reply, 4096)
    for(const c of chunks) {
      console.log('telegram split chunk', c.length)
      const responseContent = {
        text: c,
        channelType: 'DM',
        inReplyTo: createUniqueUuid(runtime, message.id)
        // for the web UI
        //actions: ['REPLY'],
      };
      callback(responseContent)
    }
  } else {
    const responseContent = {
      text: reply,
      channelType: 'DM',
      inReplyTo: createUniqueUuid(runtime, message.id)
      // for the web UI
      //actions: ['REPLY'],
    };
    callback(responseContent)
  }
}

export async function parseTokenAccounts(heldTokens) {
  const out = {}
  for (const t of heldTokens) {
    const ca = t.account.data.parsed.info.mint
    const mintKey = new PublicKey(ca);
    const symbol = await solanaService.getTokenSymbol(mintKey)
    const amountRaw = t.account.data.parsed.info.tokenAmount.amount;
    const decimals = t.account.data.parsed.info.tokenAmount.decimals;
    const balance = Number(amountRaw) / (10 ** decimals);
    out[ca] = {
      symbol,
      decimals,
      balanceUi: balance, // how many tokens we have
    }
  }
  return out
}

export function accountMockComponent(account) {
  const id = account.componentId
  const entityId = account.entityId
  delete account.componentId
  delete account.entityId

  return {
    id,
    entityId, // has to be set for upsert/create (there is no default)
    data: account
  }
}