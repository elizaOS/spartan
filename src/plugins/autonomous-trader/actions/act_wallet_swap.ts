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
import { getWalletKey } from '../keypairUtils';
import { SOLANA_SERVICE_NAME } from '../constants';
import type { SolanaService } from '../service';
import type { Item } from '../types';
import { HasEntityIdFromMessage, getDataFromMessage } from '../utils'

/**
 * Interface representing the content of a swap with a specific wallet.
 */
interface SwapWalletContent extends Content {
    senderWalletAddress: string;
    inputTokenSymbol: string;
    outputTokenSymbol: string;
    inputTokenCA: string | null;
    outputTokenCA: string | null;
    amount: string | number;
}

/**
 * Checks if the given swap content is valid.
 */
function isSwapWalletContent(content: SwapWalletContent): boolean {
    logger.log('Content for swap', content);

    if (!content.sourceWalletAddress || typeof content.sourceWalletAddress !== 'string') {
        console.warn('bad sourceWalletAddress')
        return false;
    }

    if (!content.amount || (typeof content.amount !== 'string' && typeof content.amount !== 'number')) {
        console.warn('bad amount')
        return false;
    }
    console.log('contents good')
    return true;
}

/**
 * Fetches the number of decimals for a given token mint address.
 */
// move to solana service
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
        // tokenAmount?
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
        //console.log('quoteData', quoteData)

        /*
        const quoteResponse = await fetch(
            `https://quote-api.jup.ag/v6/quote?inputMint=${inputTokenCA}&outputMint=${outputTokenCA}&amount=${adjustedAmount}&dynamicSlippage=true&maxAccounts=64`
        );
        const quoteData = await quoteResponse.json();

        if (!quoteData || quoteData.error) {
            logger.error('Quote error:', quoteData);
            throw new Error(`Failed to get quote: ${quoteData?.error || 'Unknown error'}`);
        }
        */

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

        return swapData;
    } catch (error) {
        logger.error('Error in swapToken:', error);
        throw error;
    }
}

/**
 * Template for determining the source wallet address.
 */
const sourceAddressTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Recent Messages:
{{recentMessages}}

Extract the following information about the requested swap:
- Source wallet address to use for the swap

Example response:
\`\`\`json
{
    "sourceWalletAddress": "FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1"
}
\`\`\`

Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the JSON response format without any preamble or explanation.

IMPORTANT: Your response must ONLY contain the json block above. Do not include any text, thinking, or reasoning before or after this JSON block. Start your response immediately with { and end with }.`;

/**
 * Template for determining the swap details.
 */
const swapTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "inputTokenSymbol": "SOL",
    "outputTokenSymbol": "USDC",
    "inputTokenCA": "So11111111111111111111111111111111111111112",
    "outputTokenCA": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": 1.5
}
\`\`\`

{{recentMessages}}

Given the recent messages and wallet information below:

{{possibleWallets}}

Extract the following information about the requested token swap:
- Source wallet address
- Input token symbol (the token being sold)
- Output token symbol (the token being bought)
- Input token contract address if provided
- Output token contract address if provided
- Amount of input token to swap

Respond with a JSON markdown block containing only the extracted values. All fields are required`;

export default {
    name: 'MULTIWALLET_SWAP',
    similes: [
        'MULTIWALLET_SWAP_SOL',
        'MULTIWALLET_SWAP_TOKENS',
        'MULTIWALLET_TRADE_TOKENS',
        'MULTIWALLET_EXCHANGE_TOKENS',
        'MULTIWALLET_SWAP_SOL_TOKENS',
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
      // they have to be registered
      if (!await HasEntityIdFromMessage(runtime, message)) {
        console.log('MULTIWALLET_SWAP validate - author not found')
        return false
      }
      const reg = await getDataFromMessage(runtime, message)
      if (!reg) {
        //console.log('WALLET_CREATION validate - registration not found')
        return false;
      }
      return true;
    },
    description: 'Swap tokens from one of your wallets using Jupiter DEX.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: any[] = []
    ): Promise<boolean> => {
        logger.log('MULTIWALLET_SWAP Starting handler...');

        const sourcePrompt = composePromptFromState({
            state: state,
            template: sourceAddressTemplate,
        });
        const sourceResult = await runtime.useModel(ModelType.OBJECT_LARGE, {
            prompt: sourcePrompt,
        });
        console.log('MULTIWALLET_SWAP sourceResult', sourceResult);

        if (!sourceResult.sourceWalletAddress) {
            console.log('MULTIWALLET_SWAP cant determine source wallet address');
            return false;
        }

        // find this user's wallet
        const entityId = createUniqueUuid(runtime, message.metadata.fromId);

        const asking = 'solana';
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

        const metawallets = await interfaceWalletService.getWalletByUserEntityIds([entityId]);
        const userMetawallets = metawallets[entityId];

        // confirm wallet is in this list
        let found = [];
        for (const mw of userMetawallets) {
            const kp = mw.keypairs.solana;
            if (kp) {
                //console.log('kp', kp);
                if (kp.publicKey.toString() === sourceResult.sourceWalletAddress) {
                    found.push(kp);
                }
            }
        }

        if (!found.length) {
            console.log('MULTIWALLET_SWAP did not find any local wallet with this source address', sourceResult);
            return false;
        }
        console.log('MULTIWALLET_SWAP found', found);

        // gather possibilities
        let contextStr = '';
        const solanaService = runtime.getService(SOLANA_SERVICE_NAME) as any;
        for (const kp of found) {
            const pubKey = kp.publicKey;
            contextStr += 'Wallet Address: ' + pubKey + '\n';
            // get wallet contents
            const pubKeyObj = new PublicKey(pubKey);
            const [solBal, heldTokens] = await Promise.all([
                solanaService.getBalanceByAddr(pubKeyObj),
                solanaService.getTokenAccountsByKeypair(pubKeyObj),
            ]);
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
                // subtract open positions from available amount
                console.log('MULTIWALLET_SWAP symbol', symbol);
                contextStr += '  ' + ca + ' ($' + symbol + ') balance: ' + balance + '\n';
            }
            contextStr += '\n';
        }
        console.log('contextStr', contextStr);

        const swapPrompt = composePromptFromState({
            state: state,
            template: swapTemplate.replace('{{possibleWallets}}', contextStr),
        });

        const result = await runtime.useModel(ModelType.TEXT_LARGE, {
            prompt: swapPrompt,
        });

        const content = parseJSONObjectFromText(result) as SwapWalletContent;

        if (content === null) {
          //return this.handler(runtime, message, state, _options, callback, responses)
          console.log('no usable llm response')
          return false
        }

        console.log('MULTIWALLET_SWAP content', content);

        // find source keypair
        console.log('found', found)
        const sourceKp = found.find(kp => kp.publicKey === sourceResult.sourceWalletAddress);
        if (!sourceKp) {
            console.warn('MULTIWALLET_SWAP Could not find the specified wallet')
            callback?.({ text: 'Could not find the specified wallet' });
            return false;
        }

        // clean up symbols
        content.inputTokenSymbol = content.inputTokenSymbol.replace('$', '')
        content.outputTokenSymbol = content.outputTokenSymbol.replace('$', '')

        // Fix Handle SOL addresses
        if (content.inputTokenSymbol?.toUpperCase() === 'SOL') {
            content.inputTokenCA = 'So11111111111111111111111111111111111111112';
        }
        if (content.outputTokenSymbol?.toUpperCase() === 'SOL') {
            content.outputTokenCA = 'So11111111111111111111111111111111111111112';
        }

        // attempt to check base58 encoding on each CA
        // if fails, look it up from symbol
        if (!solanaService.isValidSolanaAddress(content.inputTokenCA) || !solanaService.validateAddress(content.inputTokenCA)) {
          // find it
          const pubKeyObj = new PublicKey(sourceResult.sourceWalletAddress);
          const heldTokens = await solanaService.getTokenAccountsByKeypair(pubKeyObj)
          for (const t of heldTokens) {
            const amountRaw = t.account.data.parsed.info.tokenAmount.amount;
            const ca = new PublicKey(t.account.data.parsed.info.mint);
            const decimals = t.account.data.parsed.info.tokenAmount.decimals;
            const balance = Number(amountRaw) / (10 ** decimals);
            const symbol = await solanaService.getTokenSymbol(ca);
            if (symbol?.toUpperCase() === content.inputTokenSymbol?.toUpperCase()) {
              console.log('fixed input CA by symbol', symbol, '=>', t.pubkey.toString())
              content.inputTokenCA = ca;
              break
            }
          }
        }
        if (!solanaService.isValidSolanaAddress(content.outputTokenCA) || !solanaService.validateAddress(content.outputTokenCA)) {
          // outputTokenCA
        }

        console.log('MULTIWALLET_SWAP content after fix', content);

        if (!isSwapWalletContent(content)) {
            callback?.({ text: 'Invalid swap parameters provided' });
            return false;
        }

        const secretKey = bs58.decode(sourceKp.privateKey);
        const senderKeypair = Keypair.fromSecretKey(secretKey);

        console.log('MULTIWALLET_SWAP built KP');

        try {
            const connection = new Connection(
                runtime.getSetting('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com'
            );
            console.log('1')

            const swapResult = (await swapToken(
                connection,
                senderKeypair.publicKey,
                content.inputTokenCA as string,
                content.outputTokenCA as string,
                Number(content.amount),
                runtime
            )) as { swapTransaction: string };

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

            const responseText = `Swap completed successfully! Transaction ID: ${txid}`;
            responses.length = 0;
            const memory: Memory = {
                entityId: uuidv4() as UUID,
                roomId: message.roomId,
                text: responseText,
                content: {
                    text: responseText,
                    success: true,
                    txid,
                    amount: content.amount,
                    sender: sourceResult.sourceWalletAddress,
                    inputToken: content.inputTokenSymbol,
                    outputToken: content.outputTokenSymbol,
                }
            };
            responses.push(memory);
            return true;
        } catch (error) {
            logger.error('Error during token swap:', error);
            responses.length = 0;
            const memory: Memory = {
                entityId: uuidv4() as UUID,
                roomId: message.roomId,
                text: `Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                content: {
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            };
            responses.push(memory);
            return false;
        }
    },
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Swap 0.1 SOL for USDC from my wallet FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll help you swap 0.1 SOL for USDC",
                    actions: ['MULTIWALLET_SWAP'],
                },
            },
        ],
    ] as ActionExample[][],
} as Action;