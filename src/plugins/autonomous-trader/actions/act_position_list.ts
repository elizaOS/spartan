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
import { getWalletsFromText, takeItPrivate, takeItPrivate2, getAccountFromMessage } from '../utils'
import { listPositions } from '../interfaces/int_positions';

/**
 * Interface representing the content of a balance check request.
 *
 * @interface BalanceCheckContent
 * @extends Content
 * @property {string | null} walletAddress - The address of the wallet to check balance for, or null for any wallet
 * @property {string | null} statusFilter - The status filter to apply ('open', 'closed', or null for both)
 */
interface BalanceCheckContent extends Content {
    walletAddress: string | null;
    statusFilter: string | null;
}

/**
 * Template for determining which wallet address to check balance for.
 */
const sourceAddressTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Recent Messages:
{{recentMessages}}

Extract the following information about the requested list positions:
- Wallet address to list positions for (if user specifies a specific address, otherwise use null)
- Status filter to apply (if user specifies "open" or "closed" positions, otherwise use null)

Example responses:
If user specifies an address and open positions:
\`\`\`json
{
    "walletAddress": "FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1",
    "statusFilter": "open"
}
\`\`\`

If user just asks for "my positions" or "list positions":
\`\`\`json
{
    "walletAddress": null,
    "statusFilter": null
}
\`\`\`

If user asks for "closed positions":
\`\`\`json
{
    "walletAddress": null,
    "statusFilter": "closed"
}
\`\`\`

Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the JSON response format without any preamble or explanation.

IMPORTANT: Your response must ONLY contain the json block above. Do not include any text, thinking, or reasoning before or after this JSON block. Start your response immediately with { and end with }.`;

export default {
    name: 'LIST_POSITIONS',
    similes: [
        'LIST_POSITIONS_CHECK',
        'LIST_POSITIONS_QUERY',
        'LIST_POSITIONS_LOOKUP',
        'LIST_POSITIONS_INFO',
        'LIST_POSITIONS_DETAILS',
        'LIST_POSITIONS_SUMMARY',
        'LIST_POSITIONS_REPORT',
        'LIST_POSITIONS_STATUS',
        'LIST_POSITIONS_OVERVIEW',
        'LIST_POSITIONS_VIEW',
        'LIST_POSITIONS_DISPLAY',
        'LIST_POSITIONS_SHOW',
        'LIST_OPEN_POSITIONS',
        'LIST_CLOSED_POSITIONS',
        'SHOW_OPEN_POSITIONS',
        'SHOW_CLOSED_POSITIONS',
        'GET_OPEN_POSITIONS',
        'GET_CLOSED_POSITIONS',
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        if (!message?.metadata?.sourceId) {
            console.log('LIST_POSITIONS validate - author not found')
            return false
        }

        const account = await getAccountFromMessage(runtime, message)
        if (!account) return false;

        return true;
    },
    description: 'List the positions of a specified Solana wallet or any wallet registered under the user. Can filter by open, closed, or show all positions.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: Memory[] = []
    ): Promise<boolean> => {
        logger.log('LIST_POSITIONS Starting handler...');

        // Extract wallet address and status filter from message
        const sources = getWalletsFromText(runtime, message)
        let content: BalanceCheckContent = { walletAddress: null, statusFilter: null };
        if (Array.isArray(sources) && sources.length === 1) {
            content.walletAddress = sources[0];
        } else if (Array.isArray(sources) && sources.length > 1) {
            callback?.(takeItPrivate(runtime, message, 'Too many wallet addresses specified. Please specify only one.'));
            return false;
        }

        // Extract status filter from message text
        const messageText = message.content?.text?.toLowerCase() || '';
        if (messageText.includes('open position') || messageText.includes('open positions')) {
            content.statusFilter = 'open';
        } else if (messageText.includes('closed position') || messageText.includes('closed positions')) {
            content.statusFilter = 'closed';
        }

        // Get all positions
        const allPositions: any[] = await listPositions(runtime);
        let filteredPositions: any[] = allPositions;

        // Apply wallet address filter
        if (content.walletAddress) {
            filteredPositions = allPositions.filter((p: any) => {
                return p.mw && p.mw.keypairs?.solana?.publicKey === content.walletAddress;
            });
        }

        // Apply status filter
        if (content.statusFilter) {
            filteredPositions = filteredPositions.filter((p: any) => {
                const isClosed = p.position.close;
                if (content.statusFilter === 'open') {
                    return !isClosed;
                } else if (content.statusFilter === 'closed') {
                    return isClosed;
                }
                return true;
            });
        }

        if (!filteredPositions.length) {
            let noResultsMessage = 'No positions found';
            if (content.walletAddress) {
                noResultsMessage += ` for the specified wallet`;
            }
            if (content.statusFilter) {
                noResultsMessage += ` with ${content.statusFilter} status`;
            }
            noResultsMessage += '.';
            callback?.(takeItPrivate(runtime, message, noResultsMessage));
            return false;
        }

        // Format output
        let positionsStr = '';
        positionsStr += `⛓️ Chain: Solana\n`;

        // Add filter information to the output
        if (content.statusFilter) {
            positionsStr += `📊 Filter: ${content.statusFilter.toUpperCase()} positions only\n`;
        }
        if (content.walletAddress) {
            positionsStr += `👜 Wallet: ${content.walletAddress}\n`;
        }
        positionsStr += '\n';
        for (const posObj of filteredPositions) {
            const { position, mw } = posObj;
            console.log('position', position)
            const pubKey = mw.keypairs?.solana?.publicKey || 'unknown';
            positionsStr += `  👜 Wallet Address: ${pubKey}\n`;
            positionsStr += `    🆔 Position ID: ${position.id || 'N/A'}\n`;
            positionsStr += `    🪙 Token: ${position.token || 'N/A'}\n`;
            // ${position.tokenAmount} TokenRawAmt
            positionsStr += `    🔢 Amount: ${position.solAmount || 'N/A'} SOL\n`;
            positionsStr += `    📊 Status: ${position.close ? 'CLOSED' : 'OPEN'}\n`;
            positionsStr += '\n';
        }

        //callback?.(takeItPrivate(runtime, message, `List of positions:\n${positionsStr}`));
        takeItPrivate2(runtime, message, `List of positions:\n${positionsStr}`, callback)
        return true;
    },

    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'What is my wallet positions?',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Checking your wallet positions...',
                    actions: ['LIST_POSITIONS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me the positions of my wallet',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll check your wallet positions for you.',
                    actions: ['LIST_POSITIONS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me the open positions of my wallet',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll check your open wallet positions for you.',
                    actions: ['LIST_POSITIONS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me the closed positions of my wallet',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll check your closed wallet positions for you.',
                    actions: ['LIST_POSITIONS'],
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
                    text: 'Let me check your wallet positions.',
                    actions: ['LIST_POSITIONS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Check positions of wallet FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll check the positions of that specific wallet.',
                    actions: ['LIST_POSITIONS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Check open positions of wallet FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll check the open positions of that specific wallet.',
                    actions: ['LIST_POSITIONS'],
                },
            },
        ],
    ] as ActionExample[][],
} as Action;