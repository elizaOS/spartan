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
 * Add Meteora liquidity action
 */
export const addMeteoraLiquidityAction: Action = {
    name: 'ADD_METEORA_LIQUIDITY',
    description: 'Add liquidity to a Meteora liquidity pool',
    similes: [
        'add meteora liquidity',
        'add liquidity to meteora',
        'deposit meteora lp',
        'stake meteora',
        'provide meteora liquidity',
        'add to meteora pool',
        'meteora add liquidity',
        'meteora deposit',
        'meteora stake',
        'meteora provide liquidity'
    ],
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Add 100 USDC and 1000 SOL to Meteora pool ABC123',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll add liquidity to the Meteora pool with 100 USDC and 1000 SOL",
                    actions: ['ADD_METEORA_LIQUIDITY'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Deposit 50 USDC to Meteora pool XYZ789',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll add 50 USDC to the Meteora liquidity pool",
                    actions: ['ADD_METEORA_LIQUIDITY'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Provide liquidity to Meteora with 200 USDC and 500 SOL',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll add liquidity to Meteora with your specified amounts",
                    actions: ['ADD_METEORA_LIQUIDITY'],
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

            // Check if message contains liquidity-related keywords
            const messageText = message.content?.text?.toLowerCase() || '';
            const liquidityKeywords = [
                'add', 'deposit', 'stake', 'provide', 'liquidity', 'pool', 'meteora'
            ];

            const hasLiquidityIntent = liquidityKeywords.some(keyword =>
                messageText.includes(keyword)
            );

            return hasLiquidityIntent;
        } catch (error) {
            console.error('Error validating ADD_METEORA_LIQUIDITY:', error);
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
            logger.log('ADD_METEORA_LIQUIDITY handler starting...');

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
            const params = await extractLiquidityParams(message);
            if (!params) {
                callback?.({
                    text: 'Please specify the pool ID and amounts. Example: "Add 100 USDC and 1000 SOL to Meteora pool ABC123"',
                });
                return;
            }

            // Get user vault (wallet) from account
            const userVault = await getUserVaultFromAccount(account);
            if (!userVault) {
                callback?.({
                    text: 'No Solana wallet found in your account. Please add a Solana wallet to add liquidity.',
                });
                return;
            }

            // Add liquidity using Meteora service
            const result = await meteoraService.addLiquidity({
                userVault,
                poolId: params.poolId,
                tokenAAmountLamports: params.tokenAAmount,
                tokenBAmountLamports: params.tokenBAmount,
                slippageBps: params.slippageBps || 100, // Default 1% slippage
            });

            if (result.success) {
                const responseText = formatSuccessResponse(result, params);
                callback?.({
                    text: responseText,
                    actions: ['ADD_METEORA_LIQUIDITY'],
                });
            } else {
                callback?.({
                    text: `❌ **Failed to add liquidity**: ${result.error}`,
                    actions: ['ADD_METEORA_LIQUIDITY'],
                });
            }

        } catch (error) {
            console.error('Error in ADD_METEORA_LIQUIDITY handler:', error);
            callback?.({
                text: 'An error occurred while adding liquidity to Meteora. Please try again later.',
            });
        }
    },
} as Action;

/**
 * Extract liquidity parameters from message
 */
async function extractLiquidityParams(message: Memory): Promise<{
    poolId: string;
    tokenAAmount: string;
    tokenBAmount?: string;
    slippageBps?: number;
} | null> {
    try {
        const messageText = message.content?.text || '';

        // Simple regex patterns to extract amounts and pool ID
        const amountPattern = /(\d+(?:\.\d+)?)\s*(USDC|SOL|ETH|BTC|MATIC|AVAX|DOT|LINK|UNI|AAVE|COMP|MKR|YFI|CRV|BAL|SNX|SUSHI|1INCH|ALPHA|BETA|GAMMA|DELTA|EPSILON|ZETA|ETA|THETA|IOTA|KAPPA|LAMBDA|MU|NU|XI|OMICRON|PI|RHO|SIGMA|TAU|UPSILON|PHI|CHI|PSI|OMEGA)/gi;
        const poolPattern = /pool\s+([A-Za-z0-9]{8,})/i;
        const slippagePattern = /(\d+(?:\.\d+)?)%?\s*slippage/i;

        const amounts: Array<{ amount: string; token: string }> = [];
        let match;

        // Extract amounts and tokens
        while ((match = amountPattern.exec(messageText)) !== null) {
            amounts.push({
                amount: match[1],
                token: match[2].toUpperCase()
            });
        }

        // Extract pool ID
        const poolMatch = poolPattern.exec(messageText);
        const poolId = poolMatch ? poolMatch[1] : '';

        // Extract slippage
        const slippageMatch = slippagePattern.exec(messageText);
        const slippagePercent = slippageMatch ? parseFloat(slippageMatch[1]) : 1; // Default 1%
        const slippageBps = Math.round(slippagePercent * 100);

        if (amounts.length === 0 || !poolId) {
            return null;
        }

        // Convert amounts to lamports (assuming 9 decimals for most tokens)
        const tokenAAmount = convertToLamports(amounts[0].amount, amounts[0].token);
        const tokenBAmount = amounts.length > 1 ? convertToLamports(amounts[1].amount, amounts[1].token) : undefined;

        return {
            poolId,
            tokenAAmount,
            tokenBAmount,
            slippageBps
        };
    } catch (error) {
        console.error('Error extracting liquidity params:', error);
        return null;
    }
}

/**
 * Convert token amount to lamports
 */
function convertToLamports(amount: string, token: string): string {
    const decimals = getTokenDecimals(token);
    const amountNum = parseFloat(amount);
    return (amountNum * Math.pow(10, decimals)).toString();
}

/**
 * Get token decimals
 */
function getTokenDecimals(token: string): number {
    const decimalsMap: Record<string, number> = {
        'USDC': 6,
        'USDT': 6,
        'SOL': 9,
        'ETH': 18,
        'BTC': 8,
        'MATIC': 18,
        'AVAX': 18,
        'DOT': 10,
        'LINK': 18,
        'UNI': 18,
        'AAVE': 18,
        'COMP': 18,
        'MKR': 18,
        'YFI': 18,
        'CRV': 18,
        'BAL': 18,
        'SNX': 18,
        'SUSHI': 18,
        '1INCH': 18,
    };

    return decimalsMap[token] || 9; // Default to 9 decimals
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
    let responseText = '✅ **LIQUIDITY ADDED SUCCESSFULLY**\n\n';

    responseText += `**Pool ID:** \`${params.poolId}\`\n`;
    responseText += `**Transaction ID:** \`${result.transactionId}\`\n`;

    if (result.data) {
        responseText += `**Liquidity Added:** ${params.tokenAAmount} lamports\n`;
        if (params.tokenBAmount) {
            responseText += `**Token B Amount:** ${params.tokenBAmount} lamports\n`;
        }
    }

    if (result.lpTokensReceived) {
        responseText += `**LP Tokens Received:** ${result.lpTokensReceived.uiAmount?.toFixed(4) || '0'}\n`;
    }

    responseText += `**Slippage:** ${params.slippageBps / 100}%\n\n`;
    responseText += 'Your liquidity has been successfully added to the Meteora pool! 🎉';

    return responseText;
}

// Export the action as default
export default addMeteoraLiquidityAction; 