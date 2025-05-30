import {
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { takeItPrivate, messageReply } from '../utils'
import { EMAIL_TYPE } from '../constants'

// handle starting new form and collecting first field
export const walletCreate: Action = {
  name: 'WALLET_CREATION',
  similes: [
  ],
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
    authorId: "580487826420793364",
  },
  createdAt: 1747348176395,
  embedding: [],
  callback: [AsyncFunction: callback],
  onComplete: undefined,
}
*/
    //console.log('sve:validate message', message)

    /*
    // if not a discord/telegram message, we can ignore it
    if (!message.metadata.authorId) return false

    // using the service to get this/components might be good way
    const entityId = createUniqueUuid(runtime, message.metadata.authorId);
    const entity = await runtime.getEntityById(entityId)
    //console.log('reg:validate entity', entity)
    const email = entity.components.find(c => c.type === EMAIL_TYPE)
    console.log('wallet_create:validate - are signed up?', !!email)
    return !!email
    */
    const traderChainService = runtime.getService('TRADER_STRATEGY') as any;
    return traderChainService
  },
  description: 'Allows a user to create a wallet',
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback,
    responses: any[]
  ): Promise<boolean> => {
    console.log('WALLET_CREATION handler')
    //console.log('message', message)

    // ok we need to change a state on this author

    // get room and it's components?
    //const roomDetails = await runtime.getRoom(message.roomId);
    // doesn't have components
    //console.log('roomDetails', roomDetails)
    //const roomEntity = await runtime.getEntityById(message.roomId)
    //console.log('roomEntity', roomEntity)

    // using the service to get this/components might be good way
    const entityId = createUniqueUuid(runtime, message.metadata.authorId);
    const entity = await runtime.getEntityById(entityId)
    //console.log('entity', entity)
    const email = entity.components.find(c => c.type === EMAIL_TYPE)
    //console.log('email', email)

    if (!email) {
      runtime.runtimeLogger.log('Not registered')
      //takeItPrivate(runtime, message, 'You need to sign up for my services first')
      messageReply(runtime, message, 'You need to sign up for my services first', responses)
      responses.length = 0 // just clear them all
      return
    }

    const traderChainService = runtime.getService('TRADER_STRATEGY') as any;
    const stratgiesList = await traderChainService.listActiveStrategies()
    console.log('stratgiesList', stratgiesList)
    takeItPrivate(runtime, message, 'Hrm youve already signed up, here are the available strategies: \n-' + stratgiesList.join('\n-') + '\n')
    responses.length = 0 // just clear them all
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
          actions: ['WALLET_CREATION'],
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
          actions: ['WALLET_CREATION'],
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
          actions: ['WALLET_CREATION'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'I want to trade with a friend',
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
          text: 'generate a wallet',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll help generate one, what trading strategy do you want to use?",
          actions: ['WALLET_CREATION'],
        },
      },
    ],
  ] as ActionExample[][],
}