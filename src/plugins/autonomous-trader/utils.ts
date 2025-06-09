import {
  type IAgentRuntime,
  ModelType,
  logger,
  parseJSONObjectFromText,
  createUniqueUuid,
} from '@elizaos/core';

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
    if (!resp) return false;
    let hasAll = true;
    for (const f of requiredFields) {
      if (!resp[f]) {
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

    console.log('trader::utils:askLlmObject - response', response);
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

export async function messageReply(runtime, message, reply, responses) {
  const roomDetails = await runtime.getRoom(message.roomId);
  //if (message.content.source === 'discord') {
  /*
  // ServiceType.DISCORD
  const discordService = runtime.getService('discord')
  if (!discordService) {
    logger.warn('no discord Service')
    return
  }
  */
  // clear all current messages
  responses.length = 0
  const entityId = createUniqueUuid(runtime, message.metadata.authorId);
  const isDM = roomDetails.type === 'dm'
  if (isDM) {
    //discordService.sendDM(message.metadata.authorId, reply)
    // add response
    responses.push({
      entityId,
      agentId: runtime.agentId,
      roomId: message.roomId,
      content: {
        text: reply,
        attachments: [],
        target: 'DM',
        //channelType: 'DM',
        inReplyTo: createUniqueUuid(runtime, message.id)
      },
      // embedding
      // metadata: entityName, type, authorId
    })
  } else {
    responses.push({
      entityId,
      agentId: runtime.agentId,
      roomId: message.roomId,
      content: {
        text: reply,
        attachments: [],
        source: message.source,
        channelType: message.channelType,
        inReplyTo: createUniqueUuid(runtime, message.id)
      },
      // embedding
      // metadata: entityName, type, authorId
    })
  }
  return true
  //}
  //logger.warn('unknown platform', message.content.source)
  //return false
}

export function takeItPrivate(runtime, message, reply, responses) {
  if (responses === undefined) {
    console.trace()
    console.log('==')
    console.log('== takeItPrivate got old style')
    console.log('==')
  }
  //if (message.content.source === 'discord') {
  /*
  // ServiceType.DISCORD
  const discordService = runtime.getService('discord')
  if (!discordService) {
    logger.warn('no discord Service')
    return
  }
  discordService.sendDM(message.metadata.authorId, reply)
  */
  //console.log('message', message)
  //console.log('responses', responses)
  const entityId = createUniqueUuid(runtime, message.metadata.fromId);
  // clear all current messages
  responses.length = 0
  // add response
  responses.push({
    entityId,
    agentId: runtime.agentId,
    roomId: message.roomId,
    content: {
      text: reply,
      attachments: [],
      target: 'DM',
      inReplyTo: createUniqueUuid(runtime, message.id)
    },
    // embedding
    // metadata: entityName, type, authorId
  })


  return true
  //}
  //logger.warn('unknown platform', message.content.source)
  //return false
}