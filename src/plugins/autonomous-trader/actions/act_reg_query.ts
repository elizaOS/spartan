import {
  type IAgentRuntime,
  type Memory,
  type State,
  type ActionExample,
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { takeItPrivate } from '../utils'
import { EMAIL_TYPE } from '../constants'

export const checkRegistration: Action = {
  name: 'CHECK_REGISTRATION',
  similes: [
  ],
  // can only enter this if we don't have an email
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    //console.log('CHECK_REGISTRATION validate')
    return true
  },
  description: 'Allows a user to see if they are registered',
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
    const entityId = createUniqueUuid(runtime, message.metadata.authorId);
    const entity = await runtime.getEntityById(entityId)
    //console.log('sve:validate entity', entity)
    const email = entity.components.find(c => c.type === EMAIL_TYPE)
    console.log('CHECK_REGISTRATION', email, email?.data.verified)
    if (email) {
      // what stage we in?
      if (email.data.verified) {
        takeItPrivate(runtime, message, 'You are signed up under ' + email.data.address)
      } else {
        takeItPrivate(runtime, message, 'You are signed up under ' + email.data.address + ', waiting to be verified')
      }
    } else {
      takeItPrivate(runtime, message, 'You are not signed up')
    }
    responses.length = 0 // just clear them all
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
    [
      {
        name: '{{name1}}',
        content: {
          text: 'am I signed up for openai?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          actions: ['IGNORE'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'what is bob signed up under?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          actions: ['IGNORE'],
        },
      },
    ],
  ] as ActionExample[][],
}