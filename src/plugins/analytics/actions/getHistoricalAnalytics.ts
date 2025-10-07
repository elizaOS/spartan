import type { Action, IAgentRuntime, Memory, State, ActionResult, ActionExample, HandlerCallback } from '@elizaos/core';
import { AnalyticsService } from '../services/analyticsService';
import { getWalletsFromText, getAccountFromMessage } from '../../autonomous-trader/utils';
import type { ComprehensiveTokenAnalytics } from '../interfaces/types';

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
    name: 'GET_HISTORICAL_ANALYTICS',
    description: 'Get historical analytics for a token including price trends, volume analysis, and technical indicators over time',
    similes: ['historical analytics', 'price history', 'token history', 'historical data', 'price trends'],
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me historical data for SOL',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll get the historical analytics for SOL",
                    actions: ['GET_HISTORICAL_ANALYTICS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'What is the price history of this token?',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "Let me analyze the historical price data",
                    actions: ['GET_HISTORICAL_ANALYTICS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me 1 week historical data for 0x1234567890abcdef',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll get the 1 week historical analytics for that token",
                    actions: ['GET_HISTORICAL_ANALYTICS'],
                },
            },
        ],
    ] as ActionExample[][],
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {

        // Allow the action for other historical analytics requests
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
            let { tokenAddress, chain = 'solana', timeframe = '1d' } = _options as any || {};

            // If no token address provided, try to extract from message text
            if (!tokenAddress) {
                const wallets = await getWalletsFromText(runtime, message);
                if (wallets.length > 0) {
                    tokenAddress = wallets[0];
                } else {
                    const errorResponse = '❌ Please provide a token address to analyze historical data.';
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
            }

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

            const request = {
                tokenAddress,
                chain,
                timeframe,
                includeHistorical: true,
                includeHolders: false,
                includeSnipers: false
            };

            const response = await analyticsService.getTokenAnalytics(request);

            if (!response.success) {
                const errorResponse = `❌ Error analyzing historical data for ${tokenAddress}: ${response.error}`;
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

            // Type guard to ensure we have ComprehensiveTokenAnalytics
            if (!response.data || typeof response.data !== 'object' || !('historicalData' in response.data)) {
                const errorResponse = '❌ Error: Invalid token analytics data received';
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

            const tokenData = response.data as ComprehensiveTokenAnalytics;

            // Check if visual output is enabled
            const visualOutput = await isVisualOutputEnabled(runtime, message);

            let responseText = visualOutput
                ? `📈 HISTORICAL ANALYTICS: ${tokenData.symbol}\n\n`
                : `Historical Analytics: ${tokenData.symbol}\n\n`;

            if (tokenData.historicalData.length === 0) {
                responseText += `❌ No historical data available for the specified timeframe.\n`;
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
                        tokenAddress,
                        symbol: tokenData.symbol,
                        historicalData: []
                    }
                };
            }

            // Historical price analysis
            const historicalData = tokenData.historicalData;
            const firstPrice = historicalData[0].close;
            const lastPrice = historicalData[historicalData.length - 1].close;
            const totalChange = ((lastPrice - firstPrice) / firstPrice) * 100;
            const avgVolume = historicalData.reduce((sum, d) => sum + d.volume, 0) / historicalData.length;

            responseText += visualOutput ? `💰 PRICE TRENDS:\n` : `Price Trends:\n`;
            responseText += `• Period: ${timeframe} data points\n`;
            responseText += `• Start Price: $${firstPrice.toFixed(6)}\n`;
            responseText += `• End Price: $${lastPrice.toFixed(6)}\n`;
            responseText += `• Total Change: ${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(2)}%\n`;
            responseText += `• Average Volume: $${avgVolume.toLocaleString()}\n\n`;

            // Technical indicators summary
            responseText += visualOutput ? `📊 TECHNICAL INDICATORS:\n` : `Technical Indicators:\n`;
            const tech = tokenData.technicalIndicators;
            responseText += `• MACD: ${tech.macd.bullish ? (visualOutput ? '🟢 Bullish' : 'Bullish') : (visualOutput ? '🔴 Bearish' : 'Bearish')} (${tech.macd.macd.toFixed(6)})\n`;
            responseText += `• RSI: ${tech.rsi.value.toFixed(2)} ${tech.rsi.overbought ? '(Overbought)' : tech.rsi.oversold ? '(Oversold)' : '(Neutral)'}\n`;
            responseText += `• Volume Ratio: ${tech.volume.volumeRatio.toFixed(2)}x average\n\n`;

            // Moving averages
            responseText += visualOutput ? `📈 MOVING AVERAGES:\n` : `Moving Averages:\n`;
            responseText += `• SMA 20: $${tech.movingAverages.sma20.toFixed(6)}\n`;
            responseText += `• SMA 50: $${tech.movingAverages.sma50.toFixed(6)}\n`;
            responseText += `• SMA 200: $${tech.movingAverages.sma200.toFixed(6)}\n`;
            responseText += `• EMA 12: $${tech.movingAverages.ema12.toFixed(6)}\n`;
            responseText += `• EMA 26: $${tech.movingAverages.ema26.toFixed(6)}\n\n`;

            // Trend analysis
            responseText += visualOutput ? `📊 TREND ANALYSIS:\n` : `Trend Analysis:\n`;
            const sma20 = tech.movingAverages.sma20;
            const sma50 = tech.movingAverages.sma50;
            const currentPrice = lastPrice;

            if (currentPrice > sma20 && sma20 > sma50) {
                responseText += `• Trend: ${visualOutput ? '🟢 Strong Uptrend' : 'Strong Uptrend'}\n`;
            } else if (currentPrice > sma20) {
                responseText += `• Trend: ${visualOutput ? '🟡 Weak Uptrend' : 'Weak Uptrend'}\n`;
            } else if (currentPrice < sma20 && sma20 < sma50) {
                responseText += `• Trend: ${visualOutput ? '🔴 Strong Downtrend' : 'Strong Downtrend'}\n`;
            } else {
                responseText += `• Trend: ${visualOutput ? '🟡 Weak Downtrend' : 'Weak Downtrend'}\n`;
            }

            // Volume analysis
            const volumeRatio = tech.volume.volumeRatio;
            if (volumeRatio > 1.5) {
                responseText += `• Volume: ${visualOutput ? '📈 High volume activity' : 'High volume activity'}\n`;
            } else if (volumeRatio < 0.5) {
                responseText += `• Volume: ${visualOutput ? '📉 Low volume activity' : 'Low volume activity'}\n`;
            } else {
                responseText += `• Volume: ${visualOutput ? '📊 Normal volume' : 'Normal volume'}\n`;
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
                    tokenAddress,
                    symbol: tokenData.symbol,
                    historicalData: historicalData,
                    technicalIndicators: tech
                }
            };

        } catch (error) {
            const errorResponse = `❌ Error analyzing historical data: ${error instanceof Error ? error.message : 'Unknown error'}`;
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