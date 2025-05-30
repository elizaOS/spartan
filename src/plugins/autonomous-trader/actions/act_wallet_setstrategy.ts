import {
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { takeItPrivate, messageReply } from '../utils'
import { EMAIL_TYPE } from '../constants'

// handle starting new form and collecting first field
export const setStrategy: Action = {
  name: 'WALLET_SETSTRAT',
  similes: [
  ],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    console.log('WALLET_SETSTRAT validate', message?.metadata?.authorId)
    if (!message?.metadata?.authorId) {
      console.log('WALLET_SETSTRAT validate - author not found')
      return false
    }

    const entityId = createUniqueUuid(runtime, message.metadata.authorId);
    if (entityId === null) return false;
    const entity = await runtime.getEntityById(entityId)
    //console.log('entity', entity)
    const reg = !!entity.components.find(c => c.type === EMAIL_TYPE)
    if (!reg) return false;

    const traderChainService = runtime.getService('TRADER_CHAIN') as any;
    if (!traderChainService) return false
    const traderStrategyService = runtime.getService('TRADER_STRATEGY') as any;
    if (!traderStrategyService) return false
    const stratgiesList = await traderStrategyService.listActiveStrategies()
    // maybe sub words?
    const containsStrat = stratgiesList.some(word => message.content.text.includes(word))
    console.log('containsStrat', containsStrat, message.content.text)
    return containsStrat
  },
  description: 'Allows a user to create a wallet with a strategy',
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback,
    responses: any[]
  ): Promise<boolean> => {
    console.log('WALLET_SETSTRAT handler')

    // using the service to get this/components might be good way
    const entityId = createUniqueUuid(runtime, message.metadata.authorId);
    const entity = await runtime.getEntityById(entityId)
    //console.log('entity', entity)
    const email = entity.components.find(c => c.type === EMAIL_TYPE)
    //console.log('email', email)

    // should never hit it
    if (!email) {
      runtime.runtimeLogger.log('Not registered')
      return
    }
    const roomDetails = await runtime.getRoom(message.roomId);

    const traderStrategyService = runtime.getService('TRADER_STRATEGY') as any;
    const stratgiesList = await traderStrategyService.listActiveStrategies()
    // maybe we use an LLM call to get their exact meaning
    const containsStrats = stratgiesList.filter(word => message.content.text.includes(word))
    console.log('containsStrats', containsStrats)
    //takeItPrivate(runtime, message, 'Hrm you\'ve selected a strategy, time to make a wallet')

    // should we check to see if we already a wallet with this strategy? no
    // they can have multiple


    // create meta wallet container on this registration

    // which chains
    const traderChainService = runtime.getService('TRADER_CHAIN') as any;
    const chains = await traderChainService.listActiveChains()
    console.log('chains', chains)

    const newData = email.data
    if (newData.metawallets === undefined) newData.metawallets = []
    const newWallet = {
      strategy: containsStrats[0],
    }
    const keypairs = {}
    for(const c of chains) {
      console.log('chain', c)
      const kp = await traderChainService.makeKeypair(c)
      console.log('kp', kp)
      keypairs[c] = kp
    }
    newWallet.keypairs = keypairs
    console.log('newWallet', newWallet)
    takeItPrivate(runtime, message, 'Made a meta-wallet ' + JSON.stringify(newWallet) + ' please fund it to start trading')

    newData.metawallets.push(newWallet)
    // dev mode
    newData.metawallets = [newWallet]

    await runtime.updateComponent({
      id: email.id,
      worldId: roomDetails.worldId,
      roomId: message.roomId,
      sourceEntityId: message.entityId,
      entityId: entityId,
      type: EMAIL_TYPE,
      data: newData,
      agentId: runtime.agentId,
    });


    responses.length = 0 // just clear them all
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'I want to create a wallet for autonomous trading using X trading strategy',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll help you get started",
          actions: ['WALLET_SETSTRAT'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'I want to autotrade with X trading strategy',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "Based",
          actions: ['WALLET_SETSTRAT'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'I\'d like to trade via X trading strategy',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "Based",
          actions: ['WALLET_SETSTRAT'],
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
          text: 'generate a wallet using X trading strategy',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll help generate one",
          actions: ['WALLET_SETSTRAT'],
        },
      },
    ],
  ] as ActionExample[][],
}