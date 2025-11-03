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
import { SOLANA_SERVICE_NAME } from '../../autonomous-trader/constants';
import { HasEntityIdFromMessage, getAccountFromMessage, getWalletsFromText, takeItPrivate, takeItPrivate2 } from '../../autonomous-trader/utils';
import { listPositions, interface_positions_ByAccountId } from '../interfaces/int_positions';

/**
 * Interface representing the content of a PnL check request.
 *
 * @interface PnLCheckContent
 * @extends Content
 * @property {string | null} walletAddress - The address of the wallet to check PnL for, or null for any wallet
 * @property {string | null} tokenAddress - The specific token to check PnL for, or null for all tokens
 */
interface PnLCheckContent extends Content {
    walletAddress: string | null;
    tokenAddress: string | null;
}

/**
 * Template for determining which wallet and token to check PnL for.
 */
const sourceAddressTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Recent Messages:
{{recentMessages}}

Extract the following information about the requested PnL check:
- Wallet address to check PnL for (if user specifies a specific address, otherwise use null)
- Token address to check PnL for (if user specifies a specific token, otherwise use null)

Example responses:
If user specifies an address and token:
\`\`\`json
{
    "walletAddress": "FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1",
    "tokenAddress": "So11111111111111111111111111111111111111112"
}
\`\`\`

If user just asks for "my PnL" or "check PnL":
\`\`\`json
{
    "walletAddress": null,
    "tokenAddress": null
}
\`\`\`

If user asks for PnL of a specific token:
\`\`\`json
{
    "walletAddress": null,
    "tokenAddress": "So11111111111111111111111111111111111111112"
}
\`\`\`

Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the JSON response format without any preamble or explanation.

IMPORTANT: Your response must ONLY contain the json block above. Do not include any text, thinking, or reasoning before or after this JSON block. Start your response immediately with { and end with }.`;

export default {
    name: 'WALLET_PNL',
    similes: [
        'WALLET_PNL_CHECK',
        'WALLET_PNL_QUERY',
        'WALLET_PNL_LOOKUP',
        'WALLET_PNL_INFO',
        'WALLET_PNL_DETAILS',
        'WALLET_PNL_SUMMARY',
        'WALLET_PNL_REPORT',
        'WALLET_PNL_STATUS',
        'WALLET_PNL_OVERVIEW',
        'WALLET_PNL_VIEW',
        'WALLET_PNL_DISPLAY',
        'WALLET_PNL_SHOW',
        'WALLET_PROFIT_LOSS',
        'WALLET_PROFIT_LOSS_CHECK',
        'WALLET_PROFIT_LOSS_QUERY',
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        if (!await HasEntityIdFromMessage(runtime, message)) {
          console.warn('WALLET_PNL validate - author not found')
          return false
        }

        const account = await getAccountFromMessage(runtime, message)
        if (!account) return false;

        return true;
    },
    description: 'Get the profit and loss (PnL) of open positions in a specified Solana wallet or any wallet registered under the user.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: Memory[] = []
    ): Promise<boolean> => {
        logger.log('WALLET_PNL Starting PnL check handler...');

        /*
        const sourcePrompt = composePromptFromState({
            state: state,
            template: sourceAddressTemplate,
        });
        const sourceResult = await runtime.useModel(ModelType.OBJECT_LARGE, {
            prompt: sourcePrompt,
        });
        console.log('WALLET_PNL sourceResult', sourceResult)

        const content = parseJSONObjectFromText(sourceResult) as PnLCheckContent;
        if (!content) {
            console.log('WALLET_PNL failed to parse response')
            return false
        }
        */

        const sources = getWalletsFromText(runtime, message)
        if (sources.length > 1) {
          if (sources.length) {
            // too many
          }
          return false
        }
        let content = { }
        if (sources.length) {
          content = {
            walletAddress: sources[0],
          }
        }

        const account = await getAccountFromMessage(runtime, message)
        // how do we get the sourceId basically
        console.log('account', account)
        if (!account) {
            console.log('WALLET_PNL no account found')
            return false
        }

        // Get all positions for the user
        let allPositions: any[] = []
        try {
            //allPositions = await listPositions(runtime, {})
            const res = await interface_positions_ByAccountId(runtime, account.entityId)
            // keyed by pos.id
            allPositions = Object.values(res.list)

            /*
            // we have a list of metawallets, which wallet?!?
            // all for now
            for(const mw of res.component.data.metawallets) {

            }
            */
            //console.log('WALLET_PNL allPositions', allPositions)
        } catch (error) {
            console.error('WALLET_PNL error getting positions', error)
            /*
            const memory: Memory = {
                entityId: uuidv4() as UUID,
                roomId: message.roomId,
                content: {
                    text: 'Error retrieving positions. Please try again.',
                    success: false,
                    pnl: 'Error retrieving positions',
                    walletAddress: content.walletAddress,
                    tokenAddress: content.tokenAddress,
                    positionCount: 0,
                }
            }
            responses.push(memory)
            */
            callback(takeItPrivate(runtime, message, 'Error retrieving positions. Please try again.'))
            return true
        }

        if (!allPositions || !allPositions.length) {
            console.log('WALLET_PNL no positions found')
            /*
            const memory: Memory = {
                entityId: uuidv4() as UUID,
                roomId: message.roomId,
                content: {
                    text: 'No open positions found to calculate PnL.',
                    success: true,
                    pnl: 'No positions',
                    walletAddress: content.walletAddress,
                    tokenAddress: content.tokenAddress,
                    positionCount: 0,
                }
            }
            responses.push(memory)
            */
            callback(takeItPrivate(runtime, message, 'No open positions found to calculate PnL.'))
            return true
        }

        // Filter positions based on user request
        let filteredPositions = allPositions

        if (content.walletAddress) {
            // Filter by specific wallet address
            filteredPositions = allPositions.filter(p => {
                try {
                    return p?.mw?.keypairs?.solana?.publicKey === content.walletAddress
                } catch (error) {
                    console.error('WALLET_PNL error filtering by wallet address', error)
                    return false
                }
            })
        }

        if (content.tokenAddress) {
            // Filter by specific token address
            filteredPositions = filteredPositions.filter(p => {
                try {
                    return p?.position?.token === content.tokenAddress
                } catch (error) {
                    console.error('WALLET_PNL error filtering by token address', error)
                    return false
                }
            })
        }

        if (!filteredPositions || !filteredPositions.length) {
            console.log('WALLET_PNL no positions match filters')
            const memory: Memory = {
                entityId: uuidv4() as UUID,
                roomId: message.roomId,
                content: {
                    text: 'No positions found matching your criteria.',
                    success: true,
                    pnl: 'No matching positions',
                    walletAddress: content.walletAddress,
                    tokenAddress: content.tokenAddress,
                    positionCount: 0,
                }
            }
            responses.push(memory)
            return true
        }

        // Calculate PnL for each position
        const solanaService = runtime.getService(SOLANA_SERVICE_NAME) as any;
        let pnlStr = ''
        let totalPnL = 0
        let totalPnLPercent = 0
        let positionCount = 0

        //console.log('filteredPositions', filteredPositions)

        const dataProviderService = runtime.getService('TRADER_DATAPROVIDER') as any;

        for (const posData of filteredPositions) {
            try {
                const position = posData?.pos
                const wallet = posData?.mw?.keypairs?.solana

                if (!position || !wallet) {
                    console.log('WALLET_PNL invalid position data', posData)
                    continue
                }

                if (!position.solAmount || !position.tokenAmount || !position.token) {
                    console.log('WALLET_PNL position missing required data', position)
                    continue
                }
                position.entryPrice = position.tokenAmount / position.solAmount

                // Get current price for the token
                const tokenMint = new PublicKey(position.token)
                //const currentPrice = await solanaService.getTokenPrice(tokenMint)
                const res = await dataProviderService.getTokenInfo('solana', position.token)
                //console.log('getTokenInfo res', res)
                const currentPrice = res.priceUsd
                if (!currentPrice) {
                    console.log('WALLET_PNL could not get current price for token', position.token)
                    continue
                }

                // Calculate PnL
                const entryValue = position.entryPrice * position.tokenAmount
                const currentValue = currentPrice * position.tokenAmount
                const pnl = currentValue - entryValue
                const pnlPercent = entryValue > 0 ? (pnl / entryValue) * 100 : 0

                // Add to totals
                totalPnL += pnl
                totalPnLPercent += pnlPercent
                positionCount++

                // Format position info
                const tokenSymbol = await solanaService.getTokenSymbol(tokenMint) || position.token
                const walletAddress = wallet.publicKey || 'Unknown'

                pnlStr += `Wallet: ${walletAddress}\n`
                pnlStr += `  Token: ${tokenSymbol} (${position.token})\n`
                pnlStr += `  Amount: ${position.tokenAmount}\n`
                pnlStr += `  Entry Price: $${position.entryPrice.toFixed(6)}\n`
                pnlStr += `  Current Price: $${currentPrice.toFixed(6)}\n`
                pnlStr += `  Entry Value: $${entryValue.toFixed(2)}\n`
                pnlStr += `  Current Value: $${currentValue.toFixed(2)}\n`
                pnlStr += `  PnL: $${pnl.toFixed(2)} (${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)\n`
                pnlStr += '\n'

            } catch (error) {
                console.error('WALLET_PNL error calculating PnL for position', posData, error)
                continue
            }
        }

        console.log('positionCount', positionCount)

        // Add summary
        if (positionCount > 0) {
            const avgPnLPercent = totalPnLPercent / positionCount
            pnlStr += `=== SUMMARY ===\n`
            pnlStr += `Total Positions: ${positionCount}\n`
            pnlStr += `Total PnL: $${totalPnL.toFixed(2)} (${avgPnLPercent > 0 ? '+' : ''}${avgPnLPercent.toFixed(2)}%)\n`
        }

        console.log('WALLET_PNL pnlStr', pnlStr)

        // Create response
        /*
        responses.length = 0
        const memory: Memory = {
            entityId: uuidv4() as UUID,
            roomId: message.roomId,
            content: {
                text: `Position PnL Report:\n${pnlStr}`,
                success: true,
                pnl: pnlStr,
                walletAddress: content.walletAddress,
                tokenAddress: content.tokenAddress,
                positionCount: positionCount,
                totalPnL: totalPnL,
                totalPnLPercent: totalPnLPercent / positionCount,
            }
        }
        responses.push(memory)
        */
        //callback(takeItPrivate(runtime, message, `Position PnL Report:\n${pnlStr}`))
        takeItPrivate2(runtime, message, `Position PnL Report:\n${pnlStr}`, callback)

        return true;
    },

    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'What is my PnL?',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Checking your position PnL...',
                    actions: ['WALLET_PNL'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me my profit and loss',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll calculate your position PnL for you.',
                    actions: ['WALLET_PNL'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'How much profit or loss do I have on my positions?',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Let me check your position PnL.',
                    actions: ['WALLET_PNL'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Check PnL of wallet FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll check the PnL of that specific wallet.',
                    actions: ['WALLET_PNL'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'What is my PnL on SOL?',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll check your SOL position PnL.',
                    actions: ['WALLET_PNL'],
                },
            },
        ],
    ] as ActionExample[][],
} as Action;