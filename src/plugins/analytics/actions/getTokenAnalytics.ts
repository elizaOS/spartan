import type { Action, IAgentRuntime, Memory, State, ActionResult } from '@elizaos/core';
import { AnalyticsService } from '../services/analyticsService';
import { parseDateFilterFromMessage, formatDateFilterText } from '../../autonomous-trader/providers/date_filter';
import type { ComprehensiveTokenAnalytics } from '../interfaces/types';

/**
 * Get comprehensive token analytics action
 */
export const getTokenAnalytics: Action = {
    name: 'GET_TOKEN_ANALYTICS',
    description: 'Get comprehensive analytics for a specific token including price data, technical indicators, holder analytics, and trading recommendations',
    parameters: {
        type: 'object',
        properties: {
            tokenAddress: {
                type: 'string',
                description: 'The token address to analyze'
            },
            chain: {
                type: 'string',
                description: 'The blockchain chain (solana, ethereum, base)',
                enum: ['solana', 'ethereum', 'base'],
                default: 'solana'
            },
            timeframe: {
                type: 'string',
                description: 'Timeframe for historical data analysis',
                enum: ['1h', '4h', '1d', '1w', '1m'],
                default: '1d'
            },
            includeHistorical: {
                type: 'boolean',
                description: 'Include historical price data and technical analysis',
                default: true
            },
            includeHolders: {
                type: 'boolean',
                description: 'Include holder analytics from Codex',
                default: true
            },
            includeSnipers: {
                type: 'boolean',
                description: 'Include sniper analytics from Codex',
                default: true
            }
        },
        required: ['tokenAddress']
    },
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        // Always allow this action to be executed
        return true;
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state?: State, options?: { [key: string]: unknown }): Promise<ActionResult> => {
        try {
            const {
                tokenAddress,
                chain = 'solana',
                timeframe = '1d',
                includeHistorical = true,
                includeHolders = true,
                includeSnipers = true
            } = options as any || {};

            // Initialize analytics service
            const analyticsService = new AnalyticsService(runtime);

            // Check for date filter in message
            const messageText = message.content?.text?.toLowerCase() || '';
            const dateFilter = parseDateFilterFromMessage(messageText);

            const request = {
                tokenAddress,
                chain,
                timeframe,
                includeHistorical,
                includeHolders,
                includeSnipers
            };

            const response = await analyticsService.getTokenAnalytics(request);

            if (!response.success) {
                return {
                    success: false,
                    error: response.error,
                    data: {
                        thought: `Failed to get token analytics: ${response.error}`,
                        response: `❌ Error analyzing token ${tokenAddress}: ${response.error}`
                    }
                };
            }

            // Type guard to ensure we have ComprehensiveTokenAnalytics
            if (!response.data || typeof response.data !== 'object' || !('price' in response.data)) {
                return {
                    success: false,
                    error: 'Invalid token analytics data received',
                    data: {
                        thought: 'Invalid token analytics data received',
                        response: '❌ Error: Invalid token analytics data received'
                    }
                };
            }

            const tokenData = response.data as ComprehensiveTokenAnalytics;

            // Format comprehensive response
            let responseText = `🔍 COMPREHENSIVE TOKEN ANALYTICS: ${tokenData.symbol}\n\n`;

            // Add date filter info if applied
            if (dateFilter) {
                responseText += `📅 Date Filter: ${formatDateFilterText(dateFilter)}\n\n`;
            }

            // Price Summary
            responseText += `💰 PRICE SUMMARY:\n`;
            responseText += `• Current Price: $${tokenData.price.price.toFixed(6)}\n`;
            responseText += `• 24h Change: ${tokenData.price.priceChangePercent24h >= 0 ? '+' : ''}${tokenData.price.priceChangePercent24h.toFixed(2)}%\n`;
            responseText += `• 24h Volume: $${tokenData.price.volume24h.toLocaleString()}\n`;
            responseText += `• Market Cap: $${tokenData.price.marketCap.toLocaleString()}\n\n`;

            // Technical Analysis Summary
            responseText += `📊 TECHNICAL ANALYSIS:\n`;
            const tech = tokenData.technicalIndicators;
            responseText += `• MACD: ${tech.macd.bullish ? '🟢 Bullish' : '🔴 Bearish'}\n`;
            responseText += `• RSI: ${tech.rsi.value.toFixed(2)} ${tech.rsi.overbought ? '(Overbought)' : tech.rsi.oversold ? '(Oversold)' : '(Neutral)'}\n`;
            responseText += `• Volume: ${tech.volume.volumeRatio.toFixed(2)}x average\n\n`;

            // Risk Assessment
            responseText += `⚠️ RISK ASSESSMENT:\n`;
            const risk = tokenData.riskAssessment;
            responseText += `• Overall Risk: ${risk.overallRisk.toUpperCase()}\n`;
            responseText += `• Volatility: ${risk.volatility.toFixed(2)}%\n`;
            responseText += `• Liquidity: ${risk.liquidity.toFixed(2)}%\n\n`;

            // Recommendations
            responseText += `💡 RECOMMENDATIONS:\n`;
            const rec = tokenData.recommendations;
            responseText += `• Action: ${rec.action.toUpperCase()}\n`;
            responseText += `• Confidence: ${rec.confidence.toFixed(0)}%\n`;
            responseText += `• Reasons: ${rec.reasons.join(', ')}\n\n`;

            // Holder Analytics (if available)
            if (tokenData.holderAnalytics) {
                responseText += `👥 HOLDER INSIGHTS:\n`;
                const holders = tokenData.holderAnalytics;
                responseText += `• Total Holders: ${holders.totalHolders.toLocaleString()}\n`;
                responseText += `• Community Growth: ${holders.communityGrowth.toUpperCase()}\n`;
                responseText += `• Concentration Risk: ${holders.concentrationRisk.toUpperCase()}\n\n`;
            }

            // Sniper Analytics (if available)
            if (tokenData.sniperAnalytics) {
                responseText += `🎯 SNIPER ACTIVITY:\n`;
                const snipers = tokenData.sniperAnalytics;
                responseText += `• Active Snipers: ${snipers.activeSnipers}\n`;
                responseText += `• Average Profit: ${snipers.averageProfitPercent >= 0 ? '+' : ''}${snipers.averageProfitPercent.toFixed(2)}%\n\n`;
            }

            return {
                success: true,
                data: {
                    thought: `Successfully analyzed token ${tokenData.symbol} with comprehensive analytics including technical indicators, risk assessment, and trading recommendations. The token shows ${rec.action} signals with ${rec.confidence.toFixed(0)}% confidence.`,
                    response: responseText
                }
            };

        } catch (error) {
            console.error('Error in getTokenAnalytics action:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                data: {
                    thought: `Error occurred while analyzing token: ${error}`,
                    response: `❌ Error analyzing token: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            };
        }
    }
}; 