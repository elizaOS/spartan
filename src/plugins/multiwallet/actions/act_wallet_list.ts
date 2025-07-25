import {
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { HasEntityIdFromMessage, takeItPrivate, messageReply, getAccountFromMessage } from '../../autonomous-trader/utils'

// handle starting new form and collecting first field
export const userMetawalletList: Action = {
  name: 'USER_METAWALLET_LIST',
  similes: [
  ],
  description: 'Allows a user to list all wallet addresses they have',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    //console.log('USER_METAWALLET_LIST validate', message?.metadata?.fromId)
    if (!await HasEntityIdFromMessage(runtime, message)) {
      console.warn('MULTIWALLET_TRANSFER validate - author not found')
      return false
    }

    const traderChainService = runtime.getService('TRADER_CHAIN') as any;
    if (!traderChainService) return false
    const traderStrategyService = runtime.getService('TRADER_STRATEGY') as any;
    if (!traderStrategyService) return false

    const account = await getAccountFromMessage(runtime, message)
    if (!account) return false;

    return true
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback,
    responses: any[]
  ): Promise<boolean> => {
    //console.log('USER_METAWALLET_LIST handler')

    // should we check to see if we already a wallet with this strategy? no
    // they can have multiple
    const account = await getAccountFromMessage(runtime, message)
    //console.log('account', account)

    if (!account.metawallets) {
      const output = takeItPrivate(runtime, message, 'You don\'t have any wallets, do you want to make one?')
      callback(output)
      return
    }

    // metawallet
    //   strategy
    //   keypairs
    let wStr = 'List wallets: \n\n'
    if (!Object.values(account.metawallets).length) {
      // no keypairs?
      wStr += '  None'
    }

    function flushString() {
      const output = takeItPrivate(runtime, message, wStr)
      callback(output)
      wStr = ''
    }

    for(const mw of account.metawallets) {
      //console.log('mw', mw)
      wStr += 'Wallet:\n'
      wStr += '  Strategy: ' + mw.strategy + '\n'
      // mw.keypairs [{ chain, keypair {publicKey, privateKey} }]
      wStr += '  Keypairs: \n'
      for(const c in mw.keypairs) {
        const kp = mw.keypairs[c]
        //console.log('c', c, 'kp', kp)
        wStr += '    Chain: ' + c + ' Address:' + "\n"
        flushString(wStr)
        // a pause might be goodhere
        await new Promise(resolve => setTimeout(resolve, 100))
        wStr += kp.publicKey + "\n"
        flushString(wStr)
      }
      if (!Object.values(mw.keypairs).length) {
        // no keypairs?
        wStr += '    None'
      }
      wStr += '\n\n'
    }
    flushString(wStr)

    //const output = takeItPrivate(runtime, message, wStr)
    //callback(output)
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