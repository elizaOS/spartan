import type { IAgentRuntime } from '@elizaos/core';
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
    calculateMovingAverages,
    calculateVolumeIndicators,
    generateSignals
} from '../utils/technicalAnalysis';

/**
 * Main Analytics Service
 * Orchestrates data from multiple providers and provides comprehensive analytics
 */
export class AnalyticsService {
    private runtime: IAgentRuntime;

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
    }

    /**
     * Get comprehensive token analytics
     */
    async getTokenAnalytics(request: AnalyticsRequest): Promise<AnalyticsResponse> {
        try {
            const { tokenAddress, chain = 'solana', timeframe = '1d', includeHistorical = true, includeHolders = true, includeSnipers = true } = request;

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
            if (includeHistorical) {
                historicalData = await this.getHistoricalDataFromExistingProviders(tokenAddress, chain, timeframe);
            }

            // Calculate technical indicators
            const technicalIndicators = await this.calculateTechnicalIndicators(historicalData);

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
                symbol: priceData.symbol,
                name: priceData.symbol, // Would need to fetch from metadata
                chain,
                price: priceData,
                technicalIndicators,
                historicalData,
                holderAnalytics,
                sniperAnalytics,
                marketPosition: {
                    rank: 0, // Would need to fetch from market data
                    marketCap: priceData.marketCap,
                    volume24h: priceData.volume24h,
                    dominance: 0, // Would need to calculate
                },
                riskAssessment,
                recommendations,
            };

            return {
                success: true,
                data: comprehensiveAnalytics,
                timestamp: Date.now(),
                source: 'analytics'
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
        // For now, return empty array as historical data might not be available in existing providers
        // This would need to be implemented with direct API calls if needed
        return [];
    }

    /**
     * Get holder analytics from Codex
     */
    private async getHolderAnalyticsFromCodex(tokenAddress: string) {
        try {
            const codexApiKey = this.runtime.getSetting('CODEX_API_KEY') as string;
            if (!codexApiKey) {
                return null;
            }

            // This would need to be implemented with direct Codex API calls
            // For now, return null as it's not available in existing providers
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
            const codexApiKey = this.runtime.getSetting('CODEX_API_KEY') as string;
            if (!codexApiKey) {
                return null;
            }

            // This would need to be implemented with direct Codex API calls
            // For now, return null as it's not available in existing providers
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
    private async calculateTechnicalIndicators(historicalData: any[]): Promise<TechnicalIndicators> {
        if (historicalData.length < 50) {
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

        // Calculate MACD
        const macdResult = calculateMACD(prices);
        const currentMACD = macdResult.macd[macdResult.macd.length - 1] || 0;
        const currentSignal = macdResult.signal[macdResult.signal.length - 1] || 0;
        const currentHistogram = macdResult.histogram[macdResult.histogram.length - 1] || 0;

        // Calculate RSI
        const rsiResult = calculateRSI(prices);
        const currentRSI = rsiResult[rsiResult.length - 1] || 50;

        // Calculate Bollinger Bands
        const bbResult = calculateBollingerBands(prices);
        const currentBB = {
            upper: bbResult.upper[bbResult.upper.length - 1] || 0,
            middle: bbResult.middle[bbResult.middle.length - 1] || 0,
            lower: bbResult.lower[bbResult.lower.length - 1] || 0,
            bandwidth: bbResult.bandwidth[bbResult.bandwidth.length - 1] || 0,
            percentB: bbResult.percentB[bbResult.percentB.length - 1] || 0.5
        };

        // Calculate Moving Averages
        const sma20 = calculateSMA(prices, 20);
        const sma50 = calculateSMA(prices, 50);
        const sma200 = calculateSMA(prices, 200);
        const ema12 = calculateEMA(prices, 12);
        const ema26 = calculateEMA(prices, 26);

        // Calculate Volume indicators
        const volumeResult = calculateVolumeIndicators(prices, volumes);

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
                sma20: sma20[sma20.length - 1] || 0,
                sma50: sma50[sma50.length - 1] || 0,
                sma200: sma200[sma200.length - 1] || 0,
                ema12: ema12[ema12.length - 1] || 0,
                ema26: ema26[ema26.length - 1] || 0
            },
            volume: {
                volumeSMA: volumeResult.volumeSMA[volumeResult.volumeSMA.length - 1] || 0,
                volumeRatio: volumeResult.volumeRatio[volumeResult.volumeRatio.length - 1] || 1,
                onBalanceVolume: volumeResult.onBalanceVolume[volumeResult.onBalanceVolume.length - 1] || 0
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