import {
    type Action,
    type ActionExample,
    type ActionResult,
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
import { PublicKey, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { v4 as uuidv4 } from 'uuid';
import { UUID } from 'crypto';
import { SOLANA_SERVICE_NAME } from '../../autonomous-trader/constants';
import { askLlmObject, HasEntityIdFromMessage, takeItPrivate, messageReply, getAccountFromMessage } from '../../autonomous-trader/utils'

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
    logger.log('Content for transfer', JSON.stringify(content));

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
    description: 'Transfer SOL or SPL tokens from a specified wallet to a specified Solana address.',
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        //logger.log('MULTIWALLET_TRANSFER Validating transfer from entity:', message.entityId);

        if (!await HasEntityIdFromMessage(runtime, message)) {
            console.warn('MULTIWALLET_TRANSFER validate - author not found')
            return false
        }

        const account = await getAccountFromMessage(runtime, message)
        if (!account) return false;

        // extract a list of base58 address (of what length?) from message.context.text
        // ensure there's 2

        // amount

        // denomination is a token on SOL

        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses?: Memory[]
    ): Promise<ActionResult | void | undefined> => {
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
            return {
                success: false,
                text: 'Could not determine source wallet address',
                error: 'PARSE_ERROR'
            }
        }

        // find this user's wallet
        //const entityId = createUniqueUuid(runtime, message.metadata.fromId);
        //console.log('MULTIWALLET_TRANSFER entityId', entityId)

        /*
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
        */
        const account = await getAccountFromMessage(runtime, message)

        //const metawallets = await interfaceWalletService.getWalletByEmailEntityIds([message.entityId])
        const userMetawallets = account.metawallets
        //console.log('MULTIWALLET_TRANSFER wallets', userMetawallets)

        // confirm wallet is in this list
        let found: any[] = []
        for (const mw of userMetawallets) {
            const kp = mw.keypairs.solana
            if (kp) {
                console.log('kp', kp)
                if (kp.publicKey.toString() === sourceResult.sourceWalletAddress) {
                    found.push(kp)
                }
            }
        }

        if (!found.length) {
            console.log('MULTIWALLET_TRANSFER did not find any local wallet with this source address', sourceResult)
            return {
                success: false,
                text: 'No matching wallet found for source address',
                error: 'WALLET_NOT_FOUND'
            }
        }
        console.log('MULTIWALLET_TRANSFER found', found)

        // gather possibilities
        let contextStr = ''
        const solanaService = runtime.getService(SOLANA_SERVICE_NAME) as any;
        for (const kp of found) {
            const pubKey = kp.publicKey
            contextStr += 'Wallet Address: ' + pubKey + '\n'
            // get wallet contents
            const pubKeyObj = new PublicKey(pubKey)
            const [balances, heldTokens] = await Promise.all([
                solanaService.getBalancesByAddrs([pubKey]),
                solanaService.getTokenAccountsByKeypair(pubKeyObj),
            ]);
            const solBal = balances[pubKey]
            contextStr += '  Token Address (Symbol)' + "\n"
            contextStr += '  So11111111111111111111111111111111111111111 ($sol) balance: ' + (solBal ?? 'unknown') + "\n"
            console.log('solBal', solBal, 'heldTokens', heldTokens)
            // loop on remaining tokens and output
            for (const t of heldTokens) {
                // data.program, data.space, data.parsed
                // data.parsed: .type and .info which has (isNative, mint, owner, state, tokenAmount)
                //console.log('data', t.account.data) // parsed.info.mint
                const amountRaw = t.account.data.parsed.info.tokenAmount.amount;
                const mintKey = new PublicKey(t.account.data.parsed.info.mint);
                const decimals = t.account.data.parsed.info.tokenAmount.decimals;
                const balance = Number(amountRaw) / (10 ** decimals);
                const symbol = await solanaService.getTokenSymbol(mintKey)
                //console.log('MULTIWALLET_TRANSFER symbol', symbol)
                contextStr += '  ' + t.pubkey.toString() + ' ($' + symbol + ') balance: ' + balance + "\n"
            }
            contextStr += '\n'
        }
        console.log('contextStr', contextStr)


        const transferPrompt = composePromptFromState({
            state: state,
            template: transferAddressTemplate,
        });

        /*
        const result = await runtime.useModel(ModelType.TEXT_LARGE, {
            prompt: transferPrompt.replace('{{possibleWallets}}', contextStr),
        });

        const content = parseJSONObjectFromText(result);
        */

        const content = await askLlmObject(runtime, { prompt: transferPrompt.replace('{{possibleWallets}}', contextStr) },
            ['tokenAddress', 'senderWalletAddress', 'recipientWalletAddress', 'amount'])

        console.log('MULTIWALLET_TRANSFER content', content)
        if (!content) {
            console.log('couldnt figure it out')
            return {
                success: false,
                text: 'Could not determine transfer details',
                error: 'PARSE_ERROR'
            }
        }

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
            // can be the model failing to match something
            console.warn('unknown address', content.senderWalletAddress, 'in', found)
            return {
                success: false,
                text: 'Source wallet not found',
                error: 'WALLET_NOT_FOUND'
            }
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
            if (responses) {
                responses.length = 0
                const memory: Memory = {
                    id: uuidv4() as UUID,
                    entityId: message.entityId,
                    roomId: message.roomId,
                    content: {
                        //thought: responseContent.thought,
                        text: 'No recipient address provided.',
                        error: 'Missing recipient address'
                        //actions: responseContent.actions,
                    }
                }
                responses.push(memory)
            }
            return {
                success: false,
                text: 'No recipient address provided.',
                error: 'Missing recipient address'
            };
        }

        // Validate the recipient address
        try {
            new PublicKey(recipientAddress);
        } catch (error) {
            runtime.logger.info("Invalid recipient address provided.")
            if (responses) {
                responses.length = 0
                const memory: Memory = {
                    id: uuidv4() as UUID,
                    entityId: message.entityId,
                    roomId: message.roomId,
                    content: {
                        text: 'Invalid recipient address provided.',
                        error: 'Invalid recipient address'
                    }
                }
                responses.push(memory)
            }
            return {
                success: false,
                text: 'Invalid recipient address provided.',
                error: 'Invalid recipient address'
            };
        }

        // ensure decimal
        content.amount = parseFloat(content.amount)
        if (!isTransferAddressContent(content)) {
            // FIXME: more than amount could be wrong here...
            runtime.logger.info("Need a valid amount to transfer.")
            if (responses) {
                responses.length = 0
                const memory: Memory = {
                    id: uuidv4() as UUID,
                    entityId: message.entityId,
                    roomId: message.roomId,
                    content: {
                        text: 'Need a valid amount to transfer.',
                        error: 'Invalid transfer content'
                    }
                }
                responses.push(memory)
            }
            return {
                success: false,
                text: 'Need a valid amount to transfer.',
                error: 'Invalid transfer content'
            };
        }

        console.log('MULTIWALLET_TRANSFER ATTEMPTING SEND')

        try {
            const solanaService = runtime.getService(SOLANA_SERVICE_NAME) as any;
            if (!solanaService) {
                throw new Error('Solana service not available');
            }

            const recipientPubkey = new PublicKey(recipientAddress);
            let signature: string;

            // Handle SOL transfer
            if (content.tokenAddress === "So11111111111111111111111111111111111111111") {
                const lamports = Number(content.amount) * 1e9;
                signature = await solanaService.transferSol(senderKeypair, recipientPubkey, lamports);

                runtime.logger.info(`Sent ${content.amount} SOL from ${content.senderWalletAddress} to ${recipientAddress}. Transaction hash: ${signature}`)
                if (responses) {
                    responses.length = 0
                    const memory: Memory = {
                        id: uuidv4() as UUID,
                        entityId: message.entityId,
                        roomId: message.roomId,
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
                return {
                    success: true,
                    text: `Sent ${content.amount} SOL. Transaction hash: ${signature}`,
                    data: {
                        signature,
                        amount: content.amount,
                        sender: content.senderWalletAddress,
                        recipient: recipientAddress,
                    }
                }
            }
            // Handle SPL token transfer
            else {
                const mintPubkey = new PublicKey(content.tokenAddress);
                signature = await solanaService.transferSplToken(senderKeypair, recipientPubkey, mintPubkey, Number(content.amount));

                runtime.logger.info(`Sent ${content.amount} tokens to ${recipientAddress}\nTransaction hash: ${signature}`)
                if (responses) {
                    responses.length = 0
                    const memory: Memory = {
                        id: uuidv4() as UUID,
                        entityId: message.entityId,
                        roomId: message.roomId,
                        content: {
                            text: `Sent ${content.amount} tokens to ${recipientAddress} from ${content.senderWalletAddress}\nTransaction hash: ${signature}`,
                            success: true,
                            signature,
                            amount: content.amount,
                            sender: content.senderWalletAddress,
                            recipient: recipientAddress,
                        }
                    }
                    responses.push(memory)
                }
                return {
                    success: true,
                    text: `Sent ${content.amount} tokens to ${recipientAddress}\nTransaction hash: ${signature}`,
                    data: {
                        signature,
                        amount: content.amount,
                        sender: content.senderWalletAddress,
                        recipient: recipientAddress,
                    }
                }
            }
        } catch (error) {
            logger.error('Error during transfer:', error instanceof Error ? error.message : String(error));
            const errorMessage = error instanceof Error ? error.message : String(error);
            runtime.logger.info(`Transfer failed: ${errorMessage}`)
            if (responses) {
                responses.length = 0
                const memory: Memory = {
                    id: uuidv4() as UUID,
                    entityId: message.entityId,
                    roomId: message.roomId,
                    content: {
                        text: `Transfer failed: ${errorMessage}`,
                        error: errorMessage
                    }
                }
                responses.push(memory)
            }
            return {
                success: false,
                text: `Transfer failed: ${errorMessage}`,
                error: errorMessage
            };
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
                        recipientAddress: '3nMBmufBUBVnk28sTp3NsrSJsdVGTyLZYmsqpMFaUT9J',
                    },
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Send 69 $DEGENAI 3nMBmufBUBVnk28sTp3NsrSJsdVGTyLZYmsqpMFaUT9J',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Sending the tokens now...',
                    actions: ['MULTIWALLET_TRANSFER'],
                    options: {
                        recipientAddress: '3nMBmufBUBVnk28sTp3NsrSJsdVGTyLZYmsqpMFaUT9J',
                    },
                },
            },
        ],
    ] as ActionExample[][],
} as Action;