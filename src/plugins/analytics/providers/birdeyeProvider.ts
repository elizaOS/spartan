import type { IAgentRuntime } from '@elizaos/core';
import type {
    TokenPriceData,
    HistoricalPriceData,
    MarketAnalytics,
    AccountAnalytics
} from '../interfaces/types';

/**
 * Birdeye Data Provider
 * Integrates with Birdeye API for Solana token data
 */
export class BirdeyeProvider {
    private runtime: IAgentRuntime;
    private apiKey: string;

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
        this.apiKey = runtime.getSetting('BIRDEYE_API_KEY') as string;

        if (!this.apiKey) {
            throw new Error('Birdeye API key not configured');
        }
    }

    /**
     * Get token price data from Birdeye
     */
    async getTokenPrice(tokenAddress: string, chain: string = 'solana'): Promise<TokenPriceData | null> {
        try {
            const cacheKey = `birdeye_price_${tokenAddress}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            const options = {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'x-chain': chain,
                    'X-API-KEY': this.apiKey,
                },
            };

            const response = await fetch(
                `https://public-api.birdeye.so/v1/token/price?address=${tokenAddress}`,
                options
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const tokenData = data?.data;

            if (!tokenData) {
                return null;
            }

            const priceData: TokenPriceData = {
                timestamp: Date.now(),
                source: 'birdeye',
                chain: chain,
                tokenAddress: tokenAddress,
                symbol: tokenData.symbol || 'UNKNOWN',
                price: tokenData.value || 0,
                priceChange24h: tokenData.priceChange24h || 0,
                priceChangePercent24h: tokenData.priceChangePercent24h || 0,
                volume24h: tokenData.volume24h || 0,
                marketCap: tokenData.marketCap || 0,
                circulatingSupply: tokenData.circulatingSupply,
                totalSupply: tokenData.totalSupply,
            };

            await this.setCachedData(cacheKey, priceData, 60); // 1 minute cache
            return priceData;
        } catch (error) {
            console.error('Error fetching token price from Birdeye:', error);
            return null;
        }
    }

    /**
     * Get historical price data from Birdeye
     */
    async getHistoricalData(
        tokenAddress: string,
        chain: string = 'solana',
        timeframe: string = '1d'
    ): Promise<HistoricalPriceData[]> {
        try {
            const cacheKey = `birdeye_historical_${tokenAddress}_${timeframe}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            const options = {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'x-chain': chain,
                    'X-API-KEY': this.apiKey,
                },
            };

            // Convert timeframe to Birdeye format
            const interval = this.convertTimeframeToInterval(timeframe);
            const limit = this.getDataPointsForTimeframe(timeframe);

            const response = await fetch(
                `https://public-api.birdeye.so/v1/token/price_history?address=${tokenAddress}&interval=${interval}&limit=${limit}`,
                options
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const historyData = data?.data?.items || [];

            const historicalData: HistoricalPriceData[] = historyData.map((item: any) => ({
                timestamp: item.unixTime * 1000,
                open: item.open || 0,
                high: item.high || 0,
                low: item.low || 0,
                close: item.close || 0,
                volume: item.volume || 0,
            }));

            await this.setCachedData(cacheKey, historicalData, 300); // 5 minutes cache
            return historicalData;
        } catch (error) {
            console.error('Error fetching historical data from Birdeye:', error);
            return [];
        }
    }

    /**
     * Get market data from Birdeye
     */
    async getMarketData(chain: string = 'solana'): Promise<MarketAnalytics | null> {
        try {
            const cacheKey = `birdeye_market_${chain}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            const options = {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'x-chain': chain,
                    'X-API-KEY': this.apiKey,
                },
            };

            // Get trending tokens
            const trendingResponse = await fetch(
                'https://public-api.birdeye.so/defi/token_trending?sort_by=rank&sort_type=asc&offset=0&limit=20',
                options
            );

            if (!trendingResponse.ok) {
                throw new Error(`HTTP error! status: ${trendingResponse.status}`);
            }

            const trendingData = await trendingResponse.json();
            const trendingTokens = trendingData?.data?.tokens || [];

            // Get top gainers and losers
            const gainersResponse = await fetch(
                'https://public-api.birdeye.so/defi/token_trending?sort_by=priceChangePercent24h&sort_type=desc&offset=0&limit=10',
                options
            );

            const losersResponse = await fetch(
                'https://public-api.birdeye.so/defi/token_trending?sort_by=priceChangePercent24h&sort_type=asc&offset=0&limit=10',
                options
            );

            const gainersData = await gainersResponse.json();
            const losersData = await losersResponse.json();

            const topGainers = (gainersData?.data?.tokens || []).map((token: any) => ({
                timestamp: Date.now(),
                source: 'birdeye' as const,
                chain: chain,
                tokenAddress: token.address,
                symbol: token.symbol,
                price: token.price || 0,
                priceChange24h: token.priceChange24h || 0,
                priceChangePercent24h: token.priceChangePercent24h || 0,
                volume24h: token.volume24h || 0,
                marketCap: token.marketCap || 0,
            }));

            const topLosers = (losersData?.data?.tokens || []).map((token: any) => ({
                timestamp: Date.now(),
                source: 'birdeye' as const,
                chain: chain,
                tokenAddress: token.address,
                symbol: token.symbol,
                price: token.price || 0,
                priceChange24h: token.priceChange24h || 0,
                priceChangePercent24h: token.priceChangePercent24h || 0,
                volume24h: token.volume24h || 0,
                marketCap: token.marketCap || 0,
            }));

            const trendingTokensData = trendingTokens.map((token: any) => ({
                timestamp: Date.now(),
                source: 'birdeye' as const,
                chain: chain,
                tokenAddress: token.address,
                symbol: token.symbol,
                price: token.price || 0,
                priceChange24h: token.priceChange24h || 0,
                priceChangePercent24h: token.priceChangePercent24h || 0,
                volume24h: token.volume24h || 0,
                marketCap: token.marketCap || 0,
            }));

            const marketAnalytics: MarketAnalytics = {
                marketCap: 0, // Would need to calculate from all tokens
                volume24h: 0, // Would need to calculate from all tokens
                dominance: 0, // Would need market cap data
                topGainers,
                topLosers,
                trendingTokens: trendingTokensData,
                marketSentiment: {
                    bullish: 0.6, // Placeholder - would need sentiment analysis
                    bearish: 0.2,
                    neutral: 0.2,
                },
            };

            await this.setCachedData(cacheKey, marketAnalytics, 300); // 5 minutes cache
            return marketAnalytics;
        } catch (error) {
            console.error('Error fetching market data from Birdeye:', error);
            return null;
        }
    }

    /**
     * Get account/wallet data from Birdeye
     */
    async getAccountData(walletAddress: string, chain: string = 'solana'): Promise<AccountAnalytics | null> {
        try {
            const cacheKey = `birdeye_account_${walletAddress}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            const options = {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'x-chain': chain,
                    'X-API-KEY': this.apiKey,
                },
            };

            // Get wallet portfolio
            const portfolioResponse = await fetch(
                `https://public-api.birdeye.so/v1/wallet/token_list?wallet=${walletAddress}`,
                options
            );

            if (!portfolioResponse.ok) {
                throw new Error(`HTTP error! status: ${portfolioResponse.status}`);
            }

            const portfolioData = await portfolioResponse.json();
            const tokens = portfolioData?.data || [];

            // Get wallet value
            const valueResponse = await fetch(
                `https://public-api.birdeye.so/v1/wallet/portfolio?wallet=${walletAddress}`,
                options
            );

            const valueData = await valueResponse.json();
            const portfolioValue = valueData?.data?.value || 0;

            const portfolio = tokens.map((token: any) => ({
                tokenAddress: token.address,
                symbol: token.symbol,
                balance: token.balance || 0,
                value: token.value || 0,
                valueChange24h: token.valueChange24h || 0,
                allocation: token.value > 0 ? (token.value / portfolioValue) * 100 : 0,
            }));

            const accountAnalytics: AccountAnalytics = {
                walletAddress,
                totalValue: portfolioValue,
                totalValueChange24h: 0, // Would need historical data
                totalValueChangePercent24h: 0, // Would need historical data
                portfolio,
                performance: {
                    totalPnL: 0, // Would need historical data
                    totalPnLPercent: 0,
                    bestPerformer: portfolio.length > 0 ? portfolio[0].symbol : '',
                    worstPerformer: portfolio.length > 0 ? portfolio[0].symbol : '',
                    riskMetrics: {
                        sharpeRatio: 0,
                        maxDrawdown: 0,
                        volatility: 0,
                    },
                },
                tradingHistory: {
                    totalTrades: 0, // Would need transaction history
                    winningTrades: 0,
                    losingTrades: 0,
                    winRate: 0,
                    averageTradeSize: 0,
                },
            };

            await this.setCachedData(cacheKey, accountAnalytics, 300); // 5 minutes cache
            return accountAnalytics;
        } catch (error) {
            console.error('Error fetching account data from Birdeye:', error);
            return null;
        }
    }

    /**
     * Convert timeframe to Birdeye interval format
     */
    private convertTimeframeToInterval(timeframe: string): string {
        switch (timeframe) {
            case '1h': return '1h';
            case '4h': return '4h';
            case '1d': return '1d';
            case '1w': return '1w';
            case '1m': return '1m';
            default: return '1d';
        }
    }

    /**
     * Get number of data points for timeframe
     */
    private getDataPointsForTimeframe(timeframe: string): number {
        switch (timeframe) {
            case '1h': return 168; // 1 week of hourly data
            case '4h': return 168; // 4 weeks of 4h data
            case '1d': return 365; // 1 year of daily data
            case '1w': return 52; // 1 year of weekly data
            case '1m': return 12; // 1 year of monthly data
            default: return 30; // 30 days of daily data
        }
    }

    /**
     * Get cached data
     */
    private async getCachedData(key: string): Promise<any | null> {
        try {
            return await this.runtime.getCache(key);
        } catch (error) {
            return null;
        }
    }

    /**
     * Set cached data
     */
    private async setCachedData(key: string, data: any, ttlSeconds: number): Promise<void> {
        try {
            // Note: setCache no longer supports TTL parameter in ElizaOS 1.0.0
            // Cache expiration should be handled at the database adapter level
            await this.runtime.setCache(key, data);
        } catch (error) {
            console.error('Failed to cache data:', error);
        }
    }
} 