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
    description: 'Remove liquidity from a Meteora liquidity pool. If no specific amount is mentioned, removes all available liquidity.',
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
        'exit meteora position',
        'remove liquidity from meteora',
        'withdraw from meteora pool',
        'exit meteora liquidity',
        'close meteora lp'
    ],
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Remove liquidity from Meteora pool ABC123',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll remove all your liquidity from the Meteora pool",
                    actions: ['REMOVE_METEORA_LIQUIDITY'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Remove 100 LP tokens from Meteora pool XYZ789',
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
                    text: 'Remove 2.8 USDC and 0.015 SOL from Meteora pool DEF456',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll remove liquidity from the Meteora pool to get you 2.8 USDC and 0.015 SOL",
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

            // Must contain action words that indicate removing liquidity
            const actionKeywords = ['remove', 'withdraw', 'unstake', 'exit', 'close'];
            const hasActionIntent = actionKeywords.some(keyword => messageText.includes(keyword));

            // Must contain liquidity-related words
            const liquidityKeywords = ['liquidity', 'pool', 'position'];
            const hasLiquidityIntent = liquidityKeywords.some(keyword => messageText.includes(keyword));

            // Must contain Meteora
            const hasMeteoraIntent = messageText.includes('meteora');

            // Check for specific amounts (numbers followed by token symbols or LP tokens)
            const amountPattern = /\d+(?:\.\d+)?\s*(USDC|SOL|ETH|BTC|MATIC|AVAX|DOT|LINK|UNI|AAVE|COMP|MKR|YFI|CRV|BAL|SNX|SUSHI|1INCH|LP|LP\s*TOKENS?|LIQUIDITY|METEORA\s*LP)/i;
            const hasAmountIntent = amountPattern.test(messageText);

            // Check for "all" or "everything" keywords
            const allPattern = /all|100%|everything|complete/i;
            const hasAllIntent = allPattern.test(messageText);

            // If no specific amounts are mentioned, default to removing all liquidity
            // This makes the action more intuitive - just saying "remove liquidity" means remove all
            return hasActionIntent && hasLiquidityIntent && hasMeteoraIntent;
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

            // Log account structure for debugging
            console.log('Account structure:', JSON.stringify(account, null, 2));
            logger.log('Account retrieved successfully');

            const meteoraService = runtime.getService('METEORA_SERVICE') as unknown as MeteoraService;
            if (!meteoraService) {
                callback?.({ text: 'Meteora service not available. Please try again later.' });
                return;
            }

            // Extract parameters from message
            const params = await extractWithdrawalParams(message);
            if (!params) {
                callback?.({
                    text: 'Please specify the pool ID. Examples:\n• "Remove liquidity from Meteora pool ABC123" (removes all)\n• "Remove 100 LP tokens from Meteora pool ABC123"\n• "Remove 2.8 USDC and 0.015 SOL from Meteora pool ABC123"',
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
                    text: 'No Solana wallet found in your account. Please add a Solana wallet to remove liquidity.',
                });
                return;
            }

            // Log the public key being used
            logger.log(`Using wallet public key: ${userVault.publicKey}`);
            console.log(`Using wallet public key: ${userVault.publicKey}`);

            console.log(`Calling meteoraService.removeLiquidity with: poolId=${params.poolId}, lpTokenAmountLamports=${params.lpTokenAmount}, isRemoveByTokenAmounts=${params.isRemoveByTokenAmounts}`);

            // Remove liquidity using Meteora service
            const result = await meteoraService.removeLiquidity({
                userVault,
                poolId: params.poolId,
                lpTokenAmountLamports: params.lpTokenAmount,
                slippageBps: params.slippageBps || 100, // Default 1% slippage
                tokenAAmount: params.tokenAAmount,
                tokenBAmount: params.tokenBAmount,
                tokenASymbol: params.tokenASymbol,
                tokenBSymbol: params.tokenBSymbol,
                isRemoveByTokenAmounts: params.isRemoveByTokenAmounts,
            });

            if (result.success) {
                const responseText = formatSuccessResponse(result, params);
                callback?.({
                    text: responseText,
                    actions: ['REMOVE_METEORA_LIQUIDITY'],
                });
            } else {
                let errorMessage = `❌ **Failed to remove liquidity**: ${result.error}`;

                // Add helpful suggestions for common errors
                if (result.error?.includes('No positions found')) {
                    errorMessage += '\n\n💡 **Suggestions:**';
                    errorMessage += '\n• Check if you have any liquidity positions in this pool';
                    errorMessage += '\n• Verify the pool ID is correct';
                    errorMessage += '\n• Try searching for your positions first';
                } else if (result.error?.includes('Insufficient balance')) {
                    errorMessage += '\n\n💡 **Suggestions:**';
                    errorMessage += '\n• Check your LP token balance';
                    errorMessage += '\n• Make sure you have enough LP tokens to remove';
                }

                callback?.({
                    text: errorMessage,
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
    tokenAAmount?: string;
    tokenBAmount?: string;
    tokenASymbol?: string;
    tokenBSymbol?: string;
    isRemoveByTokenAmounts?: boolean;
} | null> {
    try {
        const messageText = message.content?.text || '';
        console.log('Extracting withdrawal params from message:', messageText);

        // Simple regex patterns to extract amounts and pool ID
        const lpTokenPattern = /(\d+(?:\.\d+)?)\s*(LP|LP\s*TOKENS?|LIQUIDITY|METEORA\s*LP)/gi;
        const tokenAmountPattern = /(\d+(?:\.\d+)?)\s*(USDC|SOL|ETH|BTC|MATIC|AVAX|DOT|LINK|UNI|AAVE|COMP|MKR|YFI|CRV|BAL|SNX|SUSHI|1INCH)/gi;
        const andPattern = /(\d+(?:\.\d+)?)\s*(USDC|SOL|ETH|BTC|MATIC|AVAX|DOT|LINK|UNI|AAVE|COMP|MKR|YFI|CRV|BAL|SNX|SUSHI|1INCH)\s+and\s+(\d+(?:\.\d+)?)\s*(USDC|SOL|ETH|BTC|MATIC|AVAX|DOT|LINK|UNI|AAVE|COMP|MKR|YFI|CRV|BAL|SNX|SUSHI|1INCH)/gi;
        const slippagePattern = /(\d+(?:\.\d+)?)%?\s*slippage/i;
        const allPattern = /all|100%|everything|complete/i;

        console.log('Testing regex patterns:');
        console.log('Message text:', messageText);
        console.log('LP token pattern test:', lpTokenPattern.test(messageText));
        console.log('Token amount pattern test:', tokenAmountPattern.test(messageText));
        console.log('And pattern test:', andPattern.test(messageText));
        console.log('All pattern test:', allPattern.test(messageText));

        let lpTokenAmount = '';
        let tokenAAmount = '';
        let tokenBAmount = '';
        let tokenASymbol = '';
        let tokenBSymbol = '';
        let isAllLiquidity = false;
        let isRemoveByTokenAmounts = false;

        // Check if user explicitly wants to remove all liquidity or if no specific amounts are provided
        const hasExplicitAll = /all|100%|everything|complete/i.test(messageText);
        const hasSpecificAmounts = /(\d+(?:\.\d+)?)\s*(USDC|SOL|ETH|BTC|MATIC|AVAX|DOT|LINK|UNI|AAVE|COMP|MKR|YFI|CRV|BAL|SNX|SUSHI|1INCH|LP|LP\s*TOKENS?|LIQUIDITY|METEORA\s*LP)/i.test(messageText);

        if (hasExplicitAll || !hasSpecificAmounts) {
            // Default to removing all liquidity if no specific amounts are mentioned
            isAllLiquidity = true;
            lpTokenAmount = '0'; // Will be handled by the service to remove all
            console.log('Defaulting to remove all liquidity');
        } else {
            // First check for "X and Y" token pattern (e.g., "2.8 USDC and 0.015 SOL")
            console.log('Checking for "X and Y" token pattern...');
            const andPattern2 = /(\d+(?:\.\d+)?)\s*(USDC|SOL|ETH|BTC|MATIC|AVAX|DOT|LINK|UNI|AAVE|COMP|MKR|YFI|CRV|BAL|SNX|SUSHI|1INCH)\s+and\s+(\d+(?:\.\d+)?)\s*(USDC|SOL|ETH|BTC|MATIC|AVAX|DOT|LINK|UNI|AAVE|COMP|MKR|YFI|CRV|BAL|SNX|SUSHI|1INCH)/gi;
            const andMatch = andPattern2.exec(messageText);
            if (andMatch) {
                isRemoveByTokenAmounts = true;
                tokenAAmount = convertToLamports(andMatch[1], andMatch[2]);
                tokenBAmount = convertToLamports(andMatch[3], andMatch[4]);
                tokenASymbol = andMatch[2].toUpperCase();
                tokenBSymbol = andMatch[4].toUpperCase();
                console.log(`Found token amounts: ${andMatch[1]} ${tokenASymbol} and ${andMatch[3]} ${tokenBSymbol}`);
            } else {
                console.log('No "X and Y" pattern found, checking for single token amount...');
                // Check for single token amount
                const tokenAmountPattern2 = /(\d+(?:\.\d+)?)\s*(USDC|SOL|ETH|BTC|MATIC|AVAX|DOT|LINK|UNI|AAVE|COMP|MKR|YFI|CRV|BAL|SNX|SUSHI|1INCH)/gi;
                const tokenMatch = tokenAmountPattern2.exec(messageText);
                if (tokenMatch) {
                    isRemoveByTokenAmounts = true;
                    tokenAAmount = convertToLamports(tokenMatch[1], tokenMatch[2]);
                    tokenASymbol = tokenMatch[2].toUpperCase();
                    console.log(`Found single token amount: ${tokenMatch[1]} ${tokenASymbol}`);
                } else {
                    console.log('No single token amount found, checking for LP token amount...');
                    // Extract LP token amount
                    const lpTokenPattern2 = /(\d+(?:\.\d+)?)\s*(LP|LP\s*TOKENS?|LIQUIDITY|METEORA\s*LP)/gi;
                    const lpMatch = lpTokenPattern2.exec(messageText);
                    if (lpMatch) {
                        lpTokenAmount = convertLpTokensToLamports(lpMatch[1]);
                        console.log(`Found LP token amount: ${lpMatch[1]} LP tokens`);
                    }
                }
            }
        }

        // Extract pool ID - prioritize Solana addresses
        let poolId = '';

        // First, look for Solana addresses (base58, 32-44 chars) - these are most likely to be pool IDs
        const solanaAddressPattern = /([1-9A-HJ-NP-Za-km-z]{32,44})/g;
        const addressMatches = messageText.match(solanaAddressPattern);
        if (addressMatches && addressMatches.length > 0) {
            // Use the first address found that's not part of a token amount pattern
            for (const address of addressMatches) {
                // Check if this address is not part of a token amount pattern
                const beforeAddress = messageText.substring(0, messageText.indexOf(address));
                const afterAddress = messageText.substring(messageText.indexOf(address) + address.length);

                // If there's no number before or after the address, it's likely a pool ID
                const beforePattern = /\d+\s*$/;
                const afterPattern = /^\s*\d+/;

                if (!beforePattern.test(beforeAddress) && !afterPattern.test(afterAddress)) {
                    poolId = address;
                    console.log(`Found pool ID via Solana address pattern: ${poolId}`);
                    break;
                }
            }
        }

        // If no Solana address found, try the pool pattern as fallback
        if (!poolId) {
            console.log('No Solana address found, trying pool pattern...');
            // Look for "pool" followed by an identifier, but be more specific
            const poolPattern = /(?:pool\s+)([A-Za-z0-9]{32,44})/gi;
            const poolMatch = poolPattern.exec(messageText);
            if (poolMatch) {
                poolId = poolMatch[1];
                console.log(`Found pool ID via pool pattern: ${poolId}`);
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

        console.log(`Validation check: isAllLiquidity=${isAllLiquidity}, lpTokenAmount=${lpTokenAmount}, isRemoveByTokenAmounts=${isRemoveByTokenAmounts}, poolId=${poolId}`);

        if ((!isAllLiquidity && !lpTokenAmount && !isRemoveByTokenAmounts) || !poolId) {
            console.log('Validation failed - missing required parameters');
            return null;
        }

        console.log(`Final params: poolId=${poolId}, lpTokenAmount=${lpTokenAmount}, isAllLiquidity=${isAllLiquidity}, isRemoveByTokenAmounts=${isRemoveByTokenAmounts}, tokenAAmount=${tokenAAmount}, tokenBAmount=${tokenBAmount}`);

        return {
            poolId,
            lpTokenAmount: isAllLiquidity ? '0' : lpTokenAmount, // 0 indicates remove all
            slippageBps,
            tokenAAmount,
            tokenBAmount,
            tokenASymbol,
            tokenBSymbol,
            isRemoveByTokenAmounts
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
    const lamports = (amountNum * Math.pow(10, 6)).toString();
    console.log(`Converting ${amount} LP tokens to ${lamports} lamports (6 decimals)`);
    return lamports;
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