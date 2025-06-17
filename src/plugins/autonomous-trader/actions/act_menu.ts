import {
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { messageReply } from '../utils'
import { EMAIL_TYPE } from '../constants'

const menutext = 'Heres what you can do'

export const servicesMenu: Action = {
  name: 'SERVICES_MENU',
  similes: [
  ],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    //console.log('SERVICES_MENU validate')
    return true
  },
  description: 'Explains/sells Spartan services',
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback,
    responses: any[]
  ): Promise<boolean> => {
    console.log('SERVICES_MENU handler')

    // is this in a DM or room?
    //console.log('message', message)
/*
  id: "f957ad11-946b-067d-ae2c-76be96a0fe0b",
  entityId: "36ab9481-0939-0d2e-be06-f2ba5bf3a917",
  agentId: "479233fd-b0e7-0f50-9d88-d4c9ea5b0de0",
  roomId: "c8936fc3-f950-0a59-8b19-a2bd342c0cb8",
  content: {
    text: "so what I can I do?",
    attachments: [],
    source: "discord",
    url: "https://discord.com/channels/@me/1366955975667482685/1374489835565224136",
    inReplyTo: undefined,
  },
  metadata: {
    entityName: "Odilitime",
    type: "message",
    fromId: "580487826420793364",
  },

*/

    // get room and it's components?
    //const roomDetails = await runtime.getRoom(message.roomId);
    // doesn't have components
    //console.log('roomDetails', roomDetails)

    //const isGroup = roomDetails.type === 'group'
    //const isDM = roomDetails.type === 'dm'

    //const entityId = createUniqueUuid(runtime, message.metadata.fromId);
    const entity = await runtime.getEntityById(message.entityId)
    if (!entity) {
      logger.warn('SERVICES_MENU client did not set entity')
      return false;
    }
    //console.log('SERVICES_MENU entity', entity)
    const signedup = entity.components.find(c => c.type === EMAIL_TYPE)

    await messageReply(runtime, message, 'You can ask me to create a wallet for autonomous trading', responses)
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'What are Spartan services',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: menutext,
          actions: ['SERVICES_MENU'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'What can I do?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: menutext,
          actions: ['SERVICES_MENU'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'menu',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: menutext,
          actions: ['SERVICES_MENU'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'What can I do with openai?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "IDK, ask them"
        },
      },
    ],
  ] as ActionExample[][],
}