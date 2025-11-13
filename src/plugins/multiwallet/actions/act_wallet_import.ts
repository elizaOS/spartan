import {
  createUniqueUuid,
  logger,
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  ActionExample,
  HandlerOptions,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { HasEntityIdFromMessage, getAccountFromMessage, takeItPrivate, messageReply, getDataFromMessage, accountMockComponent } from '../../autonomous-trader/utils'
import CONSTANTS from '../../autonomous-trader/constants'
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

    runtime.logger.debug(
      `WALLET_IMPORT validate start messageId=${message.id ?? 'unknown'} roomId=${message.roomId}`
    );

    const traderChainService = runtime.getService('INTEL_CHAIN') as any;
    if (!traderChainService) {
      runtime.logger.debug('WALLET_IMPORT validate skipped: INTEL_CHAIN service missing');
      return false;
    }
    const traderStrategyService = runtime.getService('TRADER_STRATEGY') as any;
    if (!traderStrategyService) {
      runtime.logger.debug('WALLET_IMPORT validate skipped: TRADER_STRATEGY service missing');
      return false;
    }
    const intAccountService = runtime.getService('AUTONOMOUS_TRADER_INTERFACE_ACCOUNTS') as any;
    if (!intAccountService) {
      runtime.logger.debug('WALLET_IMPORT validate skipped: AUTONOMOUS_TRADER_INTERFACE_ACCOUNTS service missing');
      return false;
    }

    if (!await HasEntityIdFromMessage(runtime, message)) {
      runtime.logger.debug(
        `WALLET_IMPORT validate skipped: author entity not found messageId=${message.id ?? 'unknown'}`
      );
      return false;
    }

    const solanaService = runtime.getService('chain_solana') as any;
    if (!solanaService) {
      runtime.logger.debug('WALLET_IMPORT validate skipped: chain_solana service missing');
      return false;
    }

    const messageText = message.content.text ?? '';
    runtime.logger.debug(
      `WALLET_IMPORT validate analyzing message text length=${messageText.length} sample=${messageText.slice(0, 80)}`
    );

    let detectedKeysByChain: Array<{ chain: string; keys: any[] }> = [];
    try {
      detectedKeysByChain = await traderChainService.detectPrivateKeysFromString(messageText);
      runtime.logger.debug(
        `WALLET_IMPORT validate chain detection results chains=${detectedKeysByChain.length}`
      );
    } catch (error) {
      const err = error as Error;
      runtime.logger.error(
        `WALLET_IMPORT validate failed to run chain detection: ${err.message}`
      );
    }

    const solanaDetected = detectedKeysByChain.find(
      result => result.chain?.toLowerCase() === 'solana'
    );
    const solanaKeys = solanaDetected?.keys ?? [];

    if (!solanaKeys.length) {
      runtime.logger.debug('WALLET_IMPORT validate falling back to direct Solana detection');
      const keys = solanaService.detectPrivateKeysFromString(messageText);
      runtime.logger.debug(`WALLET_IMPORT validate solana fallback detected keys count=${keys.length}`);
      if (!keys.length) {
        runtime.logger.debug('WALLET_IMPORT validate skipped: no private keys detected');
        return false;
      }
    } else {
      runtime.logger.debug(
        `WALLET_IMPORT validate solana keys detected via chain service count=${solanaKeys.length}`
      );
    }

    const account = await getAccountFromMessage(runtime, message);
    if (!account) {
      runtime.logger.debug(
        `WALLET_IMPORT validate skipped: account not resolved messageId=${message.id ?? 'unknown'}`
      );
      return false; // require account
    }

    runtime.logger.debug(
      `WALLET_IMPORT validate passed messageId=${message.id ?? 'unknown'} accountId=${account?.entityId ?? 'unknown'}`
    );

    return true
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: HandlerOptions,
    callback?: HandlerCallback,
    responses?: Memory[]
  ): Promise<void> => {
    console.log('WALLET_IMPORT handler')

    // using the service to get this/components might be good way
    //const email = await getDataFromMessage(runtime, message)
    const account = await getAccountFromMessage(runtime, message)
    if (!account) {
      runtime.logger.info('Not registered')
      return
    }

    const roomDetails = await runtime.getRoom(message.roomId);

    const traderStrategyService = runtime.getService('TRADER_STRATEGY') as any;
    const stratgiesList = await traderStrategyService.listActiveStrategies(account)
    // maybe we use an LLM call to get their exact meaning
    const containsStrats = stratgiesList.filter(word => message.content.text?.includes(word))
    console.log('containsStrats', containsStrats)
    //takeItPrivate(runtime, message, 'Hrm you\'ve selected a strategy, time to make a wallet')

    // should we check to see if we already a wallet with this strategy? no
    // they can have multiple


    // create meta wallet container on this registration
    // or import into existing meta wallet?

    // which chains
    const traderChainService = runtime.getService('INTEL_CHAIN') as any;
    const chains = await traderChainService.listActiveChains()
    console.log('chains', chains)

    const solanaService = runtime.getService('chain_solana') as any;
    const messageText = message.content.text ?? '';
    let detectedKeysByChain: Array<{ chain: string; keys: any[] }> = [];
    try {
      detectedKeysByChain = await traderChainService.detectPrivateKeysFromString(messageText);
      runtime.logger.debug(
        `WALLET_IMPORT handler chain detection results chains=${detectedKeysByChain.length}`
      );
    } catch (error) {
      const err = error as Error;
      runtime.logger.error(
        `WALLET_IMPORT handler failed to run chain detection: ${err.message}`
      );
    }

    const solanaDetected = detectedKeysByChain.find(
      result => result.chain?.toLowerCase() === 'solana'
    );

    let solanaKey = solanaDetected?.keys?.[0];
    if (!solanaKey) {
      const fallbackKeys = solanaService.detectPrivateKeysFromString(messageText);
      runtime.logger.debug(
        `WALLET_IMPORT handler solana fallback detected keys count=${fallbackKeys.length}`
      );
      solanaKey = fallbackKeys[0];
    } else {
      runtime.logger.debug('WALLET_IMPORT handler using solana key detected via chain service');
    }

    if (!solanaKey?.bytes) {
      runtime.logger.warn('WALLET_IMPORT handler unable to resolve Solana private key bytes');
      return;
    }

    const keypair = Keypair.fromSecretKey(solanaKey.bytes);
    //console.log('privateKeyB58', keypair)
    // keys[{ format, match, bytes }]

    console.log('account', account)
    //callback(takeItPrivate(runtime, message, 'Thinking about making a meta-wallet'))

    if (account.metawallets === undefined) account.metawallets = []
    const strat = containsStrats?.[0] || 'No trading strategy'
    const newWallet = {
      strategy: strat,
      keypairs: {
        solana: {
          privateKey: bs58.encode(keypair.secretKey),
          publicKey: keypair.publicKey.toBase58(),
          type: 'imported',
          createdAt: Date.now(),
        },
      }
    }
    console.log('newWallet', newWallet)

    let str = '\n'
    str += '  Strategy: ' + strat + '\n'
    str += '  Chain: solana\n'
    //str += '    Private key: ' + newWallet.keypairs.solana.privateKey + ' (Write this down/save it somewhere safe, we will not show this again. This key allows you to spend the funds)\n'
    str += '    Public key: ' + newWallet.keypairs.solana.publicKey + ' (This is the wallet address that you can publicly send to people)\n'

    callback?.(takeItPrivate(runtime, message, 'Made a meta-wallet ' + str + ' please fund it to start trading'))

    account.metawallets.push(newWallet)
    // dev mode
    //newData.metawallets = [newWallet]
    //await interface_account_update(runtime, account)
    const intAccountService = runtime.getService('AUTONOMOUS_TRADER_INTERFACE_ACCOUNTS') as any;
    console.log('account', account)
    const component = accountMockComponent(account)
    console.log('component', component)
    await intAccountService.interface_account_upsert(message, component)
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