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

/**
 * Interface representing the content of a position opening request.
 */
interface OpenPositionContent extends Content {
    senderWalletAddress: string;
    tokenSymbol: string;
    tokenCA: string | null;
    amount: string | number;
    stopLossPrice?: number;
    takeProfitPrice?: number;
    exitReasoning?: string;
}

/**
 * Checks if the given position content is valid.
 */
function isOpenPositionContent(content: OpenPositionContent): boolean {
    logger.log({ content }, 'Content for open position');

    if (!content.amount || (typeof content.amount !== 'string' && typeof content.amount !== 'number')) {
        console.warn('bad amount', typeof (content.amount), content.amount)
        return false;
    }

    if (!content.tokenSymbol) {
        console.warn('bad tokenSymbol', content.tokenSymbol)
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
 * Swaps SOL for tokens using Jupiter API.
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

        logger.log({
            inputMint: inputTokenCA,
            outputMint: outputTokenCA,
            amount: adjustedAmount,
        }, 'Fetching quote with params');

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
        logger.error({ error }, 'Error in swapToken');
        throw error;
    }
}

/**
 * Template for determining the position opening details.
 */
const openPositionTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Recent Messages:
{{recentMessages}}

Given the recent messages and wallet information below:

{{possibleWallets}}

Extract the following information about the requested position opening:
- Source wallet address (the wallet to use for the transaction)
- Token symbol (the token to buy, e.g., "CHAD", "USDC", "ai16z")
- Token contract address if provided (optional, will be looked up if not provided)
- Amount of SOL to spend (the SOL amount to convert to the target token)
- Stop loss price (if specified)
- Take profit price (if specified)
- Exit reasoning (if provided)

Example response:
\`\`\`json
{
    "senderWalletAddress": "FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1",
    "tokenSymbol": "CHAD",
    "tokenCA": "CAhKQzMx1czhbrYhLTk3SQo3wCq7evyVQyWiLqGJqhp5",
    "amount": 200,
    "stopLossPrice": 0.50,
    "takeProfitPrice": 1.00,
    "exitReasoning": "Exit if it drops below 0.50 or above 1.00"
}
\`\`\`

Important: The "amount" field should be the amount of SOL to spend to buy the target token. The user wants to convert SOL to the specified token.

Respond with a JSON markdown block containing only the extracted values. All fields are required except stopLossPrice, takeProfitPrice, exitReasoning, and tokenCA.`;

export default {
    name: 'OPEN_POSITION',
    similes: [
        'OPEN_TRADING_POSITION',
        'OPEN_TOKEN_POSITION',
        'START_POSITION',
        'BUY_AND_TRACK',
        'OPEN_POSITION_ON_TOKEN',
        'OPEN_POSITION_ON_SOL',
        'OPEN_POSITION_ON_TOKENS',
    ],
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        // they have to be registered
        if (!await HasEntityIdFromMessage(runtime, message)) {
            console.log('OPEN_POSITION validate - author not found')
            return false
        }
        const account = await getAccountFromMessage(runtime, message)
        if (!account) {
            return false;
        }

        // Check if message contains position opening keywords
        const messageText = message.content?.text?.toLowerCase() || ''
        const positionKeywords = [
            'open a position', 'open position', 'start position', 'buy and track',
            'position on', 'exit if', 'stop loss', 'take profit', 'target price'
        ]

        return positionKeywords.some(keyword => messageText.includes(keyword))
    },
    description: 'Open a trading position by buying tokens and setting exit conditions.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: any[] = []
    ) => {
        logger.log('OPEN_POSITION Starting handler...');
        const account = await getAccountFromMessage(runtime, message)
        if (!account) return false; // shouldn't hit here
        console.log('account', account)

        // Get source wallet
        const sources = await getWalletsFromText(runtime, message)
        console.log('sources', sources)
        if (sources.length !== 1) {
            if (callback) {
                takeItPrivate2(runtime, message, "Can't determine source wallet", callback)
            }
            return
        }
        const sourceResult = {
            sourceWalletAddress: sources[0]
        }

        if (!sourceResult.sourceWalletAddress) {
            console.log('OPEN_POSITION cant determine source wallet address');
            return;
        }


        // FIXME: don't need wallet service, can just use interface files directly
        // Get wallet service
        const asking = 'open position';
        const serviceType = 'AUTONOMOUS_TRADER_INTERFACE_WALLETS';
        let interfaceWalletService = runtime.getService(serviceType) as any;
        while (!interfaceWalletService) {
            console.log(asking, 'waiting for', serviceType, 'service...');
            interfaceWalletService = runtime.getService(serviceType) as any;
            if (!interfaceWalletService) {
                await new Promise((waitResolve) => setTimeout(waitResolve, 1000));
            } else {
                console.log(asking, 'Acquired', serviceType, 'service...');
            }
        }

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
            console.log('OPEN_POSITION did not find any local wallet with this source address', sourceResult);
            return;
        }
        console.log('OPEN_POSITION found', found);

        // gather wallet context for LLM to parse details from message
        let contextStr = '';
        const solanaService = runtime.getService(SOLANA_SERVICE_NAME) as any;
        // don't need to get wallet context, opening a positon has nothing to do with his wallet
        /*
        for (const kp of found) {
            const pubKey = kp.publicKey;
            contextStr += 'Wallet Address: ' + pubKey + '\n';
            // get wallet contents
            const pubKeyObj = new PublicKey(pubKey);
            const [balances, heldTokens] = await Promise.all([
              solanaService.getBalancesByAddrs([pubKey])
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
                console.log('OPEN_POSITION symbol', symbol);
                contextStr += '  ' + ca + ' ($' + symbol + ') balance: ' + balance + '\n';
            }
            contextStr += '\n';
        }
        */
        console.log('contextStr', contextStr);

        const openPositionPrompt = composePromptFromState({
            state: state,
            template: openPositionTemplate.replace('{{possibleWallets}}', contextStr),
        });

        const content = await askLlmObject(runtime, { prompt: openPositionPrompt }, [
            'amount', 'tokenSymbol'
        ])

        if (content === null) {
            console.log('no usable llm response')
            callback?.({ text: 'Could not figure out the request' });
            return
        }

        console.log('OPEN_POSITION content', content);

        // find source keypair
        console.log('found', found)
        const sourceKp = found.find(kp => kp.publicKey === sourceResult.sourceWalletAddress);
        if (!sourceKp) {
            console.warn('OPEN_POSITION Could not find the specified wallet')
            callback?.({ text: 'Could not find the specified wallet' });
            return;
        }

        // clean up symbols
        content.tokenSymbol = content.tokenSymbol.replace('$', '')

        // Fix Handle SOL addresses
        if (content.tokenSymbol?.toUpperCase() === 'SOL') {
            content.tokenCA = 'So11111111111111111111111111111111111111112';
        }

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

        console.log('OPEN_POSITION content after fix', content);

        // check for input & output
        if (!isOpenPositionContent(content)) {
            callback?.({ text: 'Invalid position parameters provided' });
            return;
        }

        const secretKey = bs58.decode(sourceKp.privateKey);
        const senderKeypair = Keypair.fromSecretKey(secretKey);

        console.log('OPEN_POSITION built KP');

        try {
            const connection = new Connection(
                runtime.getSetting('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com'
            );
            console.log('1')

            // use solanaService

            // Execute the swap (buy tokens with SOL)
            const swapResult = (await swapToken(
                connection,
                senderKeypair.publicKey,
                'So11111111111111111111111111111111111111112', // SOL
                content.tokenCA as string,
                Number(content.amount),
                runtime
            )) as { swapTransaction: string; quoteResponse?: any };

            console.log('2')

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
            let outputAmount = 'Unknown';
            if (swapResult.quoteResponse?.outAmount) {
                const outputDecimals = content.tokenCA === 'So11111111111111111111111111111111111111112'
                    ? 9
                    : await getTokenDecimals(connection, content.tokenCA as string);
                const outAmountBN = new BigNumber(swapResult.quoteResponse.outAmount);
                outputAmount = outAmountBN.dividedBy(new BigNumber(10).pow(outputDecimals)).toString();
            }

            // Create position record
            const position = {
                id: uuidv4() as UUID,
                chain: 'solana',
                token: content.tokenCA as string,
                publicKey: sourceResult.sourceWalletAddress,
                // usdAmount?
                solAmount: content.amount.toString(),
                tokenAmount: swapResult.quoteResponse?.outAmount || '0',
                swapFee: 0, // Could extract from swap result if needed
                timestamp: Date.now(),
                // tokenPriceUsd
                // tokenLiquidity
                exitConditions: {
                    reasoning: content.exitReasoning || 'Manual position opening',
                    // sentimentDrop
                    // liqudityDrop
                    // volumeDrop
                    priceDrop: content.stopLossPrice || null,
                    targetPrice: content.takeProfitPrice || null
                }
            };

            // Save position to database
            await createPosition(runtime, account.entityId, position);

            // Create Solscan link
            const solscanLink = `https://solscan.io/tx/${txid}`;

            // Format response with all details
            const responseText = `✅ Position opened successfully!

💰 **Position Details:**
• ${content.amount} SOL → ${outputAmount} ${content.tokenSymbol}
• Token: ${content.tokenSymbol} (${content.tokenCA})

🎯 **Exit Conditions:**
${content.stopLossPrice ? `• Stop Loss: $${content.stopLossPrice}` : ''}
${content.takeProfitPrice ? `• Take Profit: $${content.takeProfitPrice}` : ''}
${content.exitReasoning ? `• Reasoning: ${content.exitReasoning}` : ''}

🔗 **Transaction Details:**
• Transaction ID: \`${txid}\`
• Solscan: ${solscanLink}

💼 **Wallet:** ${sourceResult.sourceWalletAddress}`;

            if (callback) {
                takeItPrivate2(runtime, message, responseText, callback)
            }
        } catch (error) {
            runtime.logger.error({ error }, 'Error during position opening');
            if (callback) {
                takeItPrivate2(runtime, message, `Position opening failed: ${error instanceof Error ? error.message : 'Unknown error'}`, callback)
            }
        }
    },
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'open a position on 200 $CHAD, exit if it drops below 0.50 or above 1.00',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll help you open a position on 200 $CHAD with those exit conditions",
                    actions: ['OPEN_POSITION'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Open a position on 0.5 SOL worth of USDC from my wallet FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll open a position for you with 0.5 SOL worth of USDC",
                    actions: ['OPEN_POSITION'],
                },
            },
        ],
    ] as ActionExample[][],
} as Action;