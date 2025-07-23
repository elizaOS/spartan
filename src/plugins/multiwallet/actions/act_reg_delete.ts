import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  type ActionExample,
  type UUID,
  type Content,
} from '@elizaos/core';
import { takeItPrivate, HasEntityIdFromMessage, getDataFromMessage } from '../../autonomous-trader/utils'
import CONSTANTS from '../../autonomous-trader/constants'

export const deleteRegistration: Action = {
  name: 'DELETE_REGISTRATION',
  similes: [
  ],
  // can only enter this if we don't have an email
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    //console.log('DELETE_REGISTRATION validate')

    if (!await HasEntityIdFromMessage(runtime, message)) {
      console.warn('DELETE_REGISTRATION validate - author not found')
      return false
    }
    //console.log('entity', entity)

    const reg = await getDataFromMessage(runtime, message)
    // is it verified?
    if (!reg) return false; // can only clear what's set
    return true
  },
  description: 'Replies, allowing a user to delete their account with Spartan services.' + CONSTANTS.DESCONLYCALLME,
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback: HandlerCallback,
    responses: any[]
  ): Promise<boolean> => {
    console.log('DELETE_REGISTRATION handler')
    //console.log('message', message)

    //const roomDetails = await runtime.getRoom(message.roomId);
    // author entity for this runtime
    //const entityId = createUniqueUuid(runtime, message.metadata.fromId);

    const componentData = await getDataFromMessage(runtime, message)
    //console.log('newEmail', componentData)

    let output: Content | null = null
    if (componentData) {
      console.log('deleting', componentData)
      output = takeItPrivate(runtime, message, 'Just cleared your registration: ' + componentData.address)
      runtime.deleteComponent(componentData.componentId)
    } else {
      output = takeItPrivate(runtime, message, 'Cant find your registration')
    }
    callback(output)
    return true
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