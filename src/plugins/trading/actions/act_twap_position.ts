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
    Connection,
    Keypair,
    PublicKey,
    VersionedTransaction,
} from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import bs58 from 'bs58';
import { v4 as uuidv4 } from 'uuid';
import { UUID } from 'crypto';
import { SOLANA_SERVICE_NAME } from '../../autonomous-trader/constants';
import { askLlmObject, takeItPrivate2, getAccountFromMessage, getWalletsFromText, HasEntityIdFromMessage } from '../../autonomous-trader/utils';
import { createPosition } from '../interfaces/int_positions';
import { parseDateFilterFromMessage, getDateRange } from '../../autonomous-trader/providers/date_filter';

/**
 * Interface representing the content of a TWAP request (both simple and position).
 */
interface TwapContent extends Content {
    senderWalletAddress: string;
    tokenSymbol: string;
    tokenCA: string | null;
    totalAmount: string | number;
    endDate: Date;
    intervalMinutes?: number;
    stopLossPrice?: number;
    takeProfitPrice?: number;
    exitReasoning?: string;
    description?: string;
    isPosition?: boolean; // Whether this should create a position or just execute orders
}

/**
 * Interface for TWAP task metadata (unified for both types)
 */
interface TwapTaskMetadata {
    twapId: string;
    positionId?: string; // Only present for position-type TWAPs
    senderWalletAddress: string;
    tokenSymbol: string;
    tokenCA: string;
    totalAmount: number;
    remainingAmount: number;
    endDate: Date;
    intervalMinutes: number;
    stopLossPrice?: number;
    takeProfitPrice?: number;
    exitReasoning?: string;
    description?: string;
    isPosition: boolean;
    createdAt: Date;
    lastExecution?: Date;
    executions: Array<{
        timestamp: Date;
        amount: number;
        txid?: string;
        success: boolean;
        error?: string;
    }>;
}

/**
 * Checks if the given TWAP content is valid.
 */
function isTwapContent(content: TwapContent): boolean {
    logger.log('Content for TWAP', content);

    if (!content.totalAmount || (typeof content.totalAmount !== 'string' && typeof content.totalAmount !== 'number')) {
        console.warn('bad totalAmount', typeof (content.totalAmount), content.totalAmount)
        return false;
    }

    if (!content.tokenSymbol) {
        console.warn('bad tokenSymbol', content.tokenSymbol)
        return false;
    }

    if (!content.endDate || !(content.endDate instanceof Date)) {
        console.warn('bad endDate', content.endDate)
        return false;
    }

    console.log('contents good')
    return true;
}

/**
 * Fetches the number of decimals for a given token mint address.
 */
async function getTokenDecimals(connection: Connection, mintAddress: string): Promise<number> {
    const mintPublicKey = new PublicKey(mintAddress);
    const tokenAccountInfo = await connection.getParsedAccountInfo(mintPublicKey);

    if (
        tokenAccountInfo.value &&
        typeof tokenAccountInfo.value.data === 'object' &&
        'parsed' in tokenAccountInfo.value.data
    ) {
        const parsedInfo = tokenAccountInfo.value.data.parsed?.info;
        console.log('parsedInfo', parsedInfo)
        if (parsedInfo && typeof parsedInfo?.decimals === 'number') {
            return parsedInfo.decimals;
        }
    }
    console.log('getTokenDecimals tokenAccountInfo', tokenAccountInfo)
    throw new Error('Unable to fetch token decimals');
}

/**
 * Swaps tokens using Jupiter API.
 */
async function swapToken(
    connection: Connection,
    walletPublicKey: PublicKey,
    inputTokenCA: string,
    outputTokenCA: string,
    amount: number,
    runtime
): Promise<unknown> {
    try {
        const decimals =
            inputTokenCA === 'So11111111111111111111111111111111111111112'
                ? new BigNumber(9)
                : new BigNumber(await getTokenDecimals(connection, inputTokenCA));

        logger.log('Decimals:', decimals.toString());

        const amountBN = new BigNumber(amount);
        const adjustedAmount = amountBN.multipliedBy(new BigNumber(10).pow(decimals));

        logger.log('Fetching quote with params:', {
            inputMint: inputTokenCA,
            outputMint: outputTokenCA,
            amount: adjustedAmount,
        });

        const jupiterService = runtime.getService('JUPITER_SERVICE') as any;

        const quoteData = await jupiterService.getQuote({
            inputMint: inputTokenCA,
            outputMint: outputTokenCA,
            amount: adjustedAmount,
            slippageBps: 200,
        });

        const swapRequestBody = {
            quoteResponse: quoteData,
            userPublicKey: walletPublicKey.toBase58(),
            dynamicComputeUnitLimit: true,
            dynamicSlippage: true,
            priorityLevelWithMaxLamports: {
                maxLamports: 4000000,
                priorityLevel: 'veryHigh',
            },
        };

        const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(swapRequestBody),
        });

        const swapData = await swapResponse.json();

        if (!swapData || !swapData.swapTransaction) {
            logger.error('Swap error:', swapData);
            throw new Error(
                `Failed to get swap transaction: ${swapData?.error || 'No swap transaction returned'}`
            );
        }

        return {
            ...swapData,
            quoteResponse: quoteData
        };
    } catch (error) {
        logger.error('Error in swapToken:', error);
        throw error;
    }
}

/**
 * Template for determining the TWAP details (unified for both types).
 */
const twapTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Recent Messages:
{{recentMessages}}

Given the recent messages and wallet information below:

{{possibleWallets}}

Extract the following information about the requested TWAP (Time-Weighted Average Price) order:
- Source wallet address (the wallet to use for the transaction)
- Token symbol (the token to buy, e.g., "SOL", "USDC", "CHAD")
- Token contract address if provided (optional, will be looked up if not provided)
- Total amount to spend (the total SOL amount to convert to the target token over time)
- End date (when the TWAP should complete)
- Interval in minutes (optional, default 60 minutes between executions)
- Stop loss price (if specified)
- Take profit price (if specified)
- Exit reasoning (if provided)
- Description (optional, for tracking purposes)
- Is position (whether this should create a managed position with exit conditions)

Example response:
\`\`\`json
{
    "senderWalletAddress": "FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1",
    "tokenSymbol": "SOL",
    "tokenCA": "So11111111111111111111111111111111111111112",
    "totalAmount": 100,
    "endDate": "2025-08-27T00:00:00.000Z",
    "intervalMinutes": 60,
    "stopLossPrice": 0.50,
    "takeProfitPrice": 1.00,
    "exitReasoning": "Exit if it drops below 0.50 or above 1.00",
    "description": "TWAP for SOL",
    "isPosition": true
}
\`\`\`

Important: The "totalAmount" field should be the total amount of SOL to spend over the entire TWAP period. The system will automatically calculate how much to buy in each interval.

Respond with a JSON markdown block containing only the extracted values. All fields are required except intervalMinutes, stopLossPrice, takeProfitPrice, exitReasoning, description, tokenCA, and isPosition.`;

/**
 * Template for canceling TWAP orders.
 */
const cancelTwapTemplate = `Respond with a JSON markdown block containing only the extracted values.

Recent Messages:
{{recentMessages}}

Extract the following information about the TWAP cancellation request:
- TWAP ID (the unique identifier of the TWAP order to cancel)

Example response:
\`\`\`json
{
    "twapId": "xsdesdsdsdds"
}
\`\`\`

Respond with a JSON markdown block containing only the extracted values.`;

export default {
    name: 'TWAP',
    similes: [
        'TWAP_BUY',
        'TWAP_ORDER',
        'TWAP_POSITION',
        'TWAP_POSITION_OPEN',
        'TWAP_POSITION_BUY',
        'TWAP_POSITION_ORDER',
        'TWAP_POSITION_DCA',
        'TIME_WEIGHTED_BUY',
        'TIME_WEIGHTED_POSITION',
        'DCA_BUY',
        'DCA_POSITION',
        'SCHEDULED_BUY',
        'SCHEDULED_POSITION',
        'CANCEL_TWAP',
        'CANCEL_TWAP_POSITION',
        'CANCEL_TWAP_ORDER',
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // they have to be registered
        if (!await HasEntityIdFromMessage(runtime, message)) {
            console.log('TWAP validate - author not found')
            return false
        }
        const account = await getAccountFromMessage(runtime, message)
        if (!account) {
            return false;
        }

        // Check if message contains TWAP keywords
        const messageText = message.content?.text?.toLowerCase() || ''

        const twapKeywords = [
            'twap', 'time weighted', 'dca', 'dollar cost average', 'scheduled buy',
            'buy until', 'buy over time', 'position until', 'position over time',
            'cancel twap', 'cancel position'
        ]

        // Check for specific patterns that indicate TWAP
        const hasTwapKeyword = twapKeywords.some(keyword => messageText.includes(keyword))

        // Also check for "buy X until Y" pattern specifically
        const buyUntilPattern = /\bbuy\s+\d+\s+.*until\b/i
        const hasBuyUntilPattern = buyUntilPattern.test(messageText)

        // Check for time-based buying patterns
        const timePatterns = [
            /\buntil\s+\d{1,2}\/\d{1,2}\/\d{4}\b/i,
            /\buntil\s+\d{4}-\d{1,2}-\d{1,2}\b/i,
            /\bover\s+time\b/i,
            /\bover\s+\d+\s+(?:days?|weeks?|months?)\b/i
        ]
        const hasTimePattern = timePatterns.some(pattern => pattern.test(messageText))

        // Additional check for "buy X until Y" with more flexible pattern
        const simpleBuyUntil = messageText.includes('buy') && messageText.includes('until')

        return hasTwapKeyword || hasBuyUntilPattern || hasTimePattern || simpleBuyUntil
    },
    description: 'Create or cancel Time-Weighted Average Price (TWAP) orders for buying tokens over time, with optional position management and exit conditions.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: any[] = []
    ): Promise<void> => {
        logger.log('TWAP Starting handler...');

        const messageText = message.content?.text?.toLowerCase() || '';

        // Check if this is a cancellation request
        if (messageText.includes('cancel')) {
            await handleTwapCancellation(runtime, message, state, callback);
        } else {
            await handleTwapCreation(runtime, message, state, callback);
        }
    },
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'spartan buy 100 dollars of SOL until 08/27/2025',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll create a TWAP order to buy $100 worth of SOL over time until August 27, 2025",
                    actions: ['TWAP'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'spartan open twap position on 200 $CHAD until 08/27/2025, exit if it drops below 0.50 or above 1.00',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll open a TWAP position on 200 $CHAD with those exit conditions",
                    actions: ['TWAP'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'spartan cancel twap xsdesdsdsdds',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll cancel the TWAP with ID xsdesdsdsdds",
                    actions: ['TWAP'],
                },
            },
        ],
    ] as ActionExample[][],
} as Action;

/**
 * Handle TWAP creation (unified for both simple orders and positions)
 */
async function handleTwapCreation(
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    callback?: HandlerCallback
): Promise<void> {
    const account = await getAccountFromMessage(runtime, message)
    if (!account) return;
    console.log('account', account)

    // Get source wallet
    const walletSources = await getWalletsFromText(runtime, message)
    console.log('walletSources', walletSources)

    if (walletSources.length !== 1) {
        takeItPrivate2(runtime, message, "Can't determine source wallet", callback)
        return
    }
    const sourceResult = {
        sourceWalletAddress: walletSources[0]
    }

    if (!sourceResult.sourceWalletAddress) {
        console.log('TWAP cant determine source wallet address');
        return;
    }

    // Get wallet service
    const interfaceWalletService = runtime.getService('AUTONOMOUS_TRADER_INTERFACE_WALLETS') as any;
    const userMetawallets = account.metawallets;

    // confirm wallet is in this list
    let found: any[] = [];
    for (const mw of userMetawallets) {
        const kp = mw.keypairs.solana;
        if (kp) {
            if (kp.publicKey.toString() === sourceResult.sourceWalletAddress) {
                found.push(kp);
            }
        }
    }

    if (!found.length) {
        console.log('TWAP did not find any local wallet with this source address', sourceResult);
        return;
    }
    console.log('TWAP found', found);

    // gather wallet context for LLM to parse details from message
    const solanaService = runtime.getService('chain_solana') as any;
    let contextStr = '';

    // Add wallet context
    for (const kp of found) {
        const pubKey = kp.publicKey;
        contextStr += 'Wallet Address: ' + pubKey + '\n';
        // get wallet contents
        const pubKeyObj = new PublicKey(pubKey);
        const [balances, heldTokens] = await Promise.all([
          solanaService.getBalancesByAddrs([pubKey]),
          solanaService.getTokenAccountsByKeypair(pubKeyObj),
        ]);
        const solBal = balances[pubKey]
        contextStr += '  Token Address (Symbol)\n';
        contextStr += '  So11111111111111111111111111111111111111111 ($sol) balance: ' + (solBal ?? 'unknown') + '\n';
        console.log('solBal', solBal, 'heldTokens', heldTokens);
        // loop on remaining tokens and output
        for (const t of heldTokens) {
            const amountRaw = t.account.data.parsed.info.tokenAmount.amount;
            const ca = new PublicKey(t.account.data.parsed.info.mint);
            const decimals = t.account.data.parsed.info.tokenAmount.decimals;
            const balance = Number(amountRaw) / (10 ** decimals);
            const symbol = await solanaService.getTokenSymbol(ca);
            console.log('TWAP symbol', symbol);
            contextStr += '  ' + ca + ' ($' + symbol + ') balance: ' + balance + '\n';
        }
        contextStr += '\n';
    }
    console.log('contextStr', contextStr);

    const twapPrompt = composePromptFromState({
        state: state,
        template: twapTemplate.replace('{{possibleWallets}}', contextStr),
    });

    const content = await askLlmObject(runtime, { prompt: twapPrompt }, [
        'totalAmount', 'tokenSymbol', 'endDate'
    ])

    if (content === null) {
        console.log('no usable llm response')
        callback?.({ text: 'Could not figure out the request' });
        return
    }

    console.log('TWAP content', content);

    // find source keypair
    console.log('found', found)
    const sourceKp = found.find(kp => kp.publicKey === sourceResult.sourceWalletAddress);
    if (!sourceKp) {
        console.warn('TWAP Could not find the specified wallet')
        callback?.({ text: 'Could not find the specified wallet' });
        return;
    }

    // clean up symbols
    content.tokenSymbol = content.tokenSymbol.replace('$', '')

    // Fix Handle SOL addresses
    if (content.tokenSymbol?.toUpperCase() === 'SOL') {
        content.tokenCA = 'So11111111111111111111111111111111111111112';
    }

    // ensure we have a CA
    if (!content.tokenCA || content.tokenCA === "null") {
      const birdeyeService = runtime.getService('birdeye') as any;
      const options = await birdeyeService.lookupSymbolAllChains(content.tokenSymbol)
      const exactOptions = options.filter(t => t.symbol === content.tokenSymbol)
      console.log('birdeye symbol', content.tokenSymbol, 'options', exactOptions)
      if (exactOptions.length > 1) {
        // abort
        console.warn('TWAP Could not be sure of the right CA')
        // FIXME: build string of available options
        let str = ''
        for(const o of exactOptions) {
          str += o.symbol + ': ' + o.address + '\n'
        }
        callback?.({ text: 'Could not be sure of the right CA:\n' + str });
        return;
      }
      //content.tokenCA =
    }
    console.log('verifying', content.tokenCA)

    // attempt to check base58 encoding on each CA
    // if fails, look it up from symbol
    if (!solanaService.isValidSolanaAddress(content.tokenCA) || !solanaService.validateAddress(content.tokenCA)) {
        // find it via symbol
        const pubKeyObj = new PublicKey(sourceResult.sourceWalletAddress);
        const heldTokens = await solanaService.getTokenAccountsByKeypair(pubKeyObj)
        for (const t of heldTokens) {
            const amountRaw = t.account.data.parsed.info.tokenAmount.amount;
            const ca = new PublicKey(t.account.data.parsed.info.mint);
            const decimals = t.account.data.parsed.info.tokenAmount.decimals;
            const balance = Number(amountRaw) / (10 ** decimals);
            const symbol = await solanaService.getTokenSymbol(ca);
            if (symbol?.toUpperCase() === content.tokenSymbol?.toUpperCase()) {
                console.log('fixed token CA by symbol', symbol, '=>', t.pubkey.toString())
                content.tokenCA = ca;
                break
            }
        }
    }
    const addyType = await solanaService.getAddressType(content.tokenCA)
    if (addyType !== 'Token') {
      // likely an LLM misparse, try the pipeline again
      console.warn(content.tokenCA, 'is not a Token, its a', addyType, 'retrying action')
      handleTwapCreation(runtime, message, state, callback)
      //console.warn('TWAP selected tokenCA isnt a token')
      //callback?.({ text: 'Determined tokenCA is not a token' });
      return;
    }

    // ensure date
    content.endDate = new Date(content.endDate)

    console.log('TWAP content after fix', content);

    // check for input & output
    if (!isTwapContent(content)) {
        callback?.({ text: 'Invalid TWAP parameters provided' });
        return;
    }

    // Clean up and validate content values
    // Handle string "null" values from LLM
    if (content.intervalMinutes === "null" || content.intervalMinutes === null || content.intervalMinutes === undefined) {
        content.intervalMinutes = 60; // Default to 1 hour intervals
    } else {
        content.intervalMinutes = Number(content.intervalMinutes);
    }

    if (content.stopLossPrice === "null" || content.stopLossPrice === null || content.stopLossPrice === undefined) {
        content.stopLossPrice = undefined;
    } else {
        content.stopLossPrice = Number(content.stopLossPrice);
    }

    if (content.takeProfitPrice === "null" || content.takeProfitPrice === null || content.takeProfitPrice === undefined) {
        content.takeProfitPrice = undefined;
    } else {
        content.takeProfitPrice = Number(content.takeProfitPrice);
    }

    if (content.exitReasoning === "null" || content.exitReasoning === null || content.exitReasoning === undefined) {
        content.exitReasoning = undefined;
    }

    if (content.description === "null" || content.description === null || content.description === undefined) {
        content.description = undefined;
    }

    if (content.isPosition === "null" || content.isPosition === null || content.isPosition === undefined) {
        content.isPosition = undefined;
    }

    // Determine if this should be a position based on keywords or explicit flag
    const messageText = message.content?.text?.toLowerCase() || '';
    const isPosition = Boolean(content.isPosition) ||
                      messageText.includes('position') ||
                      (content.stopLossPrice !== undefined) ||
                      (content.takeProfitPrice !== undefined) ||
                      content.exitReasoning;

    let positionId: UUID | undefined;

    // Create position record if this is a position-type TWAP
    if (isPosition) {
        positionId = uuidv4() as UUID;
        const position = {
            id: positionId,
            chain: 'solana',
            token: content.tokenCA as string,
            publicKey: sourceResult.sourceWalletAddress,
            solAmount: content.totalAmount.toString(),
            tokenAmount: '0', // Will be updated as TWAP executes
            swapFee: 0,
            timestamp: Date.now(),
            exitConditions: {
                reasoning: content.exitReasoning || 'TWAP position with time-based buying',
                priceDrop: content.stopLossPrice || null,
                targetPrice: content.takeProfitPrice || null
            },
            twapMetadata: {
                isTwap: true,
                totalAmount: Number(content.totalAmount),
                remainingAmount: Number(content.totalAmount),
                endDate: content.endDate,
                intervalMinutes: content.intervalMinutes,
                description: content.description
            }
        };

        // Save position to database
        await createPosition(runtime, account.entityId, position);
    }

    // Create TWAP task metadata
    const twapId = uuidv4() as UUID;
    const twapMetadata: TwapTaskMetadata = {
        twapId: twapId,
        positionId: positionId,
        senderWalletAddress: sourceResult.sourceWalletAddress,
        tokenSymbol: content.tokenSymbol,
        tokenCA: content.tokenCA as string,
        totalAmount: Number(content.totalAmount),
        remainingAmount: Number(content.totalAmount),
        endDate: content.endDate,
        intervalMinutes: content.intervalMinutes,
        stopLossPrice: content.stopLossPrice,
        takeProfitPrice: content.takeProfitPrice,
        exitReasoning: content.exitReasoning,
        description: content.description || `${isPosition ? 'TWAP position' : 'TWAP order'} for ${content.totalAmount} SOL worth of ${content.tokenSymbol}`,
        isPosition: isPosition,
        createdAt: new Date(),
        executions: []
    };

    // Calculate execution schedule
    const now = new Date();
    const timeUntilEnd = content.endDate.getTime() - now.getTime();
    
    // Validate end date is in the future
    if (timeUntilEnd <= 0) {
        callback?.({ text: 'End date must be in the future' });
        return;
    }
    
    // Ensure intervalMinutes is a valid number
    if (!content.intervalMinutes || isNaN(content.intervalMinutes) || content.intervalMinutes <= 0) {
        content.intervalMinutes = 60; // Default to 1 hour
    }
    
    const totalIntervals = Math.ceil(timeUntilEnd / (content.intervalMinutes * 60 * 1000));
    
    // Validate total amount
    if (!content.totalAmount || isNaN(Number(content.totalAmount)) || Number(content.totalAmount) <= 0) {
        callback?.({ text: 'Total amount must be a positive number' });
        return;
    }
    
    const amountPerInterval = Number(content.totalAmount) / Math.max(1, totalIntervals);

    console.log('TWAP Schedule:', {
        totalIntervals,
        amountPerInterval,
        intervalMinutes: content.intervalMinutes,
        endDate: content.endDate,
        isPosition: isPosition
    });

    // Register the TWAP execution task worker (only once)
    // Check if worker is already registered to avoid duplicates
    const existingWorkers = runtime.getTaskWorker("EXECUTE_TWAP");
    let hasWorker = true;
    if(!existingWorkers) {
      hasWorker = false;
    }
    
    if (!hasWorker) {
        runtime.registerTaskWorker({
            name: 'EXECUTE_TWAP',
            validate: async (runtime: IAgentRuntime, _message: Memory, _state: State) => {
                return true;
            },
            execute: async (runtime: IAgentRuntime, options: { [key: string]: unknown }, task: any) => {
            console.log('TWAP task execution started:', task.id);
            try {
                const metadata = task.metadata as TwapTaskMetadata;
                console.log('TWAP metadata:', metadata);

                // Check if TWAP is still active
                if (new Date() > metadata.endDate || metadata.remainingAmount <= 0) {
                    console.log('TWAP completed or expired:', metadata.twapId);
                    // Mark task as completed
                    await runtime.updateTask(task.id as `${string}-${string}-${string}-${string}-${string}`, {
                        ...task,
                        status: 'completed',
                        metadata: {
                            ...metadata,
                            completedAt: new Date()
                        }
                    });
                    return;
                }

                // Calculate amount for this execution
                const timeUntilEnd = metadata.endDate.getTime() - new Date().getTime();
                const remainingIntervals = Math.ceil(timeUntilEnd / (metadata.intervalMinutes * 60 * 1000));
                const executionAmount = Math.min(metadata.remainingAmount, metadata.remainingAmount / Math.max(1, remainingIntervals));
                
                console.log('TWAP execution calculation:', {
                    timeUntilEnd,
                    remainingIntervals,
                    executionAmount,
                    remainingAmount: metadata.remainingAmount
                });

                // Execute the swap
                const connection = new Connection(
                    runtime.getSetting('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com'
                );

                // Get the wallet keypair
                const account = await getAccountFromMessage(runtime, { entityId: task.entityId } as Memory);
                if (!account) {
                    console.log('Account not found for TWAP execution, entityId:', task.entityId);
                    throw new Error('Account not found for TWAP execution');
                }

                const mw = account.metawallets.find(mw => mw.keypairs.solana?.publicKey === metadata.senderWalletAddress);
                if (!mw?.keypairs.solana) {
                    console.log('Wallet not found for TWAP execution, wallet address:', metadata.senderWalletAddress);
                    console.log('Available wallets:', account.metawallets.map(mw => mw.keypairs.solana?.publicKey));
                    throw new Error('Wallet not found for TWAP execution');
                }

                const secretKey = bs58.decode(mw.keypairs.solana.privateKey);
                const senderKeypair = Keypair.fromSecretKey(secretKey);

                const swapResult = await swapToken(
                    connection,
                    senderKeypair.publicKey,
                    'So11111111111111111111111111111111111111112', // SOL
                    metadata.tokenCA,
                    executionAmount,
                    runtime
                ) as { swapTransaction: string; quoteResponse?: any };

                const transactionBuf = Buffer.from(swapResult.swapTransaction, 'base64');
                const transaction = VersionedTransaction.deserialize(transactionBuf);
                transaction.sign([senderKeypair]);

                const latestBlockhash = await connection.getLatestBlockhash();
                const txid = await connection.sendTransaction(transaction, {
                    skipPreflight: false,
                    maxRetries: 3,
                    preflightCommitment: 'confirmed',
                });

                const confirmation = await connection.confirmTransaction(
                    {
                        signature: txid,
                        blockhash: latestBlockhash.blockhash,
                        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
                    },
                    'confirmed'
                );

                if (confirmation.value.err) {
                    throw new Error(`Transaction failed: ${confirmation.value.err}`);
                }

                // Extract output amount from quote if available
                let outputAmount = '0';
                if (swapResult.quoteResponse?.outAmount) {
                    const outputDecimals = metadata.tokenCA === 'So11111111111111111111111111111111111111112'
                        ? 9
                        : await getTokenDecimals(connection, metadata.tokenCA);
                    const outAmountBN = new BigNumber(swapResult.quoteResponse.outAmount);
                    outputAmount = outAmountBN.dividedBy(new BigNumber(10).pow(outputDecimals)).toString();
                }

                // Update metadata
                metadata.remainingAmount -= executionAmount;
                metadata.lastExecution = new Date();
                metadata.executions.push({
                    timestamp: new Date(),
                    amount: executionAmount,
                    txid: txid,
                    success: true
                });

                // Update task metadata
                await runtime.updateTask(task.id as `${string}-${string}-${string}-${string}-${string}`, {
                    ...task,
                    metadata: metadata,
                    // Schedule next execution if not completed
                    nextExecution: new Date(Date.now() + (metadata.intervalMinutes * 60 * 1000))
                });

                console.log(`${metadata.isPosition ? 'TWAP position' : 'TWAP'} execution successful: ${executionAmount} SOL -> ${outputAmount} ${metadata.tokenSymbol}, TX: ${txid}`);
                console.log('Next execution scheduled for:', new Date(Date.now() + (metadata.intervalMinutes * 60 * 1000)));

            } catch (error) {
                logger.error('Error executing TWAP:', error);

                // Record failed execution
                const metadata = task.metadata as TwapTaskMetadata;
                metadata.executions.push({
                    timestamp: new Date(),
                    amount: 0,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });

                await runtime.updateTask(task.id as `${string}-${string}-${string}-${string}-${string}`, {
                    ...task,
                    metadata: metadata,
                    // Still schedule next execution even on failure
                    nextExecution: new Date(Date.now() + (metadata.intervalMinutes * 60 * 1000))
                });
                
                console.log('TWAP execution failed, next retry scheduled for:', new Date(Date.now() + (metadata.intervalMinutes * 60 * 1000)));
            }
        },
    });
    }

    // Create the scheduled task
    const taskResult = await runtime.createTask({
        id: twapId as `${string}-${string}-${string}-${string}-${string}`,
        name: 'EXECUTE_TWAP',
        description: `${isPosition ? 'TWAP position' : 'TWAP order'} for ${content.totalAmount} SOL worth of ${content.tokenSymbol}`,
        tags: ['queue', 'repeat', 'twap', 'trading', ...(isPosition ? ['position'] : [])],
        metadata: {
            ...twapMetadata,
            taskStatus: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            updateInterval: content.intervalMinutes * 60 * 1000, // Convert minutes to milliseconds
        },
        worldId: runtime.agentId,
        roomId: message.roomId,
        entityId: account.entityId,

    });

    console.log('TWAP task created:', taskResult);

    // Format response
    const responseText = `✅ ${isPosition ? 'TWAP position opened' : 'TWAP order created'} successfully!

💰 **${isPosition ? 'Position' : 'Order'} Details:**
• Total Amount: ${content.totalAmount} SOL
• Token: ${content.tokenSymbol} (${content.tokenCA})
• End Date: ${content.endDate.toLocaleDateString()}
• Interval: ${content.intervalMinutes} minutes
${positionId ? `• Position ID: \`${positionId}\`` : ''}
• TWAP ID: \`${twapId}\`

${isPosition && (content.stopLossPrice !== undefined || content.takeProfitPrice !== undefined || content.exitReasoning) ? `🎯 **Exit Conditions:**
${content.stopLossPrice !== undefined ? `• Stop Loss: $${content.stopLossPrice}` : ''}
${content.takeProfitPrice !== undefined ? `• Take Profit: $${content.takeProfitPrice}` : ''}
${content.exitReasoning ? `• Reasoning: ${content.exitReasoning}` : ''}
` : ''}

📊 **Schedule:**
• ${totalIntervals} executions planned
• ~${amountPerInterval.toFixed(4)} SOL per execution
• First execution: ${new Date(Date.now() + (content.intervalMinutes * 60 * 1000)).toLocaleString()}

💼 **Wallet:** ${sourceResult.sourceWalletAddress}

To cancel this ${isPosition ? 'TWAP position' : 'TWAP order'}, use: "spartan cancel twap ${twapId}"`;

    takeItPrivate2(runtime, message, responseText, callback)
}

/**
 * Handle TWAP cancellation (unified for both types)
 */
async function handleTwapCancellation(
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    callback?: HandlerCallback
): Promise<void> {
    const cancelPrompt = composePromptFromState({
        state: state,
        template: cancelTwapTemplate,
    });

    const content = await askLlmObject(runtime, { prompt: cancelPrompt }, ['twapId'])

    if (content === null || !content.twapId) {
        callback?.({ text: 'Could not determine which TWAP to cancel. Please provide the TWAP ID.' });
        return;
    }

    try {
        // Find and delete the TWAP task
        const tasks = await runtime.getTasksByName('EXECUTE_TWAP');
        const twapTask = tasks.find(task => {
            const metadata = task.metadata as unknown as TwapTaskMetadata;
            return metadata?.twapId === content.twapId;
        });

        if (!twapTask) {
            callback?.({ text: `TWAP with ID "${content.twapId}" not found.` });
            return;
        }

        // Delete the task
        await runtime.deleteTask(twapTask.id as `${string}-${string}-${string}-${string}-${string}`);

        const metadata = twapTask.metadata as unknown as TwapTaskMetadata;
        const responseText = `✅ ${metadata.isPosition ? 'TWAP position' : 'TWAP order'} cancelled successfully!

🗑️ **Cancelled ${metadata.isPosition ? 'TWAP Position' : 'TWAP Order'}:**
• ID: \`${content.twapId}\`
${metadata.positionId ? `• Position ID: \`${metadata.positionId}\`` : ''}
• Token: ${metadata.tokenSymbol}
• Remaining Amount: ${metadata.remainingAmount.toFixed(4)} SOL
• Executions Completed: ${metadata.executions.filter(e => e.success).length}

The ${metadata.isPosition ? 'TWAP position has been stopped and will no longer execute. The position remains open for manual management.' : 'TWAP order has been stopped and will no longer execute.'}`;

        takeItPrivate2(runtime, message, responseText, callback)

    } catch (error) {
        logger.error('Error cancelling TWAP:', error);
        callback?.({ text: `Failed to cancel TWAP: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
}
