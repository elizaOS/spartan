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
    parseJSONObjectFromText,
} from '@elizaos/core';
import {
    createAssociatedTokenAccountInstruction,
    createTransferInstruction,
    getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
    Connection,
    PublicKey,
    SystemProgram,
    TransactionMessage,
    VersionedTransaction,
} from '@solana/web3.js';
import { getWalletKey } from '../keypairUtils';
import { v4 as uuidv4 } from 'uuid';
import { UUID } from 'crypto';

/**
 * Interface representing the content of a transfer with a specific address.
 *
 * @interface TransferAddressContent
 * @extends Content
 * @property {string | null} tokenAddress - The address of the token being transferred, or null for SOL transfers
 * @property {string} recipient - The address of the recipient of the transfer
 * @property {string | number} amount - The amount of the transfer, represented as a string or number
 */
interface TransferAddressContent extends Content {
    tokenAddress: string | null; // null for SOL transfers
    recipient: string;
    amount: string | number;
}

/**
 * Checks if the given transfer content is valid based on the type of transfer.
 * @param {TransferAddressContent} content - The content to be validated for transfer.
 * @returns {boolean} Returns true if the content is valid for transfer, and false otherwise.
 */
function isTransferAddressContent(content: TransferAddressContent): boolean {
    logger.log('Content for transfer', content);

    // Base validation
    if (!content.recipient || typeof content.recipient !== 'string' || !content.amount) {
        return false;
    }

    if (content.tokenAddress === 'null') {
        content.tokenAddress = null;
    }

    return typeof content.amount === 'string' || typeof content.amount === 'number';
}

/**
 * Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.
 *
 * Example responses:
 * For SPL tokens:
 * ```json
 * {
 *    "tokenAddress": "BieefG47jAHCGZBxi2q87RDuHyGZyYC3vAzxpyu8pump",
 *    "recipient": "9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa",
 *    "amount": "1000"
 * }
 * ```
 *
 * For SOL:
 * ```json
 * {
 *    "tokenAddress": null,
 *    "recipient": "9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa",
 *    "amount": 1.5
 * }
 * ```
 *
 * {{recentMessages}}
 *
 * Extract the following information about the requested transfer:
 * - Token contract address (use null for SOL transfers)
 * - Recipient wallet address
 * - Amount to transfer
 */
const transferAddressTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example responses:
For SPL tokens:
\`\`\`json
{
    "tokenAddress": "BieefG47jAHCGZBxi2q87RDuHyGZyYC3vAzxpyu8pump",
    "recipient": "9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa",
    "amount": "1000"
}
\`\`\`

For SOL:
\`\`\`json
{
    "tokenAddress": "So11111111111111111111111111111111111111111",
    "recipient": "9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa",
    "amount": 1.5
}
\`\`\`

{{recentMessages}}

Extract the following information about the requested transfer:
- Token contract address (use null for SOL transfers)
- Recipient wallet address
- Amount to transfer
`;

export default {
    name: 'MULTIWALLET_TRANSFER',
    similes: [
        'MULTIWALLET_TRANSFER_SOL',
        'MULTIWALLET_SEND_TOKEN',
        'MULTIWALLET_TRANSFER_TOKEN',
        'MULTIWALLET_SEND_TOKENS',
        'MULTIWALLET_TRANSFER_TOKENS',
        'MULTIWALLET_SEND_SOL',
        'MULTIWALLET_SEND_TOKEN_SOL',
        'MULTIWALLET_PAY_SOL',
        'MULTIWALLET_PAY_TOKEN_SOL',
        'MULTIWALLET_PAY_TOKENS_SOL',
        'MULTIWALLET_PAY_TOKENS',
        'MULTIWALLET_PAY',
    ],
    validate: async (_runtime: IAgentRuntime, message: Memory) => {
        //logger.log('Validating transfer from entity:', message.entityId);

        // extract a list of base58 address (of what length?) from message.context.text
        // ensure there's 2

        // amount

        // denomination is a token on SOL

        return true;
    },
    description: 'Transfer SOL or SPL tokens to a specified Solana address.',
    handler: async (
        runtime: IAgentRuntime,
        _message: Memory,
        state: State,
        options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: any[]
    ): Promise<boolean> => {
        logger.log('Starting TRANSFER_ADDRESS handler...');
        //console.log('options', options)

        const transferPrompt = composePromptFromState({
            state: state,
            template: transferAddressTemplate,
        });

        const result = await runtime.useModel(ModelType.TEXT_LARGE, {
            prompt: transferPrompt,
        });

        const content = parseJSONObjectFromText(result);
        console.log('content', content)

        // Override the recipient from the model with the one from options
        /*
        if (content) {
            content.recipient = recipientAddress;
        }
        */

        // Get the recipient address from options
        //const recipientAddress = options.recipientAddress as string;
        const recipientAddress = content.recipient
        console.log('recipientAddress', recipientAddress)
        if (!recipientAddress) {

            //
            // NEW WAY
            //
            runtime.logger.info("No recipient address provided.")
            responses.length = 0
            const memory: Memory = {
                entityId: uuidv4() as UUID,
                roomId: _message.roomId,
                text: 'No recipient address provided.',
                content: {
                    //thought: responseContent.thought,
                    text: 'No recipient address provided.',
                    error: 'Missing recipient address'
                    //actions: responseContent.actions,
                }
            }
            responses.push(memory)

            //
            // OLD WAY
            //
            /*
            if (callback) {
                callback({
                    text: 'No recipient address provided.',
                    content: { error: 'Missing recipient address' },
                });
            }
            */
            return false;
        }

        // Validate the recipient address
        try {
            new PublicKey(recipientAddress);
        } catch (error) {
            runtime.logger.info("Invalid recipient address provided.")
            responses.length = 0
            const memory: Memory = {
                entityId: uuidv4() as UUID,
                roomId: _message.roomId,
                text: 'Invalid recipient address provided.',
                content: {
                    text: 'Invalid recipient address provided.',
                    error: 'Invalid recipient address'
                }
            }
            responses.push(memory)
            return false;
        }



        if (!isTransferAddressContent(content)) {
            runtime.logger.info("Need a valid amount to transfer.")
            responses.length = 0
            const memory: Memory = {
                entityId: uuidv4() as UUID,
                roomId: _message.roomId,
                text: 'Need a valid amount to transfer.',
                content: {
                    text: 'Need a valid amount to transfer.',
                    error: 'Invalid transfer content'
                }
            }
            responses.push(memory)
            return false;
        }

        try {
            const { keypair: senderKeypair } = await getWalletKey(runtime, true);
            const connection = new Connection(
                runtime.getSetting('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com'
            );
            const recipientPubkey = new PublicKey(recipientAddress);

            let signature: string;

            // Handle SOL transfer
            if (content.tokenAddress === null) {
                const lamports = Number(content.amount) * 1e9;

                const instruction = SystemProgram.transfer({
                    fromPubkey: senderKeypair.publicKey,
                    toPubkey: recipientPubkey,
                    lamports,
                });

                const messageV0 = new TransactionMessage({
                    payerKey: senderKeypair.publicKey,
                    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                    instructions: [instruction],
                }).compileToV0Message();

                const transaction = new VersionedTransaction(messageV0);
                transaction.sign([senderKeypair]);

                signature = await connection.sendTransaction(transaction);

                runtime.logger.info(`Sent ${content.amount} SOL. Transaction hash: ${signature}`)
                responses.length = 0
                const memory: Memory = {
                    entityId: uuidv4() as UUID,
                    roomId: _message.roomId,
                    text: `Sent ${content.amount} SOL. Transaction hash: ${signature}`,
                    content: {
                        success: true,
                        signature,
                        amount: content.amount,
                        recipient: recipientAddress,
                    }
                }
                responses.push(memory)
            }
            // Handle SPL token transfer
            else {
                const mintPubkey = new PublicKey(content.tokenAddress);
                const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
                const decimals =
                    (mintInfo.value?.data as { parsed: { info: { decimals: number } } })?.parsed?.info
                        ?.decimals ?? 9;
                const adjustedAmount = BigInt(Number(content.amount) * 10 ** decimals);

                const senderATA = getAssociatedTokenAddressSync(mintPubkey, senderKeypair.publicKey);
                const recipientATA = getAssociatedTokenAddressSync(mintPubkey, recipientPubkey);

                const instructions = [];

                const recipientATAInfo = await connection.getAccountInfo(recipientATA);
                if (!recipientATAInfo) {
                    instructions.push(
                        createAssociatedTokenAccountInstruction(
                            senderKeypair.publicKey,
                            recipientATA,
                            recipientPubkey,
                            mintPubkey
                        )
                    );
                }

                instructions.push(
                    createTransferInstruction(
                        senderATA,
                        recipientATA,
                        senderKeypair.publicKey,
                        adjustedAmount
                    )
                );

                const messageV0 = new TransactionMessage({
                    payerKey: senderKeypair.publicKey,
                    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                    instructions,
                }).compileToV0Message();

                const transaction = new VersionedTransaction(messageV0);
                transaction.sign([senderKeypair]);

                signature = await connection.sendTransaction(transaction);

                runtime.logger.info(`Sent ${content.amount} tokens to ${recipientAddress}\nTransaction hash: ${signature}`)
                responses.length = 0
                const memory: Memory = {
                    entityId: uuidv4() as UUID,
                    roomId: _message.roomId,
                    text: `Sent ${content.amount} tokens to ${recipientAddress}\nTransaction hash: ${signature}`,
                    content: {
                        success: true,
                        signature,
                        amount: content.amount,
                        recipient: recipientAddress,
                    }
                }
                responses.push(memory)
            }

            return true;
        } catch (error) {
            logger.error('Error during transfer:', error);
            runtime.logger.info(`Transfer failed: ${error.message}`)
            responses.length = 0
            const memory: Memory = {
                entityId: uuidv4() as UUID,
                roomId: _message.roomId,
                text: `Transfer failed: ${error.message}`,
                content: {
                    error: error.message
                }
            }
            responses.push(memory)
            return false;
        }
    },

    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Send 1.5 SOL',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Sending SOL now...',
                    actions: ['MULTIWALLET_TRANSFER'],
                    options: {
                        recipientAddress: '9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa',
                    },
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Send 69 $DEGENAI BieefG47jAHCGZBxi2q87RDuHyGZyYC3vAzxpyu8pump',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Sending the tokens now...',
                    actions: ['MULTIWALLET_TRANSFER'],
                    options: {
                        recipientAddress: '9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa',
                    },
                },
            },
        ],
    ] as ActionExample[][],
} as Action;