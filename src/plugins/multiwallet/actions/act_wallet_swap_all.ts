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
    Connection,
    Keypair,
    PublicKey,
    VersionedTransaction,
} from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import bs58 from 'bs58';
import { v4 as uuidv4 } from 'uuid';
import { SOLANA_SERVICE_NAME } from '../../autonomous-trader/constants';
import { HasEntityIdFromMessage, getWalletsFromText, getAccountFromMessage, askLlmObject, takeItPrivate } from '../../autonomous-trader/utils';

/**
 * Interface representing the content of a swap all operation.
 */
interface SwapAllWalletContent extends Content {
    senderWalletAddress: string;
}

/**
 * Checks if the given swap all content is valid.
 */
function isSwapAllWalletContent(content: SwapAllWalletContent): boolean {
    logger.log('Content for swap all', content);

    if (!content.senderWalletAddress || typeof content.senderWalletAddress !== 'string') {
        console.warn('bad senderWalletAddress')
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
        //console.log('parsedInfo', parsedInfo)
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
    runtime: IAgentRuntime
): Promise<{ swapTransaction: string }> {
    try {
        const decimals =
            inputTokenCA === 'So11111111111111111111111111111111111111111'
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

Extract the following information about the requested swap all:
- Source wallet address to use for the swap all

Example response:
\`\`\`json
{
    "sourceWalletAddress": "FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1"
}
\`\`\`

Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the JSON response format without any preamble or explanation.

IMPORTANT: Your response must ONLY contain the json block above. Do not include any text, thinking, or reasoning before or after this JSON block. Start your response immediately with { and end with }.`;

export default {
    name: 'MULTIWALLET_SWAP_ALL',
    similes: [
        'MULTIWALLET_SWAP_ALL_TOKENS',
        'MULTIWALLET_SWAP_ALL_ASSETS',
        'MULTIWALLET_SWAP_ALL_BALANCES',
        'MULTIWALLET_SWAP_ALL_FUNDS',
        'MULTIWALLET_CONVERT_ALL_TO_SOL',
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        if (!await HasEntityIdFromMessage(runtime, message)) {
            console.log('MULTIWALLET_SWAP_ALL validate - author not found')
            return false
        }
        // they have to be registered
        const account = await getAccountFromMessage(runtime, message)
        if (!account) {
            //console.log('MULTIWALLET_SWAP_ALL validate - registration not found')
            return false;
        }
        return true;
    },
    description: 'Swap all tokens in a wallet back to SOL using Jupiter DEX.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: any[] = []
    ): Promise<boolean> => {
        logger.log('MULTIWALLET_SWAP_ALL Starting handler...');

        const account = await getAccountFromMessage(runtime, message)
        if (!account) return false; // shouldn't hit here

        const sources = await getWalletsFromText(runtime, message)
        console.log('sources', sources)

        const sourcePrompt = composePromptFromState({
            state: state,
            template: sourceAddressTemplate,
        });
        //console.log('prompt', sourcePrompt)

        const sourceResult = await askLlmObject(runtime, { prompt: sourcePrompt },
            ['sourceWalletAddress'])
        //console.log('MULTIWALLET_SWAP_ALL sourceResult', sourceResult);

        if (!sourceResult.sourceWalletAddress) {
            console.log('MULTIWALLET_SWAP_ALL cant determine source wallet address');
            return false;
        }

        // find this user's wallet
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

        const accountComponentData = await getAccountFromMessage(runtime, message)

        const metawallets = accountComponentData.metawallets
        //console.log('metawallets', metawallets)

        const userMetawallet = metawallets.find(mw => mw.keypairs?.solana?.publicKey === sourceResult.sourceWalletAddress);
        //console.log('userMetawallet', userMetawallet)
        if (!userMetawallet) {
            callback?.({ text: 'The requested wallet is not registered in your account.' });
            return false;
        }
        let found = [userMetawallet.keypairs.solana];

        //console.log('MULTIWALLET_SWAP_ALL found', found);

        // gather possibilities
        let contextStr = '';
        const solanaService = runtime.getService(SOLANA_SERVICE_NAME) as any;
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
            //console.log('solBal', solBal, 'heldTokens', heldTokens);
            // loop on remaining tokens and output
            for (const t of heldTokens) {
                const amountRaw = t.account.data.parsed.info.tokenAmount.amount;
                const mintKey = new PublicKey(t.account.data.parsed.info.mint);
                const decimals = t.account.data.parsed.info.tokenAmount.decimals;
                const balance = Number(amountRaw) / (10 ** decimals);
                const symbol = await solanaService.getTokenSymbol(mintKey);
                //console.log('MULTIWALLET_SWAP_ALL symbol', symbol);
                contextStr += '  ' + t.pubkey.toString() + ' ($' + symbol + ') balance: ' + balance + '\n';
            }
            contextStr += '\n';
        }
        console.log('contextStr', contextStr);

        const content = {
            senderWalletAddress: sourceResult.sourceWalletAddress
        } as SwapAllWalletContent;

        console.log('MULTIWALLET_SWAP_ALL content', content);

        if (!isSwapAllWalletContent(content)) {
            callback?.({ text: 'Invalid swap all parameters provided' });
            return false;
        }

        // find source keypair
        console.log('found', found)
        const sourceKp = found.find(kp => kp.publicKey === sourceResult.sourceWalletAddress);
        if (!sourceKp) {
            console.warn('MULTIWALLET_SWAP_ALL Could not find the specified wallet')
            callback?.({ text: 'Could not find the specified wallet' });
            return false;
        }
        console.log('sourceKp', sourceKp.publicKey)

        const secretKey = bs58.decode(sourceKp.privateKey);
        const senderKeypair = Keypair.fromSecretKey(secretKey);

        try {
            const connection = new Connection(
                runtime.getSetting('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com'
            );

            // Get all token accounts
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(senderKeypair.publicKey, {
                programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
            });

            console.log(`Found ${tokenAccounts.value.length} token accounts`);

            // Filter tokens with balances > 0
            const tokenAccountsWithBalances = tokenAccounts.value.filter(account => {
                const amount = BigInt(account.account.data.parsed.info.tokenAmount.amount);
                return amount > 0;
            });

            console.log(`Found ${tokenAccountsWithBalances.length} tokens with balances > 0`);

            if (tokenAccountsWithBalances.length === 0) {
                callback?.({ text: 'No tokens found to swap to SOL' });
                return false;
            }

            const SOL_MINT = 'So11111111111111111111111111111111111111111';
            const WSOL_MINT = 'So11111111111111111111111111111111111111112';
            const signatures: string[] = [];
            let successfulSwaps = 0;
            let failedSwaps = 0;

            // Swap each token to SOL
            for (const tokenAccount of tokenAccountsWithBalances) {
                const tokenInfo = tokenAccount.account.data.parsed.info;
                const mintPubkey = new PublicKey(tokenInfo.mint);
                const amount = Number(tokenInfo.tokenAmount.uiAmount);

                // Skip if it's already SOL
                if (tokenInfo.mint === SOL_MINT) {
                    console.log('Skipping SOL - already SOL');
                    continue;
                }

                try {
                    console.log(`Swapping ${amount} of token ${tokenInfo.mint} to SOL...`);

                    const swapResult = await swapToken(
                        connection,
                        senderKeypair.publicKey,
                        tokenInfo.mint,
                        WSOL_MINT,
                        amount,
                        runtime
                    );

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

                    signatures.push(txid);
                    successfulSwaps++;
                    console.log(`✅ Successfully swapped ${amount} of token ${tokenInfo.mint} to SOL. TX: ${txid}`);

                    // Add a small delay between swaps to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (error) {
                    failedSwaps++;
                    console.error(`❌ Failed to swap token ${tokenInfo.mint}:`, error);
                    logger.error(`Error swapping token ${tokenInfo.mint}:`, error);
                }
            }

            if (successfulSwaps === 0) {
                callback?.({ text: 'No tokens were successfully swapped to SOL' });
                return false;
            }

            const summary = [
                `Swap all completed!`,
                `• Successfully swapped ${successfulSwaps} tokens to SOL`,
                `• Failed to swap ${failedSwaps} tokens`,
                `• Total transactions: ${signatures.length}`,
                `• Latest signature: ${signatures[signatures.length - 1]}`
            ].join('\n');

            callback?.({ text: summary });
            return true;

        } catch (error) {
            logger.error('Error during swap all:', error);
            callback?.({ text: `Swap all failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
            return false;
        }
    },
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Swap all tokens in my wallet FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1 back to SOL',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll help you swap all tokens in your wallet back to SOL",
                    actions: ['MULTIWALLET_SWAP_ALL'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'swap all to SOL on FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll help you swap all tokens in your wallet back to SOL",
                    actions: ['MULTIWALLET_SWAP_ALL'],
                },
            },
        ],
    ] as ActionExample[][],
} as Action;