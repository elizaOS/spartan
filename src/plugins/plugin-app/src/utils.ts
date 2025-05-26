import {
  createUniqueUuid,
  logger,
} from '@elizaos/core';

export async function messageReply(runtime, message, reply, responses) {
  const roomDetails = await runtime.getRoom(message.roomId);
  if (message.content.source === 'discord') {
    // ServiceType.DISCORD
    const discordService = runtime.getService('discord')
    if (!discordService) {
      logger.warn('no discord Service')
      return
    }
    const isDM = roomDetails.type === 'dm'
    if (isDM) {
      discordService.sendDM(message.metadata.authorId, reply)
      responses.length = 0
    } else {
      responses.length = 0
      const entityId = createUniqueUuid(runtime, message.metadata.authorId);
      responses.push({
        entityId,
        agentId: runtime.agentId,
        roomId: message.roomId,
        content: {
          text: reply,
          attachments: [],
          inReplyTo: createUniqueUuid(runtime, message.id)
        },
        // embedding
        // metadata: entityName, type, authorId
      })
    }
    return true
  }
  logger.warn('unknown platform', message.content.source)
  return false
}

export function takeItPrivate(runtime, message, reply) {
  if (message.content.source === 'discord') {
    // ServiceType.DISCORD
    const discordService = runtime.getService('discord')
    if (!discordService) {
      logger.warn('no discord Service')
      return
    }
    discordService.sendDM(message.metadata.authorId, reply)
    return true
  }
  logger.warn('unknown platform', message.content.source)
  return false
}
