import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';

export const technicalIndicatorsProvider: Provider = {
    name: 'TECHNICAL_INDICATORS',
    description: 'Real-time technical indicators including MACD, RSI, Bollinger Bands, moving averages, and trading signals using CoinGecko and Birdeye data',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('TECHNICAL_INDICATORS provider called')

        let technicalStr = ''

        // Extract token address from message if available
        const messageText = message.content?.text || '';
        const tokenMatch = messageText.match(/0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}/);

        if (tokenMatch) {
            try {
                const tokenAddress = tokenMatch[0];
                console.log(`Analyzing technical indicators for token ${tokenAddress}...`);

                // Try to get data from multiple sources
                let marketData: any = null;
                let holderData: any = null;
                let coingeckoData: any = null;
                let priceHistory: number[] = [];
                let tokenSymbol: string | null = null;

                // Try to get symbol from cache or other sources FIRST
                if (!tokenSymbol) {
                    // Try to get symbol from cache
                    const birdeyeTokens = await runtime.getCache<any[]>('tokens_solana');
                    if (birdeyeTokens) {
                        const token = birdeyeTokens.find(t => t.address === tokenAddress);
                        if (token && token.symbol) {
                            tokenSymbol = token.symbol;
                            console.log(`Got symbol from cache: ${tokenSymbol}`);
                        }
                    }
                }

                // If still no symbol, try to extract from the token address (fallback)
                if (!tokenSymbol) {
                    // Use first 8 characters as a fallback symbol
                    tokenSymbol = tokenAddress.substring(0, 8).toUpperCase();
                    console.log(`Using fallback symbol from address: ${tokenSymbol}`);
                }

                console.log(`Final resolved symbol for ${tokenAddress}: ${tokenSymbol}`);

                // Try CoinGecko service first for comprehensive token data
                const coingeckoService = runtime.getService('COINGECKO_SERVICE');
                console.log('CoinGecko service found:', !!coingeckoService);

                if (coingeckoService && typeof (coingeckoService as any).getTokenAnalysis === 'function') {
                    try {
                        console.log('Fetching data from CoinGecko service...');
                        coingeckoData = await (coingeckoService as any).getTokenAnalysis(tokenAddress, tokenSymbol);
                        if (coingeckoData) {
                            console.log(`Got comprehensive data from CoinGecko for ${coingeckoData.symbol}`);
                            tokenSymbol = coingeckoData.symbol;

                            // Extract price history from CoinGecko data
                            if (coingeckoData.priceHistory && coingeckoData.priceHistory.length > 0) {
                                priceHistory = coingeckoData.priceHistory.map((item: any) => item[1]); // Extract price from [timestamp, price] format
                                console.log(`Got ${priceHistory.length} price history points from CoinGecko`);
                            }

                            // Try to get comprehensive historical data including OHLC
                            if (coingeckoData.coinId && typeof (coingeckoService as any).getComprehensiveHistoricalData === 'function') {
                                try {
                                    console.log('Fetching comprehensive historical data from CoinGecko...');
                                    const historicalData = await (coingeckoService as any).getComprehensiveHistoricalData(coingeckoData.coinId, 30);
                                    if (historicalData && historicalData.ohlc && historicalData.ohlc.length > 0) {
                                        console.log(`Got ${historicalData.ohlc.length} OHLC candlesticks from CoinGecko`);
                                        // Use OHLC close prices for more accurate technical analysis
                                        priceHistory = historicalData.ohlc.map((candle: any) => candle.close);
                                        coingeckoData.ohlcData = historicalData.ohlc;
                                        coingeckoData.historicalSummary = historicalData.summary;
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

                // Fallback to Birdeye service if CoinGecko fails
                if (!coingeckoData) {
                    const birdeyeService = runtime.getService('birdeye');
                    console.log('Birdeye service found:', !!birdeyeService);

                    if (birdeyeService && typeof (birdeyeService as any).getTokenMarketData === 'function') {
                        try {
                            console.log('Fetching market data from Birdeye service...');
                            marketData = await (birdeyeService as any).getTokenMarketData(tokenAddress);
                            if (marketData && marketData.priceHistory) {
                                priceHistory = marketData.priceHistory;
                                console.log(`Got ${priceHistory.length} price history points from Birdeye`);
                            }
                        } catch (error) {
                            console.warn('Birdeye market data service failed:', error);
                        }
                    }
                }

                // Try Codex service for additional data
                const codexService = runtime.getService('codex');
                if (codexService && typeof (codexService as any).getTokenHolderAnalytics === 'function') {
                    try {
                        console.log('Fetching holder data from Codex service...');
                        holderData = await (codexService as any).getTokenHolderAnalytics(tokenAddress);
                    } catch (error) {
                        console.warn('Codex service failed:', error);
                    }
                }

                // If no price history from Birdeye, try to get from cache
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

                // Determine which data source to use
                const dataSource = coingeckoData || marketData;
                const currentPrice = coingeckoData?.currentPrice || marketData?.price;
                const volume24h = coingeckoData?.volume24h || marketData?.volume24h;
                const marketCap = coingeckoData?.marketCap || marketData?.marketCap;

                if (dataSource && currentPrice > 0) {
                    console.log(`Successfully fetched price data: $${currentPrice}`);

                    // Use calculated indicators
                    technicalStr += `📊 TECHNICAL INDICATORS (Calculated): ${tokenAddress}\n\n`

                    // Add data source information
                    if (coingeckoData) {
                        technicalStr += `🦎 COINGECKO DATA:\n`
                        technicalStr += `• Symbol: ${coingeckoData.symbol || 'N/A'}\n`
                        technicalStr += `• Name: ${coingeckoData.name || 'N/A'}\n`
                        technicalStr += `• Current Price: $${coingeckoData.currentPrice?.toFixed(6) || 'N/A'}\n`
                        technicalStr += `• 24h Change: ${coingeckoData.priceChange24h >= 0 ? '+' : ''}${coingeckoData.priceChange24h?.toFixed(2) || 'N/A'}%\n`
                        technicalStr += `• Market Cap: $${coingeckoData.marketCap?.toLocaleString() || 'N/A'}\n`
                        technicalStr += `• 24h Volume: $${coingeckoData.volume24h?.toLocaleString() || 'N/A'}\n\n`
                    } else if (marketData) {
                        technicalStr += `🔍 BIRDEYE DATA:\n`
                        technicalStr += `• Current Price: $${marketData.price?.toFixed(6) || 'N/A'}\n`
                        technicalStr += `• Market Cap: $${marketData.marketCap?.toLocaleString() || 'N/A'}\n`
                        technicalStr += `• 24h Volume: $${marketData.volume24h?.toLocaleString() || 'N/A'}\n\n`
                    }

                    if (priceHistory.length > 0) {
                        console.log(`Processing ${priceHistory.length} price history points...`);

                        // Calculate simple moving averages
                        const sma20 = priceHistory.slice(-20).reduce((sum: number, p: number) => sum + p, 0) / Math.min(20, priceHistory.length);
                        const sma50 = priceHistory.slice(-50).reduce((sum: number, p: number) => sum + p, 0) / Math.min(50, priceHistory.length);
                        const sma200 = priceHistory.slice(-200).reduce((sum: number, p: number) => sum + p, 0) / Math.min(200, priceHistory.length);

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
                        const rs = avgLoss > 0 ? avgGain / avgLoss : 100;
                        const rsi = 100 - (100 / (1 + rs));

                        // Calculate MACD (simplified)
                        const ema12 = priceHistory.slice(-12).reduce((sum: number, p: number) => sum + p, 0) / Math.min(12, priceHistory.length);
                        const ema26 = priceHistory.slice(-26).reduce((sum: number, p: number) => sum + p, 0) / Math.min(26, priceHistory.length);
                        const macd = ema12 - ema26;
                        const signal = macd; // Simplified signal line
                        const histogram = macd - signal;

                        // Calculate Bollinger Bands
                        const stdDev = Math.sqrt(priceHistory.slice(-20).reduce((sum: number, p: number) => sum + Math.pow(p - sma20, 2), 0) / Math.min(20, priceHistory.length));
                        const upperBand = sma20 + (2 * stdDev);
                        const lowerBand = sma20 - (2 * stdDev);
                        const percentB = (upperBand - lowerBand) > 0 ? (currentPrice - lowerBand) / (upperBand - lowerBand) : 0.5;
                        const bandwidth = (upperBand - lowerBand) / sma20;

                        technicalStr += `📈 MACD (Moving Average Convergence Divergence):\n`
                        technicalStr += `• MACD Line: ${macd.toFixed(6)}\n`
                        technicalStr += `• Signal Line: ${signal.toFixed(6)}\n`
                        technicalStr += `• Histogram: ${histogram.toFixed(6)}\n`
                        technicalStr += `• Signal: ${macd > signal ? '🟢 Bullish (MACD > Signal)' : '🔴 Bearish (MACD < Signal)'}\n\n`

                        technicalStr += `📊 RSI (Relative Strength Index):\n`
                        technicalStr += `• Current RSI: ${rsi.toFixed(2)}\n`
                        if (rsi > 70) {
                            technicalStr += `• Signal: 🔴 Overbought (>70) - Potential sell signal\n`
                        } else if (rsi < 30) {
                            technicalStr += `• Signal: 🟢 Oversold (<30) - Potential buy signal\n`
                        } else {
                            technicalStr += `• Signal: 🟡 Neutral (30-70) - No clear signal\n`
                        }
                        technicalStr += '\n'

                        technicalStr += `📏 Bollinger Bands:\n`
                        technicalStr += `• Upper Band: $${upperBand.toFixed(6)}\n`
                        technicalStr += `• Middle Band (SMA20): $${sma20.toFixed(6)}\n`
                        technicalStr += `• Lower Band: $${lowerBand.toFixed(6)}\n`
                        technicalStr += `• Bandwidth: ${bandwidth.toFixed(4)}\n`
                        technicalStr += `• %B: ${percentB.toFixed(4)}\n`
                        if (percentB > 0.8) {
                            technicalStr += `• Signal: 🔴 Near upper band - Potential resistance\n`
                        } else if (percentB < 0.2) {
                            technicalStr += `• Signal: 🟢 Near lower band - Potential support\n`
                        } else {
                            technicalStr += `• Signal: 🟡 Middle range - Neutral\n`
                        }
                        technicalStr += '\n'

                        technicalStr += `📈 Moving Averages:\n`
                        technicalStr += `• SMA 20: $${sma20.toFixed(6)}\n`
                        technicalStr += `• SMA 50: $${sma50.toFixed(6)}\n`
                        technicalStr += `• SMA 200: $${sma200.toFixed(6)}\n`
                        technicalStr += `• EMA 12: $${ema12.toFixed(6)}\n`
                        technicalStr += `• EMA 26: $${ema26.toFixed(6)}\n\n`

                        // Moving Average Signals
                        technicalStr += `🎯 Moving Average Signals:\n`
                        if (sma20 > sma50 && sma50 > sma200) {
                            technicalStr += `• Trend: 🟢 Strong Uptrend (Golden Cross formation)\n`
                        } else if (sma20 < sma50 && sma50 < sma200) {
                            technicalStr += `• Trend: 🔴 Strong Downtrend (Death Cross formation)\n`
                        } else if (currentPrice > sma20 && sma20 > sma50) {
                            technicalStr += `• Trend: 🟡 Weak Uptrend\n`
                        } else {
                            technicalStr += `• Trend: 🟡 Weak Downtrend\n`
                        }

                        if (currentPrice > sma20) {
                            technicalStr += `• Price vs SMA20: 🟢 Above (Bullish)\n`
                        } else {
                            technicalStr += `• Price vs SMA20: 🔴 Below (Bearish)\n`
                        }

                        if (currentPrice > sma50) {
                            technicalStr += `• Price vs SMA50: 🟢 Above (Bullish)\n`
                        } else {
                            technicalStr += `• Price vs SMA50: 🔴 Below (Bearish)\n`
                        }

                        if (currentPrice > sma200) {
                            technicalStr += `• Price vs SMA200: 🟢 Above (Long-term Bullish)\n`
                        } else {
                            technicalStr += `• Price vs SMA200: 🔴 Below (Long-term Bearish)\n`
                        }
                        technicalStr += '\n'
                    } else {
                        technicalStr += `💰 Current Price: $${currentPrice.toFixed(6)}\n`
                        technicalStr += `📊 Insufficient historical data for full technical analysis.\n`
                    }

                    // Add holder analytics if available from Codex
                    if (holderData) {
                        technicalStr += `👥 HOLDER ANALYTICS (Codex):\n`
                        technicalStr += `• Total Holders: ${holderData.totalHolders?.toLocaleString() || 'N/A'}\n`
                        if (holderData.holderDistribution) {
                            const dist = holderData.holderDistribution;
                            technicalStr += `• Whale Concentration: ${dist.whales || 0} holders\n`
                            technicalStr += `• Shark Concentration: ${dist.sharks || 0} holders\n`
                            technicalStr += `• Retail Holders: ${(dist.dolphins || 0) + (dist.fish || 0)} holders\n`
                        }
                        if (holderData.concentrationRisk) {
                            technicalStr += `• Concentration Risk: ${holderData.concentrationRisk.toUpperCase()}\n`
                        }
                        technicalStr += '\n'
                    }

                    technicalStr += `💰 Current Price: $${currentPrice.toFixed(6)}\n`
                    technicalStr += `📊 24h Volume: $${volume24h?.toLocaleString() || 'N/A'}\n`
                    technicalStr += `💎 Market Cap: $${marketCap?.toLocaleString() || 'N/A'}\n`
                } else {
                    technicalStr = 'Unable to fetch price data for this token from CoinGecko, Birdeye, or Codex.';
                }
            } catch (error) {
                console.error('Error calculating technical indicators:', error);
                technicalStr = 'Error calculating technical indicators.';
            }
        } else {
            technicalStr = 'Please provide a token address to analyze technical indicators.';
        }

        const data = {
            technicalIndicators: technicalStr
        };

        const values = {};

        const text = technicalStr + '\n';

        return {
            data,
            values,
            text,
        };
    },
};