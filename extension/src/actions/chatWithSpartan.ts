import {
    Action,
    IAgentRuntime,
    Memory,
    logger,
} from "@elizaos/core";
import { z } from "zod";
import { ChatWithSpartanParams } from "../types";
import { chatWithSpartanAI, buildChatContextFromServices } from "../../../src/plugins/degenIntel/utils";

const chatWithSpartanSchema = z.object({
    message: z.string().min(1),
    context: z.any().optional(),
    userId: z.string().optional(),
});

export const chatWithSpartanAction: Action = {
    name: "CHAT_WITH_SPARTAN",
    description: "Chat with Spartan AI for DeFi insights, trading advice, and market analysis using degenIntel data and Sessions API",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase() || "";

        // Check if message is directed to Spartan or contains DeFi/trading questions
        const hasSpartanIntent = /spartan|ai|assistant|help/.test(text);
        const hasDefiIntent = /defi|trading|market|price|token|portfolio|analysis/.test(text);
        const hasQuestionIntent = /\?|what|how|why|when|where|which/.test(text);

        return hasSpartanIntent || (hasDefiIntent && hasQuestionIntent);
    },

    handler: async (runtime: IAgentRuntime, message: Memory) => {
        try {
            const userMessage = message.content.text || "";

            // Extract user ID from message metadata or use default
            const userId = message.content.metadata?.userId ||
                message.content.metadata?.username ||
                message.content.metadata?.email ||
                'default-user';

            const params: ChatWithSpartanParams = {
                message: userMessage,
                userId,
            };

            // Validate parameters
            const validated = chatWithSpartanSchema.parse(params);

            // Build context from degenIntel services and cache
            const context = await buildChatContextFromServices(runtime);
            context.userId = validated.userId; // Add user ID to context

            // Chat with Spartan AI using Sessions API
            const response = await chatWithSpartanAI(runtime, validated.message, context);

            logger.info(`Spartan AI response generated with session ID: ${response.sessionId}`);

            const formattedResponse = formatSpartanResponse(response, context);

            return {
                success: true,
                data: {
                    response,
                    context,
                    sessionId: response.sessionId,
                },
                message: formattedResponse,
            };
        } catch (error) {
            logger.error("Failed to chat with Spartan:", error);
            return {
                success: false,
                error:
                    error instanceof Error ? error.message : "Failed to chat with Spartan",
            };
        }
    },

    examples: [
        [
            {
                name: "Market Analysis",
                content: { text: "Spartan, what's your analysis of the current market?" }
            },
            {
                name: "Trading Advice",
                content: { text: "What trading advice do you have for me?" }
            },
            {
                name: "Portfolio Management",
                content: { text: "How should I manage my DeFi portfolio?" }
            },
            {
                name: "Market Sentiment",
                content: { text: "Spartan, explain the current market sentiment" }
            },
            {
                name: "Risk Assessment",
                content: { text: "What are the risks of this token?" }
            },
        ]
    ],

    similes: [
        "ASK_SPARTAN",
        "GET_AI_ADVICE",
        "DEFI_ANALYSIS",
        "TRADING_INSIGHTS",
    ],
};

function formatSpartanResponse(response: any, context: any): string {
    let formatted = `🤖 **Spartan AI Response**

${response.message}

**Confidence:** ${(response.confidence * 100).toFixed(1)}%`;

    if (response.suggestions && response.suggestions.length > 0) {
        formatted += `\n\n💡 **Suggested Actions:**`;
        response.suggestions.forEach((suggestion: string, index: number) => {
            formatted += `\n${index + 1}. ${suggestion}`;
        });
    }

    if (context?.marketData) {
        formatted += `\n\n📊 **Market Context:**`;
        formatted += `\n- Tokens tracked: ${context.marketData.totalTokens}`;
        if (context.marketData.trendingTokens?.length > 0) {
            formatted += `\n- Top trending: ${context.marketData.trendingTokens.slice(0, 3).map((t: any) => t.symbol).join(', ')}`;
        }
    }

    return formatted;
} 