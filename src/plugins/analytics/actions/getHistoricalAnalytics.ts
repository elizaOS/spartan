import type { Action, IAgentRuntime, Memory, State, ActionResult } from '@elizaos/core';
import { AnalyticsService } from '../services/analyticsService';
import type { ComprehensiveTokenAnalytics } from '../interfaces/types';

export const getHistoricalAnalytics: Action = {
    name: 'GET_HISTORICAL_ANALYTICS',
    description: 'Get historical analytics for a token including price trends, volume analysis, and technical indicators over time',
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
            const { tokenAddress, chain = 'solana', timeframe = '1d' } = options as any || {};
            const analyticsService = new AnalyticsService(runtime);

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
                return {
                    success: false,
                    error: response.error,
                    data: {
                        thought: `Failed to get historical analytics: ${response.error}`,
                        response: `❌ Error analyzing historical data for ${tokenAddress}: ${response.error}`
                    }
                };
            }

            // Type guard to ensure we have ComprehensiveTokenAnalytics
            if (!response.data || typeof response.data !== 'object' || !('historicalData' in response.data)) {
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
            let responseText = `📈 HISTORICAL ANALYTICS: ${tokenData.symbol}\n\n`;

            if (tokenData.historicalData.length === 0) {
                responseText += `❌ No historical data available for the specified timeframe.\n`;
                return {
                    success: true,
                    data: {
                        thought: 'No historical data available for analysis',
                        response: responseText
                    }
                };
            }

            // Historical price analysis
            const historicalData = tokenData.historicalData;
            const firstPrice = historicalData[0].close;
            const lastPrice = historicalData[historicalData.length - 1].close;
            const totalChange = ((lastPrice - firstPrice) / firstPrice) * 100;
            const avgVolume = historicalData.reduce((sum, d) => sum + d.volume, 0) / historicalData.length;

            responseText += `💰 PRICE TRENDS:\n`;
            responseText += `• Period: ${timeframe} data points\n`;
            responseText += `• Start Price: $${firstPrice.toFixed(6)}\n`;
            responseText += `• End Price: $${lastPrice.toFixed(6)}\n`;
            responseText += `• Total Change: ${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(2)}%\n`;
            responseText += `• Average Volume: $${avgVolume.toLocaleString()}\n\n`;

            // Technical indicators summary
            responseText += `📊 TECHNICAL INDICATORS:\n`;
            const tech = tokenData.technicalIndicators;
            responseText += `• MACD: ${tech.macd.bullish ? '🟢 Bullish' : '🔴 Bearish'} (${tech.macd.macd.toFixed(6)})\n`;
            responseText += `• RSI: ${tech.rsi.value.toFixed(2)} ${tech.rsi.overbought ? '(Overbought)' : tech.rsi.oversold ? '(Oversold)' : '(Neutral)'}\n`;
            responseText += `• Volume Ratio: ${tech.volume.volumeRatio.toFixed(2)}x average\n\n`;

            // Moving averages
            responseText += `📈 MOVING AVERAGES:\n`;
            responseText += `• SMA 20: $${tech.movingAverages.sma20.toFixed(6)}\n`;
            responseText += `• SMA 50: $${tech.movingAverages.sma50.toFixed(6)}\n`;
            responseText += `• SMA 200: $${tech.movingAverages.sma200.toFixed(6)}\n`;
            responseText += `• EMA 12: $${tech.movingAverages.ema12.toFixed(6)}\n`;
            responseText += `• EMA 26: $${tech.movingAverages.ema26.toFixed(6)}\n\n`;

            // Trend analysis
            responseText += `📊 TREND ANALYSIS:\n`;
            const sma20 = tech.movingAverages.sma20;
            const sma50 = tech.movingAverages.sma50;
            const currentPrice = lastPrice;

            if (currentPrice > sma20 && sma20 > sma50) {
                responseText += `• Trend: 🟢 Strong Uptrend\n`;
            } else if (currentPrice > sma20) {
                responseText += `• Trend: 🟡 Weak Uptrend\n`;
            } else if (currentPrice < sma20 && sma20 < sma50) {
                responseText += `• Trend: 🔴 Strong Downtrend\n`;
            } else {
                responseText += `• Trend: 🟡 Weak Downtrend\n`;
            }

            // Volume analysis
            const volumeRatio = tech.volume.volumeRatio;
            if (volumeRatio > 1.5) {
                responseText += `• Volume: 📈 High volume activity\n`;
            } else if (volumeRatio < 0.5) {
                responseText += `• Volume: 📉 Low volume activity\n`;
            } else {
                responseText += `• Volume: 📊 Normal volume\n`;
            }

            return {
                success: true,
                data: {
                    thought: `Successfully analyzed historical data for ${tokenData.symbol} showing ${totalChange >= 0 ? 'positive' : 'negative'} price movement over the ${timeframe} period.`,
                    response: responseText
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                data: {
                    thought: `Error occurred while analyzing historical data: ${error}`,
                    response: `❌ Error analyzing historical data: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            };
        }
    }
}; 