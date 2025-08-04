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
    private readonly API_BASE_URL = 'https://public-api.birdeye.so';

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

            console.log(`Fetching price for token ${tokenAddress} from Birdeye API...`);

            const options = {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'x-chain': chain,
                    'X-API-KEY': this.apiKey,
                },
            };

            // Try the main price endpoint first
            let url = `${this.API_BASE_URL}/defi/price?address=${tokenAddress}`;
            console.log(`Making request to: ${url}`);

            let response = await fetch(url, options);

            // If the main endpoint fails, try the token overview endpoint
            if (!response.ok || response.status === 404) {
                console.log(`Main price endpoint failed, trying token overview endpoint...`);
                url = `${this.API_BASE_URL}/defi/token_overview?address=${tokenAddress}`;
                console.log(`Making request to: ${url}`);
                response = await fetch(url, options);
            }

            console.log(`Birdeye API response status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Birdeye API error response: ${errorText}`);
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
            }

            // Check if response has content
            const responseText = await response.text();
            console.log(`Birdeye API raw response: ${responseText}`);

            if (!responseText || responseText.trim() === '') {
                console.warn(`Birdeye API returned empty response for token ${tokenAddress}`);
                return null;
            }

            let data;
            try {
                data = JSON.parse(responseText);
                console.log(`Birdeye API response data:`, JSON.stringify(data, null, 2));
            } catch (parseError) {
                console.error(`Failed to parse Birdeye API response as JSON: ${responseText}`);
                return null;
            }

            let tokenData = data?.data;

            if (!tokenData) {
                console.warn(`No token data found in Birdeye response for ${tokenAddress}`);
                return null;
            }

            // Handle different response formats from price vs overview endpoints
            const priceData: TokenPriceData = {
                timestamp: Date.now(),
                source: 'birdeye',
                chain: chain,
                tokenAddress: tokenAddress,
                symbol: tokenData.symbol || tokenData.name || 'UNKNOWN',
                price: tokenData.value || tokenData.price || 0,
                priceChange24h: tokenData.priceChange24h || 0,
                priceChangePercent24h: tokenData.priceChangePercent24h || tokenData.priceChangePercent || 0,
                volume24h: tokenData.volume24h || tokenData.volume || 0,
                marketCap: tokenData.marketCap || tokenData.marketcap || 0,
                circulatingSupply: tokenData.circulatingSupply || tokenData.circulating_supply,
                totalSupply: tokenData.totalSupply || tokenData.total_supply,
            };

            console.log(`Successfully parsed price data: $${priceData.price} for ${tokenData.symbol}`);

            await this.setCachedData(cacheKey, priceData, 60); // 1 minute cache
            return priceData;
        } catch (error) {
            console.error('Error fetching token price from Birdeye:', error);
            return null;
        }
    }

    /**
     * Get historical price data from Birdeye using the correct endpoint
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

            // Use the correct historical price endpoint
            const url = `${this.API_BASE_URL}/defi/history_price?address=${tokenAddress}&address_type=token&type=${interval}`;
            console.log(`Fetching historical data from: ${url}`);

            const response = await fetch(url, options);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Birdeye historical API error: ${errorText}`);
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
            }

            const data = await response.json();
            console.log(`Historical data response:`, JSON.stringify(data, null, 2));

            if (!data.success || !data.data || !data.data.items) {
                console.warn(`No historical data found for token ${tokenAddress}`);
                return [];
            }

            const historyData = data.data.items;
            console.log(`Found ${historyData.length} historical data points`);

            const historicalData: HistoricalPriceData[] = historyData.map((item: any) => ({
                timestamp: item.unixTime ? item.unixTime * 1000 : Date.now(),
                open: item.o || item.open || item.value || 0,
                high: item.h || item.high || item.value || 0,
                low: item.l || item.low || item.value || 0,
                close: item.c || item.close || item.value || 0,
                volume: item.v || item.volume || 0,
            }));

            await this.setCachedData(cacheKey, historicalData, 300); // 5 minutes cache
            return historicalData;
        } catch (error) {
            console.error('Error fetching historical data from Birdeye:', error);
            return [];
        }
    }

    /**
     * Get OHLCV data from Birdeye for better technical analysis
     */
    async getOHLCVData(
        tokenAddress: string,
        chain: string = 'solana',
        timeframe: string = '1d'
    ): Promise<HistoricalPriceData[]> {
        try {
            const cacheKey = `birdeye_ohlcv_${tokenAddress}_${timeframe}`;
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

            // Use the OHLCV endpoint for better candlestick data
            const url = `${this.API_BASE_URL}/defi/ohlcv?address=${tokenAddress}&type=${interval}`;
            console.log(`Fetching OHLCV data from: ${url}`);

            const response = await fetch(url, options);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Birdeye OHLCV API error: ${errorText}`);
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
            }

            const data = await response.json();
            console.log(`OHLCV data response:`, JSON.stringify(data, null, 2));

            if (!data.success || !data.data || !data.data.items) {
                console.warn(`No OHLCV data found for token ${tokenAddress}, falling back to historical price data`);
                return this.getHistoricalData(tokenAddress, chain, timeframe);
            }

            const ohlcvData = data.data.items;
            console.log(`Found ${ohlcvData.length} OHLCV data points`);

            const historicalData: HistoricalPriceData[] = ohlcvData.map((item: any) => ({
                timestamp: item.unixTime ? item.unixTime * 1000 : Date.now(),
                open: item.o || 0,
                high: item.h || 0,
                low: item.l || 0,
                close: item.c || 0,
                volume: item.v || 0,
            }));

            await this.setCachedData(cacheKey, historicalData, 300); // 5 minutes cache
            return historicalData;
        } catch (error) {
            console.error('Error fetching OHLCV data from Birdeye:', error);
            // Fall back to historical price data
            return this.getHistoricalData(tokenAddress, chain, timeframe);
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
                `${this.API_BASE_URL}/defi/token_trending?sort_by=rank&sort_type=asc&offset=0&limit=20`,
                options
            );

            if (!trendingResponse.ok) {
                throw new Error(`HTTP error! status: ${trendingResponse.status}`);
            }

            const trendingData = await trendingResponse.json();
            const trendingTokens = trendingData?.data?.tokens || [];

            // Get top gainers and losers
            const gainersResponse = await fetch(
                `${this.API_BASE_URL}/defi/token_trending?sort_by=priceChangePercent24h&sort_type=desc&offset=0&limit=10`,
                options
            );

            const losersResponse = await fetch(
                `${this.API_BASE_URL}/defi/token_trending?sort_by=priceChangePercent24h&sort_type=asc&offset=0&limit=10`,
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
                `${this.API_BASE_URL}/v1/wallet/token_list?wallet=${walletAddress}`,
                options
            );

            if (!portfolioResponse.ok) {
                throw new Error(`HTTP error! status: ${portfolioResponse.status}`);
            }

            const portfolioData = await portfolioResponse.json();
            const tokens = portfolioData?.data || [];

            // Get wallet value
            const valueResponse = await fetch(
                `${this.API_BASE_URL}/v1/wallet/portfolio?wallet=${walletAddress}`,
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
            case '1m': return '1m';
            case '3m': return '3m';
            case '5m': return '5m';
            case '15m': return '15m';
            case '30m': return '30m';
            case '1h': return '1H';
            case '2h': return '2H';
            case '4h': return '4H';
            case '6h': return '6H';
            case '8h': return '8H';
            case '12h': return '12H';
            case '1d': return '1D';
            case '3d': return '3D';
            case '1w': return '1W';
            case '1m': return '1M';
            default: return '1D';
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
            await this.runtime.setCache(key, data, ttlSeconds);
        } catch (error) {
            console.error('Failed to cache data:', error);
        }
    }
}