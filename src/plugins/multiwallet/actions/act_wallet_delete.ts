import {
  type IAgentRuntime,
  type Action,
  type ActionExample,
  type Memory,
  type State,
  type HandlerCallback,
} from '@elizaos/core';
import { HasEntityIdFromMessage, getAccountFromMessage, getWalletsFromText, takeItPrivate, takeItPrivate2, accountMockComponent } from '../utils'
import CONSTANTS from '../constants'
import { interface_account_update } from '../interfaces/int_accounts'

// handle starting new form and collecting first field
export const userMetawalletDelete: Action = {
  name: 'USER_METAWALLET_DELETE',
  similes: [
  ],
  description: 'Allows a user to delete wallet they have',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    //console.log('USER_METAWALLET_DELETE validate', message?.metadata?.fromId)

    const traderChainService = runtime.getService('TRADER_CHAIN') as any;
    if (!traderChainService) return false
    const traderStrategyService = runtime.getService('TRADER_STRATEGY') as any;
    if (!traderStrategyService) return false

    if (!await HasEntityIdFromMessage(runtime, message)) {
      console.warn('USER_METAWALLET_DELETE validate - author not found')
      return false
    }

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
    console.log('USER_METAWALLET_DELETE handler')

    const sources = await getWalletsFromText(runtime, message)
    //console.log('sources', sources)
    if (sources.length !== 1) {
      callback(takeItPrivate(runtime, message, "Can't determine wallet to delete"))
      return
    }

    const componentData = await getAccountFromMessage(runtime, message)
    // find this wallet in the list...
    //console.log('componentData', componentData)
    const mw = componentData.metawallets.find(mw => mw.keypairs.solana.publicKey === sources[0])
    const idx = componentData.metawallets.indexOf(mw)
    if (idx === -1) {
      takeItPrivate2(runtime, message, "Can't find wallet " + sources[0] + " under your account", callback)
      return
    }
    //console.log('mw for', sources[0], mw, 'idx', idx)
    // Correctly remove item from array
    componentData.metawallets.splice(idx, 1);

    console.log('writing componentData', componentData)

    await interface_account_update(runtime, accountMockComponent(componentData))
    takeItPrivate2(runtime, message, "Wallet " + sources[0] + " deleted", callback)
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'delete wallet 3nMBmufBUBVnk28sTp3NsrSJsdVGTyLZYmsqpMFaUT9J',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "Here",
          actions: ['USER_METAWALLET_DELETE'],
        },
      },
    ],
  ] as ActionExample[][],
}