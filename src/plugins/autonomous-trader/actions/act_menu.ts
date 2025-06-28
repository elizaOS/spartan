import {
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { getDataFromMessage, getAccountFromMessage, messageReply } from '../utils'
import CONSTANTS from '../constants'
const menutext = 'Heres what you can do'

export const servicesMenu: Action = {
  name: 'SERVICES_MENU',
  similes: [
  ],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    //console.log('SERVICES_MENU validate')
    return true
  },
  description: 'Explains/sells Spartan services. ' + CONSTANTS.DESCONLYCALLME,
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback,
    responses: any[]
  ): Promise<boolean> => {
    console.log('SERVICES_MENU handler')

    //console.log('message metadata', message.metadata)
    // sourceId will be a UUID

    const account = await getAccountFromMessage(runtime, message)
    //const signedup = await getDataFromMessage(runtime, message)
    //console.log('newEmail', account) // only gets data from component

    //await messageReply(runtime, message, 'You can ask me to create a (non-custodial) wallet', responses)
    //await messageReply(runtime, message, 'You can ask me to create a wallet for autonomous trading', responses)
    const responseContent = {
      text: account ? 'You can ask me to create a wallet (non-custodial) wallet for autonomous trading'
      : 'After you sign up, you can ask me to create a wallet (non-custodial) wallet for autonomous trading',
      // for the web UI
      //actions: ['REPLY'],
    };
    callback(responseContent)
    return
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
  ] as ActionExample[][],
}