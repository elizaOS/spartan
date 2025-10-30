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
    logger as coreLogger,
} from '@elizaos/core';
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
import { UUID } from 'crypto';
import { SOLANA_SERVICE_NAME } from '../../autonomous-trader/constants';
import { HasEntityIdFromMessage, getAccountFromMessage } from '../../autonomous-trader/utils';

/**
 * Interface representing the content of an x402 payment request.
 */
interface X402PaymentContent extends Content {
    endpoint: string;
    amount: string; // USD amount
    network?: string; // Solana, Base, Ethereum
    recipientAddress: string; // Payment recipient address
    thought?: string;
}

/**
 * Template for extracting payment parameters from user messages.
 */
const paymentExtractionTemplate = `You are helping a user pay for access to a premium API endpoint using x402 micropayments.

Extract the following information from the user's request:
1. The API endpoint or route they want to access (e.g., /api/analytics/market-overview)
2. The price amount mentioned (e.g., $0.10)
3. The recipient address they should pay to
4. Optional: specific network preference (Solana, Base, Ethereum)

Respond with a JSON markdown block containing only the extracted values.

Example responses:
\`\`\`json
{
    "endpoint": "/api/analytics/market-overview",
    "amount": "0.10",
    "network": "Solana",
    "recipientAddress": "0xYourPaymentAddress",
    "thought": "User wants to access market analytics for $0.10"
}
\`\`\`

Recent Messages:
{{recentMessages}}

Extract payment information from the request.`;

/**
 * Ask LLM for structured object extraction
 */
async function askLlmObject(
    runtime: IAgentRuntime,
    params: { prompt: string },
    keys: string[]
): Promise<any> {
    const result = await runtime.useModel(ModelType.OBJECT_LARGE, {
        prompt: params.prompt,
    });

    // Parse the result
    const parsed = JSON.parse(result);

    // Validate that all required keys are present
    for (const key of keys) {
        if (!parsed[key]) {
            coreLogger.warn(`Missing key ${key} in LLM response`);
        }
    }

    return parsed;
}

/**
 * Create x402 payment handler that uses the user's multiwallet to pay
 */
export default {
    name: 'X402_PAYMENT',
    similes: [
        'X402_PAY',
        'X402_MICROPAYMENT',
        'X402_PAY_FOR_API',
        'X402_PAY_FOR_ENDPOINT',
        'X402_PURCHASE_ACCESS',
        'X402_BUY_ACCESS',
        'X402_PAYMENT_GATEWAY',
        'X402_SEND_PAYMENT',
        'X402_MAKE_PAYMENT',
        'PAY_X402',
        'MAKE_X402_PAYMENT',
        'SEND_X402_PAYMENT',
    ],
    description: 'Pay for access to premium API endpoints using x402 micropayments from the user\'s multiwallet',
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        logger.log('X402_PAYMENT Validating payment request');

        if (!await HasEntityIdFromMessage(runtime, message)) {
            console.warn('X402_PAYMENT validate - author not found');
            return false;
        }

        const account = await getAccountFromMessage(runtime, message);
        if (!account) {
            return false;
        }

        // Check if user has at least one wallet
        if (!account.metawallets || account.metawallets.length === 0) {
            console.warn('X402_PAYMENT - user has no wallets');
            return false;
        }

        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: Memory[] = []
    ): Promise<void> => {
        logger.log('X402_PAYMENT Starting payment handler...');

        try {
            // Extract payment parameters using LLM
            const prompt = composePromptFromState({
                state: state,
                template: paymentExtractionTemplate,
            });

            const content = await askLlmObject(runtime, { prompt }, [
                'endpoint',
                'amount',
                'recipientAddress',
            ]) as X402PaymentContent;

            logger.log('X402_PAYMENT extracted content:', content);

            if (!content.endpoint || !content.amount || !content.recipientAddress) {
                logger.error('X402_PAYMENT missing required payment parameters');
                responses.push({
                    entityId: uuidv4() as UUID,
                    roomId: message.roomId,
                    text: 'Unable to extract payment information. Please provide endpoint, amount, and recipient address.',
                    content: {
                        text: 'Unable to extract payment information.',
                        error: 'Missing payment parameters',
                    },
                });
                return;
            }

            // Get user's account and wallets
            const account = await getAccountFromMessage(runtime, message);
            if (!account || !account.metawallets || account.metawallets.length === 0) {
                logger.error('X402_PAYMENT user has no wallets');
                responses.push({
                    entityId: uuidv4() as UUID,
                    roomId: message.roomId,
                    text: 'You have no wallets registered. Please create a wallet first.',
                    content: {
                        text: 'You have no wallets registered.',
                        error: 'No wallets available',
                    },
                });
                return;
            }

            // For now, we'll use the first Solana wallet available
            // In a real implementation, you'd let the user choose or pick based on network
            const userMetawallets = account.metawallets;
            let selectedKeypair = null;

            for (const mw of userMetawallets) {
                const kp = mw.keypairs.solana;
                if (kp) {
                    selectedKeypair = kp;
                    break;
                }
            }

            if (!selectedKeypair) {
                logger.error('X402_PAYMENT no Solana wallet found');
                responses.push({
                    entityId: uuidv4() as UUID,
                    roomId: message.roomId,
                    text: 'No Solana wallet found in your wallets.',
                    content: {
                        text: 'No Solana wallet found.',
                        error: 'No compatible wallet',
                    },
                });
                return false;
            }

            // For Solana payments, we need SOL. Let's check balance first
            const solanaService = runtime.getService(SOLANA_SERVICE_NAME) as any;
            const connection = new Connection(
                runtime.getSetting('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com'
            );

            const senderPubKey = selectedKeypair.publicKey;
            const balances = await solanaService.getBalancesByAddrs([senderPubKey]);
            const solBalance = balances[senderPubKey];

            logger.log('X402_PAYMENT sender balance:', solBalance);

            // Check if we have enough SOL for the payment
            // Note: In a real implementation, you'd convert the USD amount to SOL
            // For now, we'll send a minimal payment amount (0.001 SOL)
            const paymentAmountSOL = 0.001; // This should be calculated from USD amount
            const requiredLamports = paymentAmountSOL * 1e9;

            if (!solBalance || parseFloat(solBalance) < paymentAmountSOL) {
                logger.error('X402_PAYMENT insufficient balance');
                responses.push({
                    entityId: uuidv4() as UUID,
                    roomId: message.roomId,
                    text: `Insufficient SOL balance. You need at least ${paymentAmountSOL} SOL to make this payment. Your current balance is ${solBalance || '0'} SOL.`,
                    content: {
                        text: `Insufficient SOL balance. Need ${paymentAmountSOL} SOL, have ${solBalance || '0'} SOL.`,
                        error: 'Insufficient balance',
                    },
                });
                return;
            }

            // Create and send the payment transaction
            const secretKey = bs58.decode(selectedKeypair.privateKey);
            const senderKeypair = Keypair.fromSecretKey(secretKey);

            // Validate recipient address
            let recipientPubkey: PublicKey;
            try {
                recipientPubkey = new PublicKey(content.recipientAddress);
            } catch (error) {
                logger.error('X402_PAYMENT invalid recipient address');
                responses.push({
                    entityId: uuidv4() as UUID,
                    roomId: message.roomId,
                    text: 'Invalid recipient address provided.',
                    content: {
                        text: 'Invalid recipient address.',
                        error: 'Invalid address',
                    },
                });
                return;
            }

            // Create SOL transfer
            const instruction = SystemProgram.transfer({
                fromPubkey: senderKeypair.publicKey,
                toPubkey: recipientPubkey,
                lamports: requiredLamports,
            });

            const messageV0 = new TransactionMessage({
                payerKey: senderKeypair.publicKey,
                recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                instructions: [instruction],
            }).compileToV0Message();

            const transaction = new VersionedTransaction(messageV0);
            transaction.sign([senderKeypair]);

            const signature = await connection.sendTransaction(transaction);

            logger.info(`X402_PAYMENT sent ${paymentAmountSOL} SOL payment. Transaction hash: ${signature}`);

            // Create response with payment proof
            const paymentProof = `invoice:${content.endpoint}:${signature}`;

            responses.push({
                entityId: uuidv4() as UUID,
                roomId: message.roomId,
                text: `Payment successful! I've sent ${paymentAmountSOL} SOL. Transaction: ${signature}\n\nUse this payment proof to access the endpoint: ${paymentProof}`,
                content: {
                    text: `Payment successful! Transaction: ${signature}`,
                    success: true,
                    signature,
                    paymentProof,
                    endpoint: content.endpoint,
                    amount: paymentAmountSOL,
                    sender: senderPubKey,
                    recipient: content.recipientAddress,
                },
            });

            return;
        } catch (error) {
            logger.error('X402_PAYMENT error during payment:', error);
            responses.push({
                entityId: uuidv4() as UUID,
                roomId: message.roomId,
                text: `Payment failed: ${error.message}`,
                content: {
                    text: `Payment failed: ${error.message}`,
                    error: error.message,
                },
            });
            return;
        }
    },

    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Pay for access to /api/analytics/market-overview',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Processing your payment...',
                    actions: ['X402_PAYMENT'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'I need to pay $0.10 to access the market overview API',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll send the payment from your wallet.',
                    actions: ['X402_PAYMENT'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Purchase access to analytics data',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Processing payment for analytics access...',
                    actions: ['X402_PAYMENT'],
                },
            },
        ],
    ] as ActionExample[][],
} as Action;

