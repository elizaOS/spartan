import {
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { getAccountFromMessage, takeItPrivate, messageReply, HasEntityIdFromMessage, getDataFromMessage } from '../utils'
import { interface_account_update } from '../interfaces/int_accounts'
import CONSTANTS from '../constants'
const { Keypair } = require('@solana/web3.js');
import bs58 from 'bs58'

// handle starting new form and collecting first field
export const walletImportAction: Action = {
  name: 'WALLET_IMPORT',
  similes: [
  ],
  description: 'Allows a user to import a wallet without a strategy',
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

    const solanaService = runtime.getService('chain_solana') as any;
    const keys = solanaService.detectPrivateKeysFromString(message.content.text)
    if (!keys.length) return false;

    const account = await getAccountFromMessage(runtime, message)
    if (!account) return false; // require account

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
    console.log('WALLET_IMPORT handler')

    // using the service to get this/components might be good way
    //const email = await getDataFromMessage(runtime, message)
    const account = await getAccountFromMessage(runtime, message)
    if (!account) {
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

    const solanaService = runtime.getService('chain_solana') as any;
    const keys = solanaService.detectPrivateKeysFromString(message.content.text)
    console.log('keys', keys)
    const keypair = Keypair.fromSecretKey(keys[0].bytes);
    console.log('privateKeyB58', keypair)
    // keys[{ format, match, bytes }]

    console.log('account', account)
    //callback(takeItPrivate(runtime, message, 'Thinking about making a meta-wallet'))

    if (account.metawallets === undefined) account.metawallets = []
    const newWallet = {
      strategy: containsStrats?.[0] || 'LLM trading strategy',
      keypairs: {
        solana: {
          privateKey: bs58.encode(keypair.secretKey),
          publicKey: keypair.publicKey.toBase58(),
        }
      }
    }
    console.log('newWallet', newWallet)
    callback(takeItPrivate(runtime, message, 'Made a meta-wallet ' + JSON.stringify(newWallet) + ' please fund it to start trading'))

    account.metawallets.push(newWallet)
    // dev mode
    //newData.metawallets = [newWallet]
    await interface_account_update(runtime, account)
    /*
    await runtime.updateComponent({
      id: account.componentId,
      worldId: roomDetails.worldId,
      roomId: message.roomId,
      sourceEntityId: message.entityId,
      entityId: account.entityId,
      type: CONSTANTS.COMPONENT_ACCOUNT_TYPE,
      data: newData,
      agentId: runtime.agentId,
    });
    */
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'I want to import a wallet with this (base58 encoded) private key 4Vw7qoDQYMkicLcp1NSsyTjev8k7CvKBVWEUsRJgXMqsHB3iAVcQ11yiRiKXnLAXynHzNQQUrhC788fE9rcN1Ar4',
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
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Import wallet from 4Vw7qoDQYMkicLcp1NSsyTjev8k7CvKBVWEUsRJgXMqsHB3iAVcQ11yiRiKXnLAXynHzNQQUrhC788fE9rcN1Ar4',
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