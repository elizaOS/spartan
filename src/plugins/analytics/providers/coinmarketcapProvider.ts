import type { IAgentRuntime } from '@elizaos/core';
import type {
    TokenPriceData,
    HistoricalPriceData,
    MarketAnalytics,
    AccountAnalytics
} from '../interfaces/types';

/**
 * CoinMarketCap Data Provider
 * Integrates with CoinMarketCap API for multi-chain token data
 */
export class CoinMarketCapProvider {
    private runtime: IAgentRuntime;
    private apiKey: string;

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
        this.apiKey = runtime.getSetting('COINMARKETCAP_API_KEY') as string;

        if (!this.apiKey) {
            throw new Error('CoinMarketCap API key not configured');
        }
    }

    /**
     * Get token price data from CoinMarketCap
     */
    async getTokenPrice(tokenAddress: string, chain: string = 'ethereum'): Promise<TokenPriceData | null> {
        try {
            const cacheKey = `cmc_price_${tokenAddress}_${chain}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            const options = {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'X-CMC_PRO_API_KEY': this.apiKey,
                },
            };

            // For CoinMarketCap, we need to use the token ID or symbol
            // This is a simplified approach - in practice you'd need a mapping
            const response = await fetch(
                `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=${tokenAddress}`,
                options
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const tokenData = data?.data?.[tokenAddress.toUpperCase()]?.[0];

            if (!tokenData) {
                return null;
            }

            const quote = tokenData.quote?.USD;
            if (!quote) {
                return null;
            }

            const priceData: TokenPriceData = {
                timestamp: Date.now(),
                source: 'coinmarketcap',
                chain: chain,
                tokenAddress: tokenAddress,
                symbol: tokenData.symbol,
                price: quote.price || 0,
                priceChange24h: quote.volume_change_24h || 0,
                priceChangePercent24h: quote.percent_change_24h || 0,
                volume24h: quote.volume_24h || 0,
                marketCap: quote.market_cap || 0,
                circulatingSupply: tokenData.circulating_supply,
                totalSupply: tokenData.total_supply,
            };

            await this.setCachedData(cacheKey, priceData, 300); // 5 minutes cache
            return priceData;
        } catch (error) {
            console.error('Error fetching token price from CoinMarketCap:', error);
            return null;
        }
    }

    /**
     * Get historical price data from CoinMarketCap
     */
    async getHistoricalData(
        tokenAddress: string,
        chain: string = 'ethereum',
        timeframe: string = '1d'
    ): Promise<HistoricalPriceData[]> {
        try {
            const cacheKey = `cmc_historical_${tokenAddress}_${timeframe}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            const options = {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'X-CMC_PRO_API_KEY': this.apiKey,
                },
            };

            // Get token ID first
            const tokenResponse = await fetch(
                `https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?symbol=${tokenAddress}`,
                options
            );

            if (!tokenResponse.ok) {
                throw new Error(`HTTP error! status: ${tokenResponse.status}`);
            }

            const tokenData = await tokenResponse.json();
            const tokenId = tokenData?.data?.[0]?.id;

            if (!tokenId) {
                return [];
            }

            // Get historical data
            const count = this.getDataPointsForTimeframe(timeframe);
            const interval = this.convertTimeframeToInterval(timeframe);

            const historicalResponse = await fetch(
                `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/historical?id=${tokenId}&count=${count}&interval=${interval}`,
                options
            );

            if (!historicalResponse.ok) {
                throw new Error(`HTTP error! status: ${historicalResponse.status}`);
            }

            const historicalData = await historicalResponse.json();
            const quotes = historicalData?.data?.quotes || [];

            const historicalPriceData: HistoricalPriceData[] = quotes.map((quote: any) => ({
                timestamp: new Date(quote.timestamp).getTime(),
                open: quote.quote.USD.open || 0,
                high: quote.quote.USD.high || 0,
                low: quote.quote.USD.low || 0,
                close: quote.quote.USD.close || 0,
                volume: quote.quote.USD.volume || 0,
            }));

            await this.setCachedData(cacheKey, historicalPriceData, 600); // 10 minutes cache
            return historicalPriceData;
        } catch (error) {
            console.error('Error fetching historical data from CoinMarketCap:', error);
            return [];
        }
    }

    /**
     * Get market data from CoinMarketCap
     */
    async getMarketData(chain: string = 'ethereum'): Promise<MarketAnalytics | null> {
        try {
            const cacheKey = `cmc_market_${chain}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            const options = {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'X-CMC_PRO_API_KEY': this.apiKey,
                },
            };

            // Get global market data
            const globalResponse = await fetch(
                'https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest',
                options
            );

            if (!globalResponse.ok) {
                throw new Error(`HTTP error! status: ${globalResponse.status}`);
            }

            const globalData = await globalResponse.json();
            const globalMetrics = globalData?.data;

            // Get top gainers and losers
            const gainersResponse = await fetch(
                'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?sort=percent_change_24h&sort_dir=desc&limit=10',
                options
            );

            const losersResponse = await fetch(
                'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?sort=percent_change_24h&sort_dir=asc&limit=10',
                options
            );

            const gainersData = await gainersResponse.json();
            const losersData = await losersResponse.json();

            const topGainers = (gainersData?.data || []).map((token: any) => ({
                timestamp: Date.now(),
                source: 'coinmarketcap' as const,
                chain: token.platform?.slug || 'L1',
                tokenAddress: token.platform?.token_address || token.slug,
                symbol: token.symbol,
                price: token.quote?.USD?.price || 0,
                priceChange24h: token.quote?.USD?.volume_change_24h || 0,
                priceChangePercent24h: token.quote?.USD?.percent_change_24h || 0,
                volume24h: token.quote?.USD?.volume_24h || 0,
                marketCap: token.quote?.USD?.market_cap || 0,
            }));

            const topLosers = (losersData?.data || []).map((token: any) => ({
                timestamp: Date.now(),
                source: 'coinmarketcap' as const,
                chain: token.platform?.slug || 'L1',
                tokenAddress: token.platform?.token_address || token.slug,
                symbol: token.symbol,
                price: token.quote?.USD?.price || 0,
                priceChange24h: token.quote?.USD?.volume_change_24h || 0,
                priceChangePercent24h: token.quote?.USD?.percent_change_24h || 0,
                volume24h: token.quote?.USD?.volume_24h || 0,
                marketCap: token.quote?.USD?.market_cap || 0,
            }));

            // Get trending tokens (top by volume)
            const trendingResponse = await fetch(
                'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?sort=volume_24h&sort_dir=desc&limit=20',
                options
            );

            const trendingData = await trendingResponse.json();
            const trendingTokens = (trendingData?.data || []).map((token: any) => ({
                timestamp: Date.now(),
                source: 'coinmarketcap' as const,
                chain: token.platform?.slug || 'L1',
                tokenAddress: token.platform?.token_address || token.slug,
                symbol: token.symbol,
                price: token.quote?.USD?.price || 0,
                priceChange24h: token.quote?.USD?.volume_change_24h || 0,
                priceChangePercent24h: token.quote?.USD?.percent_change_24h || 0,
                volume24h: token.quote?.USD?.volume_24h || 0,
                marketCap: token.quote?.USD?.market_cap || 0,
            }));

            const marketAnalytics: MarketAnalytics = {
                marketCap: globalMetrics?.quote?.USD?.total_market_cap || 0,
                volume24h: globalMetrics?.quote?.USD?.total_volume_24h || 0,
                dominance: 0, // Would need to calculate for specific chain
                topGainers,
                topLosers,
                trendingTokens,
                marketSentiment: {
                    bullish: 0.5, // Placeholder - would need sentiment analysis
                    bearish: 0.3,
                    neutral: 0.2,
                },
            };

            await this.setCachedData(cacheKey, marketAnalytics, 600); // 10 minutes cache
            return marketAnalytics;
        } catch (error) {
            console.error('Error fetching market data from CoinMarketCap:', error);
            return null;
        }
    }

    /**
     * Get account data from CoinMarketCap
     * Note: CoinMarketCap doesn't provide account/wallet data
     * This is a placeholder for consistency
     */
    async getAccountData(walletAddress: string, chain: string = 'ethereum'): Promise<AccountAnalytics | null> {
        // CoinMarketCap doesn't provide account/wallet data
        // This would need to be implemented using other providers or blockchain APIs
        console.warn('CoinMarketCap does not provide account data');
        return null;
    }

    /**
     * Convert timeframe to CoinMarketCap interval format
     */
    private convertTimeframeToInterval(timeframe: string): string {
        switch (timeframe) {
            case '1h': return '1h';
            case '4h': return '4h';
            case '1d': return '1d';
            case '1w': return '1w';
            case '1m': return '1M';
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
            await this.runtime.setCache(key, data, ttlSeconds);
        } catch (error) {
            console.error('Failed to cache data:', error);
        }
    }

    /**
     * Get the complete list of coins from CoinGecko (free API)
     * This helps with symbol resolution for better token identification
     */
    async getCoinsListFromCoinGecko(): Promise<any> {
        try {
            const cacheKey = 'coingecko_coins_list_free';
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            console.log('Fetching CoinGecko coins list from free API...');

            const response = await fetch('https://api.coingecko.com/api/v3/coins/list');
            if (!response.ok) {
                throw new Error(`CoinGecko coins list API error: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Got ${data.length || 0} coins from CoinGecko free API`);

            await this.setCachedData(cacheKey, data, 86400); // 24 hours cache
            return data;
        } catch (error) {
            console.error('Error fetching CoinGecko coins list:', error);
            return null;
        }
    }

    /**
     * Find coin ID by symbol using CoinGecko coins list
     */
    async findCoinIdBySymbol(symbol: string): Promise<string | null> {
        try {
            const coinsList = await this.getCoinsListFromCoinGecko();
            if (!coinsList || !Array.isArray(coinsList)) {
                return null;
            }

            // Find exact symbol match (case insensitive)
            const foundCoin = coinsList.find((coin: any) =>
                coin.symbol && coin.symbol.toLowerCase() === symbol.toLowerCase()
            );

            if (foundCoin) {
                console.log(`Found CoinGecko ID ${foundCoin.id} for symbol ${symbol}`);
                return foundCoin.id;
            }

            // Try partial name match if symbol not found
            const foundByName = coinsList.find((coin: any) =>
                coin.name && coin.name.toLowerCase().includes(symbol.toLowerCase())
            );

            if (foundByName) {
                console.log(`Found CoinGecko ID ${foundByName.id} for name match with ${symbol}`);
                return foundByName.id;
            }

            return null;
        } catch (error) {
            console.error('Error finding coin ID by symbol:', error);
            return null;
        }
    }
} 