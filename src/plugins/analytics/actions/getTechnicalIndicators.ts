import type { Action, IAgentRuntime, Memory, State, ActionResult, ActionExample, HandlerCallback } from '@elizaos/core';
import { AnalyticsService } from '../services/analyticsService';
import { getWalletsFromText, getAccountFromMessage } from '../../autonomous-trader/utils';
import type { ComprehensiveTokenAnalytics, TokenPriceData } from '../interfaces/types';

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
    name: 'GET_TECHNICAL_INDICATORS',
    description: 'Get detailed technical indicators for a token including MACD, RSI, Bollinger Bands, moving averages, and trading signals',
    similes: ['technical indicators', 'technical analysis', 'MACD', 'RSI', 'Bollinger Bands', 'moving averages'],
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me technical indicators for SOL',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll get the technical analysis for SOL",
                    actions: ['GET_TECHNICAL_INDICATORS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'What are the RSI and MACD values?',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "Let me check the technical indicators",
                    actions: ['GET_TECHNICAL_INDICATORS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Analyze technical indicators for 0x1234567890abcdef',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll analyze the technical indicators for that token",
                    actions: ['GET_TECHNICAL_INDICATORS'],
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
                    const errorResponse = '❌ Please provide a token address to analyze technical indicators.\n\n' +
                        '💡 Examples:\n' +
                        '• "Show me technical indicators for SOL"\n' +
                        '• "Analyze 0x1234567890abcdef"\n' +
                        '• "What are the RSI and MACD values for [token]?"';
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

            // Validate token address format
            if (!tokenAddress || tokenAddress.length < 10) {
                const errorResponse = '❌ Invalid token address provided. Please provide a valid token address.';
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

            // Try to get CoinGecko data first for better symbol resolution
            let coinGeckoData: any = null;
            let priceHistory: number[] = [];
            let tokenSymbol: string | null = null;

            const coingeckoService = runtime.getService('COINGECKO_SERVICE') as any;
            if (coingeckoService && typeof coingeckoService.getTokenAnalysis === 'function') {
                try {
                    console.log(`Attempting to get CoinGecko data for ${tokenAddress}...`);

                    // First, try to get the coins list for better symbol resolution
                    if (typeof coingeckoService.getCoinsList === 'function') {
                        try {
                            console.log('Fetching CoinGecko coins list for better symbol resolution...');
                            const coinsList = await coingeckoService.getCoinsList();
                            if (coinsList && coinsList.length > 0) {
                                console.log(`Got ${coinsList.length} coins from CoinGecko list`);

                                // Try to find the token by address or symbol
                                let foundCoin: any = null;

                                // First try to find by symbol if we can extract one
                                const symbolFromAddress = tokenAddress.substring(0, 8).toUpperCase();
                                foundCoin = coinsList.find((coin: any) =>
                                    coin.symbol && coin.symbol.toLowerCase() === symbolFromAddress.toLowerCase()
                                );

                                if (foundCoin) {
                                    console.log(`Found coin ${foundCoin.symbol} (${foundCoin.name}) in CoinGecko list`);
                                }
                            }
                        } catch (listError) {
                            console.warn('Failed to get CoinGecko coins list:', listError);
                        }
                    }

                    // Try to get symbol from cache first
                    const birdeyeTokens = await runtime.getCache<any[]>('tokens_solana');
                    if (birdeyeTokens) {
                        const token = birdeyeTokens.find(t => t.address === tokenAddress);
                        if (token && token.symbol) {
                            tokenSymbol = token.symbol;
                            console.log(`Got symbol from cache: ${tokenSymbol}`);
                        }
                    }

                    // If still no symbol, use fallback
                    if (!tokenSymbol) {
                        tokenSymbol = tokenAddress.substring(0, 8).toUpperCase();
                        console.log(`Using fallback symbol from address: ${tokenSymbol}`);
                    }

                    coinGeckoData = await coingeckoService.getTokenAnalysis(tokenAddress, tokenSymbol);
                    if (coinGeckoData && coinGeckoData.symbol) {
                        console.log(`Found CoinGecko symbol: ${coinGeckoData.symbol} for ${tokenAddress}`);

                        // Extract price history from CoinGecko data
                        if (coinGeckoData.priceHistory && coinGeckoData.priceHistory.length > 0) {
                            priceHistory = coinGeckoData.priceHistory.map((item: any) => item[1]); // Extract price from [timestamp, price] format
                            console.log(`Got ${priceHistory.length} price history points from CoinGecko`);
                        }

                        // Try to get comprehensive historical data including OHLC
                        if (coinGeckoData.coinId && typeof coingeckoService.getComprehensiveHistoricalData === 'function') {
                            try {
                                console.log('Fetching comprehensive historical data from CoinGecko...');
                                const historicalData = await coingeckoService.getComprehensiveHistoricalData(coinGeckoData.coinId, 30);
                                if (historicalData && historicalData.ohlc && historicalData.ohlc.length > 0) {
                                    console.log(`Got ${historicalData.ohlc.length} OHLC candlesticks from CoinGecko`);
                                    // Use OHLC close prices for more accurate technical analysis
                                    priceHistory = historicalData.ohlc.map((candle: any) => candle.close);
                                    coinGeckoData.ohlcData = historicalData.ohlc;
                                    coinGeckoData.historicalSummary = historicalData.summary;
                                }
                            } catch (historicalError) {
                                console.warn('Failed to get comprehensive historical data:', historicalError);
                            }
                        }
                    }
                } catch (error) {
                    console.warn('CoinGecko service failed:', error);
                }
            }

            // If no price history from CoinGecko, try to get from cache
            if (priceHistory.length === 0) {
                const birdeyeTokens = await runtime.getCache<any[]>('tokens_solana');
                if (birdeyeTokens) {
                    const token = birdeyeTokens.find(t => t.address === tokenAddress);
                    if (token && token.price) {
                        // Create a simple price history from current price
                        priceHistory = [token.price * 0.98, token.price * 0.99, token.price];
                        console.log('Created price history from cache data');
                    }
                }
            }

            const request = {
                tokenAddress,
                chain,
                timeframe,
                includeHistorical: true,
                includeHolders: false,
                includeSnipers: false,
                coinGeckoData, // Pass CoinGecko data to the analytics service
                priceHistory // Pass price history to the analytics service
            };

            const response = await analyticsService.getTokenAnalytics(request);

            if (!response.success) {
                console.warn(`Analytics service failed for ${tokenAddress}: ${response.error}`);

                // Try to get basic price data as fallback using Birdeye plugin
                try {
                    console.log(`Attempting fallback price fetch for ${tokenAddress}...`);

                    // Get Birdeye service from runtime
                    const birdeyeService = runtime.getService('birdeye') as any;
                    if (birdeyeService && typeof birdeyeService.getTokenMarketData === 'function') {
                        const priceData = await birdeyeService.getTokenMarketData(tokenAddress);
                        if (priceData && priceData.price > 0) {
                            console.log(`Fallback successful: Got price $${priceData.price} for ${tokenAddress}`);

                            const fallbackResponse = `📊 BASIC TOKEN INFO: ${tokenAddress.substring(0, 8)}...\n\n` +
                                `💰 Current Price: $${priceData.price.toFixed(6)}\n` +
                                `📊 24h Volume: $${priceData.volume24h.toLocaleString()}\n` +
                                `💎 Market Cap: $${priceData.marketCap.toLocaleString()}\n\n` +
                                `⚠️ Technical indicators unavailable - price data only from Birdeye`;

                            if (callback) {
                                callback({
                                    text: fallbackResponse,
                                    attachments: [],
                                    source: 'auto',
                                    channelType: 'text',
                                    inReplyTo: message.id
                                });
                            }
                            return;
                        }
                    }
                } catch (fallbackError) {
                    console.warn(`Fallback price fetch also failed:`, fallbackError);
                }

                const errorResponse = `❌ Error analyzing technical indicators for ${tokenAddress}: ${response.error}\n\n` +
                    `💡 Try:\n` +
                    `• Check if the token address is correct\n` +
                    `• Ensure the token has sufficient trading volume\n` +
                    `• Try a different token or timeframe`;

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
            if (!response.data || typeof response.data !== 'object' || !('technicalIndicators' in response.data)) {
                console.warn(`Invalid analytics data received for ${tokenAddress}:`, response.data);

                // Try to provide basic price info if available
                const tokenData = response.data as any;
                if (tokenData && 'price' in tokenData && tokenData.price) {
                    const priceData = tokenData.price as TokenPriceData;
                    const basicResponse = `📊 BASIC TOKEN INFO: ${priceData.symbol || 'UNKNOWN'}\n\n` +
                        `💰 Current Price: $${priceData.price?.toFixed(6) || 'N/A'}\n` +
                        `📈 24h Change: ${priceData.priceChangePercent24h >= 0 ? '+' : ''}${priceData.priceChangePercent24h?.toFixed(2) || 'N/A'}%\n` +
                        `📊 24h Volume: $${priceData.volume24h?.toLocaleString() || 'N/A'}\n` +
                        `💎 Market Cap: $${priceData.marketCap?.toLocaleString() || 'N/A'}\n\n` +
                        `⚠️ Technical indicators unavailable - insufficient historical data`;

                    if (callback) {
                        callback({
                            text: basicResponse,
                            attachments: [],
                            source: 'auto',
                            channelType: 'text',
                            inReplyTo: message.id
                        });
                    }
                    return;
                }

                const errorResponse = '❌ Error: Invalid token analytics data received\n\n' +
                    '💡 This might be due to:\n' +
                    '• Insufficient trading history for the token\n' +
                    '• Token not found on supported exchanges\n' +
                    '• Network connectivity issues';

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

            //console.log('response.data', response.data)

            const tokenData = response.data as ComprehensiveTokenAnalytics;
            console.log('tokenData', tokenData)

            // Check if visual output is enabled
            const visualOutput = await isVisualOutputEnabled(runtime, message);

            let responseText = visualOutput
                ? `📊 TECHNICAL INDICATORS (Calculated): ${tokenAddress}\n\n`
                : `Technical Indicators (Calculated): ${tokenAddress}\n\n`;

            // Add CoinGecko data if available
            if (coinGeckoData) {
                responseText += visualOutput ? `🦎 COINGECKO DATA:\n` : `CoinGecko Data:\n`;
                responseText += `• Symbol: ${coinGeckoData.symbol || 'N/A'}\n`;
                responseText += `• Name: ${coinGeckoData.name || 'N/A'}\n`;
                responseText += `• Current Price: $${coinGeckoData.currentPrice?.toFixed(6) || 'N/A'}\n`;
                responseText += `• 24h Change: ${coinGeckoData.priceChange24h >= 0 ? '+' : ''}${coinGeckoData.priceChange24h?.toFixed(2) || 'N/A'}%\n`;
                responseText += `• Market Cap: $${coinGeckoData.marketCap?.toLocaleString() || 'N/A'}\n`;
                responseText += `• 24h Volume: $${coinGeckoData.volume24h?.toLocaleString() || 'N/A'}\n\n`;
            }

            // Add TAAPI status information
            const taapiService = runtime.getService('TAAPI_SERVICE') as any;
            responseText += visualOutput ? `⚠️ TAAPI SERVICE STATUS:\n` : `TAAPI Service Status:\n`;
            responseText += `• TAAPI Service Available: ${!!taapiService}\n`;
            responseText += `• Symbol Used: ${tokenData.symbol || 'None'}\n`;
            responseText += `• TAAPI Response: ${taapiService ? 'Available' : 'None'}\n\n`;

            const tech = tokenData.technicalIndicators;

            // MACD Analysis
            responseText += visualOutput ? `📈 MACD (Moving Average Convergence Divergence):\n` : `MACD (Moving Average Convergence Divergence):\n`;
            responseText += `• MACD Line: ${tech.macd.macd.toFixed(6)}\n`;
            responseText += `• Signal Line: ${tech.macd.signal.toFixed(6)}\n`;
            responseText += `• Histogram: ${tech.macd.histogram.toFixed(6)}\n`;
            responseText += `• Signal: ${tech.macd.bullish ? (visualOutput ? '🟢 Bullish (MACD > Signal)' : 'Bullish (MACD > Signal)') : (visualOutput ? '🔴 Bearish (MACD < Signal)' : 'Bearish (MACD < Signal)')}\n\n`;

            // RSI Analysis
            responseText += visualOutput ? `📊 RSI (Relative Strength Index):\n` : `RSI (Relative Strength Index):\n`;
            responseText += `• Current RSI: ${tech.rsi.value.toFixed(2)}\n`;
            if (tech.rsi.overbought) {
                responseText += `• Signal: ${visualOutput ? '🔴 Overbought (>70) - Potential sell signal' : 'Overbought (>70) - Potential sell signal'}\n`;
            } else if (tech.rsi.oversold) {
                responseText += `• Signal: ${visualOutput ? '🟢 Oversold (<30) - Potential buy signal' : 'Oversold (<30) - Potential buy signal'}\n`;
            } else {
                responseText += `• Signal: ${visualOutput ? '🟡 Neutral (30-70) - No clear signal' : 'Neutral (30-70) - No clear signal'}\n`;
            }
            responseText += '\n';

            // Bollinger Bands Analysis
            responseText += visualOutput ? `📏 Bollinger Bands:\n` : `Bollinger Bands:\n`;
            responseText += `• Upper Band: $${tech.bollingerBands.upper.toFixed(6)}\n`;
            responseText += `• Middle Band (SMA20): $${tech.bollingerBands.middle.toFixed(6)}\n`;
            responseText += `• Lower Band: $${tech.bollingerBands.lower.toFixed(6)}\n`;
            responseText += `• Bandwidth: ${tech.bollingerBands.bandwidth.toFixed(4)}\n`;
            responseText += `• %B: ${tech.bollingerBands.percentB.toFixed(4)}\n`;

            if (tech.bollingerBands.percentB > 0.8) {
                responseText += `• Signal: ${visualOutput ? '🔴 Near upper band - Potential resistance' : 'Near upper band - Potential resistance'}\n`;
            } else if (tech.bollingerBands.percentB < 0.2) {
                responseText += `• Signal: ${visualOutput ? '🟢 Near lower band - Potential support' : 'Near lower band - Potential support'}\n`;
            } else {
                responseText += `• Signal: ${visualOutput ? '🟡 Middle range - Neutral' : 'Middle range - Neutral'}\n`;
            }
            responseText += '\n';

            // Moving Averages Analysis
            responseText += visualOutput ? `📈 Moving Averages:\n` : `Moving Averages:\n`;
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

            responseText += visualOutput ? `🎯 Moving Average Signals:\n` : `Moving Average Signals:\n`;

            // Golden Cross / Death Cross
            if (sma20 > sma50 && sma50 > sma200) {
                responseText += `• Trend: ${visualOutput ? '🟢 Strong Uptrend (Golden Cross formation)' : 'Strong Uptrend (Golden Cross formation)'}\n`;
            } else if (sma20 < sma50 && sma50 < sma200) {
                responseText += `• Trend: ${visualOutput ? '🔴 Strong Downtrend (Death Cross formation)' : 'Strong Downtrend (Death Cross formation)'}\n`;
            } else if (currentPrice > sma20 && sma20 > sma50) {
                responseText += `• Trend: ${visualOutput ? '🟡 Weak Uptrend' : 'Weak Uptrend'}\n`;
            } else {
                responseText += `• Trend: ${visualOutput ? '🟡 Weak Downtrend' : 'Weak Downtrend'}\n`;
            }

            // Price vs Moving Averages
            if (currentPrice > sma20) {
                responseText += `• Price vs SMA20: ${visualOutput ? '🟢 Above (Bullish)' : 'Above (Bullish)'}\n`;
            } else {
                responseText += `• Price vs SMA20: ${visualOutput ? '🔴 Below (Bearish)' : 'Below (Bearish)'}\n`;
            }

            if (currentPrice > sma50) {
                responseText += `• Price vs SMA50: ${visualOutput ? '🟢 Above (Bullish)' : 'Above (Bullish)'}\n`;
            } else {
                responseText += `• Price vs SMA50: ${visualOutput ? '🔴 Below (Bearish)' : 'Below (Bearish)'}\n`;
            }

            if (currentPrice > sma200) {
                responseText += `• Price vs SMA200: ${visualOutput ? '🟢 Above (Long-term Bullish)' : 'Above (Long-term Bullish)'}\n`;
            } else {
                responseText += `• Price vs SMA200: ${visualOutput ? '🔴 Below (Long-term Bearish)' : 'Below (Long-term Bearish)'}\n`;
            }
            responseText += '\n';

            // Final summary with current price and market data
            responseText += `💰 Current Price: $${currentPrice.toFixed(6)}\n`;
            responseText += `📊 24h Volume: $${tokenData.price.volume24h?.toLocaleString() || 'N/A'}\n`;

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
                    technicalIndicators: tech
                }
            };

        } catch (error) {
            const errorResponse = `❌ Error analyzing technical indicators: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
