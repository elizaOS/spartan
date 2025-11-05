/**
 * Chat Routes - Spartan AI Chat Interface
 * Enables users to interact with Spartan agent through a simplified messaging API
 * 
 * This leverages the ElizaOS messaging system to create conversational sessions
 * where users can chat with Spartan for token analysis, market insights, and trading advice.
 */

import type { Route, IAgentRuntime, UUID } from '@elizaos/core';
import { logger, validateUuid, ChannelType, createUniqueUuid } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';

// ==================== Types ====================

interface ChatSessionRequest {
    userId: string;
    metadata?: Record<string, any>;
}

interface ChatMessageRequest {
    content: string;
    metadata?: Record<string, any>;
}

interface ChatSession {
    id: string;
    userId: UUID;
    channelId: UUID;
    agentId: UUID;
    createdAt: Date;
    lastActivity: Date;
    metadata: Record<string, any>;
}

// ==================== Session Management ====================

// In-memory session store (consider moving to database for persistence)
const chatSessions = new Map<string, ChatSession>();

// Default server ID for messaging system
const DEFAULT_SERVER_ID = '00000000-0000-0000-0000-000000000000' as UUID;

/**
 * Create a new chat session with Spartan
 * This sets up a dedicated channel for the conversation
 */
async function createChatSession(
    runtime: IAgentRuntime,
    userId: string,
    metadata?: Record<string, any>
): Promise<ChatSession> {
    const sessionId = uuidv4();
    const channelId = uuidv4() as UUID;

    // Create a deterministic entity ID from the userId (like Discord/Telegram do)
    // This ensures the same userId always maps to the same entity across sessions
    const userEntityId = createUniqueUuid(runtime, userId) as UUID;

    // Get the AgentServer instance from the messaging system
    // This is accessible through the global ElizaOS instance
    const serverInstance = (global as any).elizaServer || (runtime as any).server;

    if (!serverInstance) {
        throw new Error('AgentServer instance not available');
    }

    try {
        // Create a dedicated channel for this chat session
        await serverInstance.createChannel({
            id: channelId,
            name: `spartan-chat-${sessionId}`,
            type: ChannelType.DM, // Direct message channel
            messageServerId: DEFAULT_SERVER_ID,
            metadata: {
                sessionId,
                userId: userEntityId,
                originalUserId: userId, // Store original for reference
                agentId: runtime.agentId,
                sessionType: 'spartan_chat',
                createdAt: new Date().toISOString(),
                ...metadata,
            },
        });

        // Add both user and agent as participants for DM channel
        await serverInstance.addParticipantsToChannel(channelId, [userEntityId, runtime.agentId]);

        logger.debug(`[Spartan Chat] Created session ${sessionId} for user ${userId}`);
    } catch (error) {
        logger.error('[Spartan Chat] Failed to create channel:', error instanceof Error ? error.message : String(error));
        throw new Error('Failed to initialize chat session');
    }

    // Create session object
    const now = new Date();
    const session: ChatSession = {
        id: sessionId,
        userId: userEntityId, // Use the deterministic entity ID
        channelId,
        agentId: runtime.agentId,
        createdAt: now,
        lastActivity: now,
        metadata: {
            ...metadata,
            originalUserId: userId, // Store original for reference
        },
    };

    // Store session
    chatSessions.set(sessionId, session);

    logger.info(`[Spartan Chat] Session ${sessionId} created for userId "${userId}" -> entityId ${userEntityId}`);

    return session;
}

/**
 * Get an existing chat session
 */
function getChatSession(sessionId: string): ChatSession | null {
    return chatSessions.get(sessionId) || null;
}

/**
 * Update session activity timestamp
 */
function updateSessionActivity(sessionId: string): void {
    const session = chatSessions.get(sessionId);
    if (session) {
        session.lastActivity = new Date();
    }
}

// ==================== Route Definitions ====================

export const chatRoutes: Route[] = [
    /**
     * Create a new chat session with Spartan
     * POST /chat/sessions
     */
    {
        type: 'POST',
        path: '/chat/sessions',
        public: true,
        handler: async (req: any, res: any, runtime: IAgentRuntime) => {
            try {
                const body: ChatSessionRequest = req.body;

                // Validate request
                if (!body.userId) {
                    res.status(400).json({
                        success: false,
                        error: 'Missing required field: userId',
                    });
                    return;
                }

                // Create session
                const session = await createChatSession(
                    runtime,
                    body.userId,
                    body.metadata
                );

                res.status(201).json({
                    success: true,
                    data: {
                        sessionId: session.id,
                        channelId: session.channelId,
                        agentId: session.agentId,
                        createdAt: session.createdAt,
                    },
                });
            } catch (error) {
                logger.error('[Spartan Chat] Error creating session:', error instanceof Error ? error.message : String(error));
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to create chat session',
                });
            }
        },
    },

    /**
     * Send a message to Spartan in an existing session
     * POST /chat/sessions/:sessionId/messages
     */
    {
        type: 'POST',
        path: '/chat/sessions/:sessionId/messages',
        public: true,
        handler: async (req: any, res: any, runtime: IAgentRuntime) => {
            try {
                const { sessionId } = req.params;
                const body: ChatMessageRequest = req.body;

                // Validate session
                const session = getChatSession(sessionId);
                if (!session) {
                    res.status(404).json({
                        success: false,
                        error: 'Chat session not found',
                    });
                    return;
                }

                // Validate message content
                if (!body.content || typeof body.content !== 'string') {
                    res.status(400).json({
                        success: false,
                        error: 'Missing or invalid field: content',
                    });
                    return;
                }

                if (body.content.length === 0 || body.content.length > 10000) {
                    res.status(400).json({
                        success: false,
                        error: 'Content must be between 1 and 10000 characters',
                    });
                    return;
                }

                // Get server instance
                const serverInstance = (global as any).elizaServer || (runtime as any).server;

                if (!serverInstance) {
                    throw new Error('AgentServer instance not available');
                }

                // Fetch channel details to get metadata (including channel type)
                let channelMetadata = {};
                try {
                    const channel = await serverInstance.getChannelDetails(session.channelId);
                    if (channel && channel.metadata) {
                        channelMetadata = channel.metadata;
                    }
                } catch (error) {
                    logger.debug(
                        `[Spartan Chat] Could not fetch channel metadata for ${session.channelId}: ${error}`
                    );
                }

                // Create message in the database
                // This automatically broadcasts to the message bus for agent processing
                const message = await serverInstance.createMessage({
                    channelId: session.channelId,
                    authorId: session.userId,
                    content: body.content,
                    rawMessage: {
                        content: body.content,
                        source: 'spartan_chat',
                    },
                    sourceType: 'user',
                    metadata: {
                        // Include channel metadata (which has sessionId, userId, agentId, etc.)
                        ...channelMetadata,
                        // Explicitly set channelType for room creation
                        channelType: ChannelType.DM,
                        // Session-specific metadata
                        sessionId: session.id,
                        sessionType: 'spartan_chat',
                        // Message-specific metadata overrides
                        ...body.metadata,
                    },
                });

                // Update session activity
                updateSessionActivity(sessionId);

                // Reduced logging verbosity - changed from info to debug
                logger.debug(`[Spartan Chat] Message sent in session ${sessionId}: ${message.id}`);

                res.status(201).json({
                    success: true,
                    data: {
                        messageId: message.id,
                        content: message.content,
                        createdAt: message.createdAt,
                        channelId: session.channelId,
                    },
                });
            } catch (error) {
                logger.error('[Spartan Chat] Error sending message:', error instanceof Error ? error.message : String(error));
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to send message',
                });
            }
        },
    },

    /**
     * Get message history for a chat session
     * GET /chat/sessions/:sessionId/messages
     */
    {
        type: 'GET',
        path: '/chat/sessions/:sessionId/messages',
        public: true,
        handler: async (req: any, res: any, runtime: IAgentRuntime) => {
            try {
                const { sessionId } = req.params;
                const limit = parseInt(req.query.limit as string) || 50;
                const before = req.query.before as string | undefined;

                // Validate session
                const session = getChatSession(sessionId);
                if (!session) {
                    res.status(404).json({
                        success: false,
                        error: 'Chat session not found',
                    });
                    return;
                }

                // Validate limit
                if (limit < 1 || limit > 100) {
                    res.status(400).json({
                        success: false,
                        error: 'Limit must be between 1 and 100',
                    });
                    return;
                }

                // Get server instance
                const serverInstance = (global as any).elizaServer || (runtime as any).server;

                if (!serverInstance) {
                    throw new Error('AgentServer instance not available');
                }

                // Parse before timestamp if provided
                let beforeDate: Date | undefined;
                if (before) {
                    const beforeTimestamp = parseInt(before, 10);
                    if (!isNaN(beforeTimestamp)) {
                        beforeDate = new Date(beforeTimestamp);
                    }
                }

                // Retrieve messages from the channel
                const messages = await serverInstance.getMessagesForChannel(
                    session.channelId,
                    limit,
                    beforeDate
                );

                // Transform messages for response
                const transformedMessages = messages.map((msg: any) => ({
                    id: msg.id,
                    content: msg.content,
                    authorId: msg.authorId,
                    isAgent: msg.authorId === runtime.agentId,
                    createdAt: msg.createdAt,
                    sourceType: msg.sourceType,
                    metadata: msg.metadata,
                    rawMessage: msg.rawMessage,
                }));

                res.status(200).json({
                    success: true,
                    data: {
                        messages: transformedMessages,
                        sessionId: session.id,
                        hasMore: messages.length === limit,
                    },
                });
            } catch (error) {
                logger.error('[Spartan Chat] Error retrieving messages:', error instanceof Error ? error.message : String(error));
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to retrieve messages',
                });
            }
        },
    },

    /**
     * Get session information
     * GET /chat/sessions/:sessionId
     */
    {
        type: 'GET',
        path: '/chat/sessions/:sessionId',
        public: true,
        handler: async (req: any, res: any, runtime: IAgentRuntime) => {
            try {
                const { sessionId } = req.params;

                const session = getChatSession(sessionId);
                if (!session) {
                    res.status(404).json({
                        success: false,
                        error: 'Chat session not found',
                    });
                    return;
                }

                res.status(200).json({
                    success: true,
                    data: {
                        sessionId: session.id,
                        userId: session.userId,
                        channelId: session.channelId,
                        agentId: session.agentId,
                        createdAt: session.createdAt,
                        lastActivity: session.lastActivity,
                        metadata: session.metadata,
                    },
                });
            } catch (error) {
                logger.error('[Spartan Chat] Error retrieving session:', error instanceof Error ? error.message : String(error));
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to retrieve session',
                });
            }
        },
    },

    /**
     * Delete a chat session
     * DELETE /chat/sessions/:sessionId
     */
    {
        type: 'DELETE',
        path: '/chat/sessions/:sessionId',
        public: true,
        handler: async (req: any, res: any, runtime: IAgentRuntime) => {
            try {
                const { sessionId } = req.params;

                const session = getChatSession(sessionId);
                if (!session) {
                    res.status(404).json({
                        success: false,
                        error: 'Chat session not found',
                    });
                    return;
                }

                // Remove session from memory
                chatSessions.delete(sessionId);

                // Reduced logging verbosity - changed from info to debug
                logger.debug(`[Spartan Chat] Deleted session ${sessionId}`);

                res.status(200).json({
                    success: true,
                    message: 'Chat session deleted successfully',
                });
            } catch (error) {
                logger.error('[Spartan Chat] Error deleting session:', error instanceof Error ? error.message : String(error));
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to delete session',
                });
            }
        },
    },

    /**
     * List all active sessions for a user
     * GET /chat/users/:userId/sessions
     */
    {
        type: 'GET',
        path: '/chat/users/:userId/sessions',
        public: true,
        handler: async (req: any, res: any, runtime: IAgentRuntime) => {
            try {
                const { userId } = req.params;
                const userUuid = validateUuid(userId);

                if (!userUuid) {
                    res.status(400).json({
                        success: false,
                        error: 'Invalid userId format',
                    });
                    return;
                }

                // Find all sessions for this user
                const userSessions = Array.from(chatSessions.values())
                    .filter(session => session.userId === userUuid)
                    .map(session => ({
                        sessionId: session.id,
                        channelId: session.channelId,
                        agentId: session.agentId,
                        createdAt: session.createdAt,
                        lastActivity: session.lastActivity,
                        metadata: session.metadata,
                    }));

                res.status(200).json({
                    success: true,
                    data: {
                        sessions: userSessions,
                        count: userSessions.length,
                    },
                });
            } catch (error) {
                logger.error('[Spartan Chat] Error listing sessions:', error instanceof Error ? error.message : String(error));
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to list sessions',
                });
            }
        },
    },

    /**
     * Health check endpoint for chat service
     * GET /chat/health
     */
    {
        type: 'GET',
        path: '/chat/health',
        public: true,
        handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
            try {
                const activeSessionCount = chatSessions.size;

                res.status(200).json({
                    success: true,
                    data: {
                        status: 'healthy',
                        agentId: runtime.agentId,
                        agentName: runtime.character?.name || 'Spartan',
                        activeSessions: activeSessionCount,
                        timestamp: new Date().toISOString(),
                    },
                });
            } catch (error) {
                logger.error('[Spartan Chat] Error in health check:', error instanceof Error ? error.message : String(error));
                res.status(500).json({
                    success: false,
                    error: 'Health check failed',
                });
            }
        },
    },
];

