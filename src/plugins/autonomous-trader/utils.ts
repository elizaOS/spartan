import {
  type IAgentRuntime,
  ModelType,
  logger,
  parseJSONObjectFromText,
  createUniqueUuid,
} from '@elizaos/core';
import { interface_users_ByIds } from './interfaces/int_users'
import { interface_accounts_ByIds } from './interfaces/int_accounts'

// we used to use message.entityId
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

    //console.log('trader::utils:askLlmObject - response', response);
    responseContent = parseJSONObjectFromText(response) as any;

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

export function takeItPrivate(runtime, message, reply) {
  const responseContent = {
    text: reply,
    channelType: 'DM',
    inReplyTo: createUniqueUuid(runtime, message.id)
    // for the web UI
    //actions: ['REPLY'],
  };
  return responseContent
}