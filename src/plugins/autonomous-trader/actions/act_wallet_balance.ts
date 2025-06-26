import {
    type Action,
    type ActionExample,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    ModelType,
    type State,
    composePromptFromState,
    logger,
    createUniqueUuid,
    parseJSONObjectFromText,
} from '@elizaos/core';
import {
    PublicKey,
} from '@solana/web3.js';
import { v4 as uuidv4 } from 'uuid';
import { UUID } from 'crypto';
import { SOLANA_SERVICE_NAME } from '../constants';
import { getAccountFromMessage } from '../utils'

/**
 * Interface representing the content of a balance check request.
 *
 * @interface BalanceCheckContent
 * @extends Content
 * @property {string | null} walletAddress - The address of the wallet to check balance for, or null for any wallet
 */
interface BalanceCheckContent extends Content {
    walletAddress: string | null;
}

/**
 * Template for determining which wallet address to check balance for.
 */
const sourceAddressTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Recent Messages:
{{recentMessages}}

Extract the following information about the requested balance check:
- Wallet address to check balance for (if user specifies a specific address, otherwise use null)

Example responses:
If user specifies an address:
\`\`\`json
{
    "walletAddress": "FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1"
}
\`\`\`

If user just asks for "my balance" or "check balance":
\`\`\`json
{
    "walletAddress": null
}
\`\`\`

Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the JSON response format without any preamble or explanation.

IMPORTANT: Your response must ONLY contain the json block above. Do not include any text, thinking, or reasoning before or after this JSON block. Start your response immediately with { and end with }.`;

export default {
    name: 'WALLET_BALANCE',
    similes: [
        'WALLET_BALANCE_CHECK',
        'WALLET_BALANCE_QUERY',
        'WALLET_BALANCE_LOOKUP',
        'WALLET_BALANCE_INFO',
        'WALLET_BALANCE_DETAILS',
        'WALLET_BALANCE_SUMMARY',
        'WALLET_BALANCE_REPORT',
        'WALLET_BALANCE_STATUS',
        'WALLET_BALANCE_OVERVIEW',
        'WALLET_BALANCE_VIEW',
        'WALLET_BALANCE_DISPLAY',
        'WALLET_BALANCE_SHOW',
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        if (!message?.metadata?.sourceId) {
            console.log('WALLET_BALANCE validate - author not found')
            return false
        }

        const account = await getAccountFromMessage(runtime, message)
        if (!account) return false;

        return true;
    },
    description: 'Get the balance of SOL and SPL tokens in a specified Solana wallet or any wallet registered under the user.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: Memory[] = []
    ): Promise<boolean> => {
        logger.log('WALLET_BALANCE Starting balance check handler...');

        const sourcePrompt = composePromptFromState({
            state: state,
            template: sourceAddressTemplate,
        });
        const sourceResult = await runtime.useModel(ModelType.OBJECT_LARGE, {
            prompt: sourcePrompt,
        });
        console.log('WALLET_BALANCE sourceResult', sourceResult)

        const content = parseJSONObjectFromText(sourceResult) as BalanceCheckContent;
        if (!content) {
            console.log('WALLET_BALANCE failed to parse response')
            return false
        }

        const account = await getAccountFromMessage(runtime, message)
        const userMetawallets = account.metawallets

        // Determine which wallets to check
        let walletsToCheck: any[] = []

        if (content.walletAddress) {
            // User specified a specific wallet address
            console.log('WALLET_BALANCE user specified wallet address:', content.walletAddress)

            // confirm wallet is in this user's list
            for (const mw of userMetawallets) {
                const kp = mw.keypairs.solana
                if (kp) {
                    console.log('kp', kp)
                    if (kp.publicKey.toString() === content.walletAddress) {
                        walletsToCheck.push(kp)
                    }
                }
            }

            if (!walletsToCheck.length) {
                console.log('WALLET_BALANCE did not find any local wallet with this address', content)
                return false
            }
        } else {
            // User didn't specify an address, check all their wallets
            console.log('WALLET_BALANCE checking all user wallets')

            for (const mw of userMetawallets) {
                const kp = mw.keypairs.solana
                if (kp) {
                    walletsToCheck.push(kp)
                }
            }

            if (!walletsToCheck.length) {
                console.log('WALLET_BALANCE user has no wallets')
                return false
            }
        }

        console.log('WALLET_BALANCE found', walletsToCheck.length, 'wallets to check')

        // gather balance information
        let balanceStr = ''
        const solanaService = runtime.getService(SOLANA_SERVICE_NAME) as any;

        for (const kp of walletsToCheck) {
            const pubKey = kp.publicKey
            balanceStr += 'Wallet Address: ' + pubKey + '\n'

            // get wallet contents
            const pubKeyObj = new PublicKey(pubKey)
            const [solBal, heldTokens] = await Promise.all([
                solanaService.getBalanceByAddr(pubKeyObj),
                solanaService.getTokenAccountsByKeypair(pubKeyObj),
            ]);

            balanceStr += '  Token Address (Symbol)\n'
            balanceStr += '  So11111111111111111111111111111111111111111 ($sol) balance: ' + (solBal ?? 'unknown') + '\n'
            console.log('solBal', solBal, 'heldTokens', heldTokens)

            // loop on remaining tokens and output
            for (const t of heldTokens) {
                const amountRaw = t.account.data.parsed.info.tokenAmount.amount;
                const mintKey = new PublicKey(t.account.data.parsed.info.mint);
                const decimals = t.account.data.parsed.info.tokenAmount.decimals;
                const balance = Number(amountRaw) / (10 ** decimals);
                const symbol = await solanaService.getTokenSymbol(mintKey)
                console.log('WALLET_BALANCE symbol', symbol)
                balanceStr += '  ' + t.pubkey.toString() + ' ($' + symbol + ') balance: ' + balance + '\n'
            }
            balanceStr += '\n'
        }
        console.log('balanceStr', balanceStr)

        // Create response
        responses.length = 0
        const memory: Memory = {
            entityId: uuidv4() as UUID,
            roomId: message.roomId,
            content: {
                text: `Wallet Balance:\n${balanceStr}`,
                success: true,
                balance: balanceStr,
                walletAddress: content.walletAddress,
                walletCount: walletsToCheck.length,
            }
        }
        responses.push(memory)

        return true;
    },

    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'What is my wallet balance?',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Checking your wallet balance...',
                    actions: ['WALLET_BALANCE'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me the balance of my wallet',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll check your wallet balance for you.',
                    actions: ['WALLET_BALANCE'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'How much SOL and tokens do I have?',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Let me check your wallet balances.',
                    actions: ['WALLET_BALANCE'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Check balance of wallet FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll check the balance of that specific wallet.',
                    actions: ['WALLET_BALANCE'],
                },
            },
        ],
    ] as ActionExample[][],
} as Action; 