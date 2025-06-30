import {
  type IAgentRuntime,
  type Memory,
  type State,
  type ActionExample,
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { takeItPrivate, HasEntityIdFromMessage, getDataFromMessage, getAccountFromMessage } from '../utils'
import CONSTANTS from '../constants'

// probably should be a provider
export const checkRegistration: Action = {
  name: 'CHECK_REGISTRATION',
  similes: [
  ],
  // can only enter this if we don't have an email
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    //console.log('CHECK_REGISTRATION validate')
    if (!await HasEntityIdFromMessage(runtime, message)) {
      console.log('CHECK_REGISTRATION validate - author not found')
      return false
    }
    return true
  },
  description: 'Replies with if a user is registered or not. Does not check codes for completing registrations.' + CONSTANTS.DESCONLYCALLME,
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback,
    responses: any[]
  ): Promise<boolean> => {
    console.log('CHECK_REGISTRATION handler')
    // using the service to get this/components might be good way

    //console.log('entity', entity)
    const componentData = await getDataFromMessage(runtime, message)
    console.log('user component', componentData)

    //const account = await getAccountFromMessage(runtime, message)

    console.log('CHECK_REGISTRATION verified?', componentData?.verified)
    //responses.length = 0 // just clear them all
    let output = false
    if (componentData) {
      //console.log('componentData', componentData)
      // what stage we in?
      if (componentData.verified) {
        output = takeItPrivate(runtime, message, 'You are signed up under ' + componentData.address)
      } else {
        output = takeItPrivate(runtime, message, 'You are signed up under ' + componentData.address + ', waiting to be verified')
      }
    } else {
      output = takeItPrivate(runtime, message, 'You are not signed up. Would you like to sign up, just provide me an email address?')
    }
    callback(output)
    //console.log('CHECK_REGISTRATION outResponses', responses)
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'am I signed up?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll check for you",
          actions: ['CHECK_REGISTRATION'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'am I registered?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll check for you",
          actions: ['CHECK_REGISTRATION'],
        },
      },
    ],
  ] as ActionExample[][],
}