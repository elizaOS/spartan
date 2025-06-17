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
    createAssociatedTokenAccountInstruction,
    createTransferInstruction,
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
import { UUID } from 'crypto';
import { getWalletKey } from '../keypairUtils';
import { SOLANA_SERVICE_NAME } from '../constants';

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
    senderWalletAddress: string;
    recipientWalletAddress: string;
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
    if (!content.recipientWalletAddress || typeof content.recipientWalletAddress !== 'string' || !content.amount) {
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

This user only have these in his wallet and can only send from these options
{{possibleWallets}}

Example responses:
For SPL tokens:
\`\`\`json
{
    "tokenAddress": "BieefG47jAHCGZBxi2q87RDuHyGZyYC3vAzxpyu8pump",
    "senderWalletAddress": "9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa",
    "recipientWalletAddress": "3nMBmufBUBVnk28sTp3NsrSJsdVGTyLZYmsqpMFaUT9J",
    "amount": "15000"
}
\`\`\`

For SOL:
\`\`\`json
{
    "tokenAddress": "So11111111111111111111111111111111111111111",
    "senderWalletAddress": "FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1",
    "recipientWalletAddress": "BzsJQeZ7cvk3pTHmKeuvdhNDkDxcZ6uCXxW2rjwC7RTq",
    "amount": "0.1"
}
\`\`\`

{{recentMessages}}

Extract the following information about the requested transfer:
- Token contract address (use null for SOL transfers)
- Recipient wallet address
- Amount to transfer
`;

const sourceAddressTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Recent Messages:
{{recentMessages}}

Extract the following information about the requested transfer:


Example responses:
\`\`\`json
{
    "sourceWalletAddress": "FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1",
    "reasoning": "Your reasoning here",
}
\`\`\`
Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the JSON response format without any preamble or explanation.

IMPORTANT: Your response must ONLY contain the json block above. Do not include any text, thinking, or reasoning before or after this JSON block. Start your response immediately with { and end with }.
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
        //logger.log('MULTIWALLET_TRANSFER Validating transfer from entity:', message.entityId);

        // extract a list of base58 address (of what length?) from message.context.text
        // ensure there's 2

        // amount

        // denomination is a token on SOL

        return true;
    },
    description: 'Transfer SOL or SPL tokens to a specified Solana address.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: any[]
    ): Promise<boolean> => {
        logger.log('MULTIWALLET_TRANSFER Starting TRANSFER_ADDRESS handler...');
        //console.log('options', options)

        const sourcePrompt = composePromptFromState({
            state: state,
            template: sourceAddressTemplate,
        });
        const sourceResult = await runtime.useModel(ModelType.OBJECT_LARGE, {
            prompt: sourcePrompt,
        });
        console.log('MULTIWALLET_TRANSFER sourceResult', sourceResult)

        if (!sourceResult.sourceWalletAddress) {
          console.log('MULTIWALLET_TRANSFER cant determine source wallet address')
          return false
        }

        // find this user's wallet
        //const entityId = createUniqueUuid(runtime, message.metadata.fromId);
        //console.log('MULTIWALLET_TRANSFER entityId', entityId)

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

        const metawallets = await interfaceWalletService.getWalletByUserEntityIds([message.entityId])
        const userMetawallets = metawallets[message.entityId]
        //console.log('MULTIWALLET_TRANSFER wallets', userMetawallets)

        // confirm wallet is in this list
        let found = false
        for(const mw of userMetawallets) {
          const kp = mw.keypairs.solana
          if (kp) {
            console.log('kp', kp)
            if (kp.publicKey.toString() === sourceResult.sourceWalletAddress) {
              if (found === false) found = []
              found.push(kp)
            }
          }
        }

        if (!found.length) {
          console.log('MULTIWALLET_TRANSFER did not find any local wallet with this source address', sourceResult)
          return false
        }
        console.log('MULTIWALLET_TRANSFER found', found)

        // gather possibilities
        let contextStr = ''
        const solanaService = runtime.getService(SOLANA_SERVICE_NAME) as any;
        for(const kp of found) {
          const pubKey = kp.publicKey
          contextStr += 'Wallet Address: ' + pubKey + '\n'
          // get wallet contents
          const pubKeyObj = new PublicKey(pubKey)
          const [solBal, heldTokens] = await Promise.all([
            solanaService.getBalanceByAddr(pubKeyObj), solanaService.getTokenAccountsByKeypair(pubKeyObj),
          ]);
          contextStr += '  Token Address (Symbol)' + "\n"
          contextStr += '  So11111111111111111111111111111111111111111 ($sol) balance: ' + (solBal ?? 'unknown') + "\n"
          console.log('solBal', solBal, 'heldTokens', heldTokens)
          // loop on remaining tokens and output
          for(const t of heldTokens) {
            // data.program, data.space, data.parsed
            // data.parsed: .type and .info which has (isNative, mint, owner, state, tokenAmount)
            //console.log('data', t.account.data) // parsed.info.mint
            const amountRaw = t.account.data.parsed.info.tokenAmount.amount;
            const mintKey = new PublicKey(t.account.data.parsed.info.mint);
            const decimals = t.account.data.parsed.info.tokenAmount.decimals;
            const balance = Number(amountRaw) / (10 ** decimals);
            const symbol = await solanaService.getTokenSymbol(mintKey)
            console.log('MULTIWALLET_TRANSFER symbol', symbol)
            contextStr += '  ' + t.pubkey.toString() + ' ($' + symbol + ') balance: ' + balance + "\n"
          }
          contextStr += '\n'
        }
        console.log('contextStr', contextStr)


        const transferPrompt = composePromptFromState({
            state: state,
            template: transferAddressTemplate,
        });

        const result = await runtime.useModel(ModelType.TEXT_LARGE, {
            prompt: transferPrompt.replace('{{possibleWallets}}', contextStr),
        });

        const content = parseJSONObjectFromText(result);
        console.log('MULTIWALLET_TRANSFER content', content)

        // Override the recipient from the model with the one from options
        /*
        if (content) {
            content.recipient = recipientAddress;
        }
        */

        // find source keypair
        //in found
        const sourceKp = found.find(kp => kp.publicKey === content.senderWalletAddress)
        //console.log('MULTIWALLET_TRANSFER sourceKp', sourceKp)
        if (!sourceKp) {
          // FIXME
        }
        const secretKey = bs58.decode(sourceKp.privateKey);
        const senderKeypair = Keypair.fromSecretKey(secretKey);
        //console.log('MULTIWALLET_TRANSFER senderKeypair', senderKeypair)

        // Get the recipient address from options
        //const recipientAddress = options.recipientAddress as string;
        const recipientAddress = content.recipientWalletAddress
        console.log('MULTIWALLET_TRANSFER recipientAddress', recipientAddress)
        if (!recipientAddress) {
            runtime.logger.info("No recipient address provided.")
            responses.length = 0
            const memory: Memory = {
                entityId: uuidv4() as UUID,
                roomId: message.roomId,
                text: 'No recipient address provided.',
                content: {
                    //thought: responseContent.thought,
                    text: 'No recipient address provided.',
                    error: 'Missing recipient address'
                    //actions: responseContent.actions,
                }
            }
            responses.push(memory)
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
                roomId: message.roomId,
                text: 'Invalid recipient address provided.',
                content: {
                    text: 'Invalid recipient address provided.',
                    error: 'Invalid recipient address'
                }
            }
            responses.push(memory)
            return false;
        }

        // ensure decimal
        content.amount = parseFloat(content.amount)
        if (!isTransferAddressContent(content)) {
            // FIXME: more than amount could be wrong here...
            runtime.logger.info("Need a valid amount to transfer.")
            responses.length = 0
            const memory: Memory = {
                entityId: uuidv4() as UUID,
                roomId: message.roomId,
                text: 'Need a valid amount to transfer.',
                content: {
                    text: 'Need a valid amount to transfer.',
                    error: 'Invalid transfer content'
                }
            }
            responses.push(memory)
            return false;
        }

        console.log('MULTIWALLET_TRANSFER ATTEMPTING SEND')

        try {
            //const { keypair: senderKeypair } = await getWalletKey(runtime, true);
            const connection = new Connection(
                runtime.getSetting('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com'
            );
            const recipientPubkey = new PublicKey(recipientAddress);

            let signature: string;

            // Handle SOL transfer
            if (content.tokenAddress === "So11111111111111111111111111111111111111111") {
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

                runtime.logger.info(`Sent ${content.amount} SOL from ${content.senderWalletAddress} to ${recipientAddress}. Transaction hash: ${signature}`)
                responses.length = 0
                const memory: Memory = {
                    entityId: uuidv4() as UUID,
                    roomId: message.roomId,
                    text: `Sent ${content.amount} SOL. Transaction hash: ${signature}`,
                    content: {
                        text: `Sent ${content.amount} SOL. Transaction hash: ${signature}`,
                        success: true,
                        signature,
                        amount: content.amount,
                        sender: content.senderWalletAddress,
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
                    roomId: message.roomId,
                    text: `Sent ${content.amount} tokens to ${recipientAddress} from ${content.senderWalletAddress}\nTransaction hash: ${signature}`,
                    content: {
                        text: `Sent ${content.amount} tokens to ${recipientAddress}\nTransaction hash: ${signature}`,
                        success: true,
                        signature,
                        amount: content.amount,
                        sender: content.senderWalletAddress,
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
                roomId: message.roomId,
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