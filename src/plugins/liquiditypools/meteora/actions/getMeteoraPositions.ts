import {
    type Action,
    type ActionExample,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    logger,
} from '@elizaos/core';
import { MeteoraService } from '../services/meteoraService';
import { getAccountFromMessage } from '../../../autonomous-trader/utils';

/**
 * Get Meteora liquidity pool positions action
 */
export const getMeteoraPositionsAction: Action = {
    name: 'GET_METEORA_POSITIONS',
    description: 'Get all Meteora liquidity pool positions for the current user',
    similes: [
        'meteora positions',
        'meteora pools',
        'meteora lp',
        'meteora liquidity',
        'meteora holdings',
        'meteora investments',
        'meteora portfolio',
        'meteora stakes',
        'meteora deposits',
        'meteora yields'
    ],
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me my Meteora positions',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll get your Meteora liquidity pool positions",
                    actions: ['GET_METEORA_POSITIONS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'What Meteora pools am I in?',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "Let me check your Meteora liquidity pool positions",
                    actions: ['GET_METEORA_POSITIONS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Check my Meteora LP status',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll check your Meteora liquidity pool status",
                    actions: ['GET_METEORA_POSITIONS'],
                },
            },
        ],
    ] as ActionExample[][],
    validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        try {
            // Check if user has an account
            const account = await getAccountFromMessage(runtime, message);
            if (!account) {
                return false;
            }

            // Check if Meteora service is available
            const meteoraService = runtime.getService('METEORA_SERVICE') as unknown as MeteoraService;
            if (!meteoraService) {
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error validating GET_METEORA_POSITIONS:', error);
            return false;
        }
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: Memory[] = []
    ): Promise<void> => {
        try {
            logger.log('GET_METEORA_POSITIONS handler starting...');

            const account = await getAccountFromMessage(runtime, message);
            if (!account) {
                callback?.({ text: 'No account found. Please create an account first.' });
                return;
            }

            const meteoraService = runtime.getService('METEORA_SERVICE') as unknown as MeteoraService;
            if (!meteoraService) {
                callback?.({ text: 'Meteora service not available. Please try again later.' });
                return;
            }

            // Extract Solana wallet addresses from account
            const walletAddresses: string[] = [];
            if (account.metawallets) {
                for (const mw of account.metawallets) {
                    for (const chain in mw.keypairs) {
                        if (chain === 'solana') {
                            const kp = mw.keypairs[chain];
                            if (kp.publicKey) {
                                walletAddresses.push(kp.publicKey);
                            }
                        }
                    }
                }
            }

            if (walletAddresses.length === 0) {
                callback?.({
                    text: 'No Solana wallets found in your account. Please add a Solana wallet to view Meteora positions.',
                });
                return;
            }

            let responseText = '🔍 **METEORA LIQUIDITY POOL POSITIONS**\n\n';

            // Get positions for each wallet
            for (const walletAddress of walletAddresses) {
                responseText += `**Wallet:** \`${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}\`\n\n`;

                try {
                    // Get real positions from Meteora service
                    const positions = await meteoraService.getAllUserPositions(walletAddress);

                    if (positions.size === 0) {
                        responseText += 'No Meteora positions found for this wallet.\n\n';
                    } else {
                        responseText += `Found **${positions.size}** position(s):\n\n`;

                        for (const [poolAddress, positionInfo] of positions.entries()) {
                            responseText += await formatPositionResponse(positionInfo, poolAddress, meteoraService);
                            responseText += '\n---\n\n';
                        }
                    }
                } catch (error) {
                    console.error(`Error fetching positions for wallet ${walletAddress}:`, error);
                    responseText += 'Error fetching positions for this wallet.\n\n';
                }
            }

            // Add summary
            responseText += await generatePositionsSummary(walletAddresses, meteoraService);

            callback?.({
                text: responseText,
                actions: ['GET_METEORA_POSITIONS'],
            });

        } catch (error) {
            console.error('Error in GET_METEORA_POSITIONS handler:', error);
            callback?.({
                text: 'An error occurred while fetching your Meteora positions. Please try again later.',
            });
        }
    },
} as Action;

/**
 * Format position for response
 */
async function formatPositionResponse(
    positionInfo: any,
    poolAddress: string,
    meteoraService: MeteoraService
): Promise<string> {
    let positionText = '';

    try {
        // Basic position info
        positionText += `**Position:** \`${positionInfo.publicKey?.toString().slice(0, 8)}...${positionInfo.publicKey?.toString().slice(-8) || 'Unknown'}\`\n`;
        positionText += `**Pool:** \`${poolAddress.slice(0, 8)}...${poolAddress.slice(-8)}\`\n`;

        // Get additional pool information
        try {
            const poolDetails = await meteoraService.getLpPositionDetails('mock-user', poolAddress);
            if (poolDetails) {
                positionText += `**Pool Type:** ${poolDetails.metadata?.poolType || 'Unknown'}\n`;
                if (poolDetails.lpTokenBalance) {
                    positionText += `**LP Tokens:** ${poolDetails.lpTokenBalance.uiAmount?.toFixed(4) || '0'}\n`;
                }
                if (poolDetails.underlyingTokens && poolDetails.underlyingTokens.length >= 2) {
                    const tokenA = poolDetails.underlyingTokens[0];
                    const tokenB = poolDetails.underlyingTokens[1];
                    positionText += `**${tokenA.symbol}:** ${tokenA.uiAmount?.toFixed(4) || '0'}\n`;
                    positionText += `**${tokenB.symbol}:** ${tokenB.uiAmount?.toFixed(4) || '0'}\n`;
                }
            }
        } catch (error) {
            console.warn('Could not fetch pool details:', error);
            positionText += '**Status:** Active\n';
            positionText += '**Details:** Position data available\n';
        }

    } catch (error) {
        console.error('Error formatting position response:', error);
        positionText += 'Error formatting position details.\n';
    }

    return positionText;
}

/**
 * Generate summary of all positions
 */
async function generatePositionsSummary(
    walletAddresses: string[],
    meteoraService: MeteoraService
): Promise<string> {
    let summaryText = '📊 **POSITIONS SUMMARY**\n\n';

    try {
        let totalPositions = 0;
        let totalValue = 0;
        let activePositions = 0;

        for (const walletAddress of walletAddresses) {
            try {
                const positions = await meteoraService.getAllUserPositions(walletAddress);
                totalPositions += positions.size;
                activePositions += positions.size; // All positions are considered active for now
            } catch (error) {
                console.warn(`Error calculating summary for wallet ${walletAddress}:`, error);
            }
        }

        summaryText += `**Total Wallets:** ${walletAddresses.length}\n`;
        summaryText += `**Total Positions:** ${totalPositions}\n`;
        summaryText += `**Active Positions:** ${activePositions}\n`;
        summaryText += `**Total Value:** Calculating...\n`;
        summaryText += `**Total Fees Earned:** Calculating...\n`;

        if (totalPositions > 0) {
            summaryText += `**Average Positions per Wallet:** ${(totalPositions / walletAddresses.length).toFixed(1)}\n`;
        }

    } catch (error) {
        console.error('Error generating positions summary:', error);
        summaryText += 'Error calculating summary.\n';
    }

    return summaryText;
}

// Export the action as default
export default getMeteoraPositionsAction; 