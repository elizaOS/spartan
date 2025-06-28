import {
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { takeItPrivate, messageReply, HasEntityIdFromMessage, getDataFromMessage } from '../utils'
import { COMPONENT_USER_TYPE } from '../constants'

// handle starting new form and collecting first field
export const walletImportAction: Action = {
  name: 'WALLET_IMPORT',
  similes: [
  ],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    //console.log('WALLET_IMPORT validate')

    const traderChainService = runtime.getService('TRADER_CHAIN') as any;
    if (!traderChainService) return false
    const traderStrategyService = runtime.getService('TRADER_STRATEGY') as any;
    if (!traderStrategyService) return false

    if (!await HasEntityIdFromMessage(runtime, message)) {
      console.log('WALLET_IMPORT validate - author not found')
      return false
    }
    const reg = await getDataFromMessage(runtime, message)
    if (!reg) return false; // require validation
    return true
  },
  description: 'Allows a user to import a wallet without a strategy',
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback,
    responses: any[]
  ): Promise<boolean> => {
    console.log('WALLET_IMPORT handler')

    // using the service to get this/components might be good way
    const email = await getDataFromMessage(runtime, message)
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

    //console.log('email', email)
    const newData = email.data
    //console.log('newData', newData)

    if (newData.metawallets === undefined) newData.metawallets = []
    const newWallet = {
      strategy: containsStrats[0],
      keypairs: {
        solana: {
          privateKey: '',
          publicKey: '',
        }
      }
    }
    console.log('newWallet', newWallet)
    responses.length = 0 // just clear them all
    takeItPrivate(runtime, message, 'Made a meta-wallet ' + JSON.stringify(newWallet) + ' please fund it to start trading', responses)

    newData.metawallets.push(newWallet)
    // dev mode
    //newData.metawallets = [newWallet]

    await runtime.updateComponent({
      id: email.id,
      worldId: roomDetails.worldId,
      roomId: message.roomId,
      sourceEntityId: message.entityId,
      entityId: entityId,
      type: COMPONENT_USER_TYPE,
      data: newData,
      agentId: runtime.agentId,
    });
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'I want to import a wallet with this (base58 encoded) private key HZoGUehwBuXkFhTkkov7VkKDo2uhUKqdoijVb9vByE9B',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll import that now",
          actions: ['WALLET_IMPORT'],
        },
      },
    ],
  ] as ActionExample[][],
}