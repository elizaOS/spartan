import {
  createUniqueUuid,
  logger,
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  HandlerOptions,
  ActionExample,
  ActionResult,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { takeItPrivate, messageReply, HasEntityIdFromMessage, getAccountFromMessage, getDataFromMessage } from '../../autonomous-trader/utils'

// handle starting new form and collecting first field
// maybe combine with setstrategy, so the mode can help steer outcome
export const walletCreate: Action = {
  name: 'WALLET_OPTIONS',
  similes: [
  ],
  description: 'Replies, and gives a list of available strategies that you can make a wallet with',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    //console.log('WALLET_CREATION validate')
    /*
    sve:validate message {
      id: "1e574bcc-7d3d-04de-bb2e-a58ec153832f",
      entityId: "36ab9481-0939-0d2e-be06-f2ba5bf3a917",
      agentId: "479233fd-b0e7-0f50-9d88-d4c9ea5b0de0",
      roomId: "c8936fc3-f950-0a59-8b19-a2bd342c0cb8",
      content: {
        text: "x@y.cc",
        attachments: [],
        source: "discord",
        url: "https://discord.com/channels/@me/1366955975667482685/1372702486644916354",
        inReplyTo: undefined,
      },
      metadata: {
        entityName: "Odilitime",
        fromId: "580487826420793364",
      },
      createdAt: 1747348176395,
      embedding: [],
      callback: [AsyncFunction: callback],
      onComplete: undefined,
    }
    */
    //console.log('sve:validate message', message)

    // they have to be registered
    if (!await HasEntityIdFromMessage(runtime, message)) {
      //console.log('WALLET_CREATION validate - author not found')
      return false
    }

    const account = await getAccountFromMessage(runtime, message)
    if (!account) {
      //console.log('WALLET_CREATION validate - account not found')
      return false;
    }

    const traderChainService = runtime.getService('TRADER_STRATEGY') as any;
    return traderChainService
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State | undefined,
    _options: HandlerOptions | undefined,
    callback?: HandlerCallback,
    responses?: Memory[]
  ): Promise<ActionResult | void | undefined> => {
    console.log('WALLET_CREATION handler')
    //console.log('message', message)

    // Hrm youve already signed up,
    const traderChainService = runtime.getService('TRADER_STRATEGY') as any;
    const account = await getAccountFromMessage(runtime, message)
    //console.log('account', account)
    const stratgiesList = await traderChainService.listActiveStrategies(account)
    //console.log('stratgiesList', stratgiesList)
    const output = takeItPrivate(runtime, message, 'Please select an available strategies for the wallet: \n-' + stratgiesList.join('\n-') + '\n')
    callback?.(output)
    return {
      success: true,
      text: 'Wallet options provided successfully'
    }
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'I want to create a wallet for autonomous trading',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll help you get started",
          actions: ['WALLET_OPTIONS'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'I want to autotrade',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "What strategy u wanna use",
          actions: ['WALLET_OPTIONS'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'I\'d like to trade',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "based. what strategy u want me to use",
          actions: ['WALLET_OPTIONS'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'generate a wallet',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll help generate one, what trading strategy do you want to use?",
          actions: ['WALLET_OPTIONS'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'can you create a wallet for me?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "First you need to sign up",
          actions: ['WALLET_OPTIONS'],
        },
      },
    ],
  ] as ActionExample[][],
}