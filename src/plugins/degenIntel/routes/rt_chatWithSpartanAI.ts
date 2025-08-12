import { type IAgentRuntime, logger } from '@elizaos/core';

// Helper functions for chat
function generateSuggestionsFromContext(context: any): string[] {
    const suggestions = [
        "Show my wallet balances",
        "Get a swap quote for SOL to USDC",
        "What's the current market sentiment?",
        "Analyze my portfolio performance",
        "Show trending tokens",
    ];

    return suggestions.slice(0, 3);
}

function buildContextString(context: any): string {
    if (!context) return '';

    let contextString = '';

    if (context.marketData) {
        contextString += `**Current Market Data:**\n`;
        contextString += `- Total tokens tracked: ${context.marketData.totalTokens || 0}\n`;

        if (context.marketData.trendingTokens?.length > 0) {
            contextString += `- Top trending tokens:\n`;
            context.marketData.trendingTokens.slice(0, 5).forEach((token: any) => {
                contextString += `  • ${token.symbol}: $${token.price?.toFixed(4) || 'N/A'} (${token.change24h?.toFixed(2) || 'N/A'}% 24h)\n`;
            });
        }
    }

    if (context.portfolio) {
        contextString += `\n**Portfolio Data Available**\n`;
    }

    if (context.recentTransactions?.length > 0) {
        contextString += `\n**Recent Transactions:** ${context.recentTransactions.length} transactions\n`;
    }

    return contextString;
}

async function createOrGetSession(runtime: IAgentRuntime, userId: string): Promise<string> {
    try {
        const response = await fetch(`${runtime.getSetting('API_BASE_URL') || 'http://206.81.100.168:3000'}/api/messaging/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                agentId: runtime.agentId,
                userId,
                metadata: {
                    platform: 'spartan',
                    username: userId,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to create session: ${response.statusText}`);
        }

        const { sessionId } = await response.json();
        return sessionId;
    } catch (error) {
        console.error("Error creating session:", error);
        throw error;
    }
}

async function sendSessionMessage(runtime: IAgentRuntime, sessionId: string, message: string, context: any) {
    try {
        const contextString = buildContextString(context);
        const fullMessage = contextString ? `${contextString}\n\nUser: ${message}` : message;

        const response = await fetch(
            `${runtime.getSetting('API_BASE_URL') || 'http://206.81.100.168:3000'}/api/messaging/sessions/${sessionId}/messages`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: fullMessage,
                    metadata: {
                        userTimezone: 'UTC',
                        context: contextString ? 'defi' : 'general',
                    }
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to send message: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error sending session message:", error);
        throw error;
    }
}

// Chat with Spartan AI function implementation
async function chatWithSpartanAI(runtime: IAgentRuntime, message: string, context: any) {
    try {
        const userId = context.userId || 'default-user';
        const sessionId = await createOrGetSession(runtime, userId);

        const response = await sendSessionMessage(runtime, sessionId, message, context);

        return {
            message: response.content,
            sessionId,
            suggestions: generateSuggestionsFromContext(context),
            confidence: 0.9,
        };
    } catch (error) {
        console.error("Error chatting with Spartan AI:", error);
        return {
            message: "I'm having trouble processing your request right now. Please try again.",
            confidence: 0.1,
        };
    }
}

// Route handler for creating sessions
export const rt_createSession = async (req: any, res: any, runtime: IAgentRuntime) => {
    try {
        const { userId, metadata } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: userId'
            });
        }

        const sessionId = await createOrGetSession(runtime, userId);

        res.json({
            success: true,
            data: { sessionId },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Route handler for sending session messages
export const rt_sendSessionMessage = async (req: any, res: any, runtime: IAgentRuntime) => {
    try {
        const { sessionId } = req.params;
        const { content, metadata } = req.body;

        if (!content) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: content'
            });
        }

        const messageResponse = await sendSessionMessage(runtime, sessionId, content, metadata);

        res.json({
            success: true,
            data: messageResponse,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error sending session message:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Route handler for getting session messages
export const rt_getSessionMessages = async (req: any, res: any, runtime: IAgentRuntime) => {
    try {
        const { sessionId } = req.params;
        const { limit = 20, before, after } = req.query;

        // Build query parameters
        const queryParams = new URLSearchParams();
        if (limit) queryParams.append('limit', limit.toString());
        if (before) queryParams.append('before', before);
        if (after) queryParams.append('after', after);

        // Get message history using Sessions API
        const response = await fetch(
            `${runtime.getSetting('API_BASE_URL') || 'http://localhost:3000'}/api/messaging/sessions/${sessionId}/messages?${queryParams}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to get messages: ${response.statusText}`);
        }

        const messagesResponse = await response.json();

        res.json({
            success: true,
            data: messagesResponse,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error getting session messages:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Route handler for deleting sessions
export const rt_deleteSession = async (req: any, res: any, runtime: IAgentRuntime) => {
    try {
        const { sessionId } = req.params;

        // Delete session using Sessions API
        const response = await fetch(
            `${runtime.getSetting('API_BASE_URL') || 'http://localhost:3000'}/api/messaging/sessions/${sessionId}`,
            {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to delete session: ${response.statusText}`);
        }

        res.json({
            success: true,
            data: { message: 'Session deleted successfully' },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const rt_chatWithSpartanAI = async (req: any, res: any, runtime: IAgentRuntime) => {
    try {
        const { message: userMessage, context = {} } = req.body || {};

        if (!userMessage) {
            return res.status(400).json({
                success: false,
                message: 'Message is required'
            });
        }

        logger.info('Chatting with Spartan AI:', userMessage.substring(0, 100) + '...');

        const response = await chatWithSpartanAI(runtime, userMessage, context);

        res.json({
            success: true,
            message: response.message,
            sessionId: response.sessionId,
            suggestions: response.suggestions,
            confidence: response.confidence,
            originalMessage: userMessage
        });
    } catch (error) {
        logger.error('Error in rt_chatWithSpartanAI route:', error);
        res.status(500).json({
            success: false,
            message: 'Error chatting with Spartan AI',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}; 