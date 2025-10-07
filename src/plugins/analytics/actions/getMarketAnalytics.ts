import type { Action, IAgentRuntime, Memory, State, ActionResult, ActionExample, HandlerCallback } from '@elizaos/core';
import { AnalyticsService } from '../services/analyticsService';
import { getWalletsFromText, getAccountFromMessage } from '../../autonomous-trader/utils';
import type { MarketAnalytics } from '../interfaces/types';

/**
 * Check if user has visual output enabled
 */
async function isVisualOutputEnabled(runtime: IAgentRuntime, message: Memory): Promise<boolean> {
    try {
        const account = await getAccountFromMessage(runtime, message);
        return account?.visualOutput === true;
    } catch (error) {
        console.warn('Error checking visual output setting:', error);
        return true; // Default to visual output enabled
    }
}

export default {
    name: 'GET_MARKET_ANALYTICS',
    description: 'Get comprehensive market analytics including top gainers, losers, trending tokens, and market sentiment',
    similes: ['market analytics', 'market overview', 'market trends', 'top gainers', 'market sentiment'],
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me market analytics',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll get the latest market data for you",
                    actions: ['GET_MARKET_ANALYTICS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'What are the top gainers today?',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "Let me check the market for top performers",
                    actions: ['GET_MARKET_ANALYTICS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me trending tokens on Solana',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll analyze the Solana market trends",
                    actions: ['GET_MARKET_ANALYTICS'],
                },
            },
        ],
    ] as ActionExample[][],
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {

        // Allow the action for other market analytics requests
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: Memory[] = []
    ): Promise<ActionResult | void | undefined> => {
        try {
            const { chain = 'solana' } = _options as any || {};

            // Get the registered analytics service instead of creating a new instance
            const analyticsService = runtime.getService('ANALYTICS_SERVICE') as AnalyticsService;
            if (!analyticsService) {
                const errorResponse = '❌ Analytics service not available. Please ensure the analytics plugin is properly configured.';
                if (callback) {
                    callback({
                        text: errorResponse,
                        attachments: [],
                        source: 'auto',
                        channelType: 'text',
                        inReplyTo: message.id
                    });
                }
                return;
            }

            const response = await analyticsService.getMarketAnalytics({ chain });

            if (!response.success) {
                const errorResponse = `❌ Error getting market data: ${response.error}`;
                if (callback) {
                    callback({
                        text: errorResponse,
                        attachments: [],
                        source: 'auto',
                        channelType: 'text',
                        inReplyTo: message.id
                    });
                }
                return;
            }

            // Type guard to ensure we have MarketAnalytics
            if (!response.data || typeof response.data !== 'object' || !('marketCap' in response.data)) {
                const errorResponse = '❌ Error: Invalid market analytics data received';
                if (callback) {
                    callback({
                        text: errorResponse,
                        attachments: [],
                        source: 'auto',
                        channelType: 'text',
                        inReplyTo: message.id
                    });
                }
                return;
            }

            const marketData = response.data as MarketAnalytics;

            // Check if visual output is enabled
            const visualOutput = await isVisualOutputEnabled(runtime, message);

            let responseText = visualOutput
                ? `🌍 MARKET ANALYTICS: ${chain.toUpperCase()}\n\n`
                : `Market Analytics: ${chain.toUpperCase()}\n\n`;

            responseText += visualOutput ? `📊 MARKET OVERVIEW:\n` : `Market Overview:\n`;
            responseText += `• Total Market Cap: $${marketData.marketCap.toLocaleString()}\n`;
            responseText += `• 24h Volume: $${marketData.volume24h.toLocaleString()}\n`;
            responseText += `• Market Sentiment: ${getSentimentText(marketData.marketSentiment, visualOutput)}\n\n`;

            responseText += visualOutput ? `🚀 TOP GAINERS (24h):\n` : `Top Gainers (24h):\n`;
            for (let i = 0; i < Math.min(5, marketData.topGainers.length); i++) {
                const token = marketData.topGainers[i];
                responseText += `${i + 1}. ${token.symbol}: +${token.priceChangePercent24h.toFixed(2)}% ($${token.price.toFixed(6)})\n`;
            }
            responseText += '\n';

            responseText += visualOutput ? `📉 TOP LOSERS (24h):\n` : `Top Losers (24h):\n`;
            for (let i = 0; i < Math.min(5, marketData.topLosers.length); i++) {
                const token = marketData.topLosers[i];
                responseText += `${i + 1}. ${token.symbol}: ${token.priceChangePercent24h.toFixed(2)}% ($${token.price.toFixed(6)})\n`;
            }
            responseText += '\n';

            responseText += visualOutput ? `🔥 TRENDING TOKENS:\n` : `Trending Tokens:\n`;
            for (let i = 0; i < Math.min(5, marketData.trendingTokens.length); i++) {
                const token = marketData.trendingTokens[i];
                responseText += `${i + 1}. ${token.symbol}: $${token.volume24h.toLocaleString()} volume ($${token.price.toFixed(6)})\n`;
            }

            if (callback) {
                callback({
                    text: responseText,
                    attachments: [],
                    source: 'auto',
                    channelType: 'text',
                    inReplyTo: message.id
                });
            }

            return {
                success: true,
                text: responseText,
                data: {
                    chain,
                    analytics: marketData
                }
            };

        } catch (error) {
            const errorResponse = `❌ Error getting market analytics: ${error instanceof Error ? error.message : 'Unknown error'}`;
            if (callback) {
                callback({
                    text: errorResponse,
                    attachments: [],
                    source: 'auto',
                    channelType: 'text',
                    inReplyTo: message.id
                });
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
} as Action;

function getSentimentText(sentiment: any, visualOutput: boolean = true): string {
    if (sentiment.bullish > 0.6) return visualOutput ? '🟢 Bullish' : 'Bullish';
    if (sentiment.bearish > 0.6) return visualOutput ? '🔴 Bearish' : 'Bearish';
    return visualOutput ? '🟡 Neutral' : 'Neutral';
} 