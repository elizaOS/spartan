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
    createAssociatedTokenAccountInstruction,
    createTransferInstruction,
    createCloseAccountInstruction,
    getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    TransactionMessage,
    VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { v4 as uuidv4 } from 'uuid';
import { SOLANA_SERVICE_NAME } from '../../autonomous-trader/constants';
import { HasEntityIdFromMessage, getWalletsFromText, getAccountFromMessage, askLlmObject } from '../../autonomous-trader/utils';

/**
 * Interface representing the content of a sweep operation.
 */
interface SweepWalletContent extends Content {
    senderWalletAddress: string;
    recipientWalletAddress: string;
}

/**
 * Checks if the given sweep content is valid.
 */
function isSweepWalletContent(content: SweepWalletContent): boolean {
    logger.log('Content for sweep', content);

    if (!content.senderWalletAddress || typeof content.senderWalletAddress !== 'string') {
        console.warn('bad senderWalletAddress')
        return false;
    }

    if (!content.recipientWalletAddress || typeof content.recipientWalletAddress !== 'string') {
        console.warn('bad recipientWalletAddress')
        return false;
    }
    console.log('contents good')
    return true;
}

/**
 * Template for determining the source wallet address.
 */
const sourceAddressTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Recent Messages:
{{recentMessages}}

Extract the following information about the requested sweep:
- Source wallet address to use for the sweep

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
 * Template for determining the sweep details.
 */
const sweepTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "senderWalletAddress": "FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1",
    "recipientWalletAddress": "3nMBmufBUBVnk28sTp3NsrSJsdVGTyLZYmsqpMFaUT9J"
}
\`\`\`

{{recentMessages}}

Given the recent messages and wallet information below:

{{possibleWallets}}

Extract the following information about the requested sweep:
- Source wallet address
- Recipient wallet address

Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.`;

export default {
    name: 'MULTIWALLET_SWEEP',
    similes: [
        'MULTIWALLET_SWEEP_ALL',
        'MULTIWALLET_SWEEP_TOKENS',
        'MULTIWALLET_SWEEP_ASSETS',
        'MULTIWALLET_SWEEP_BALANCES',
        'MULTIWALLET_SWEEP_FUNDS',
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        if (!await HasEntityIdFromMessage(runtime, message)) {
            console.log('MULTIWALLET_SWEEP validate - author not found')
            return false
        }
        // they have to be registered
        const account = await getAccountFromMessage(runtime, message)
        if (!account) {
            //console.log('MULTIWALLET_SWEEP validate - registration not found')
            return false;
        }
        return true;
    },
    description: 'Sweep all assets (SOL and SPL tokens) from one wallet to another.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: any[] = []
    ): Promise<boolean> => {
        logger.log('MULTIWALLET_SWEEP Starting handler...');

        const account = await getAccountFromMessage(runtime, message)
        if (!account) return false; // shouldn't hit here

        //const validSources = account.metawallets.map(mw => mw.keypairs.solana.publicKey)
        //console.log('validSources', validSources)
        const sources = await getWalletsFromText(runtime, message)
        console.log('sources', sources)

        const sourcePrompt = composePromptFromState({
            state: state,
            template: sourceAddressTemplate,
        });
        console.log('prompt', sourcePrompt)

        /*
        const sourceResult = await runtime.useModel(ModelType.OBJECT_LARGE, {
            prompt: sourcePrompt,
        });
        */
        const sourceResult = await askLlmObject(runtime, { prompt: sourcePrompt },
            ['sourceWalletAddress'])
        console.log('MULTIWALLET_SWEEP sourceResult', sourceResult);

        if (!sourceResult.sourceWalletAddress) {
            console.log('MULTIWALLET_SWEEP cant determine source wallet address');
            return false;
        }

        // find this user's wallet
        //const entityId = createUniqueUuid(runtime, message.metadata?.sourceId || '');

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
        console.log('metawallets', metawallets)

        const userMetawallet = metawallets.find(mw => mw.keypairs?.solana?.publicKey === sourceResult.sourceWalletAddress);
        console.log('userMetawallet', userMetawallet)
        if (!userMetawallet) {
            callback?.({ text: 'The requested wallet is not registered in your account.' });
            return false;
        }
        let found = [userMetawallet.keypairs.solana];

        /*
        // confirm wallet is in this list
        let found: any[] = [];
        //for (const mw of userMetawallets) {
            const kp = userMetawallet.keypairs.solana;
            if (kp) {
                console.log('kp', kp);
                if (kp.publicKey.toString() === sourceResult.sourceWalletAddress) {
                    found.push(kp);
                }
            }
        //}

        if (!found.length) {
            console.log('MULTIWALLET_SWEEP did not find any local wallet with this source address', sourceResult);
            return false;
        }
        */
        console.log('MULTIWALLET_SWEEP found', found);

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
            console.log('solBal', solBal, 'heldTokens', heldTokens);
            // loop on remaining tokens and output
            for (const t of heldTokens) {
                const amountRaw = t.account.data.parsed.info.tokenAmount.amount;
                const mintKey = new PublicKey(t.account.data.parsed.info.mint);
                const decimals = t.account.data.parsed.info.tokenAmount.decimals;
                const balance = Number(amountRaw) / (10 ** decimals);
                const symbol = await solanaService.getTokenSymbol(mintKey);
                console.log('MULTIWALLET_SWEEP symbol', symbol);
                contextStr += '  ' + t.pubkey.toString() + ' ($' + symbol + ') balance: ' + balance + '\n';
            }
            contextStr += '\n';
        }
        console.log('contextStr', contextStr);

        const sweepPrompt = composePromptFromState({
            state: state,
            template: sweepTemplate,
        });

        const result = await runtime.useModel(ModelType.TEXT_LARGE, {
            prompt: sweepPrompt.replace('{{possibleWallets}}', contextStr),
        });

        const content = parseJSONObjectFromText(result) as SweepWalletContent;

        if (content === null) {
            console.log('no usable llm response')
            return false
        }

        console.log('MULTIWALLET_SWEEP content', content);

        if (!isSweepWalletContent(content)) {
            callback?.({ text: 'Invalid sweep parameters provided' });
            return false;
        }

        // find source keypair
        console.log('found', found)
        const sourceKp = found.find(kp => kp.publicKey === sourceResult.sourceWalletAddress);
        if (!sourceKp) {
            console.warn('MULTIWALLET_SWEEP Could not find the specified wallet')
            callback?.({ text: 'Could not find the specified wallet' });
            return false;
        }
        console.log('sourceKp', sourceKp)

        const secretKey = bs58.decode(sourceKp.privateKey);
        const senderKeypair = Keypair.fromSecretKey(secretKey);

        const recipientPubkey = new PublicKey(content.recipientWalletAddress);

        try {
            const connection = new Connection(
                runtime.getSetting('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com'
            );

            // Get all token accounts and SOL balance
            const [solBalance, tokenAccounts] = await Promise.all([
                connection.getBalance(senderKeypair.publicKey),
                connection.getParsedTokenAccountsByOwner(senderKeypair.publicKey, {
                    programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
                }),
            ]);

            /*
            const instructions: any[] = [];
            const signatures = [];
            const ataInstructions = [];
            const tokenTransfers = [];

            console.log('solBalance', solBalance, 'lamports')

            // Handle SOL transfer (leave some for fees)
            // 1m per ATA
            if (solBalance > 5000) { // Leave 5000 lamports for fees
                instructions.push(
                    SystemProgram.transfer({
                        fromPubkey: senderKeypair.publicKey,
                        toPubkey: recipientPubkey,
                        lamports: solBalance - 5000,
                    })
                );
            }

            // Handle SPL token transfers
            // create all ATAs
            for (const tokenAccount of tokenAccounts.value) {
                const tokenInfo = tokenAccount.account.data.parsed.info;
                const mintPubkey = new PublicKey(tokenInfo.mint);
                const amount = BigInt(tokenInfo.tokenAmount.amount);

                if (amount > 0) {
                    const senderATA = tokenAccount.pubkey;
                    const recipientATA = getAssociatedTokenAddressSync(mintPubkey, recipientPubkey);

                    // Check if recipient ATA exists
                    const recipientATAInfo = await connection.getAccountInfo(recipientATA);
                    if (!recipientATAInfo) {
                        ataInstructions.push(
                            createAssociatedTokenAccountInstruction(
                                senderKeypair.publicKey,
                                recipientATA,
                                recipientPubkey,
                                mintPubkey
                            )
                        );
                    }

                   tokenTransfers.push({
                        senderATA,
                        recipientATA,
                        amount
                    });
//                     instructions.push(
//                         createTransferInstruction(
//                             senderATA,
//                             recipientATA,
//                             senderKeypair.publicKey,
//                             amount
//                         )
//                     );
                }
            }

            if (instructions.length === 0) {
                callback?.({ text: 'No assets to sweep' });
                return false;
            }

            // dispatch
            // Send ATA creation transactions (batch up to 3-4 ATA creations per tx)
            if (ataInstructions.length > 0) {
                const ataChunks = [];
                for (let i = 0; i < ataInstructions.length; i += 3) {
                    ataChunks.push(ataInstructions.slice(i, i + 3));
                }

                for (const chunk of ataChunks) {
                    const messageV0 = new TransactionMessage({
                        payerKey: senderKeypair.publicKey,
                        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                        instructions: chunk,
                    }).compileToV0Message();

                    const transaction = new VersionedTransaction(messageV0);
                    transaction.sign([senderKeypair]);

                    const sig = await connection.sendTransaction(transaction, {
                        skipPreflight: false,
                        maxRetries: 3,
                        preflightCommitment: 'confirmed',
                    });

                    signatures.push(sig);
                    console.log('ATA creation signature:', sig);

                    // Wait for confirmation before next batch
                    await connection.confirmTransaction(sig, 'confirmed');
                }
            }

            // Step 2: Send token transfers (batch up to 8-10 transfers per tx)
            if (tokenTransfers.length > 0) {
                const transferChunks = [];
                for (let i = 0; i < tokenTransfers.length; i += 8) {
                    transferChunks.push(tokenTransfers.slice(i, i + 8));
                }

                for (const chunk of transferChunks) {
                    const instructions = chunk.map(transfer =>
                        createTransferInstruction(
                            transfer.senderATA,
                            transfer.recipientATA,
                            senderKeypair.publicKey,
                            transfer.amount
                        )
                    );

                    const messageV0 = new TransactionMessage({
                        payerKey: senderKeypair.publicKey,
                        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                        instructions,
                    }).compileToV0Message();

                    const transaction = new VersionedTransaction(messageV0);
                    transaction.sign([senderKeypair]);

                    const sig = await connection.sendTransaction(transaction, {
                        skipPreflight: false,
                        maxRetries: 3,
                        preflightCommitment: 'confirmed',
                    });

                    signatures.push(sig);
                    console.log('Token transfer signature:', sig);

                    // Wait for confirmation before next batch
                    await connection.confirmTransaction(sig, 'confirmed');
                }
            }

            // Step 3: Send SOL last (after all token transfers to ensure we have enough for fees)
            if (solBalance > 10000) { // Leave more SOL for fees since we're doing multiple txs
                const solInstruction = SystemProgram.transfer({
                    fromPubkey: senderKeypair.publicKey,
                    toPubkey: recipientPubkey,
                    lamports: solBalance - 10000, // Leave 10k lamports for final tx fees
                });

                const messageV0 = new TransactionMessage({
                    payerKey: senderKeypair.publicKey,
                    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                    instructions: [solInstruction],
                }).compileToV0Message();

                const transaction = new VersionedTransaction(messageV0);
                transaction.sign([senderKeypair]);

                const sig = await connection.sendTransaction(transaction, {
                    skipPreflight: false,
                    maxRetries: 3,
                    preflightCommitment: 'confirmed',
                });

                signatures.push(sig);
                console.log('SOL transfer signature:', sig);
            }

            if (signatures.length === 0) {
                callback?.({ text: 'No assets to sweep' });
                return false;
            }
            */

            /*
            // Create and send transaction
            console.log('sending from', senderKeypair.publicKey.toBase58())
            const messageV0 = new TransactionMessage({
                payerKey: senderKeypair.publicKey,
                recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                instructions,
            }).compileToV0Message();

            const transaction = new VersionedTransaction(messageV0);
            transaction.sign([senderKeypair]);

            const latestBlockhash = await connection.getLatestBlockhash();
            // probably needs to be raw
            const signature = await connection.sendTransaction(transaction, {
                skipPreflight: false,
                maxRetries: 3,
                preflightCommitment: 'confirmed',
            });
            console.log('signature', signature)

            const confirmation = await connection.confirmTransaction(
                {
                    signature: signature,
                    blockhash: latestBlockhash.blockhash,
                    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
                },
                'confirmed'
            );

            if (confirmation.value.err) {
                throw new Error(`Transaction failed: ${confirmation.value.err}`);
            }
            */

            console.log(`Starting sweep - SOL balance: ${solBalance} lamports`);
            console.log(`Found ${tokenAccounts.value.length} token accounts`);

            // Prepare data for batch ATA existence check
            const tokenAccountsWithBalances = tokenAccounts.value.filter(account => {
                const amount = BigInt(account.account.data.parsed.info.tokenAmount.amount);
                return amount > 0;
            });

            const tokenMints = tokenAccountsWithBalances.map(account =>
                new PublicKey(account.account.data.parsed.info.mint)
            );

            // Batch check recipient ATAs existence
            const recipientATAs = tokenMints.map(mint =>
                getAssociatedTokenAddressSync(mint, recipientPubkey)
            );

            console.log(`Checking ${recipientATAs.length} recipient ATAs...`);
            const ataExistenceChecks = await Promise.all(
                recipientATAs.map(ata => connection.getAccountInfo(ata))
            );

            const instructions = [];
            let transferredTokens = 0;
            let skippedTokens = 0;
            let closedAccounts = 0;

            // Calculate if we can afford ATA creation after account closures
            const rentRecoveryFromClosures = closedAccounts * 2039280; // ~0.002 SOL per account
            const projectedBalance = solBalance + rentRecoveryFromClosures;
            const ataCreationCost = 2039280; // Cost per ATA

            console.log(`Projected balance after closures: ${projectedBalance} lamports`);

            // Process tokens - create ATAs if we can afford them, otherwise skip
            for (let i = 0; i < tokenAccountsWithBalances.length; i++) {
                const tokenAccount = tokenAccountsWithBalances[i];
                const tokenInfo = tokenAccount.account.data.parsed.info;
                const amount = BigInt(tokenInfo.tokenAmount.amount);
                const recipientATA = recipientATAs[i];
                const ataExists = ataExistenceChecks[i] !== null;
                const mintPubkey = new PublicKey(tokenInfo.mint);

                if (ataExists) {
                    // Recipient has ATA - transfer tokens
                    instructions.push(
                        createTransferInstruction(
                            tokenAccount.pubkey,
                            recipientATA,
                            senderKeypair.publicKey,
                            amount
                        )
                    );
                    transferredTokens++;
                    console.log(`✓ Will transfer ${tokenInfo.tokenAmount.uiAmount} ${tokenInfo.mint.slice(0, 8)}... (existing ATA)`);
                } else {
                    // Check if we can afford to create ATA
                    const currentCost = (transferredTokens - skippedTokens) * ataCreationCost; // ATAs we're already creating
                    const totalCostWithThis = currentCost + ataCreationCost;
                    const estimatedFinalBalance = projectedBalance - totalCostWithThis - 15000; // 15k for tx fees

                    if (estimatedFinalBalance > 0) {
                        // We can afford this ATA - create it and transfer
                        instructions.push(
                            createAssociatedTokenAccountInstruction(
                                senderKeypair.publicKey,
                                recipientATA,
                                recipientPubkey,
                                mintPubkey
                            )
                        );
                        instructions.push(
                            createTransferInstruction(
                                tokenAccount.pubkey,
                                recipientATA,
                                senderKeypair.publicKey,
                                amount
                            )
                        );
                        transferredTokens++;
                        console.log(`✓ Will create ATA and transfer ${tokenInfo.tokenAmount.uiAmount} ${tokenInfo.mint.slice(0, 8)}...`);
                    } else {
                        // Can't afford this ATA
                        skippedTokens++;
                        console.log(`✗ Skipping ${tokenInfo.tokenAmount.uiAmount} ${tokenInfo.mint.slice(0, 8)}... (can't afford ATA: need ${ataCreationCost}, have ${estimatedFinalBalance})`);
                    }
                }
            }

            // Close all empty token accounts to recover rent
            for (const tokenAccount of tokenAccounts.value) {
                const amount = BigInt(tokenAccount.account.data.parsed.info.tokenAmount.amount);
                if (amount === 0n) {
                    instructions.push(
                        createCloseAccountInstruction(
                            tokenAccount.pubkey,
                            senderKeypair.publicKey, // Rent refunded to sender
                            senderKeypair.publicKey
                        )
                    );
                    closedAccounts++;
                }
            }

            console.log(`Will close ${closedAccounts} empty accounts (recovering ~${closedAccounts * 0.002} SOL)`);

            // Calculate SOL transfer amount AFTER accounting for ATA creation costs
            let ataCreationCosts = 0;
            for (let i = 0; i < instructions.length; i++) {
                // Count ATA creation instructions (they come in pairs with transfers usually)
                if (instructions[i].programId.equals(new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'))) {
                    ataCreationCosts += ataCreationCost;
                }
            }

            // Add SOL transfer last - account for actual costs
            const estimatedFees = 10000; // Transaction fee
            const walletRentExempt = 890880; // Minimum SOL to keep wallet rent-exempt (~0.0009 SOL)
            const actualCostsInTx = ataCreationCosts; // ATAs will be created in this tx

            const availableForTransfer = solBalance - estimatedFees - walletRentExempt - actualCostsInTx;

            if (availableForTransfer > 0) {
                instructions.push(
                    SystemProgram.transfer({
                        fromPubkey: senderKeypair.publicKey,
                        toPubkey: recipientPubkey,
                        lamports: availableForTransfer,
                    })
                );
                console.log(`Will transfer ${availableForTransfer} lamports SOL (~${availableForTransfer / 1e9} SOL) after costs`);
                console.log(`Keeping ${walletRentExempt + estimatedFees} lamports for wallet rent + fees`);
            } else {
                console.log(`Insufficient SOL for transfer after costs. Need: ${actualCostsInTx + estimatedFees + walletRentExempt}, have: ${solBalance}`);
            }

            if (instructions.length === 0) {
                callback?.({ text: 'No assets to sweep - no recipient ATAs exist and no empty accounts to close' });
                return false;
            }

            console.log(`Total instructions: ${instructions.length}`);

            // Check if we can fit in one transaction (conservative limit)
            if (instructions.length <= 10) {
                console.log('Attempting single transaction...');

                const messageV0 = new TransactionMessage({
                    payerKey: senderKeypair.publicKey,
                    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                    instructions,
                }).compileToV0Message();

                const transaction = new VersionedTransaction(messageV0);
                transaction.sign([senderKeypair]);

                const signature = await connection.sendTransaction(transaction, {
                    skipPreflight: false,
                    maxRetries: 3,
                    preflightCommitment: 'confirmed',
                });

                console.log('✅ Single transaction signature:', signature);

                const summary = [
                    `Sweep completed in one transaction!`,
                    `• Transferred ${transferredTokens} tokens`,
                    `• Skipped ${skippedTokens} tokens (no recipient ATAs)`,
                    `• Closed ${closedAccounts} empty accounts`,
                    `• Signature: ${signature}`
                ].join('\n');

                callback?.({ text: summary });
                return true;

            } else {
                // Fall back to batching for very large numbers of instructions
                console.log('Too many instructions for single transaction, batching...');

                const batchSize = 8;
                const batches = [];
                for (let i = 0; i < instructions.length; i += batchSize) {
                    batches.push(instructions.slice(i, i + batchSize));
                }

                const signatures = [];
                for (let i = 0; i < batches.length; i++) {
                    const batch = batches[i];
                    console.log(`Sending batch ${i + 1}/${batches.length} with ${batch.length} instructions...`);

                    const messageV0 = new TransactionMessage({
                        payerKey: senderKeypair.publicKey,
                        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                        instructions: batch,
                    }).compileToV0Message();

                    const transaction = new VersionedTransaction(messageV0);
                    transaction.sign([senderKeypair]);

                    const sig = await connection.sendTransaction(transaction, {
                        skipPreflight: false,
                        maxRetries: 3,
                        preflightCommitment: 'confirmed',
                    });

                    signatures.push(sig);
                    console.log(`Batch ${i + 1} signature:`, sig);

                    // Wait for confirmation before next batch
                    if (i < batches.length - 1) {
                        await connection.confirmTransaction(sig, 'confirmed');
                    }
                }

                const summary = [
                    `Sweep completed in ${signatures.length} transactions!`,
                    `• Transferred ${transferredTokens} tokens`,
                    `• Skipped ${skippedTokens} tokens (no recipient ATAs)`,
                    `• Closed ${closedAccounts} empty accounts`,
                    `• Final signature: ${signatures[signatures.length - 1]}`
                ].join('\n');

                callback?.({ text: summary });
                return true;
            }
            const responseText = `Sweep completed successfully! Transaction ID: ${signature}`;
            responses.length = 0;
            const memory: Memory = {
                entityId: uuidv4() as UUID,
                roomId: message.roomId,
                text: responseText,
                content: {
                    text: responseText,
                    success: true,
                    signature,
                    sender: content.senderWalletAddress,
                    recipient: content.recipientWalletAddress,
                }
            };
            responses.push(memory);
            return true;
        } catch (error) {
            logger.error('Error during sweep:', error);
            responses.length = 0;
            const memory: Memory = {
                entityId: uuidv4() as UUID,
                roomId: message.roomId,
                text: `Sweep failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
                    text: 'Sweep all assets from my wallet FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1 to 3nMBmufBUBVnk28sTp3NsrSJsdVGTyLZYmsqpMFaUT9J',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll help you sweep all assets from your wallet",
                    actions: ['MULTIWALLET_SWEEP'],
                },
            },
        ],
    ] as ActionExample[][],
} as Action;