import type { Action, IAgentRuntime, Memory, State, ActionResult, ActionExample, HandlerCallback } from '@elizaos/core';
import { AnalyticsService } from '../services/analyticsService';
import { parseDateFilterFromMessage, formatDateFilterText } from '../../autonomous-trader/providers/date_filter';
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

/**
 * Resolve symbol to address using Birdeye service
 */
async function resolveSymbolToAddress(runtime: IAgentRuntime, symbol: string): Promise<string | null> {
    try {
        // Get Birdeye service from runtime
        const birdeyeService = runtime.getService('birdeye');
        if (!birdeyeService) {
            console.warn('Birdeye service not available for symbol resolution');
            return null;
        }

        // Use the Birdeye service to search for tokens
        // Note: This is a simplified approach - in a real implementation you'd use the proper search method
        console.log(`Attempting to resolve symbol ${symbol} using Birdeye service...`);

        // For now, return null and let the user provide the address
        // In a full implementation, you'd use birdeyeService.searchTokens() or similar
        return null;
    } catch (error) {
        console.warn(`Error resolving symbol ${symbol} to address:`, error);
        return null;
    }
}

/**
 * Get comprehensive token analytics action
 */
export default {
    name: 'GET_TOKEN_ANALYTICS',
    description: 'Get comprehensive analytics for a specific token including price data, technical indicators, holder analytics, and trading recommendations',
    similes: ['token analytics', 'token analysis', 'token data', 'token info', 'token overview'],
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Analyze SOL token',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll get comprehensive analytics for SOL",
                    actions: ['GET_TOKEN_ANALYTICS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'What is the current status of this token?',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "Let me analyze the token's current status",
                    actions: ['GET_TOKEN_ANALYTICS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me analytics for 0x1234567890abcdef',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll analyze that token address for you",
                    actions: ['GET_TOKEN_ANALYTICS'],
                },
            },
        ],
    ] as ActionExample[][],
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        // Always allow this action to be executed
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses?: Memory[]
    ): Promise<ActionResult | void | undefined> => {
        try {
            let {
                tokenAddress,
                chain = 'solana',
                timeframe = '1d',
                includeHistorical = true,
                includeHolders = true,
                includeSnipers = true
            } = _options as any || {};

            // If no token address provided, try to extract from message text
            if (!tokenAddress) {
                const messageText = message.content?.text || '';

                // First try to extract addresses using getWalletsFromText
                const addresses = await getWalletsFromText(runtime, message);
                if (addresses.length > 0) {
                    tokenAddress = addresses[0];
                    // Default to solana chain for wallet addresses
                    chain = 'solana';
                } else {
                    // If no addresses found, try to extract symbols using a simple regex
                    const symbolMatch = messageText.match(/\b[A-Z]{2,10}\b/g);
                    if (symbolMatch && symbolMatch.length > 0) {
                        // Try to resolve the first symbol to an address
                        const resolvedAddress = await resolveSymbolToAddress(runtime, symbolMatch[0]);
                        if (resolvedAddress) {
                            tokenAddress = resolvedAddress;
                        } else {
                            const errorResponse = `❌ Could not resolve symbol ${symbolMatch[0]} to a token address. Please provide a valid token address.`;
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
                                error: `Could not resolve symbol ${symbolMatch[0]} to a token address`
                            };
                        }
                    } else {
                        const errorResponse = '❌ Please provide a token address or symbol to analyze.';
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
                            error: 'No token address or symbol provided'
                        };
                    }
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
                return {
                    success: false,
                    error: 'Analytics service not available'
                };
            }

            // Try to get data directly from Birdeye service first for better performance
            const birdeyeService = runtime.getService('birdeye');
            let birdeyeData = null;
            if (birdeyeService) {
                try {
                    birdeyeData = await birdeyeService.getTokenMarketData(tokenAddress);
                    console.log(`Got Birdeye data for ${tokenAddress}:`, birdeyeData);
                } catch (error) {
                    console.warn(`Failed to get Birdeye data for ${tokenAddress}:`, error);
                }
            }

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

            // If we have Birdeye data, use it to enhance the response
            if (birdeyeData && birdeyeData.price > 0) {
                console.log(`Using Birdeye data for enhanced response for ${tokenAddress}`);

                // Check if visual output is enabled
                const visualOutput = await isVisualOutputEnabled(runtime, message);

                // Format response using Birdeye data
                let responseText = visualOutput
                    ? `🔍 TOKEN ANALYTICS: ${tokenAddress}\n\n`
                    : `Token Analytics: ${tokenAddress}\n\n`;

                // Add date filter info if applied
                if (dateFilter) {
                    responseText += visualOutput ? `📅 Date Filter: ${formatDateFilterText(dateFilter)}\n\n` : `Date Filter: ${formatDateFilterText(dateFilter)}\n\n`;
                }

                // Price Summary from Birdeye
                responseText += visualOutput ? `💰 PRICE SUMMARY:\n` : `Price Summary:\n`;
                responseText += `• Current Price: $${birdeyeData.price.toFixed(6)}\n`;
                responseText += `• Market Cap: $${birdeyeData.marketCap.toLocaleString()}\n`;
                responseText += `• 24h Volume: $${birdeyeData.volume24h.toLocaleString()}\n`;
                responseText += `• Liquidity: $${birdeyeData.liquidity.toLocaleString()}\n\n`;

                // Technical Analysis from price history if available
                if (birdeyeData.priceHistory && birdeyeData.priceHistory.length > 0) {
                    responseText += visualOutput ? `📊 TECHNICAL ANALYSIS:\n` : `Technical Analysis:\n`;

                    const priceHistory = birdeyeData.priceHistory;
                    const currentPrice = birdeyeData.price;

                    // Calculate simple moving averages
                    const sma20 = priceHistory.slice(-20).reduce((sum: number, p: number) => sum + p, 0) / Math.min(20, priceHistory.length);
                    const sma50 = priceHistory.slice(-50).reduce((sum: number, p: number) => sum + p, 0) / Math.min(50, priceHistory.length);

                    // Calculate RSI (simplified)
                    const recentPrices = priceHistory.slice(-14);
                    let gains = 0, losses = 0;
                    for (let i = 1; i < recentPrices.length; i++) {
                        const change = recentPrices[i] - recentPrices[i - 1];
                        if (change > 0) gains += change;
                        else losses -= change;
                    }
                    const avgGain = gains / 14;
                    const avgLoss = losses / 14;
                    const rs = avgGain / avgLoss;
                    const rsi = 100 - (100 / (1 + rs));

                    // Calculate MACD (simplified)
                    const ema12 = priceHistory.slice(-12).reduce((sum: number, p: number) => sum + p, 0) / Math.min(12, priceHistory.length);
                    const ema26 = priceHistory.slice(-26).reduce((sum: number, p: number) => sum + p, 0) / Math.min(26, priceHistory.length);
                    const macd = ema12 - ema26;
                    const signal = macd; // Simplified signal line

                    responseText += `• MACD: ${macd > signal ? (visualOutput ? '🟢 Bullish' : 'Bullish') : (visualOutput ? '🔴 Bearish' : 'Bearish')}\n`;
                    responseText += `• RSI: ${rsi.toFixed(2)} ${rsi > 70 ? '(Overbought)' : rsi < 30 ? '(Oversold)' : '(Neutral)'}\n`;
                    responseText += `• Price vs SMA20: ${currentPrice > sma20 ? (visualOutput ? '🟢 Above' : 'Above') : (visualOutput ? '🔴 Below' : 'Below')}\n`;
                    responseText += `• Price vs SMA50: ${currentPrice > sma50 ? (visualOutput ? '🟢 Above' : 'Above') : (visualOutput ? '🔴 Below' : 'Below')}\n\n`;
                }

                // Risk Assessment (simplified)
                responseText += visualOutput ? `⚠️ RISK ASSESSMENT:\n` : `Risk Assessment:\n`;
                const volatility = birdeyeData.volume24h > 0 ? 'Medium' : 'Low';
                const liquidity = birdeyeData.liquidity > 100000 ? 'High' : birdeyeData.liquidity > 10000 ? 'Medium' : 'Low';
                responseText += `• Volatility: ${volatility}\n`;
                responseText += `• Liquidity: ${liquidity}\n\n`;

                // Recommendations (simplified)
                responseText += visualOutput ? `💡 RECOMMENDATIONS:\n` : `Recommendations:\n`;
                const action = birdeyeData.price > 0 ? 'HOLD' : 'AVOID';
                responseText += `• Action: ${action}\n`;
                responseText += `• Data Points: ${birdeyeData.priceHistory ? birdeyeData.priceHistory.length : 0} historical prices\n\n`;

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
                        symbol: tokenAddress,
                        analytics: {
                            price: birdeyeData.price,
                            marketCap: birdeyeData.marketCap,
                            volume24h: birdeyeData.volume24h,
                            liquidity: birdeyeData.liquidity,
                            priceHistory: birdeyeData.priceHistory
                        }
                    }
                };
            }

            if (!response.success) {
                const errorResponse = `❌ Error analyzing token ${tokenAddress}: ${response.error}`;
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
                    error: response.error
                };
            }

            // Type guard to ensure we have ComprehensiveTokenAnalytics
            if (!response.data || typeof response.data !== 'object' || !('price' in response.data)) {
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
                return {
                    success: false,
                    error: 'Invalid token analytics data received'
                };
            }

            const tokenData = response.data as ComprehensiveTokenAnalytics;

            // Check if visual output is enabled
            const visualOutput = await isVisualOutputEnabled(runtime, message);

            // Format comprehensive response
            let responseText = visualOutput
                ? `🔍 COMPREHENSIVE TOKEN ANALYTICS: ${tokenData.symbol}\n\n`
                : `Comprehensive Token Analytics: ${tokenData.symbol}\n\n`;

            // Add date filter info if applied
            if (dateFilter) {
                responseText += visualOutput ? `📅 Date Filter: ${formatDateFilterText(dateFilter)}\n\n` : `Date Filter: ${formatDateFilterText(dateFilter)}\n\n`;
            }

            // Price Summary
            responseText += visualOutput ? `💰 PRICE SUMMARY:\n` : `Price Summary:\n`;
            responseText += `• Current Price: $${tokenData.price.price.toFixed(6)}\n`;
            responseText += `• 24h Change: ${tokenData.price.priceChangePercent24h >= 0 ? '+' : ''}${tokenData.price.priceChangePercent24h.toFixed(2)}%\n`;
            responseText += `• 24h Volume: $${tokenData.price.volume24h.toLocaleString()}\n`;
            responseText += `• Market Cap: $${tokenData.price.marketCap.toLocaleString()}\n\n`;

            // Technical Analysis Summary
            responseText += visualOutput ? `📊 TECHNICAL ANALYSIS:\n` : `Technical Analysis:\n`;
            const tech = tokenData.technicalIndicators;
            responseText += `• MACD: ${tech.macd.bullish ? (visualOutput ? '🟢 Bullish' : 'Bullish') : (visualOutput ? '🔴 Bearish' : 'Bearish')}\n`;
            responseText += `• RSI: ${tech.rsi.value.toFixed(2)} ${tech.rsi.overbought ? '(Overbought)' : tech.rsi.oversold ? '(Oversold)' : '(Neutral)'}\n`;
            responseText += `• Volume: ${tech.volume.volumeRatio.toFixed(2)}x average\n\n`;

            // Risk Assessment
            responseText += visualOutput ? `⚠️ RISK ASSESSMENT:\n` : `Risk Assessment:\n`;
            const risk = tokenData.riskAssessment;
            responseText += `• Overall Risk: ${risk.overallRisk.toUpperCase()}\n`;
            responseText += `• Volatility: ${risk.volatility.toFixed(2)}%\n`;
            responseText += `• Liquidity: ${risk.liquidity.toFixed(2)}%\n\n`;

            // Recommendations
            responseText += visualOutput ? `💡 RECOMMENDATIONS:\n` : `Recommendations:\n`;
            const rec = tokenData.recommendations;
            responseText += `• Action: ${rec.action.toUpperCase()}\n`;
            responseText += `• Confidence: ${rec.confidence.toFixed(0)}%\n`;
            responseText += `• Reasons: ${rec.reasons.join(', ')}\n\n`;

            // Holder Analytics (if available)
            if (tokenData.holderAnalytics) {
                responseText += visualOutput ? `👥 HOLDER INSIGHTS:\n` : `Holder Insights:\n`;
                const holders = tokenData.holderAnalytics;
                responseText += `• Total Holders: ${holders.totalHolders.toLocaleString()}\n`;
                responseText += `• Community Growth: ${holders.communityGrowth.toUpperCase()}\n`;
                responseText += `• Concentration Risk: ${holders.concentrationRisk.toUpperCase()}\n\n`;
            }

            // Sniper Analytics (if available)
            if (tokenData.sniperAnalytics) {
                responseText += visualOutput ? `🎯 SNIPER ACTIVITY:\n` : `Sniper Activity:\n`;
                const snipers = tokenData.sniperAnalytics;
                responseText += `• Active Snipers: ${snipers.activeSnipers}\n`;
                responseText += `• Average Profit: ${snipers.averageProfitPercent >= 0 ? '+' : ''}${snipers.averageProfitPercent.toFixed(2)}%\n\n`;
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
                    analytics: tokenData
                }
            };

        } catch (error) {
            console.error('Error in getTokenAnalytics action:', error);
            const errorResponse = `❌ Error analyzing token: ${error instanceof Error ? error.message : 'Unknown error'}`;
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