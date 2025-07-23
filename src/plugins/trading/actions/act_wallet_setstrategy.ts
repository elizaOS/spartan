import {
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { takeItPrivate, messageReply, HasEntityIdFromMessage, getDataFromMessage, getAccountFromMessage, accountMockComponent } from '../../autonomous-trader/utils'
import { matchOption } from '../../autonomous-trader/util_matcher'
//import { interface_account_upsert } from '../interfaces/int_accounts'

// handle starting new form and collecting first field
export const setStrategy: Action = {
  name: 'WALLET_SETSTRAT',
  similes: [],
  description: 'Replies to user and creates a wallet with a specified strategy',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    //console.log('WALLET_SETSTRAT validate', message?.metadata?.fromId)
    if (!await HasEntityIdFromMessage(runtime, message)) {
      console.warn('WALLET_SETSTRAT validate - author not found')
      return false
    }

    const traderChainService = runtime.getService('TRADER_CHAIN') as any;
    if (!traderChainService) {
      //console.warn('WALLET_SETSTRAT validate - TRADER_CHAIN not found')
      return false
    }
    const traderStrategyService = runtime.getService('TRADER_STRATEGY') as any;
    if (!traderStrategyService) {
      //console.warn('WALLET_SETSTRAT validate - TRADER_STRATEGY not found')
      return false
    }

    const account = await getAccountFromMessage(runtime, message)
    if (!account) {
      //console.log('WALLET_SETSTRAT validate - account not found')
      return false;
    }

    // FIXME: create synonyms?

    const stratgiesList = await traderStrategyService.listActiveStrategies(account)
    const bestOption = matchOption(message.content.text, stratgiesList)

    // normal to be null
    if (bestOption !== null) {
      console.log('WALLET_SETSTRAT bestOption', bestOption)
    }
    return bestOption !== null
  },
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

    const traderStrategyService = runtime.getService('TRADER_STRATEGY') as any;
    const componentData = await getAccountFromMessage(runtime, message)
    const stratgiesList = await traderStrategyService.listActiveStrategies(componentData)
    // maybe we use an LLM call to get their exact meaning
    //const containsStrats = stratgiesList.filter(word => message.content.text.toUpperCase().includes(word.toUpperCase()))
    //console.log('containsStrats', containsStrats)

    const bestOption = matchOption(message.content.text, stratgiesList)
    //console.log('bestOption', bestOption)
    if (!bestOption) {
      callback(takeItPrivate(runtime, message, "I don't understand which strategy you're asking for"))
      return
    }

    //callback(takeItPrivate(runtime, message, 'Hrm you\'ve selected a strategy, time to make a wallet'))

    // should we check to see if we already a wallet with this strategy? no
    // they can have multiple


    // create meta wallet container on this registration

    // which chains
    const traderChainService = runtime.getService('TRADER_CHAIN') as any;
    const chains = await traderChainService.listActiveChains()
    //console.log('chains', chains)

    if (componentData.metawallets === undefined) componentData.metawallets = []
    const newWallet = {
      strategy: bestOption,
    }
    const keypairs = await traderChainService.makeKeypairs()
    const ts = Date.now()
    for(const chain in keypairs) {
      const kp = keypairs[chain]
      kp.createdAt = ts
      kp.type = 'generated'
    }
    //console.log('keypairs', keypairs)
    newWallet.keypairs = keypairs
    //console.log('new MetaWallet', newWallet)

    //responses.length = 0 // just clear them all
    if (!newWallet.strategy) {
      const output = takeItPrivate(runtime, message, 'Something went wrong')
      callback(output)
      return
    }

    let str = ''
    for(const c in keypairs) {
      const kp = keypairs[c]
      str += '  Chain: ' + c + '\n'
      str += '    Private key: ' + kp.privateKey + ' (Write this down/save it somewhere safe, we will not show this again. This key allows you to spend the funds)\n'
      str += '    Public key: ' + kp.publicKey + ' (This is the wallet address that you can publicly send to people)\n'
    }

    const output = takeItPrivate(runtime, message, 'Made a meta-wallet\n' + str + ' please fund it with SOL to start trading')
    callback(output)

    componentData.metawallets.push(newWallet)
    // dev mode
    //componentData.metawallets = [newWallet]

    console.log('writing componentData', componentData)
    const component = accountMockComponent(componentData)
    const intAcountService = runtime.getService('AUTONOMOUS_TRADER_INTERFACE_ACCOUNTS') as any;
    await intAcountService.interface_account_upsert(message, component)
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
    [
      {
        name: '{{name1}}',
        content: {
          text: 'make me an X trading strategy wallet',
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
    [
      {
        name: '{{name1}}',
        content: {
          text: 'create X trading strategy',
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