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

            // Check if message contains specific action keywords for adding liquidity
            const messageText = message.content?.text?.toLowerCase() || '';

            // Must contain action words that indicate adding liquidity (not just searching)
            const actionKeywords = ['add', 'deposit', 'stake', 'provide'];
            const hasActionIntent = actionKeywords.some(keyword => messageText.includes(keyword));

            // Must contain liquidity-related words
            const liquidityKeywords = ['liquidity', 'pool'];
            const hasLiquidityIntent = liquidityKeywords.some(keyword => messageText.includes(keyword));

            // Must contain Meteora
            const hasMeteoraIntent = messageText.includes('meteora');

            // Must contain amounts (numbers followed by token symbols)
            const amountPattern = /\d+\s*(USDC|SOL|ETH|BTC|MATIC|AVAX|DOT|LINK|UNI|AAVE|COMP|MKR|YFI|CRV|BAL|SNX|SUSHI|1INCH)/i;
            const hasAmountIntent = amountPattern.test(messageText);

            return hasActionIntent && hasLiquidityIntent && hasMeteoraIntent && hasAmountIntent;
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

            // Log account structure for debugging
            console.log('Account structure:', JSON.stringify(account, null, 2));
            logger.log('Account retrieved successfully');

            const meteoraService = runtime.getService('METEORA_SERVICE') as unknown as MeteoraService;
            if (!meteoraService) {
                callback?.({ text: 'Meteora service not available. Please try again later.' });
                return;
            }

            // Extract parameters from message
            const params = await extractLiquidityParams(message);
            if (!params) {
                callback?.({
                    text: 'Please specify the pool ID and amounts. Example: "Add 100 USDC and 1000 SOL to Meteora pool ABC123" or "Add liquidity to 5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6 meteora with 1 USDC and 1 SOL"',
                });
                return;
            }

            // Validate pool ID format
            if (!params.poolId || params.poolId.length < 32 || params.poolId.length > 44) {
                callback?.({
                    text: `Invalid pool ID format: ${params.poolId}. Pool ID should be a valid Solana address (32-44 characters).\n\nTry searching for pools first: "Search SOL/USDC pools on Meteora" to get the correct pool ID.`,
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

            // Log the public key being used
            logger.log(`Using wallet public key: ${userVault.publicKey}`);
            console.log(`Using wallet public key: ${userVault.publicKey}`);

            console.log(`Calling meteoraService.addLiquidity with: poolId=${params.poolId}, tokenAAmountLamports=${params.tokenAAmount}, tokenBAmountLamports=${params.tokenBAmount}`);

            // Add liquidity using Meteora service
            const result = await meteoraService.addLiquidity({
                userVault,
                poolId: params.poolId,
                tokenAAmountLamports: params.tokenAAmount,
                tokenBAmountLamports: params.tokenBAmount,
                slippageBps: params.slippageBps || 100, // Default 1% slippage
                tokenASymbol: params.tokenASymbol,
                tokenBSymbol: params.tokenBSymbol,
            });

            if (result.success) {
                const responseText = formatSuccessResponse(result, params);
                callback?.({
                    text: responseText,
                    actions: ['ADD_METEORA_LIQUIDITY'],
                });
            } else {
                let errorMessage = `❌ **Failed to add liquidity**: ${result.error}`;

                // Add helpful suggestions for insufficient balance errors
                if (result.error?.includes('Insufficient balance')) {
                    errorMessage += '\n\n💡 **Suggestions:**';
                    errorMessage += '\n• Check your token balances first';
                    errorMessage += '\n• Make sure you have enough of both tokens';
                    errorMessage += '\n• Consider swapping some SOL for USDC if needed';
                }

                callback?.({
                    text: errorMessage,
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
    tokenASymbol?: string;
    tokenBSymbol?: string;
} | null> {
    try {
        const messageText = message.content?.text || '';

        // Simple regex patterns to extract amounts and pool ID
        const amountPattern = /(\d+(?:\.\d+)?)\s*(USDC|SOL|ETH|BTC|MATIC|AVAX|DOT|LINK|UNI|AAVE|COMP|MKR|YFI|CRV|BAL|SNX|SUSHI|1INCH|ALPHA|BETA|GAMMA|DELTA|EPSILON|ZETA|ETA|THETA|IOTA|KAPPA|LAMBDA|MU|NU|XI|OMICRON|PI|RHO|SIGMA|TAU|UPSILON|PHI|CHI|PSI|OMEGA)/gi;

        // Alternative pattern for "X and Y" format
        const andPattern = /(\d+(?:\.\d+)?)\s*(USDC|SOL|ETH|BTC|MATIC|AVAX|DOT|LINK|UNI|AAVE|COMP|MKR|YFI|CRV|BAL|SNX|SUSHI|1INCH)\s+and\s+(\d+(?:\.\d+)?)\s*(USDC|SOL|ETH|BTC|MATIC|AVAX|DOT|LINK|UNI|AAVE|COMP|MKR|YFI|CRV|BAL|SNX|SUSHI|1INCH)/gi;
        const poolPattern = /(?:pool\s+)?([A-Za-z0-9]{8,})/i;
        const slippagePattern = /(\d+(?:\.\d+)?)%?\s*slippage/i;

        const amounts: Array<{ amount: string; token: string }> = [];
        let match;

        // First try the "X and Y" pattern
        const andMatch = andPattern.exec(messageText);
        if (andMatch) {
            amounts.push({
                amount: andMatch[1],
                token: andMatch[2].toUpperCase()
            });
            amounts.push({
                amount: andMatch[3],
                token: andMatch[4].toUpperCase()
            });
        } else {
            // Extract amounts and tokens using the regular pattern
            while ((match = amountPattern.exec(messageText)) !== null) {
                amounts.push({
                    amount: match[1],
                    token: match[2].toUpperCase()
                });
            }
        }

        // Debug logging
        console.log('Extracted amounts:', amounts);
        console.log('Message text:', messageText);

        // Extract pool ID - look for various patterns
        let poolId = '';

        // Try the pool pattern first
        const poolMatch = poolPattern.exec(messageText);
        if (poolMatch) {
            poolId = poolMatch[1];
        } else {
            // Look for any string that looks like a Solana address (base58, 32-44 chars)
            const solanaAddressPattern = /([1-9A-HJ-NP-Za-km-z]{32,44})/g;
            const addressMatches = messageText.match(solanaAddressPattern);
            if (addressMatches && addressMatches.length > 0) {
                // Use the first address found that's not a token amount
                for (const address of addressMatches) {
                    // Check if this address is not part of a token amount pattern
                    const beforeAddress = messageText.substring(0, messageText.indexOf(address));
                    const afterAddress = messageText.substring(messageText.indexOf(address) + address.length);

                    // If there's no number before or after the address, it's likely a pool ID
                    const beforePattern = /\d+\s*$/;
                    const afterPattern = /^\s*\d+/;

                    if (!beforePattern.test(beforeAddress) && !afterPattern.test(afterAddress)) {
                        poolId = address;
                        break;
                    }
                }
            }
        }

        // Validate pool ID format
        if (poolId) {
            // Check if it's a valid base58 string
            const base58Pattern = /^[1-9A-HJ-NP-Za-km-z]+$/;
            if (!base58Pattern.test(poolId)) {
                console.error('Invalid pool ID format:', poolId);
                return null;
            }

            // Check if it's a reasonable length for a Solana address
            if (poolId.length < 32 || poolId.length > 44) {
                console.error('Pool ID length is not valid for Solana address:', poolId.length);
                return null;
            }
        }

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

        console.log(`Final amounts: tokenAAmount=${tokenAAmount} (${amounts[0].amount} ${amounts[0].token}), tokenBAmount=${tokenBAmount} (${amounts[1]?.amount} ${amounts[1]?.token})`);

        return {
            poolId,
            tokenAAmount,
            tokenBAmount,
            slippageBps,
            tokenASymbol: amounts[0].token,
            tokenBSymbol: amounts[1]?.token,
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
    const lamports = (amountNum * Math.pow(10, decimals)).toString();
    console.log(`Converting ${amount} ${token} to ${lamports} lamports (${decimals} decimals)`);
    return lamports;
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

    const decimals = decimalsMap[token] || 9; // Default to 9 decimals
    console.log(`Token ${token} has ${decimals} decimals`);
    return decimals;
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
                            console.log(`Found Solana keypair with public key: ${kp.publicKey}`);
                            logger.log(`Found Solana keypair with public key: ${kp.publicKey}`);
                            return {
                                publicKey: kp.publicKey,
                                keypair: kp
                            };
                        }
                    }
                }
            }
        }
        console.log('No Solana keypair found in account');
        logger.log('No Solana keypair found in account');
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