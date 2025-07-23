import {
    type Action,
    type ActionExample,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    logger,
    createUniqueUuid,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { takeItPrivate, messageReply, HasEntityIdFromMessage, getDataFromMessage, getAccountFromMessage, accountMockComponent, getWalletsFromText } from '../../autonomous-trader/utils'
import { matchOption } from '../../autonomous-trader/util_matcher'

// handle changing strategy of an existing wallet
export const changeStrategy: Action = {
    name: 'WALLET_CHANGESTRAT',
    similes: [],
    description: 'Replies to user and changes the strategy of an existing wallet',
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        //console.log('WALLET_CHANGESTRAT validate', message?.metadata?.fromId)
        if (!await HasEntityIdFromMessage(runtime, message)) {
            console.warn('WALLET_CHANGESTRAT validate - author not found')
            return false
        }

        const traderChainService = runtime.getService('TRADER_CHAIN') as any;
        if (!traderChainService) {
            //console.warn('WALLET_CHANGESTRAT validate - TRADER_CHAIN not found')
            return false
        }
        const traderStrategyService = runtime.getService('TRADER_STRATEGY') as any;
        if (!traderStrategyService) {
            //console.warn('WALLET_CHANGESTRAT validate - TRADER_STRATEGY not found')
            return false
        }

        const account = await getAccountFromMessage(runtime, message)
        if (!account) {
            //console.log('WALLET_CHANGESTRAT validate - account not found')
            return false;
        }

        // Check if user has any wallets
        if (!account.metawallets || account.metawallets.length === 0) {
            //console.log('WALLET_CHANGESTRAT validate - no wallets found')
            return false;
        }

        // Check if a wallet is mentioned in the message
        const sources = await getWalletsFromText(runtime, message)
        if (sources.length === 0) {
            //console.log('WALLET_CHANGESTRAT validate - no wallet mentioned')
            return false;
        }

        // Check if a strategy is mentioned in the message
        const stratgiesList = await traderStrategyService.listActiveStrategies(account)
        const bestOption = matchOption(message.content.text, stratgiesList)

        // Return true if either a strategy is mentioned OR if they're asking to change strategy
        // This allows for both scenarios: "change strategy" (show list) and "change to X strategy" (direct change)
        return bestOption !== null || message.content.text.toLowerCase().includes('change') && message.content.text.toLowerCase().includes('strategy')
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: Memory[] = []
    ): Promise<boolean> => {
        console.log('WALLET_CHANGESTRAT handler')

        const componentData = await getAccountFromMessage(runtime, message)
        if (!componentData) {
            callback(takeItPrivate(runtime, message, "Account not found"))
            return false
        }

        const traderStrategyService = runtime.getService('TRADER_STRATEGY') as any;
        const stratgiesList = await traderStrategyService.listActiveStrategies(componentData)

        const bestOption = matchOption(message.content.text, stratgiesList)
        //console.log('bestOption', bestOption)

        // If no strategy is specified, show the list of available strategies
        if (!bestOption) {
            let responseText = "I'll help you change the strategy. Here are the available strategies:\n\n"
            for (const strategy of stratgiesList) {
                responseText += `- ${strategy}\n`
            }
            responseText += "\nPlease specify which strategy you'd like to change to."

            const output = takeItPrivate(runtime, message, responseText)
            callback(output)
            return true
        }

        // Get the wallet address from the message
        const sources = await getWalletsFromText(runtime, message)
        if (sources.length === 0) {
            callback(takeItPrivate(runtime, message, "I couldn't find a wallet address in your message. Please specify which wallet you want to change the strategy for."))
            return false
        }

        const targetWalletAddress = sources[0]
        console.log('WALLET_CHANGESTRAT targetWalletAddress', targetWalletAddress)

        // Find the wallet in the user's metawallets
        let targetWallet = null
        let walletIndex = -1

        for (let i = 0; i < componentData.metawallets.length; i++) {
            const wallet = componentData.metawallets[i]
            if (wallet.keypairs && wallet.keypairs.solana && wallet.keypairs.solana.publicKey === targetWalletAddress) {
                targetWallet = wallet
                walletIndex = i
                break
            }
        }

        if (!targetWallet) {
            callback(takeItPrivate(runtime, message, `I couldn't find a wallet with address ${targetWalletAddress} in your account. Please make sure you're using one of your own wallets.`))
            return false
        }

        // Store the old strategy for the response
        const oldStrategy = targetWallet.strategy

        // Update the wallet's strategy
        componentData.metawallets[walletIndex].strategy = bestOption

        // Update the account in the database
        console.log('writing componentData', componentData)
        const component = accountMockComponent(componentData)
        const intAcountService = runtime.getService('AUTONOMOUS_TRADER_INTERFACE_ACCOUNTS') as any;
        await intAcountService.interface_account_update(component)

        // Generate response
        let responseText = `Successfully changed the strategy for wallet ${targetWalletAddress} from "${oldStrategy}" to "${bestOption}".\n\n`

        const output = takeItPrivate(runtime, message, responseText)
        callback(output)

        return true
    },
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'I want to change the strategy of my wallet FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1 to X trading strategy',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll help you change the strategy",
                    actions: ['WALLET_CHANGESTRAT'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Change the strategy for wallet FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1 to X strategy',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll update the strategy for you",
                    actions: ['WALLET_CHANGESTRAT'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Update my wallet FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1 to use X trading strategy',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll update the strategy",
                    actions: ['WALLET_CHANGESTRAT'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Switch my wallet FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1 to X strategy',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll switch the strategy for you",
                    actions: ['WALLET_CHANGESTRAT'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Modify wallet FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1 to X trading strategy',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll modify the strategy",
                    actions: ['WALLET_CHANGESTRAT'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Set wallet FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1 to use X strategy',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll set the new strategy",
                    actions: ['WALLET_CHANGESTRAT'],
                },
            },
        ],
    ] as ActionExample[][],
}