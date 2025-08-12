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
 * Remove Meteora liquidity action
 */
export const removeMeteoraLiquidityAction: Action = {
    name: 'REMOVE_METEORA_LIQUIDITY',
    description: 'Remove liquidity from a Meteora liquidity pool',
    similes: [
        'remove meteora liquidity',
        'withdraw meteora lp',
        'unstake meteora',
        'exit meteora pool',
        'remove from meteora',
        'withdraw from meteora',
        'meteora remove liquidity',
        'meteora withdraw',
        'meteora unstake',
        'meteora exit pool',
        'close meteora position',
        'exit meteora position'
    ],
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Remove 100 LP tokens from Meteora pool ABC123',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll remove liquidity from the Meteora pool by withdrawing 100 LP tokens",
                    actions: ['REMOVE_METEORA_LIQUIDITY'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Withdraw all liquidity from Meteora pool XYZ789',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll withdraw all your liquidity from the Meteora pool",
                    actions: ['REMOVE_METEORA_LIQUIDITY'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Exit my position in Meteora pool DEF456',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll help you exit your Meteora liquidity position",
                    actions: ['REMOVE_METEORA_LIQUIDITY'],
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

            // Check if message contains withdrawal-related keywords
            const messageText = message.content?.text?.toLowerCase() || '';
            const withdrawalKeywords = [
                'remove', 'withdraw', 'unstake', 'exit', 'close', 'liquidity', 'pool', 'meteora', 'position'
            ];

            const hasWithdrawalIntent = withdrawalKeywords.some(keyword =>
                messageText.includes(keyword)
            );

            return hasWithdrawalIntent;
        } catch (error) {
            console.error('Error validating REMOVE_METEORA_LIQUIDITY:', error);
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
            logger.log('REMOVE_METEORA_LIQUIDITY handler starting...');

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

            // Extract parameters from message
            const params = await extractWithdrawalParams(message);
            if (!params) {
                callback?.({
                    text: 'Please specify the pool ID and LP token amount. Example: "Remove 100 LP tokens from Meteora pool ABC123"',
                });
                return;
            }

            // Get user vault (wallet) from account
            const userVault = await getUserVaultFromAccount(account);
            if (!userVault) {
                callback?.({
                    text: 'No Solana wallet found in your account. Please add a Solana wallet to remove liquidity.',
                });
                return;
            }

            // Remove liquidity using Meteora service
            const result = await meteoraService.removeLiquidity({
                userVault,
                poolId: params.poolId,
                lpTokenAmountLamports: params.lpTokenAmount,
                slippageBps: params.slippageBps || 100, // Default 1% slippage
            });

            if (result.success) {
                const responseText = formatSuccessResponse(result, params);
                callback?.({
                    text: responseText,
                    actions: ['REMOVE_METEORA_LIQUIDITY'],
                });
            } else {
                callback?.({
                    text: `❌ **Failed to remove liquidity**: ${result.error}`,
                    actions: ['REMOVE_METEORA_LIQUIDITY'],
                });
            }

        } catch (error) {
            console.error('Error in REMOVE_METEORA_LIQUIDITY handler:', error);
            callback?.({
                text: 'An error occurred while removing liquidity from Meteora. Please try again later.',
            });
        }
    },
} as Action;

/**
 * Extract withdrawal parameters from message
 */
async function extractWithdrawalParams(message: Memory): Promise<{
    poolId: string;
    lpTokenAmount: string;
    slippageBps?: number;
} | null> {
    try {
        const messageText = message.content?.text || '';

        // Simple regex patterns to extract LP token amounts and pool ID
        const lpTokenPattern = /(\d+(?:\.\d+)?)\s*(LP|LP\s*TOKENS?|LIQUIDITY|METEORA\s*LP)/gi;
        const poolPattern = /pool\s+([A-Za-z0-9]{8,})/i;
        const slippagePattern = /(\d+(?:\.\d+)?)%?\s*slippage/i;
        const allPattern = /all|100%|everything|complete/i;

        let lpTokenAmount = '';
        let isAllLiquidity = false;

        // Check if user wants to remove all liquidity
        if (allPattern.test(messageText)) {
            isAllLiquidity = true;
            lpTokenAmount = '0'; // Will be handled by the service to remove all
        } else {
            // Extract LP token amount
            const lpMatch = lpTokenPattern.exec(messageText);
            if (lpMatch) {
                lpTokenAmount = convertLpTokensToLamports(lpMatch[1]);
            }
        }

        // Extract pool ID
        const poolMatch = poolPattern.exec(messageText);
        const poolId = poolMatch ? poolMatch[1] : '';

        // Extract slippage
        const slippageMatch = slippagePattern.exec(messageText);
        const slippagePercent = slippageMatch ? parseFloat(slippageMatch[1]) : 1; // Default 1%
        const slippageBps = Math.round(slippagePercent * 100);

        if ((!isAllLiquidity && !lpTokenAmount) || !poolId) {
            return null;
        }

        return {
            poolId,
            lpTokenAmount: isAllLiquidity ? '0' : lpTokenAmount, // 0 indicates remove all
            slippageBps
        };
    } catch (error) {
        console.error('Error extracting withdrawal params:', error);
        return null;
    }
}

/**
 * Convert LP token amount to lamports
 */
function convertLpTokensToLamports(amount: string): string {
    const amountNum = parseFloat(amount);
    // LP tokens typically have 6 decimals
    return (amountNum * Math.pow(10, 6)).toString();
}

/**
 * Get user vault from account
 */
async function getUserVaultFromAccount(account: any): Promise<any> {
    try {
        if (account.metawallets) {
            for (const mw of account.metawallets) {
                for (const chain in mw.keypairs) {
                    if (chain === 'solana') {
                        const kp = mw.keypairs[chain];
                        if (kp.publicKey) {
                            return {
                                publicKey: kp.publicKey,
                                keypair: kp
                            };
                        }
                    }
                }
            }
        }
        return null;
    } catch (error) {
        console.error('Error getting user vault:', error);
        return null;
    }
}

/**
 * Format success response
 */
function formatSuccessResponse(result: any, params: any): string {
    let responseText = '✅ **LIQUIDITY REMOVED SUCCESSFULLY**\n\n';

    responseText += `**Pool ID:** \`${params.poolId}\`\n`;
    responseText += `**Transaction ID:** \`${result.transactionId}\`\n`;

    if (result.data) {
        responseText += `**Liquidity Removed:** ${result.data.liquidityRemoved} lamports\n`;
    }

    if (result.tokensReceived && result.tokensReceived.length > 0) {
        responseText += '\n**Tokens Received:**\n';
        for (const token of result.tokensReceived) {
            responseText += `• **${token.symbol}:** ${token.uiAmount?.toFixed(4) || '0'} (${token.balance} lamports)\n`;
        }
    }

    responseText += `**Slippage:** ${params.slippageBps / 100}%\n\n`;
    responseText += 'Your liquidity has been successfully removed from the Meteora pool! 💰';

    return responseText;
}

// Export the action as default
export default removeMeteoraLiquidityAction; 