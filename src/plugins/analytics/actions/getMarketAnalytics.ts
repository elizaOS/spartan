import type { Action, IAgentRuntime, Memory, State, ActionResult } from '@elizaos/core';
import { AnalyticsService } from '../services/analyticsService';
import type { MarketAnalytics } from '../interfaces/types';

export const getMarketAnalytics: Action = {
    name: 'GET_MARKET_ANALYTICS',
    description: 'Get comprehensive market analytics including top gainers, losers, trending tokens, and market sentiment',
    parameters: {
        type: 'object',
        properties: {
            chain: {
                type: 'string',
                description: 'The blockchain chain (solana, ethereum, base)',
                enum: ['solana', 'ethereum', 'base'],
                default: 'solana'
            }
        }
    },
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        // Always allow this action to be executed
        return true;
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state?: State, options?: { [key: string]: unknown }): Promise<ActionResult> => {
        try {
            const { chain = 'solana' } = options as any || {};
            const analyticsService = new AnalyticsService(runtime);

            const response = await analyticsService.getMarketAnalytics({ chain });

            if (!response.success) {
                return {
                    success: false,
                    error: response.error,
                    data: {
                        thought: `Failed to get market analytics: ${response.error}`,
                        response: `❌ Error getting market data: ${response.error}`
                    }
                };
            }

            // Type guard to ensure we have MarketAnalytics
            if (!response.data || typeof response.data !== 'object' || !('marketCap' in response.data)) {
                return {
                    success: false,
                    error: 'Invalid market analytics data received',
                    data: {
                        thought: 'Invalid market analytics data received',
                        response: '❌ Error: Invalid market analytics data received'
                    }
                };
            }

            const marketData = response.data as MarketAnalytics;
            let responseText = `🌍 MARKET ANALYTICS: ${chain.toUpperCase()}\n\n`;

            responseText += `📊 MARKET OVERVIEW:\n`;
            responseText += `• Total Market Cap: $${marketData.marketCap.toLocaleString()}\n`;
            responseText += `• 24h Volume: $${marketData.volume24h.toLocaleString()}\n`;
            responseText += `• Market Sentiment: ${getSentimentText(marketData.marketSentiment)}\n\n`;

            responseText += `🚀 TOP GAINERS (24h):\n`;
            for (let i = 0; i < Math.min(5, marketData.topGainers.length); i++) {
                const token = marketData.topGainers[i];
                responseText += `${i + 1}. ${token.symbol}: +${token.priceChangePercent24h.toFixed(2)}% ($${token.price.toFixed(6)})\n`;
            }
            responseText += '\n';

            responseText += `📉 TOP LOSERS (24h):\n`;
            for (let i = 0; i < Math.min(5, marketData.topLosers.length); i++) {
                const token = marketData.topLosers[i];
                responseText += `${i + 1}. ${token.symbol}: ${token.priceChangePercent24h.toFixed(2)}% ($${token.price.toFixed(6)})\n`;
            }
            responseText += '\n';

            responseText += `🔥 TRENDING TOKENS:\n`;
            for (let i = 0; i < Math.min(5, marketData.trendingTokens.length); i++) {
                const token = marketData.trendingTokens[i];
                responseText += `${i + 1}. ${token.symbol}: $${token.volume24h.toLocaleString()} volume ($${token.price.toFixed(6)})\n`;
            }

            return {
                success: true,
                data: {
                    thought: `Successfully retrieved market analytics for ${chain} showing market sentiment and trending tokens.`,
                    response: responseText
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                data: {
                    thought: `Error occurred while getting market analytics: ${error}`,
                    response: `❌ Error getting market analytics: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            };
        }
    }
};

function getSentimentText(sentiment: any): string {
    if (sentiment.bullish > 0.6) return '🟢 Bullish';
    if (sentiment.bearish > 0.6) return '🔴 Bearish';
    return '🟡 Neutral';
} 