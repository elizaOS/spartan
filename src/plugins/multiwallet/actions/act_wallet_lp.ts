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
    type UUID,
} from '@elizaos/core';
import {
    PublicKey,
} from '@solana/web3.js';
import { v4 as uuidv4 } from 'uuid';
import { SOLANA_SERVICE_NAME } from '../constants';
import { HasEntityIdFromMessage, getAccountFromMessage, getWalletsFromText, takeItPrivate2, askLlmObject } from '../utils';
import { createPosition, updatePosition } from '../interfaces/int_positions';

/**
 * Interface representing the content of an LP operation.
 */
interface LPOperationContent extends Content {
    operation: 'open' | 'close' | 'track' | 'list';
    walletAddress?: string;
    poolAddress?: string;
    tokenAMint?: string;
    tokenBMint?: string;
    lowerPrice?: number;
    upperPrice?: number;
    liquidity?: number;
    tokenAAmount?: number;
    tokenBAmount?: number;
    positionAddress?: string;
}

/**
 * Checks if the given LP operation content is valid.
 */
function isLPOperationContent(content: LPOperationContent): boolean {
    logger.log('Content for LP operation', content);

    if (!content.operation || !['open', 'close', 'track', 'list'].includes(content.operation)) {
        console.warn('bad operation')
        return false;
    }

    if (content.operation === 'open') {
        if (!content.poolAddress || !content.lowerPrice || !content.upperPrice || !content.liquidity) {
            console.warn('missing required fields for open operation')
            return false;
        }
    }

    if (content.operation === 'close') {
        if (!content.positionAddress) {
            console.warn('missing positionAddress for close operation')
            return false;
        }
    }

    console.log('contents good')
    return true;
}

/**
 * Template for determining the LP operation details.
 */
const lpOperationTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Recent Messages:
{{recentMessages}}

Extract the following information about the requested LP operation:
- Operation type: "open", "close", "track", or "list"
- Wallet address (if specified)
- Pool address (if specified)
- Token A mint address (if specified)
- Token B mint address (if specified)
- Lower price for position (if opening)
- Upper price for position (if opening)
- Liquidity amount (if opening)
- Token A amount (if opening)
- Token B amount (if opening)
- Position address (if closing)

Example responses:

For opening a position:
\`\`\`json
{
    "operation": "open",
    "walletAddress": "FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1",
    "poolAddress": "7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoVNUJnm",
    "lowerPrice": 0.95,
    "upperPrice": 1.05,
    "liquidity": 1000,
    "tokenAAmount": 500,
    "tokenBAmount": 500
}
\`\`\`

For closing a position:
\`\`\`json
{
    "operation": "close",
    "positionAddress": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
}
\`\`\`

For listing positions:
\`\`\`json
{
    "operation": "list",
    "walletAddress": "FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1"
}
\`\`\`

For tracking a position:
\`\`\`json
{
    "operation": "track",
    "positionAddress": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
}
\`\`\`

Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the JSON response format without any preamble or explanation.

IMPORTANT: Your response must ONLY contain the json block above. Do not include any text, thinking, or reasoning before or after this JSON block. Start your response immediately with { and end with }.`;

export default {
    name: 'WALLET_LP',
    similes: [
        'WALLET_LIQUIDITY_POOL',
        'WALLET_LP_OPEN',
        'WALLET_LP_CLOSE',
        'WALLET_LP_TRACK',
        'WALLET_LP_LIST',
        'WALLET_LP_MANAGE',
        'WALLET_LP_POSITION',
        'WALLET_LP_POSITIONS',
        'WALLET_LP_OPERATION',
        'WALLET_LP_PROVIDE',
        'WALLET_LP_REMOVE',
        'WALLET_LP_STATUS',
        'WALLET_LP_INFO',
        'WALLET_LP_DETAILS',
        'WALLET_LP_SUMMARY',
        'WALLET_LP_REPORT',
        'WALLET_LP_OVERVIEW',
        'WALLET_LP_VIEW',
        'WALLET_LP_DISPLAY',
        'WALLET_LP_SHOW',
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        if (!await HasEntityIdFromMessage(runtime, message)) {
            console.log('WALLET_LP validate - author not found')
            return false
        }
        // they have to be registered
        const account = await getAccountFromMessage(runtime, message)
        if (!account) {
            return false;
        }
        return true;
    },
    description: 'Manage Raydium liquidity pool positions - open, close, track, and list LP positions for a specified wallet.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: Memory[] = []
    ): Promise<boolean> => {
        logger.log('WALLET_LP Starting handler...');

        const account = await getAccountFromMessage(runtime, message)
        if (!account) return false; // shouldn't hit here

        const sources = await getWalletsFromText(runtime, message)
        console.log('sources', sources)

        const lpPrompt = composePromptFromState({
            state: state,
            template: lpOperationTemplate,
        });

        const result = await askLlmObject(runtime, { prompt: lpPrompt }, ['operation', 'walletAddress', 'poolAddress', 'tokenAMint', 'tokenBMint', 'lowerPrice', 'upperPrice', 'liquidity', 'tokenAAmount', 'tokenBAmount', 'positionAddress']);

        if (!result.operation) {
            console.log('no usable llm response')
            return false
        }

        console.log('WALLET_LP content', result);

        if (!isLPOperationContent(result)) {
            callback?.({ text: 'Invalid LP operation parameters provided' });
            return false;
        }

        // Get Raydium service
        const raydiumService = runtime.getService('RAYDIUM_SERVICE') as any;
        if (!raydiumService) {
            callback?.({ text: 'Raydium service not available. Please try again later.' });
            return false;
        }

        // Get Solana service for wallet operations
        const solanaService = runtime.getService(SOLANA_SERVICE_NAME) as any;
        if (!solanaService) {
            callback?.({ text: 'Solana service not available. Please try again later.' });
            return false;
        }

        try {
            let responseText = '';
            let positionData: any = null;

            switch (result.operation) {
                case 'open':
                    responseText = await handleOpenPosition(runtime, result, account, raydiumService, solanaService);
                    break;
                case 'close':
                    responseText = await handleClosePosition(runtime, result, account, raydiumService, solanaService);
                    break;
                case 'list':
                    responseText = await handleListPositions(runtime, result, account, raydiumService, solanaService);
                    break;
                case 'track':
                    responseText = await handleTrackPosition(runtime, result, account, raydiumService, solanaService);
                    break;
                default:
                    responseText = 'Invalid operation specified';
            }

            if (responseText) {
                takeItPrivate2(runtime, message, responseText, callback);
                return true;
            }

            return false;
        } catch (error) {
            logger.error('Error during LP operation:', error);
            const errorText = `LP operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            takeItPrivate2(runtime, message, errorText, callback);
            return false;
        }
    },
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Open a Raydium LP position for SOL/USDC with 1000 liquidity between $0.95 and $1.05',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll help you open a Raydium liquidity pool position",
                    actions: ['WALLET_LP'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Close my LP position at address 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll close that liquidity pool position for you.',
                    actions: ['WALLET_LP'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'List all my LP positions',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll show you all your liquidity pool positions.',
                    actions: ['WALLET_LP'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Track my LP position performance',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll track your liquidity pool position performance.',
                    actions: ['WALLET_LP'],
                },
            },
        ],
    ] as ActionExample[][],
} as Action;

/**
 * Handle opening a new LP position
 */
async function handleOpenPosition(
    runtime: IAgentRuntime,
    content: LPOperationContent,
    account: any,
    raydiumService: any,
    solanaService: any
): Promise<string> {
    // Determine wallet to use
    let walletAddress = content.walletAddress;
    if (!walletAddress && account.metawallets?.length > 0) {
        walletAddress = account.metawallets[0].keypairs.solana.publicKey;
    }

    if (!walletAddress) {
        return 'No wallet address specified or found in your account.';
    }

    // Validate pool exists
    if (!content.poolAddress) {
        return 'Pool address is required to open a position.';
    }

    const poolInfo = await raydiumService.getCPMMPoolInfo(content.poolAddress);
    if (!poolInfo) {
        return `Pool ${content.poolAddress} not found or invalid.`;
    }

    // Calculate optimal liquidity if not provided
    let liquidity = content.liquidity;
    let tokenAAmount = content.tokenAAmount;
    let tokenBAmount = content.tokenBAmount;

    if (!liquidity || !tokenAAmount || !tokenBAmount) {
        const optimalCalc = await raydiumService.calculateOptimalLiquidity({
            poolAddress: content.poolAddress,
            lowerPrice: content.lowerPrice!,
            upperPrice: content.upperPrice!,
            tokenAAmount: tokenAAmount || 1000,
            tokenBAmount: tokenBAmount || 1000,
        });
        liquidity = optimalCalc.liquidity;
        tokenAAmount = optimalCalc.tokenAAmount;
        tokenBAmount = optimalCalc.tokenBAmount;
    }

    // Open the position
    const openResult = await raydiumService.openCPMMPosition({
        poolAddress: content.poolAddress,
        lowerPrice: content.lowerPrice!,
        upperPrice: content.upperPrice!,
        liquidity: liquidity!,
        tokenAAmount: tokenAAmount!,
        tokenBAmount: tokenBAmount!,
        userPublicKey: walletAddress,
    });

    // Save position to database
    const positionData = {
        id: uuidv4(),
        chain: 'solana',
        token: poolInfo.tokenAMint,
        tokenB: poolInfo.tokenBMint,
        poolAddress: content.poolAddress,
        positionAddress: openResult.positionAddress,
        lowerPrice: content.lowerPrice!,
        upperPrice: content.upperPrice!,
        liquidity: liquidity!,
        tokenAAmount: tokenAAmount!,
        tokenBAmount: tokenBAmount!,
        status: 'Raydium LP',
        entryPrice: tokenAAmount! / tokenBAmount!,
        solAmount: tokenAAmount!,
        tokenAmount: tokenBAmount!,
        signature: openResult.signature,
        createdAt: new Date().toISOString(),
    };

    await createPosition(runtime, account.entityId, positionData);

    return `✅ LP Position opened successfully!
• Position Address: ${openResult.positionAddress}
• Pool: ${poolInfo.tokenAMint} / ${poolInfo.tokenBMint}
• Price Range: $${content.lowerPrice} - $${content.upperPrice}
• Liquidity: ${liquidity}
• Transaction: ${openResult.signature}`;
}

/**
 * Handle closing an LP position
 */
async function handleClosePosition(
    runtime: IAgentRuntime,
    content: LPOperationContent,
    account: any,
    raydiumService: any,
    solanaService: any
): Promise<string> {
    if (!content.positionAddress) {
        return 'Position address is required to close a position.';
    }

    // Get position info
    const positionInfo = await raydiumService.getCPMMPositionInfo(content.positionAddress);
    if (!positionInfo) {
        return `Position ${content.positionAddress} not found or invalid.`;
    }

    // Determine wallet to use
    let walletAddress = content.walletAddress;
    if (!walletAddress && account.metawallets?.length > 0) {
        walletAddress = account.metawallets[0].keypairs.solana.publicKey;
    }

    if (!walletAddress) {
        return 'No wallet address specified or found in your account.';
    }

    // Close the position
    const closeResult = await raydiumService.closeCPMMPosition({
        positionAddress: content.positionAddress,
        userPublicKey: walletAddress,
    });

    // Update position status in database
    // Note: We'd need to find the position in the database and update it
    // For now, we'll just return the result

    return `✅ LP Position closed successfully!
• Position Address: ${content.positionAddress}
• Token A Returned: ${closeResult.tokenAAmount}
• Token B Returned: ${closeResult.tokenBAmount}
• Fees Earned A: ${closeResult.feeAmountA}
• Fees Earned B: ${closeResult.feeAmountB}
• Transaction: ${closeResult.signature}`;
}

/**
 * Handle listing LP positions
 */
async function handleListPositions(
    runtime: IAgentRuntime,
    content: LPOperationContent,
    account: any,
    raydiumService: any,
    solanaService: any
): Promise<string> {
    // Determine wallet to use
    let walletAddress = content.walletAddress;
    if (!walletAddress && account.metawallets?.length > 0) {
        walletAddress = account.metawallets[0].keypairs.solana.publicKey;
    }

    if (!walletAddress) {
        return 'No wallet address specified or found in your account.';
    }

    // Get all positions for the wallet
    const positions = await raydiumService.getUserCPMMPositions(walletAddress);

    if (!positions || positions.length === 0) {
        return 'No LP positions found for this wallet.';
    }

    let responseText = `📊 LP Positions for ${walletAddress}:\n\n`;

    for (const position of positions) {
        const poolInfo = await raydiumService.getCPMMPoolInfo(position.poolAddress);
        const tokenASymbol = await solanaService.getTokenSymbol(new PublicKey(poolInfo.tokenAMint)) || poolInfo.tokenAMint.slice(0, 8);
        const tokenBSymbol = await solanaService.getTokenSymbol(new PublicKey(poolInfo.tokenBMint)) || poolInfo.tokenBMint.slice(0, 8);

        responseText += `🔸 Position: ${position.positionAddress}\n`;
        responseText += `   Pool: ${tokenASymbol}/${tokenBSymbol}\n`;
        responseText += `   Price Range: $${position.lowerPrice} - $${position.upperPrice}\n`;
        responseText += `   Liquidity: ${position.liquidity}\n`;
        responseText += `   Token A: ${position.tokenAAmount}\n`;
        responseText += `   Token B: ${position.tokenBAmount}\n`;
        responseText += `   Fees A: ${position.feeAmountA}\n`;
        responseText += `   Fees B: ${position.feeAmountB}\n`;
        responseText += `   Active: ${position.isActive ? 'Yes' : 'No'}\n\n`;
    }

    return responseText;
}

/**
 * Handle tracking LP position performance
 */
async function handleTrackPosition(
    runtime: IAgentRuntime,
    content: LPOperationContent,
    account: any,
    raydiumService: any,
    solanaService: any
): Promise<string> {
    if (!content.positionAddress) {
        return 'Position address is required to track a position.';
    }

    // Get position info
    const positionInfo = await raydiumService.getCPMMPositionInfo(content.positionAddress);
    if (!positionInfo) {
        return `Position ${content.positionAddress} not found or invalid.`;
    }

    // Get pool info
    const poolInfo = await raydiumService.getCPMMPoolInfo(positionInfo.poolAddress);
    const poolMetrics = await raydiumService.getCPMMPoolMetrics(positionInfo.poolAddress);

    const tokenASymbol = await solanaService.getTokenSymbol(new PublicKey(poolInfo.tokenAMint)) || poolInfo.tokenAMint.slice(0, 8);
    const tokenBSymbol = await solanaService.getTokenSymbol(new PublicKey(poolInfo.tokenBMint)) || poolInfo.tokenBMint.slice(0, 8);

    // Calculate current value and fees
    const currentValue = positionInfo.tokenAAmount + positionInfo.tokenBAmount;
    const totalFees = positionInfo.feeAmountA + positionInfo.feeAmountB;

    let responseText = `📈 LP Position Performance:\n\n`;
    responseText += `🔸 Position: ${content.positionAddress}\n`;
    responseText += `🔸 Pool: ${tokenASymbol}/${tokenBSymbol}\n`;
    responseText += `🔸 Price Range: $${positionInfo.lowerPrice} - $${positionInfo.upperPrice}\n`;
    responseText += `🔸 Current Liquidity: ${positionInfo.liquidity}\n`;
    responseText += `🔸 Token A Amount: ${positionInfo.tokenAAmount}\n`;
    responseText += `🔸 Token B Amount: ${positionInfo.tokenBAmount}\n`;
    responseText += `🔸 Fees Earned A: ${positionInfo.feeAmountA}\n`;
    responseText += `🔸 Fees Earned B: ${positionInfo.feeAmountB}\n`;
    responseText += `🔸 Total Fees: ${totalFees}\n`;
    responseText += `🔸 Current Value: ${currentValue}\n`;
    responseText += `🔸 Pool TVL: $${poolMetrics.tvl.toFixed(2)}\n`;
    responseText += `🔸 Pool Volume 24h: $${poolMetrics.volume24h.toFixed(2)}\n`;
    responseText += `🔸 Pool Fees 24h: $${poolMetrics.fee24h.toFixed(2)}\n`;
    responseText += `🔸 Status: ${positionInfo.isActive ? 'Active' : 'Inactive'}\n`;

    return responseText;
} 