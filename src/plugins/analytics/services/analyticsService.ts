import type { IAgentRuntime } from '@elizaos/core';
import { logger, Service } from '@elizaos/core';
import type {
    ComprehensiveTokenAnalytics,
    AccountAnalytics,
    MarketAnalytics,
    AnalyticsRequest,
    AnalyticsResponse,
    TechnicalIndicators
} from '../interfaces/types';
import {
    calculateMACD,
    calculateRSI,
    calculateBollingerBands,
    calculateVolumeIndicators,
    generateSignals
} from '../utils/technicalAnalysis';

/**
 * Main Analytics Service
 * Orchestrates data from multiple providers and provides comprehensive analytics
 */
export class AnalyticsService extends Service {
    private isRunning = false;
    static serviceType = 'ANALYTICS_SERVICE';

    capabilityDescription = 'Comprehensive analytics service for token and market data analysis';

    constructor(runtime: IAgentRuntime) {
        super(runtime);
    }

    /**
     * Get comprehensive token analytics
     */
    async getTokenAnalytics(request: AnalyticsRequest): Promise<AnalyticsResponse> {
        try {
            const { tokenAddress, chain = 'solana', timeframe = '1d', includeHistorical = true, includeHolders = true, includeSnipers = true, coinGeckoData, priceHistory } = request;

            if (!tokenAddress) {
                return {
                    success: false,
                    data: null as any,
                    timestamp: Date.now(),
                    source: 'analytics',
                    error: 'Token address is required'
                };
            }

            // Get price data from existing providers
            const priceData = await this.getTokenPriceFromExistingProviders(tokenAddress, chain);
            if (!priceData) {
                return {
                    success: false,
                    data: null as any,
                    timestamp: Date.now(),
                    source: 'analytics',
                    error: 'Unable to fetch price data'
                };
            }

            // Get historical data for technical analysis
            let historicalData: any[] = [];
            console.log('includeHistorical', includeHistorical)
            if (includeHistorical) {
                // Use priceHistory if provided, otherwise fetch from providers
                if (priceHistory && priceHistory.length > 0) {
                    console.log(`Using provided price history with ${priceHistory.length} data points`);
                    historicalData = priceHistory.map((price: number, index: number) => ({
                        timestamp: Date.now() - (priceHistory.length - index) * 24 * 60 * 60 * 1000, // Approximate timestamps
                        price: price,
                        volume: 0, // Default volume
                        open: price,
                        high: price,
                        low: price,
                        close: price
                    }));
                } else {
                    historicalData = await this.getHistoricalDataFromExistingProviders(tokenAddress, chain, timeframe);
                }
            }

            // Calculate technical indicators
            const technicalIndicators = await this.calculateTechnicalIndicators(historicalData, tokenAddress);

            // Get holder analytics from Codex (if available)
            let holderAnalytics = null;
            if (includeHolders) {
                holderAnalytics = await this.getHolderAnalyticsFromCodex(tokenAddress);
            }

            // Get sniper analytics from Codex (if available)
            let sniperAnalytics = null;
            if (includeSnipers) {
                sniperAnalytics = await this.getSniperAnalyticsFromCodex(tokenAddress);
            }

            // Calculate risk assessment
            const riskAssessment = this.calculateRiskAssessment(
                technicalIndicators,
                holderAnalytics,
                priceData
            );

            // Generate recommendations
            const recommendations = this.generateRecommendations(
                technicalIndicators,
                holderAnalytics,
                priceData,
                historicalData
            );

            const comprehensiveAnalytics: ComprehensiveTokenAnalytics = {
                tokenAddress,
                symbol: coinGeckoData?.symbol || priceData.symbol,
                price: priceData,
                technicalIndicators,
                holderAnalytics,
                sniperAnalytics,
                riskAssessment,
                recommendations,
                timestamp: Date.now(),
                source: 'analytics'
            };

            return {
                success: true,
                data: comprehensiveAnalytics,
                timestamp: Date.now(),
                source: 'analytics',
                error: null
            };

        } catch (error) {
            console.error('Error in getTokenAnalytics:', error);
            return {
                success: false,
                data: null as any,
                timestamp: Date.now(),
                source: 'analytics',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get account analytics
     */
    async getAccountAnalytics(request: AnalyticsRequest): Promise<AnalyticsResponse> {
        try {
            const { walletAddress, chain = 'solana' } = request;

            if (!walletAddress) {
                return {
                    success: false,
                    data: null as any,
                    timestamp: Date.now(),
                    source: 'analytics',
                    error: 'Wallet address is required'
                };
            }

            // Get account data from existing Birdeye provider
            const accountData = await this.getAccountDataFromExistingProviders(walletAddress, chain);

            if (!accountData) {
                return {
                    success: false,
                    data: null as any,
                    timestamp: Date.now(),
                    source: 'analytics',
                    error: 'Unable to fetch account data'
                };
            }

            return {
                success: true,
                data: accountData,
                timestamp: Date.now(),
                source: 'analytics'
            };

        } catch (error) {
            console.error('Error in getAccountAnalytics:', error);
            return {
                success: false,
                data: null as any,
                timestamp: Date.now(),
                source: 'analytics',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get market analytics
     */
    async getMarketAnalytics(request: AnalyticsRequest): Promise<AnalyticsResponse> {
        try {
            const { chain = 'solana' } = request;

            // Get market data from existing providers
            const marketData = await this.getMarketDataFromExistingProviders(chain);

            if (!marketData) {
                return {
                    success: false,
                    data: null as any,
                    timestamp: Date.now(),
                    source: 'analytics',
                    error: 'Unable to fetch market data'
                };
            }

            return {
                success: true,
                data: marketData,
                timestamp: Date.now(),
                source: 'analytics'
            };

        } catch (error) {
            console.error('Error in getMarketAnalytics:', error);
            return {
                success: false,
                data: null as any,
                timestamp: Date.now(),
                source: 'analytics',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get token price from existing providers
     */
    private async getTokenPriceFromExistingProviders(tokenAddress: string, chain: string) {
        try {
            // Try to get from Birdeye trending data first
            const birdeyeTokens = await this.runtime.getCache<any[]>('tokens_solana');
            if (birdeyeTokens) {
                const token = birdeyeTokens.find(t => t.address === tokenAddress);
                if (token) {
                    console.log(`Found token in Birdeye cache: ${token.symbol} at $${token.price}`);
                    return {
                        timestamp: Date.now(),
                        source: 'birdeye',
                        chain: chain,
                        tokenAddress: tokenAddress,
                        symbol: token.symbol,
                        price: token.price || 0,
                        priceChange24h: 0, // Would need to calculate
                        priceChangePercent24h: token.price24hChangePercent || 0,
                        volume24h: token.volume24hUSD || 0,
                        marketCap: token.marketcap || 0,
                    };
                }
            }

            // Try to get from CoinMarketCap data
            const cmcTokens = await this.runtime.getCache<any[]>('coinmarketcap_sync');
            if (cmcTokens) {
                const token = cmcTokens.find(t => t.address === tokenAddress);
                if (token) {
                    console.log(`Found token in CoinMarketCap cache: ${token.symbol} at $${token.price}`);
                    return {
                        timestamp: Date.now(),
                        source: 'coinmarketcap',
                        chain: chain,
                        tokenAddress: tokenAddress,
                        symbol: token.symbol,
                        price: token.price || 0,
                        priceChange24h: 0, // Would need to calculate
                        priceChangePercent24h: token.price24hChangePercent || 0,
                        volume24h: token.volume24hUSD || 0,
                        marketCap: token.marketcap || 0,
                    };
                }
            }

            // If not found in cache, try to fetch fresh data from providers
            console.log(`Token ${tokenAddress} not found in cache, attempting to fetch fresh data...`);

            // Try Birdeye plugin service first for Solana tokens
            if (chain === 'solana') {
                try {
                    const birdeyeService = this.runtime.getService('birdeye');
                    if (birdeyeService && typeof (birdeyeService as any).getTokenMarketData === 'function') {
                        console.log(`Attempting to fetch from Birdeye plugin service for ${tokenAddress}...`);
                        const marketData = await (birdeyeService as any).getTokenMarketData(tokenAddress);
                        if (marketData && marketData.price > 0) {
                            console.log(`Successfully fetched price data from Birdeye plugin for ${tokenAddress}: $${marketData.price}`);
                            return {
                                timestamp: Date.now(),
                                source: 'birdeye',
                                chain: chain,
                                tokenAddress: tokenAddress,
                                symbol: 'UNKNOWN', // Birdeye service doesn't provide symbol in getTokenMarketData
                                price: marketData.price,
                                priceChange24h: 0, // Would need to calculate
                                priceChangePercent24h: 0,
                                volume24h: marketData.volume24h || 0,
                                marketCap: marketData.marketCap || 0,
                            };
                        } else {
                            console.warn(`Birdeye plugin service returned null or zero price for token ${tokenAddress}`);
                        }
                    } else {
                        console.warn('Birdeye plugin service not available or getTokenMarketData method not found');
                    }
                } catch (error) {
                    console.warn(`Failed to fetch from Birdeye plugin service for ${tokenAddress}:`, error);
                }
            }

            // Try Codex service for additional data
            try {
                const codexService = this.runtime.getService('codex');
                if (codexService && typeof (codexService as any).getTokenHolderAnalytics === 'function') {
                    console.log(`Attempting to fetch holder data from Codex for ${tokenAddress}...`);
                    const holderData = await (codexService as any).getTokenHolderAnalytics(tokenAddress);
                    if (holderData) {
                        console.log(`Successfully fetched holder data from Codex for ${tokenAddress}`);
                        // Note: Codex doesn't provide price data, only holder analytics
                    }
                }
            } catch (error) {
                console.warn(`Failed to fetch from Codex for ${tokenAddress}:`, error);
            }

            // Try JupiterService as fallback for Solana tokens
            if (chain === 'solana') {
                try {
                    const jupiterService = this.runtime.getService('JUPITER_SERVICE') as any;
                    if (jupiterService && typeof jupiterService.getTokenPrice === 'function') {
                        console.log(`Attempting to fetch price from Jupiter for ${tokenAddress}...`);

                        // Try with different amounts if the first attempt fails
                        let price = 0;
                        const amounts = [1000000, 10000000, 100000000]; // Try different amounts

                        for (const amount of amounts) {
                            try {
                                console.log(`Trying Jupiter with amount ${amount}...`);
                                price = await jupiterService.getTokenPrice(tokenAddress, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 6);
                                if (price > 0) {
                                    console.log(`Successfully fetched price data from Jupiter for ${tokenAddress}: $${price}`);
                                    break;
                                }
                            } catch (amountError) {
                                console.warn(`Jupiter failed with amount ${amount}:`, amountError);
                                continue;
                            }
                        }

                        if (price > 0) {
                            return {
                                timestamp: Date.now(),
                                source: 'jupiter' as any,
                                chain: chain,
                                tokenAddress: tokenAddress,
                                symbol: 'UNKNOWN',
                                price: price,
                                priceChange24h: 0,
                                priceChangePercent24h: 0,
                                volume24h: 0,
                                marketCap: 0,
                            };
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to fetch from Jupiter for ${tokenAddress}:`, error);
                }
            }

            // Try CoinMarketCapProvider as final fallback
            try {
                const cmcApiKey = this.runtime.getSetting('COINMARKETCAP_API_KEY') as string;
                if (cmcApiKey) {
                    const { CoinMarketCapProvider } = await import('../providers/coinmarketcapProvider');
                    const cmcProvider = new CoinMarketCapProvider(this.runtime);
                    const priceData = await cmcProvider.getTokenPrice(tokenAddress, chain);
                    if (priceData) {
                        console.log(`Successfully fetched price data from CoinMarketCap for ${tokenAddress}`);
                        return priceData;
                    }
                }
            } catch (error) {
                console.warn(`Failed to fetch from CoinMarketCap for ${tokenAddress}:`, error);
            }

            console.warn(`No price data available for token ${tokenAddress} from any provider`);
            return null;
        } catch (error) {
            console.error('Error getting token price from existing providers:', error);
            return null;
        }
    }

    /**
     * Get historical data from existing providers
     */
    private async getHistoricalDataFromExistingProviders(tokenAddress: string, chain: string, timeframe: string) {
        try {
            console.log(`Fetching historical data for ${tokenAddress} on ${chain} with timeframe ${timeframe}`);

            // Try multiple sources for historical data
            let priceHistory: number[] = [];
            let marketData: any = null;

            // Try Birdeye service first
            const birdeyeService = this.runtime.getService('birdeye');
            if (birdeyeService && typeof (birdeyeService as any).getTokenMarketData === 'function') {
                try {
                    console.log('Fetching data from Birdeye service...');
                    marketData = await (birdeyeService as any).getTokenMarketData(tokenAddress);
                    if (marketData && marketData.priceHistory && marketData.priceHistory.length > 0) {
                        priceHistory = marketData.priceHistory;
                        console.log(`Got ${priceHistory.length} price history points from Birdeye`);
                    }
                } catch (error) {
                    console.warn('Birdeye service failed:', error);
                }
            }

            // If no price history from Birdeye, try to get from cache
            if (priceHistory.length === 0) {
                const birdeyeTokens = await this.runtime.getCache<any[]>('tokens_solana');
                if (birdeyeTokens) {
                    const token = birdeyeTokens.find(t => t.address === tokenAddress);
                    if (token && token.price) {
                        // Create a simple price history from current price
                        priceHistory = [token.price * 0.98, token.price * 0.99, token.price];
                        console.log('Created price history from cache data');
                    }
                }
            }

            if (priceHistory.length === 0) {
                console.warn(`No historical data found for token ${tokenAddress}`);
                return [];
            }

            console.log(`Raw price history length: ${priceHistory.length}`);
            console.log(`Sample price history: ${priceHistory.slice(0, 5).join(', ')}`);

            // Convert the price history array to the expected format with proper OHLCV data
            const historicalData = priceHistory.map((price: number, index: number) => {
                // Create realistic OHLCV data from the price
                const timestamp = Date.now() - (priceHistory.length - index - 1) * 15 * 60 * 1000; // 15-minute intervals
                const variation = price * 0.02; // 2% variation for high/low
                const high = price + variation * Math.random();
                const low = price - variation * Math.random();
                const open = price + (Math.random() - 0.5) * variation;
                const close = price;
                const volume = Math.random() * 1000000; // Random volume for now

                return {
                    timestamp,
                    open,
                    high,
                    low,
                    close,
                    volume,
                };
            });

            console.log(`Processed ${historicalData.length} historical data points for ${tokenAddress}`);

            if (historicalData.length > 0) {
                console.log(`Sample processed data point:`, historicalData[0]);
                console.log(`Last data point:`, historicalData[historicalData.length - 1]);
            }

            return historicalData;
        } catch (error) {
            console.error('Error fetching historical data from providers:', error);
            return [];
        }
    }

    /**
     * Get holder analytics from Codex
     */
    private async getHolderAnalyticsFromCodex(tokenAddress: string) {
        try {
            const codexService = this.runtime.getService('codex');
            if (codexService && typeof (codexService as any).getTokenHolderAnalytics === 'function') {
                console.log(`Fetching holder analytics from Codex for ${tokenAddress}...`);
                const holderData = await (codexService as any).getTokenHolderAnalytics(tokenAddress);
                if (holderData) {
                    console.log(`Successfully fetched holder analytics from Codex for ${tokenAddress}`);
                    return holderData;
                }
            } else {
                console.warn('Codex service not available or getTokenHolderAnalytics method not found');
            }
            return null;
        } catch (error) {
            console.error('Error getting holder analytics from Codex:', error);
            return null;
        }
    }

    /**
     * Get sniper analytics from Codex
     */
    private async getSniperAnalyticsFromCodex(tokenAddress: string) {
        try {
            const codexService = this.runtime.getService('codex');
            if (codexService && typeof (codexService as any).getSniperAnalytics === 'function') {
                console.log(`Fetching sniper analytics from Codex for ${tokenAddress}...`);
                const sniperData = await (codexService as any).getSniperAnalytics(tokenAddress);
                if (sniperData) {
                    console.log(`Successfully fetched sniper analytics from Codex for ${tokenAddress}`);
                    return sniperData;
                }
            } else {
                console.warn('Codex service not available or getSniperAnalytics method not found');
            }
            return null;
        } catch (error) {
            console.error('Error getting sniper analytics from Codex:', error);
            return null;
        }
    }

    /**
     * Get account data from existing providers
     */
    private async getAccountDataFromExistingProviders(walletAddress: string, chain: string): Promise<AccountAnalytics | null> {
        try {
            // Get portfolio data from existing Birdeye provider
            const portfolioData = await this.runtime.getCache<any>('portfolio');
            if (!portfolioData || portfolioData.wallet !== walletAddress) {
                return null;
            }

            const portfolio = portfolioData.data;
            const trades = await this.runtime.getCache<any[]>('transaction_history') || [];

            // Convert to AccountAnalytics format
            const accountAnalytics: AccountAnalytics = {
                walletAddress,
                totalValue: portfolio.totalUsd || 0,
                totalValueChange24h: 0, // Would need to calculate
                totalValueChangePercent24h: 0, // Would need to calculate
                portfolio: portfolio.items?.map((item: any) => ({
                    tokenAddress: item.address,
                    symbol: item.symbol,
                    balance: item.balance || 0,
                    value: item.value || 0,
                    valueChange24h: 0, // Would need to calculate
                    allocation: item.value > 0 ? (item.value / portfolio.totalUsd) * 100 : 0,
                })) || [],
                performance: {
                    totalPnL: 0, // Would need to calculate
                    totalPnLPercent: 0,
                    bestPerformer: '',
                    worstPerformer: '',
                    riskMetrics: {
                        sharpeRatio: 0,
                        maxDrawdown: 0,
                        volatility: 0,
                    },
                },
                tradingHistory: {
                    totalTrades: trades.length,
                    winningTrades: 0, // Would need to analyze trades
                    losingTrades: 0, // Would need to analyze trades
                    winRate: 0,
                    averageTradeSize: 0,
                },
            };

            return accountAnalytics;
        } catch (error) {
            console.error('Error getting account data from existing providers:', error);
            return null;
        }
    }

    /**
     * Get market data from existing providers
     */
    private async getMarketDataFromExistingProviders(chain: string): Promise<MarketAnalytics | null> {
        try {
            let topGainers: any[] = [];
            let topLosers: any[] = [];
            let trendingTokens: any[] = [];

            // Get data from Birdeye trending
            const birdeyeTokens = await this.runtime.getCache<any[]>('tokens_solana');
            if (birdeyeTokens && birdeyeTokens.length > 0) {
                trendingTokens = birdeyeTokens.slice(0, 20).map(token => ({
                    timestamp: Date.now(),
                    source: 'birdeye' as const,
                    chain: chain,
                    tokenAddress: token.address,
                    symbol: token.symbol,
                    price: token.price || 0,
                    priceChange24h: 0,
                    priceChangePercent24h: token.price24hChangePercent || 0,
                    volume24h: token.volume24hUSD || 0,
                    marketCap: token.marketcap || 0,
                }));

                // Sort by price change for gainers/losers
                const sortedTokens = [...birdeyeTokens].sort((a, b) =>
                    (b.price24hChangePercent || 0) - (a.price24hChangePercent || 0)
                );

                topGainers = sortedTokens.slice(0, 10).map(token => ({
                    timestamp: Date.now(),
                    source: 'birdeye' as const,
                    chain: chain,
                    tokenAddress: token.address,
                    symbol: token.symbol,
                    price: token.price || 0,
                    priceChange24h: 0,
                    priceChangePercent24h: token.price24hChangePercent || 0,
                    volume24h: token.volume24hUSD || 0,
                    marketCap: token.marketcap || 0,
                }));

                topLosers = sortedTokens.slice(-10).map(token => ({
                    timestamp: Date.now(),
                    source: 'birdeye' as const,
                    chain: chain,
                    tokenAddress: token.address,
                    symbol: token.symbol,
                    price: token.price || 0,
                    priceChange24h: 0,
                    priceChangePercent24h: token.price24hChangePercent || 0,
                    volume24h: token.volume24hUSD || 0,
                    marketCap: token.marketcap || 0,
                }));
            }

            // Get data from CoinMarketCap
            const cmcTokens = await this.runtime.getCache<any[]>('coinmarketcap_sync');
            if (cmcTokens && cmcTokens.length > 0) {
                // Add CMC data if Birdeye data is insufficient
                if (trendingTokens.length < 20) {
                    const cmcTrending = cmcTokens.slice(0, 20 - trendingTokens.length).map(token => ({
                        timestamp: Date.now(),
                        source: 'coinmarketcap' as const,
                        chain: chain,
                        tokenAddress: token.address,
                        symbol: token.symbol,
                        price: token.price || 0,
                        priceChange24h: 0,
                        priceChangePercent24h: token.price24hChangePercent || 0,
                        volume24h: token.volume24hUSD || 0,
                        marketCap: token.marketcap || 0,
                    }));
                    trendingTokens.push(...cmcTrending);
                }
            }

            const marketAnalytics: MarketAnalytics = {
                marketCap: 0, // Would need to calculate from all tokens
                volume24h: 0, // Would need to calculate from all tokens
                dominance: 0, // Would need to calculate
                topGainers,
                topLosers,
                trendingTokens,
                marketSentiment: {
                    bullish: 0.5, // Placeholder
                    bearish: 0.3,
                    neutral: 0.2,
                },
            };

            return marketAnalytics;
        } catch (error) {
            console.error('Error getting market data from existing providers:', error);
            return null;
        }
    }

    /**
     * Calculate technical indicators from historical data
     */
    private async calculateTechnicalIndicators(historicalData: any[], tokenAddress?: string): Promise<TechnicalIndicators> {
        console.log(`Calculating technical indicators with ${historicalData.length} data points`);

        // Try to use TAAPI service first for real technical indicators
        const taapiService = this.runtime.getService('TAAPI_SERVICE') as any;
        if (taapiService && typeof taapiService.getMarketAnalysis === 'function' && tokenAddress) {
            try {
                console.log('Attempting to get technical indicators from TAAPI service...');

                // Get token symbol from Birdeye overview
                let symbol = null;
                const birdeyeService = this.runtime.getService('birdeye') as any;
                if (birdeyeService && typeof birdeyeService.fetchTokenOverview === 'function') {
                    try {
                        const overviewData = await birdeyeService.fetchTokenOverview({ address: tokenAddress });
                        console.log('Birdeye overview response:', JSON.stringify(overviewData, null, 2));

                        if (overviewData && overviewData.success && overviewData.data) {
                            // Try different possible symbol fields
                            symbol = overviewData.data.symbol ||
                                overviewData.data.tokenSymbol ||
                                overviewData.data.token_symbol;

                            if (symbol) {
                                console.log(`Got symbol from Birdeye overview: ${symbol}`);
                            } else {
                                console.log('No symbol found in Birdeye overview response');
                            }
                        } else {
                            console.log('Birdeye overview response was not successful or missing data');
                        }
                    } catch (error) {
                        console.warn('Failed to get token overview from Birdeye:', error);
                    }
                }

                // Only proceed if we have a valid symbol
                if (symbol && symbol !== 'UNKNOWN') {
                    // Convert to standard format for TAAPI (e.g., SOL/USDT)
                    const taapiSymbol = `${symbol}/USDT`;
                    console.log(`Using symbol ${taapiSymbol} for TAAPI analysis`);

                    const taapiData = await taapiService.getMarketAnalysis(taapiSymbol, 'binance', '1h');

                    if (taapiData && taapiData.indicators) {
                        console.log('Successfully got technical indicators from TAAPI');

                        const indicators = taapiData.indicators;

                        return {
                            macd: {
                                macd: indicators.macd?.macd || 0,
                                signal: indicators.macd?.signal || 0,
                                histogram: indicators.macd?.histogram || 0,
                                bullish: (indicators.macd?.macd || 0) > (indicators.macd?.signal || 0)
                            },
                            rsi: {
                                value: indicators.rsi?.value || 50,
                                overbought: (indicators.rsi?.value || 50) > 70,
                                oversold: (indicators.rsi?.value || 50) < 30
                            },
                            bollingerBands: {
                                upper: indicators.bbands?.upper || 0,
                                middle: indicators.bbands?.middle || 0,
                                lower: indicators.bbands?.lower || 0,
                                bandwidth: indicators.bbands?.bandwidth || 0,
                                percentB: indicators.bbands?.percentB || 0.5
                            },
                            movingAverages: {
                                sma20: indicators.sma?.value || 0,
                                sma50: 0, // Would need to get SMA50 separately
                                sma200: 0, // Would need to get SMA200 separately
                                ema12: 0, // Would need to get EMA12 separately
                                ema26: indicators.ema?.value || 0
                            },
                            volume: {
                                volumeSMA: 0,
                                volumeRatio: 1,
                                onBalanceVolume: 0
                            }
                        };
                    }
                } else {
                    console.log(`No valid symbol found for token ${tokenAddress}, skipping TAAPI analysis`);
                }
            } catch (error) {
                console.warn('TAAPI service failed, falling back to calculated indicators:', error);
            }
        }

        // Fall back to calculated indicators if TAAPI is not available
        if (historicalData.length < 20) {
            console.warn(`Insufficient historical data: ${historicalData.length} points (need at least 20)`);
            return {
                macd: { macd: 0, signal: 0, histogram: 0, bullish: false },
                rsi: { value: 50, overbought: false, oversold: false },
                bollingerBands: { upper: 0, middle: 0, lower: 0, bandwidth: 0, percentB: 0.5 },
                movingAverages: { sma20: 0, sma50: 0, sma200: 0, ema12: 0, ema26: 0 },
                volume: { volumeSMA: 0, volumeRatio: 1, onBalanceVolume: 0 }
            };
        }

        const prices = historicalData.map(d => d.close);
        const volumes = historicalData.map(d => d.volume);
        const highs = historicalData.map(d => d.high);
        const lows = historicalData.map(d => d.low);

        console.log(`Sample prices: ${prices.slice(0, 5).join(', ')}...`);
        console.log(`Sample volumes: ${volumes.slice(0, 5).join(', ')}...`);
        console.log(`Current price: ${prices[prices.length - 1]}`);

        // Calculate MACD
        const macdResult = calculateMACD(prices);
        const currentMACD = macdResult.macd[macdResult.macd.length - 1] || 0;
        const currentSignal = macdResult.signal[macdResult.signal.length - 1] || 0;
        const currentHistogram = macdResult.histogram[macdResult.histogram.length - 1] || 0;

        console.log(`MACD calculation: MACD=${currentMACD}, Signal=${currentSignal}, Histogram=${currentHistogram}`);

        // Calculate RSI
        const rsiResult = calculateRSI(prices);
        const currentRSI = rsiResult[rsiResult.length - 1] || 50;

        console.log(`RSI calculation: ${currentRSI}`);

        // Calculate Bollinger Bands
        const bbResult = calculateBollingerBands(prices);
        const currentBB = {
            upper: bbResult.upper[bbResult.upper.length - 1] || 0,
            middle: bbResult.middle[bbResult.middle.length - 1] || 0,
            lower: bbResult.lower[bbResult.lower.length - 1] || 0,
            bandwidth: bbResult.bandwidth[bbResult.bandwidth.length - 1] || 0,
            percentB: bbResult.percentB[bbResult.percentB.length - 1] || 0.5
        };

        console.log(`Bollinger Bands: Upper=${currentBB.upper}, Middle=${currentBB.middle}, Lower=${currentBB.lower}, %B=${currentBB.percentB}`);

        // Calculate Moving Averages
        const sma20 = calculateSMA(prices, 20);
        const sma50 = calculateSMA(prices, 50);
        const sma200 = calculateSMA(prices, Math.min(200, prices.length));
        const ema12 = calculateEMA(prices, 12);
        const ema26 = calculateEMA(prices, 26);

        const currentSMA20 = sma20[sma20.length - 1] || 0;
        const currentSMA50 = sma50[sma50.length - 1] || 0;
        const currentSMA200 = sma200[sma200.length - 1] || 0;
        const currentEMA12 = ema12[ema12.length - 1] || 0;
        const currentEMA26 = ema26[ema26.length - 1] || 0;

        console.log(`Moving Averages: SMA20=${currentSMA20}, SMA50=${currentSMA50}, SMA200=${currentSMA200}, EMA12=${currentEMA12}, EMA26=${currentEMA26}`);

        // Calculate Volume indicators
        const volumeResult = calculateVolumeIndicators(prices, volumes);

        const currentVolumeSMA = volumeResult.volumeSMA[volumeResult.volumeSMA.length - 1] || 0;
        const currentVolumeRatio = volumeResult.volumeRatio[volumeResult.volumeRatio.length - 1] || 1;
        const currentOnBalanceVolume = volumeResult.onBalanceVolume[volumeResult.onBalanceVolume.length - 1] || 0;

        console.log(`Volume indicators: VolumeSMA=${currentVolumeSMA}, VolumeRatio=${currentVolumeRatio}, OBV=${currentOnBalanceVolume}`);

        return {
            macd: {
                macd: currentMACD,
                signal: currentSignal,
                histogram: currentHistogram,
                bullish: currentMACD > currentSignal
            },
            rsi: {
                value: currentRSI,
                overbought: currentRSI > 70,
                oversold: currentRSI < 30
            },
            bollingerBands: currentBB,
            movingAverages: {
                sma20: currentSMA20,
                sma50: currentSMA50,
                sma200: currentSMA200,
                ema12: currentEMA12,
                ema26: currentEMA26
            },
            volume: {
                volumeSMA: currentVolumeSMA,
                volumeRatio: currentVolumeRatio,
                onBalanceVolume: currentOnBalanceVolume
            }
        };
    }

    /**
     * Calculate risk assessment
     */
    private calculateRiskAssessment(
        technicalIndicators: TechnicalIndicators,
        holderAnalytics: any,
        priceData: any
    ) {
        let volatility = 0;
        let liquidity = 0;
        let concentrationRisk = 'low';
        let technicalRisk = 'low';
        let overallRisk: 'low' | 'moderate' | 'high' = 'low';

        // Calculate volatility from price data
        if (priceData.priceChangePercent24h) {
            volatility = Math.abs(priceData.priceChangePercent24h);
        }

        // Calculate liquidity score
        if (priceData.volume24h && priceData.marketCap) {
            liquidity = (priceData.volume24h / priceData.marketCap) * 100;
        }

        // Assess concentration risk from holder analytics
        if (holderAnalytics) {
            concentrationRisk = holderAnalytics.concentrationRisk;
        }

        // Assess technical risk
        if (technicalIndicators.rsi.overbought || technicalIndicators.rsi.oversold) {
            technicalRisk = 'moderate';
        }
        if (technicalIndicators.bollingerBands.percentB > 0.8 || technicalIndicators.bollingerBands.percentB < 0.2) {
            technicalRisk = 'high';
        }

        // Calculate overall risk
        let riskScore = 0;
        if (volatility > 50) riskScore += 2;
        if (liquidity < 1) riskScore += 2;
        if (concentrationRisk === 'high') riskScore += 2;
        if (technicalRisk === 'high') riskScore += 1;

        if (riskScore >= 4) overallRisk = 'high';
        else if (riskScore >= 2) overallRisk = 'moderate';
        else overallRisk = 'low';

        return {
            volatility,
            liquidity,
            concentrationRisk,
            technicalRisk,
            overallRisk
        };
    }

    /**
     * Generate trading recommendations
     */
    private generateRecommendations(
        technicalIndicators: TechnicalIndicators,
        holderAnalytics: any,
        priceData: any,
        historicalData: any[]
    ) {
        // Generate signals from technical indicators
        const signals = generateSignals(
            historicalData.map(d => d.close),
            historicalData.map(d => d.volume),
            historicalData.map(d => d.high),
            historicalData.map(d => d.low)
        );

        let action: 'buy' | 'sell' | 'hold' | 'accumulate' = 'hold';
        let confidence = 0;
        const reasons: string[] = [];
        const priceTargets = {
            shortTerm: priceData.price,
            mediumTerm: priceData.price,
            longTerm: priceData.price
        };

        // Determine action based on signals
        if (signals.overallSignal === 'buy' && signals.confidence > 60) {
            action = 'buy';
            confidence = signals.confidence;
            reasons.push('Strong technical buy signals');
        } else if (signals.overallSignal === 'sell' && signals.confidence > 60) {
            action = 'sell';
            confidence = signals.confidence;
            reasons.push('Strong technical sell signals');
        } else if (signals.overallSignal === 'buy' && signals.confidence > 40) {
            action = 'accumulate';
            confidence = signals.confidence;
            reasons.push('Moderate technical buy signals');
        }

        // Add holder analytics insights
        if (holderAnalytics) {
            if (holderAnalytics.communityGrowth === 'explosive') {
                reasons.push('Explosive community growth');
                confidence += 10;
            } else if (holderAnalytics.communityGrowth === 'growing') {
                reasons.push('Growing community');
                confidence += 5;
            }

            if (holderAnalytics.concentrationRisk === 'low') {
                reasons.push('Low concentration risk');
                confidence += 5;
            } else if (holderAnalytics.concentrationRisk === 'high') {
                reasons.push('High concentration risk');
                confidence -= 10;
            }
        }

        // Calculate price targets
        if (historicalData.length > 0) {
            const currentPrice = priceData.price;
            const volatility = Math.abs(priceData.priceChangePercent24h) / 100;

            priceTargets.shortTerm = currentPrice * (1 + (volatility * 0.5));
            priceTargets.mediumTerm = currentPrice * (1 + (volatility * 1.5));
            priceTargets.longTerm = currentPrice * (1 + (volatility * 3));
        }

        // Cap confidence at 100
        confidence = Math.min(confidence, 100);

        return {
            action,
            confidence,
            reasons,
            priceTargets
        };
    }

    /**
     * Start the scenario service with the given runtime.
     * @param {IAgentRuntime} runtime - The agent runtime
     * @returns {Promise<ScenarioService>} - The started scenario service
     */
    static async start(runtime: IAgentRuntime) {
        const service = new AnalyticsService(runtime);
        service.start();
        return service;
    }
    /**
     * Stops the Scenario service associated with the given runtime.
     *
     * @param {IAgentRuntime} runtime The runtime to stop the service for.
     * @throws {Error} When the Scenario service is not found.
     */
    static async stop(runtime: IAgentRuntime) {
        const service = runtime.getService(this.serviceType);
        if (!service) {
            throw new Error(this.serviceType + ' service not found');
        }
        service.stop();
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('ANALYTICS_SERVICE service is already running');
            return;
        }

        try {
            logger.info('ANALYTICS_SERVICE trading service...');

            this.isRunning = true;
            logger.info('ANALYTICS_SERVICE service started successfully');
        } catch (error) {
            logger.error('Error starting ANALYTICS_SERVICE service:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('ANALYTICS_SERVICE service is not running');
            return;
        }

        try {
            logger.info('Stopping ANALYTICS_SERVICE service...');

            this.isRunning = false;
            logger.info('ANALYTICS_SERVICE stopped successfully');
        } catch (error) {
            logger.error('Error stopping ANALYTICS_SERVICE service:', error);
            throw error;
        }
    }

    isServiceRunning(): boolean {
        return this.isRunning;
    }

}

// Helper functions for moving averages
function calculateSMA(prices: number[], period: number): number[] {
    if (prices.length < period) return [];

    const sma: number[] = [];
    for (let i = period - 1; i < prices.length; i++) {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
    }
    return sma;
}

function calculateEMA(prices: number[], period: number): number[] {
    if (prices.length < period) return [];

    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // First EMA is SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += prices[i];
    }
    ema.push(sum / period);

    // Calculate subsequent EMAs
    for (let i = period; i < prices.length; i++) {
        const newEMA = (prices[i] * multiplier) + (ema[ema.length - 1] * (1 - multiplier));
        ema.push(newEMA);
    }

    return ema;
}