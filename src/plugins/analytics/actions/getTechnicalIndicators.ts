import type { Action, IAgentRuntime, Memory, State, ActionResult } from '@elizaos/core';
import { AnalyticsService } from '../services/analyticsService';
import type { ComprehensiveTokenAnalytics } from '../interfaces/types';

export const getTechnicalIndicators: Action = {
    name: 'GET_TECHNICAL_INDICATORS',
    description: 'Get detailed technical indicators for a token including MACD, RSI, Bollinger Bands, moving averages, and trading signals',
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
                description: 'Timeframe for technical analysis',
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
                        thought: `Failed to get technical indicators: ${response.error}`,
                        response: `❌ Error analyzing technical indicators for ${tokenAddress}: ${response.error}`
                    }
                };
            }

            // Type guard to ensure we have ComprehensiveTokenAnalytics
            if (!response.data || typeof response.data !== 'object' || !('technicalIndicators' in response.data)) {
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
            let responseText = `📊 TECHNICAL INDICATORS: ${tokenData.symbol}\n\n`;

            const tech = tokenData.technicalIndicators;

            // MACD Analysis
            responseText += `📈 MACD (Moving Average Convergence Divergence):\n`;
            responseText += `• MACD Line: ${tech.macd.macd.toFixed(6)}\n`;
            responseText += `• Signal Line: ${tech.macd.signal.toFixed(6)}\n`;
            responseText += `• Histogram: ${tech.macd.histogram.toFixed(6)}\n`;
            responseText += `• Signal: ${tech.macd.bullish ? '🟢 Bullish (MACD > Signal)' : '🔴 Bearish (MACD < Signal)'}\n\n`;

            // RSI Analysis
            responseText += `📊 RSI (Relative Strength Index):\n`;
            responseText += `• Current RSI: ${tech.rsi.value.toFixed(2)}\n`;
            if (tech.rsi.overbought) {
                responseText += `• Signal: 🔴 Overbought (>70) - Potential sell signal\n`;
            } else if (tech.rsi.oversold) {
                responseText += `• Signal: 🟢 Oversold (<30) - Potential buy signal\n`;
            } else {
                responseText += `• Signal: 🟡 Neutral (30-70) - No clear signal\n`;
            }
            responseText += '\n';

            // Bollinger Bands Analysis
            responseText += `📏 BOLLINGER BANDS:\n`;
            responseText += `• Upper Band: $${tech.bollingerBands.upper.toFixed(6)}\n`;
            responseText += `• Middle Band (SMA20): $${tech.bollingerBands.middle.toFixed(6)}\n`;
            responseText += `• Lower Band: $${tech.bollingerBands.lower.toFixed(6)}\n`;
            responseText += `• Bandwidth: ${tech.bollingerBands.bandwidth.toFixed(4)}\n`;
            responseText += `• %B: ${tech.bollingerBands.percentB.toFixed(4)}\n`;

            if (tech.bollingerBands.percentB > 0.8) {
                responseText += `• Signal: 🔴 Near upper band - Potential resistance\n`;
            } else if (tech.bollingerBands.percentB < 0.2) {
                responseText += `• Signal: 🟢 Near lower band - Potential support\n`;
            } else {
                responseText += `• Signal: 🟡 Middle range - Neutral\n`;
            }
            responseText += '\n';

            // Moving Averages Analysis
            responseText += `📈 MOVING AVERAGES:\n`;
            responseText += `• SMA 20: $${tech.movingAverages.sma20.toFixed(6)}\n`;
            responseText += `• SMA 50: $${tech.movingAverages.sma50.toFixed(6)}\n`;
            responseText += `• SMA 200: $${tech.movingAverages.sma200.toFixed(6)}\n`;
            responseText += `• EMA 12: $${tech.movingAverages.ema12.toFixed(6)}\n`;
            responseText += `• EMA 26: $${tech.movingAverages.ema26.toFixed(6)}\n\n`;

            // Moving Average Signals
            const currentPrice = tokenData.price.price;
            const sma20 = tech.movingAverages.sma20;
            const sma50 = tech.movingAverages.sma50;
            const sma200 = tech.movingAverages.sma200;
            const ema12 = tech.movingAverages.ema12;
            const ema26 = tech.movingAverages.ema26;

            responseText += `🎯 MOVING AVERAGE SIGNALS:\n`;

            // Golden Cross / Death Cross
            if (sma20 > sma50 && sma50 > sma200) {
                responseText += `• Trend: 🟢 Strong Uptrend (Golden Cross formation)\n`;
            } else if (sma20 < sma50 && sma50 < sma200) {
                responseText += `• Trend: 🔴 Strong Downtrend (Death Cross formation)\n`;
            } else if (currentPrice > sma20 && sma20 > sma50) {
                responseText += `• Trend: 🟡 Weak Uptrend\n`;
            } else {
                responseText += `• Trend: 🟡 Weak Downtrend\n`;
            }

            // Price vs Moving Averages
            if (currentPrice > sma20) {
                responseText += `• Price vs SMA20: 🟢 Above (Bullish)\n`;
            } else {
                responseText += `• Price vs SMA20: 🔴 Below (Bearish)\n`;
            }

            if (currentPrice > sma50) {
                responseText += `• Price vs SMA50: 🟢 Above (Bullish)\n`;
            } else {
                responseText += `• Price vs SMA50: 🔴 Below (Bearish)\n`;
            }

            if (currentPrice > sma200) {
                responseText += `• Price vs SMA200: 🟢 Above (Long-term Bullish)\n`;
            } else {
                responseText += `• Price vs SMA200: 🔴 Below (Long-term Bearish)\n`;
            }
            responseText += '\n';

            // Volume Analysis
            responseText += `📊 VOLUME ANALYSIS:\n`;
            responseText += `• Volume SMA: ${tech.volume.volumeSMA.toLocaleString()}\n`;
            responseText += `• Volume Ratio: ${tech.volume.volumeRatio.toFixed(2)}x average\n`;
            responseText += `• On-Balance Volume: ${tech.volume.onBalanceVolume.toLocaleString()}\n`;

            if (tech.volume.volumeRatio > 1.5) {
                responseText += `• Volume Signal: 📈 High volume - Strong price movement likely\n`;
            } else if (tech.volume.volumeRatio < 0.5) {
                responseText += `• Volume Signal: 📉 Low volume - Weak price movement likely\n`;
            } else {
                responseText += `• Volume Signal: 📊 Normal volume\n`;
            }
            responseText += '\n';

            // Overall Technical Summary
            responseText += `🎯 OVERALL TECHNICAL SUMMARY:\n`;

            let bullishSignals = 0;
            let bearishSignals = 0;

            // Count signals
            if (tech.macd.bullish) bullishSignals++;
            else bearishSignals++;

            if (tech.rsi.oversold) bullishSignals++;
            else if (tech.rsi.overbought) bearishSignals++;

            if (tech.bollingerBands.percentB < 0.2) bullishSignals++;
            else if (tech.bollingerBands.percentB > 0.8) bearishSignals++;

            if (currentPrice > sma20) bullishSignals++;
            else bearishSignals++;

            if (currentPrice > sma50) bullishSignals++;
            else bearishSignals++;

            if (tech.volume.volumeRatio > 1.2) bullishSignals++;
            else if (tech.volume.volumeRatio < 0.8) bearishSignals++;

            const totalSignals = bullishSignals + bearishSignals;
            const bullishPercentage = totalSignals > 0 ? (bullishSignals / totalSignals) * 100 : 50;

            responseText += `• Bullish Signals: ${bullishSignals}/${totalSignals} (${bullishPercentage.toFixed(0)}%)\n`;
            responseText += `• Bearish Signals: ${bearishSignals}/${totalSignals} (${(100 - bullishPercentage).toFixed(0)}%)\n`;

            if (bullishPercentage > 70) {
                responseText += `• Overall Signal: 🟢 STRONG BUY\n`;
            } else if (bullishPercentage > 60) {
                responseText += `• Overall Signal: 🟢 BUY\n`;
            } else if (bullishPercentage > 40) {
                responseText += `• Overall Signal: 🟡 HOLD\n`;
            } else if (bullishPercentage > 30) {
                responseText += `• Overall Signal: 🔴 SELL\n`;
            } else {
                responseText += `• Overall Signal: 🔴 STRONG SELL\n`;
            }

            return {
                success: true,
                data: {
                    thought: `Successfully analyzed technical indicators for ${tokenData.symbol} showing ${bullishPercentage > 50 ? 'bullish' : 'bearish'} signals with ${bullishPercentage.toFixed(0)}% bullish indicators.`,
                    response: responseText
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                data: {
                    thought: `Error occurred while analyzing technical indicators: ${error}`,
                    response: `❌ Error analyzing technical indicators: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            };
        }
    }
}; 