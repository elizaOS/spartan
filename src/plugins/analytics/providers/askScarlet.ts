import type { IAgentRuntime, Memory, Provider, State, Content, UUID } from '@elizaos/core';
import { ModelType, asUUID } from '@elizaos/core';
import { getAccountFromMessage } from '../../autonomous-trader/utils';

interface TargetInfo {
    source: string;
    roomId?: UUID;
    entityId?: UUID;
    channelId?: string;
    serverId?: string;
    threadId?: string;
}

/**
 * Ask Scarlet Provider
 * Creates a room with Agent Scarlet and gets market information from her on specific tokens
 */
export const askScarletProvider: Provider = {
    name: 'ASK_SCARLET',
    description: 'Creates a room with Agent Scarlet to get expert market analysis and insights on specific tokens',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('ASK_SCARLET provider called');

        let scarletResponse = '';

        try {
            // Check if this is a DM (private message)
            const isDM = message.content.channelType?.toUpperCase() === 'DM';
            if (isDM) {
                const account = await getAccountFromMessage(runtime, message);
                if (!account) {
                    return {
                        data: {},
                        values: {},
                        text: 'No account found for this user.',
                    };
                }

                // Extract token address from message
                const messageText = message.content?.text || '';
                const tokenMatch = messageText.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);

                if (!tokenMatch) {
                    scarletResponse = 'Please provide a valid token address to ask Scarlet about.';
                } else {
                    const tokenAddress = tokenMatch[0];

                    scarletResponse += `🔮 ASKING AGENT SCARLET\n`;
                    scarletResponse += `Token: ${tokenAddress}\n`;
                    scarletResponse += `Status: Sending request to Scarlet...\n\n`;

                    try {
                        // Step 1: Send message to Scarlet on Discord/Telegram
                        const scarletMessage = `tell me about token ${tokenAddress}`;

                        // Get Scarlet's entity ID (this would be configured)
                        const scarletEntityId = runtime.getSetting('SCARLET_ENTITY_ID') as string;
                        if (!scarletEntityId) {
                            scarletResponse += '❌ Error: Scarlet entity ID not configured.';
                            return {
                                data: { scarletAnalysis: scarletResponse },
                                values: {},
                                text: scarletResponse + '\n',
                            };
                        }

                        // Determine Scarlet's platform (Discord or Telegram)
                        const scarletPlatform = runtime.getSetting('SCARLET_PLATFORM') as string || 'discord';

                        // Create target for Scarlet
                        const scarletTarget: TargetInfo = {
                            source: scarletPlatform,
                            roomId: asUUID(runtime.getSetting('SCARLET_ROOM_ID') as string || '00000000-0000-0000-0000-000000000000'),
                            entityId: asUUID(scarletEntityId)
                        };

                        // Create message content for Scarlet
                        const scarletContent: Content = {
                            text: scarletMessage,
                            source: scarletPlatform,
                        };

                        // Send message to Scarlet
                        console.log(`Sending message to Scarlet: ${scarletMessage}`);
                        await runtime.sendMessageToTarget(scarletTarget, scarletContent);

                        scarletResponse += `✅ Message sent to Scarlet successfully!\n`;
                        scarletResponse += `📤 Request: "${scarletMessage}"\n\n`;

                        // Store the request for later response matching
                        await storeScarletRequest(runtime, {
                            tokenAddress,
                            originalUserId: account.id,
                            originalMessage: message,
                            requestTime: Date.now()
                        });

                        scarletResponse += `⏳ Waiting for Scarlet's response...\n\n`;
                        scarletResponse += `📋 REQUEST STORED:\n`;
                        scarletResponse += `• Token: ${tokenAddress}\n`;
                        scarletResponse += `• Your ID: ${account.id}\n`;
                        scarletResponse += `• Platform: ${scarletPlatform}\n`;
                        scarletResponse += `• Response will be forwarded to you via DM\n\n`;

                        // Add Scarlet's contact information
                        scarletResponse += `📞 SCARLET'S CONTACT INFO:\n`;
                        if (scarletPlatform === 'discord') {
                            scarletResponse += `• Discord: Agent Scarlett#8343\n`;
                        } else if (scarletPlatform === 'telegram') {
                            scarletResponse += `• Telegram: @AgentScarlettPrivateBot\n`;
                        }

                    } catch (error) {
                        console.error('Error sending message to Scarlet:', error);
                        scarletResponse += `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
                    }

                    // Add additional context
                    scarletResponse += `📊 REQUEST DETAILS:\n`;
                    scarletResponse += `• Token Address: ${tokenAddress}\n`;
                    scarletResponse += `• Request Type: Market analysis from Agent Scarlet\n`;
                    scarletResponse += `• Status: Message sent, awaiting response\n\n`;

                    // Add disclaimer
                    scarletResponse += `⚠️ DISCLAIMER:\n`;
                    scarletResponse += `This analysis request is being processed by Agent Scarlet. Her response will be for informational purposes only and should not be considered financial advice.\n\n`;

                }
            } else {
                scarletResponse = 'Scarlet consultations are only available in private messages for security and data privacy.';
            }
        } catch (error) {
            console.error('Error in Ask Scarlet provider:', error);
            scarletResponse = `Error consulting Scarlet: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }

        const data = {
            scarletAnalysis: scarletResponse
        };

        const values = {};

        const text = scarletResponse + '\n';

        return {
            data,
            values,
            text,
        };
    },
};

/**
 * Store Scarlet request for later response matching
 */
async function storeScarletRequest(runtime: IAgentRuntime, request: {
    tokenAddress: string;
    originalUserId: string;
    originalMessage: Memory;
    requestTime: number;
}): Promise<void> {
    try {
        const cacheKey = `scarlet_request_${request.tokenAddress}_${request.originalUserId}`;
        await runtime.setCache(cacheKey, request);
        console.log(`Stored Scarlet request for token ${request.tokenAddress} from user ${request.originalUserId}`);
    } catch (error) {
        console.error('Error storing Scarlet request:', error);
    }
}

/**
 * Forward Scarlet's response back to the original user
 * This function would be called when Scarlet responds
 */
export async function forwardScarletResponse(
    runtime: IAgentRuntime,
    scarletResponse: string,
    tokenAddress: string
): Promise<void> {
    try {
        // Find the original request for this token
        const cacheKey = `scarlet_request_${tokenAddress}_*`;
        const requests = await runtime.getCache(cacheKey);

        if (requests && Array.isArray(requests)) {
            for (const request of requests) {
                if (request.tokenAddress === tokenAddress) {
                    // Forward the response to the original user
                    await forwardResponseToUser(runtime, request, scarletResponse);
                    break;
                }
            }
        }
    } catch (error) {
        console.error('Error forwarding Scarlet response:', error);
    }
}

/**
 * Forward response to the original user
 */
async function forwardResponseToUser(
    runtime: IAgentRuntime,
    request: any,
    scarletResponse: string
): Promise<void> {
    try {
        const originalMessage = request.originalMessage;
        const originalUserId = request.originalUserId;

        // Determine the user's platform
        const userPlatform = originalMessage.content.source || 'discord';

        // Create target for the original user
        const userTarget: TargetInfo = {
            source: userPlatform,
            roomId: originalMessage.roomId,
            entityId: asUUID(originalUserId)
        };

        // Create response content
        const responseContent: Content = {
            text: `🔮 SCARLET'S ANALYSIS FOR TOKEN ${request.tokenAddress}\n\n${scarletResponse}`,
            source: userPlatform,
        };

        // Send the response to the original user
        console.log(`Forwarding Scarlet's response to user ${originalUserId}`);
        await runtime.sendMessageToTarget(userTarget, responseContent);

        console.log(`Successfully forwarded Scarlet's response to user ${originalUserId}`);
    } catch (error) {
        console.error('Error forwarding response to user:', error);
    }
}
