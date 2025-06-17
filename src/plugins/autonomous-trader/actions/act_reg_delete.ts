import {
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { takeItPrivate } from '../utils'
import { EMAIL_TYPE } from '../constants'

export const deleteRegistration: Action = {
  name: 'DELETE_REGISTRATION',
  similes: [
  ],
  // can only enter this if we don't have an email
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    console.log('DELETE_REGISTRATION validate')

    // if not a discord/telegram message, we can ignore it
    if (!message.metadata.fromId) return false

    // using the service to get this/components might be good way
    // why generate this, instead of using message.entityId?
    //const entityId = createUniqueUuid(runtime, message.metadata.fromId);
    const entity = await runtime.getEntityById(message.entityId)
    if (!entity) {
      logger.warn('DELETE_REGISTRATION client did not set entity', message.entityId)
      return false;
    }
    const email = entity.components.find(c => c.type === EMAIL_TYPE)
    return email // can only clear what's set
  },
  description: 'Replies, allowing a user to delete their account with Spartan services',
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback,
    responses: any[]
  ): Promise<boolean> => {
    console.log('DELETE_REGISTRATION handler')
    //console.log('message', message)

    const roomDetails = await runtime.getRoom(message.roomId);
    // author entity for this runtime
    //const entityId = createUniqueUuid(runtime, message.metadata.fromId);

    const entity = await runtime.getEntityById(message.entityId)
    if (!entity) {
      logger.warn('client did not set entity')
      return false;
    }
    console.log('entity', entity)
    const existingComponent = entity.components.find(c => c.type === EMAIL_TYPE)
    /*
    const existingComponent = await runtime.getComponent(
      entityId,
      EMAIL_TYPE,
      roomDetails.worldId,
      message.entityId
    );
    console.log('existingComponent', existingComponent)
    */

    if (existingComponent) {
      console.log('deleting', existingComponent)
      takeItPrivate(runtime, message, 'Just cleared your registration: ' + existingComponent.data.address, responses)
      runtime.deleteComponent(existingComponent.id)
    } else {
      takeItPrivate(runtime, message, 'Cant find your registration', responses)
    }
    responses.length = 0 // just clear them all
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Please delete my registration',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll help you delete your registration",
          actions: ['DELETE_REGISTRATION'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'I can I delete my registration',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "Yes that's available",
          thought: "User is curious but we want confirmed before we act",
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Please delete my email on openai',
        },
      },
      {
        name: '{{name2}}',
        content: {
          actions: ['IGNORE'],
        },
      },
    ], [
      {
        name: '{{name1}}',
        content: {
          text: 'Please delete my signup on user@email.com',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll help you delete your registration",
          actions: ['DELETE_REGISTRATION'],
        },
      },
    ],
  ] as ActionExample[][],
}