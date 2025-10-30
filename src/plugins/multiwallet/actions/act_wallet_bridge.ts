import {
    type Action,
    type ActionExample,
    type ActionResult,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    logger,
    ModelType,
} from '@elizaos/core';
import {
    HasEntityIdFromMessage,
    getAccountFromMessage,
    messageReply,
} from '../../autonomous-trader/utils';
import type { MultiwalletRelayBridgeService } from '../services/srv_relay_bridge';

interface BridgeParams {
    originChain: string;
    originChainId?: number;
    destinationChain: string;
    destinationChainId?: number;
    token: string;
    tokenAddress?: string;
    amount: string;
    destinationToken?: string;
    destinationTokenAddress?: string;
}

// Map of chain names to chain IDs
const CHAIN_NAME_TO_ID: Record<string, number> = {
    'ethereum': 1,
    'eth': 1,
    'mainnet': 1,
    'base': 8453,
    'arbitrum': 42161,
    'arb': 42161,
    'polygon': 137,
    'matic': 137,
    'optimism': 10,
    'op': 10,
    'zora': 7777777,
    'blast': 81457,
    'scroll': 534352,
    'linea': 59144,
};

/**
 * Parse bridge parameters from message text using LLM
 */
async function parseBridgeParams(
    runtime: IAgentRuntime,
    message: Memory
): Promise<BridgeParams | null> {
    try {
        const messageText = message.content.text || '';
        const prompt = `
You are a parameter extraction assistant. Extract bridge transaction parameters from the user's message.
The user wants to bridge tokens from one chain to another.

User message: "${messageText}"

Extract the following parameters:
- originChain: The source blockchain (e.g., "ethereum", "base", "arbitrum")
- destinationChain: The destination blockchain
- token: The token to bridge (symbol or name, e.g., "ETH", "USDC")
- amount: The amount to bridge (in token units, e.g., "1.5", "100")
- destinationToken: (optional) The token to receive on destination chain (if different from origin token)

Return ONLY a JSON object with these fields, no other text:
{
  "originChain": "chain_name",
  "destinationChain": "chain_name",
  "token": "token_symbol",
  "amount": "numeric_amount",
  "destinationToken": "token_symbol_or_null"
}
`;

        const response = await runtime.useModel(ModelType.TEXT_SMALL, { prompt });

        // Try to parse JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            logger.warn('Could not extract JSON from LLM response');
            return null;
        }

        const params = JSON.parse(jsonMatch[0]) as BridgeParams;

        // Validate required fields
        if (!params.originChain || !params.destinationChain || !params.token || !params.amount) {
            logger.warn('Missing required bridge parameters');
            return null;
        }

        // Map chain names to IDs
        const originChainId = CHAIN_NAME_TO_ID[params.originChain.toLowerCase()];
        const destinationChainId = CHAIN_NAME_TO_ID[params.destinationChain.toLowerCase()];

        if (!originChainId || !destinationChainId) {
            logger.warn(`Unknown chain: ${params.originChain} or ${params.destinationChain}`);
            return null;
        }

        params.originChainId = originChainId;
        params.destinationChainId = destinationChainId;

        return params;
    } catch (error) {
        const err = error as Error;
        logger.error(`Error parsing bridge parameters: ${err.message}`);
        return null;
    }
}

/**
 * Resolve token address from symbol
 * This is a simplified version - in production, you'd query a token registry
 */
function resolveTokenAddress(symbol: string, chainId: number): string {
    // Common token addresses (native tokens use zero address)
    const tokens: Record<number, Record<string, string>> = {
        1: { // Ethereum
            'ETH': '0x0000000000000000000000000000000000000000',
            'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        },
        8453: { // Base
            'ETH': '0x0000000000000000000000000000000000000000',
            'USDC': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        },
        42161: { // Arbitrum
            'ETH': '0x0000000000000000000000000000000000000000',
            'USDC': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        },
        137: { // Polygon
            'MATIC': '0x0000000000000000000000000000000000000000',
            'USDC': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        },
        10: { // Optimism
            'ETH': '0x0000000000000000000000000000000000000000',
            'USDC': '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
        },
    };

    const chainTokens = tokens[chainId];
    if (!chainTokens) {
        // Default to zero address for native token
        return '0x0000000000000000000000000000000000000000';
    }

    return chainTokens[symbol.toUpperCase()] || '0x0000000000000000000000000000000000000000';
}

export const walletBridgeAction: Action = {
    name: 'WALLET_BRIDGE',
    similes: ['CROSS_CHAIN_BRIDGE', 'BRIDGE_TOKENS', 'MOVE_TOKENS_CROSS_CHAIN'],
    description: 'Bridge tokens across different blockchains using Relay Protocol. Supports bridging between Ethereum, Base, Arbitrum, Polygon, Optimism, and other EVM chains.',

    validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        try {
            // Check if user is registered
            if (!(await HasEntityIdFromMessage(runtime, message))) {
                return false;
            }

            // Check if they have an account
            const account = await getAccountFromMessage(runtime, message);
            if (!account) {
                return false;
            }

            // Check if bridge service is available
            const bridgeService = runtime.getService('MULTIWALLET_RELAY_BRIDGE');
            if (!bridgeService) {
                logger.warn('MULTIWALLET_RELAY_BRIDGE service not available');
                return false;
            }

            // Check if message contains bridge-related keywords
            const text = (message.content.text || '').toLowerCase();
            const bridgeKeywords = ['bridge', 'cross-chain', 'move', 'transfer', 'send'];
            const chainKeywords = ['ethereum', 'base', 'arbitrum', 'polygon', 'optimism', 'eth', 'chain'];

            const hasBridgeKeyword = bridgeKeywords.some(keyword => text.includes(keyword));
            const hasChainKeyword = chainKeywords.some(keyword => text.includes(keyword));

            // Should mention both bridging and chains
            return hasBridgeKeyword && hasChainKeyword;
        } catch (error) {
            const err = error as Error;
            logger.error(`Bridge validation error: ${err.message}`);
            return false;
        }
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses?: any[]
    ): Promise<ActionResult> => {
        try {
            logger.info('WALLET_BRIDGE handler called');

            // Get the bridge service
            const bridgeService = runtime.getService('MULTIWALLET_RELAY_BRIDGE') as MultiwalletRelayBridgeService;
            if (!bridgeService) {
                throw new Error('Bridge service not available');
            }

            // Get account
            const account = await getAccountFromMessage(runtime, message);
            if (!account) {
                throw new Error('Account not found');
            }

            // Parse bridge parameters from message
            const params = await parseBridgeParams(runtime, message);
            if (!params) {
                const errorMsg = await messageReply(
                    runtime,
                    message,
                    'I couldn\'t understand the bridge parameters. Please specify:\n' +
                    '- Origin chain (e.g., "Ethereum")\n' +
                    '- Destination chain (e.g., "Base")\n' +
                    '- Token to bridge (e.g., "USDC")\n' +
                    '- Amount to bridge (e.g., "100")\n\n' +
                    'Example: "Bridge 100 USDC from Ethereum to Base"'
                );
                if (callback) callback(errorMsg);
                return {
                    success: false,
                    error: 'Could not parse bridge parameters',
                };
            }

            // Resolve token addresses
            params.tokenAddress = resolveTokenAddress(params.token, params.originChainId!);
            if (params.destinationToken) {
                params.destinationTokenAddress = resolveTokenAddress(
                    params.destinationToken,
                    params.destinationChainId!
                );
            }

            // Get wallet service to find user's wallet
            const walletService = runtime.getService('AUTONOMOUS_TRADER_INTERFACE_WALLETS') as any;
            if (!walletService) {
                throw new Error('Wallet service not available');
            }

            // Get user's wallets
            const accountId = account.accountEntityId;
            const metawallets = await walletService.getMetaWallets();

            // Find a wallet for this account with the origin chain
            let userWallet: any = null;
            for (const mw of metawallets) {
                if (mw.entitiesId && mw.entitiesId.includes(accountId)) {
                    if (mw.keypairs && mw.keypairs[params.originChainId!]) {
                        userWallet = mw.keypairs[params.originChainId!];
                        break;
                    }
                }
            }

            if (!userWallet) {
                const errorMsg = await messageReply(
                    runtime,
                    message,
                    `You don't have a wallet on ${params.originChain}. Please create one first.`
                );
                if (callback) callback(errorMsg);
                return {
                    success: false,
                    error: `No wallet found on ${params.originChain}`,
                };
            }

            // Send initial confirmation message
            const confirmMsg = await messageReply(
                runtime,
                message,
                `Initiating bridge transaction:\n` +
                `• From: ${params.originChain}\n` +
                `• To: ${params.destinationChain}\n` +
                `• Token: ${params.token}\n` +
                `• Amount: ${params.amount}\n\n` +
                `Getting quote...`
            );
            if (callback) callback(confirmMsg);

            // Convert amount to wei (assuming 18 decimals for simplicity)
            const amountInWei = (BigInt(Math.floor(parseFloat(params.amount) * 1e18))).toString();

            // Get quote first
            const quote = await bridgeService.getQuote({
                user: userWallet.publicKey,
                chainId: params.originChainId!,
                toChainId: params.destinationChainId!,
                currency: params.tokenAddress!,
                toCurrency: params.destinationTokenAddress || params.tokenAddress!,
                amount: amountInWei,
            });

            // Execute the bridge
            const result = await bridgeService.executeBridgeWithMultiwallet(
                userWallet.publicKey,
                {
                    user: userWallet.publicKey,
                    originChainId: params.originChainId!,
                    destinationChainId: params.destinationChainId!,
                    currency: params.tokenAddress!,
                    toCurrency: params.destinationTokenAddress,
                    amount: amountInWei,
                    useExactInput: true,
                },
                (progress) => {
                    logger.info(`Bridge progress: ${JSON.stringify(progress)}`);
                }
            );

            // Send success message
            const successMsg = await messageReply(
                runtime,
                message,
                `✅ Bridge transaction submitted successfully!\n\n` +
                `Request ID: ${result.requestId}\n` +
                `Status: ${result.status}\n\n` +
                `Your tokens are being bridged from ${params.originChain} to ${params.destinationChain}. ` +
                `This usually takes a few minutes.`
            );
            if (callback) callback(successMsg);

            return {
                success: true,
                text: `Bridge transaction submitted successfully`,
                data: {
                    requestId: result.requestId,
                    status: result.status,
                    originChain: params.originChain,
                    destinationChain: params.destinationChain,
                    token: params.token,
                    amount: params.amount,
                },
            };
        } catch (error) {
            const err = error as Error;
            logger.error(`Bridge handler error: ${err.message}`);

            const errorMsg = await messageReply(
                runtime,
                message,
                `❌ Bridge transaction failed: ${err.message}\n\n` +
                `Please check your wallet balance and try again.`
            );
            if (callback) callback(errorMsg);

            return {
                success: false,
                error: err.message,
            };
        }
    },

    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Bridge 100 USDC from Ethereum to Base',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll help you bridge those tokens across chains",
                    actions: ['WALLET_BRIDGE'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Move 0.5 ETH from Base to Arbitrum',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll bridge that ETH to Arbitrum for you",
                    actions: ['WALLET_BRIDGE'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Transfer 1000 USDC cross-chain from Polygon to Optimism',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "Setting up the cross-chain bridge",
                    actions: ['WALLET_BRIDGE'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Can you bridge my tokens from Ethereum to Base?',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "Yes! I can help bridge your tokens. How much and which token?",
                    actions: ['WALLET_BRIDGE'],
                },
            },
        ],
    ] as ActionExample[][],
};

export default walletBridgeAction;

