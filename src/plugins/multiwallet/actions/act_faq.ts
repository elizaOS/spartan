import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  type ActionExample,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { getDataFromMessage, getAccountFromMessage, messageReply } from '../../autonomous-trader/utils'
import { matchOptions } from '../../autonomous-trader/util_matcher'
import CONSTANTS from '../../autonomous-trader/constants'

const menutext = 'Heres an answer to your frequently asked question'

const db = {
  'Answer1': ['Question1', 'Question2'],
  'Answer2': ['Question3', 'Question4'],
}

export const actionFrequentlyAsked: Action = {
  name: 'ACT_ANSWER_FREQ_ASK_Q',
  similes: [
  ],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    //console.log('ACT_ANSWER_FREQ_ASK_Q validate')
    return true
  },
  description: 'Answers questions about Spartan services. ' + CONSTANTS.DESCONLYCALLME,
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback: HandlerCallback,
    responses: any[]
  ): Promise<boolean> => {
    console.log('ACT_ANSWER_FREQ_ASK_Q handler')

    const question = message.content.text
    //matchOption(question, [])

    const account = await getAccountFromMessage(runtime, message)
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
          text: 'faqs',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: menutext,
          actions: ['ACT_ANSWER_FREQ_ASK_Q'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'how do I reset my registration?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: menutext,
          actions: ['ACT_ANSWER_FREQ_ASK_Q'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'give me a sign up link',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: menutext,
          actions: ['ACT_ANSWER_FREQ_ASK_Q'],
        },
      },
    ],
  ] as ActionExample[][],
}