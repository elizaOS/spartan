import {
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { takeItPrivate, messageReply } from '../utils'
import { EMAIL_TYPE } from '../constants'

// handle starting new form and collecting first field
export const userMetawalletList: Action = {
  name: 'USER_METAWALLET_LIST',
  similes: [
  ],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    //console.log('USER_METAWALLET_LIST validate', message?.metadata?.fromId)
    if (!message?.metadata?.fromId) {
      console.log('USER_METAWALLET_LIST validate - author not found')
      return false
    }

    //const entityId = createUniqueUuid(runtime, message.metadata.fromId);
    //if (entityId === null) return false;
    const entity = await runtime.getEntityById(message.entityId)
    if (!entity) {
      logger.warn('USER_METAWALLET_LIST client did not set entity')
      return false;
    }
    //console.log('entity', entity)
    const reg = !!entity.components.find(c => c.type === EMAIL_TYPE)
    if (!reg) return false;

    const traderChainService = runtime.getService('TRADER_CHAIN') as any;
    if (!traderChainService) return false
    const traderStrategyService = runtime.getService('TRADER_STRATEGY') as any;
    if (!traderStrategyService) return false
    return true
  },
  description: 'Allows a user to list all wallets they have',
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback,
    responses: any[]
  ): Promise<boolean> => {
    console.log('USER_METAWALLET_LIST handler')

    // using the service to get this/components might be good way
    //const entityId = createUniqueUuid(runtime, message.metadata.fromId);
    const entity = await runtime.getEntityById(message.entityId)
    //console.log('entity', entity)
    const email = entity.components.find(c => c.type === EMAIL_TYPE)
    //console.log('email', email)

    // should never hit it
    if (!email) {
      runtime.logger.log('Not registered')
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
    /*
    const traderChainService = runtime.getService('TRADER_CHAIN') as any;
    const chains = await traderChainService.listActiveChains()
    console.log('chains', chains)
    */
    if (!email.data.metawallets) {
      responses.length = 0 // just clear them all
      takeItPrivate(runtime, message, 'You don\'t have any wallets, do you want to make one?', responses)
      return
    }

    /*
    [{"keypairs":{"Solana":{"publicKey":"CPNHuuGHpskEp4Fmr8cg9x6ZyEMokYvJTaBST5gywqA2","privateKey":"4vcbDoRNsRjmLSJEQjYFBi2ooG5EAY61t8K39vkNBoHaFSvcRmXB9imHx3azhMLxcPcPw67SCdEZYhKiAQDa1Y9Y"}},"strategy":"LLM trading strategy"}]
    */

    // metawallet
    //   strategy
    //   keypairs
    let wStr = '\n\n'
    for(const mw of email.data.metawallets) {
      //console.log('mw', mw)
      wStr += 'Wallet:\n'
      wStr += '  Strategy: ' + mw.strategy + '\n'
      // mw.keypairs [{ chain, keypair {publicKey, privateKey} }]
      // ' + JSON.stringify(mw.keypairs) +
      wStr += '  Keypairs: \n'
      // no keypairs?
      for(const c in mw.keypairs) {
        const kp = mw.keypairs[c]
        //console.log('c', c, 'kp', kp)
        wStr += '    Chain: ' + c + "\n"
        wStr += '    Address: ' + kp.publicKey + "\n"
      }
      wStr += '\n\n'
    }

    responses.length = 0 // just clear them all
    takeItPrivate(runtime, message, 'List wallets: ' + wStr, responses)
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'What wallets do I have',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "Here",
          actions: ['USER_METAWALLET_LIST'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'list wallets',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "Here",
          actions: ['USER_METAWALLET_LIST'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'I want list all my wallets for you',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'What?',
        },
      },
    ],
  ] as ActionExample[][],
}