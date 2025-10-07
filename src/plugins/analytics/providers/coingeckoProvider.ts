import type { IAgentRuntime } from '@elizaos/core';

/**
 * CoinGecko Data Provider
 * Integrates with CoinGecko API for comprehensive token data and historical information
 * Supports both active and inactive coins, historical data, and market charts
 */
export class CoingeckoProvider {
    private runtime: IAgentRuntime;
    private apiKey: string;
    private readonly API_BASE_URL = 'https://api.coingecko.com/api/v3';
    private readonly PRO_API_BASE_URL = 'https://pro-api.coingecko.com/api/v3';

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
        this.apiKey = runtime.getSetting('COINGECKO_API_KEY') as string;

        if (!this.apiKey) {
            console.warn('CoinGecko API key not configured. Some features may be limited.');
        }
    }

    /**
     * Search for a coin by symbol or name
     */
    async searchCoin(query: string): Promise<any> {
        try {
            const cacheKey = `coingecko_search_${query.toLowerCase()}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            console.log(`Searching CoinGecko for: ${query}`);

            const url = new URL(`${this.API_BASE_URL}/search`);
            url.searchParams.append('query', query);

            const response = await fetch(url.toString());
            if (!response.ok) {
                throw new Error(`CoinGecko search API error: ${response.status}`);
            }

            const data = await response.json();
            console.log(`CoinGecko search results for ${query}:`, data.coins?.length || 0, 'coins found');

            await this.setCachedData(cacheKey, data, 3600); // 1 hour cache
            return data;
        } catch (error) {
            console.error('Error searching CoinGecko:', error);
            return null;
        }
    }

    /**
     * Get coin data by ID
     */
    async getCoinData(coinId: string): Promise<any> {
        try {
            const cacheKey = `coingecko_coin_${coinId}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            console.log(`Fetching CoinGecko data for coin ID: ${coinId}`);

            const url = new URL(`${this.API_BASE_URL}/coins/${coinId}`);
            url.searchParams.append('localization', 'false');
            url.searchParams.append('tickers', 'false');
            url.searchParams.append('market_data', 'true');
            url.searchParams.append('community_data', 'false');
            url.searchParams.append('developer_data', 'false');
            url.searchParams.append('sparkline', 'false');

            const response = await fetch(url.toString());
            if (!response.ok) {
                throw new Error(`CoinGecko coin API error: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Got CoinGecko data for ${coinId}:`, data.symbol, data.name);

            await this.setCachedData(cacheKey, data, 1800); // 30 minutes cache
            return data;
        } catch (error) {
            console.error(`Error fetching CoinGecko data for ${coinId}:`, error);
            return null;
        }
    }

    /**
     * Get market chart data for a coin
     */
    async getMarketChart(coinId: string, days: number = 30, currency: string = 'usd'): Promise<any> {
        try {
            const cacheKey = `coingecko_market_chart_${coinId}_${days}_${currency}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            console.log(`Fetching CoinGecko market chart for ${coinId} (${days} days)`);

            const url = new URL(`${this.API_BASE_URL}/coins/${coinId}/market_chart`);
            url.searchParams.append('vs_currency', currency);
            url.searchParams.append('days', days.toString());

            const response = await fetch(url.toString());
            if (!response.ok) {
                throw new Error(`CoinGecko market chart API error: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Got market chart data for ${coinId}:`, data.prices?.length || 0, 'price points');

            await this.setCachedData(cacheKey, data, 900); // 15 minutes cache
            return data;
        } catch (error) {
            console.error(`Error fetching market chart for ${coinId}:`, error);
            return null;
        }
    }

    /**
     * Get OHLC (Open, High, Low, Close) data for a coin
     */
    async getOHLC(coinId: string, days: number = 30, currency: string = 'usd'): Promise<any> {
        try {
            const cacheKey = `coingecko_ohlc_${coinId}_${days}_${currency}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            console.log(`Fetching CoinGecko OHLC data for ${coinId} (${days} days)`);

            const url = new URL(`${this.API_BASE_URL}/coins/${coinId}/ohlc`);
            url.searchParams.append('vs_currency', currency);
            url.searchParams.append('days', days.toString());

            const response = await fetch(url.toString());
            if (!response.ok) {
                throw new Error(`CoinGecko OHLC API error: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Got OHLC data for ${coinId}:`, data.length || 0, 'candlesticks');

            await this.setCachedData(cacheKey, data, 900); // 15 minutes cache
            return data;
        } catch (error) {
            console.error(`Error fetching OHLC data for ${coinId}:`, error);
            return null;
        }
    }

    /**
     * Get comprehensive historical data including OHLC and market charts
     */
    async getComprehensiveHistoricalData(coinId: string, days: number = 30, currency: string = 'usd'): Promise<any> {
        try {
            console.log(`Getting comprehensive historical data for ${coinId} (${days} days)`);

            // Fetch multiple data types in parallel
            const [marketChart, ohlcData] = await Promise.all([
                this.getMarketChart(coinId, days, currency),
                this.getOHLC(coinId, days, currency)
            ]);

            // Process OHLC data into a more usable format
            const processedOHLC = ohlcData ? ohlcData.map((candle: any) => ({
                timestamp: candle[0],
                open: candle[1],
                high: candle[2],
                low: candle[3],
                close: candle[4],
                volume: candle[5] || 0
            })) : [];

            // Process market chart data
            const processedMarketChart = marketChart ? {
                prices: marketChart.prices?.map((item: any) => ({
                    timestamp: item[0],
                    price: item[1]
                })) || [],
                volumes: marketChart.total_volumes?.map((item: any) => ({
                    timestamp: item[0],
                    volume: item[1]
                })) || [],
                marketCaps: marketChart.market_caps?.map((item: any) => ({
                    timestamp: item[0],
                    marketCap: item[1]
                })) || []
            } : null;

            return {
                coinId,
                currency,
                days,
                ohlc: processedOHLC,
                marketChart: processedMarketChart,
                summary: {
                    totalCandlesticks: processedOHLC.length,
                    totalPricePoints: processedMarketChart?.prices?.length || 0,
                    dateRange: processedOHLC.length > 0 ? {
                        start: new Date(processedOHLC[0].timestamp),
                        end: new Date(processedOHLC[processedOHLC.length - 1].timestamp)
                    } : null
                }
            };
        } catch (error) {
            console.error(`Error getting comprehensive historical data for ${coinId}:`, error);
            return null;
        }
    }

    /**
     * Get historical data for a specific date (paid plan feature)
     */
    async getHistoricalData(coinId: string, date: string, currency: string = 'usd'): Promise<any> {
        if (!this.apiKey) {
            console.warn('CoinGecko API key required for historical data');
            return null;
        }

        try {
            const cacheKey = `coingecko_historical_${coinId}_${date}_${currency}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            console.log(`Fetching CoinGecko historical data for ${coinId} on ${date}`);

            const url = new URL(`${this.PRO_API_BASE_URL}/coins/${coinId}/history`);
            url.searchParams.append('date', date);
            url.searchParams.append('localization', 'false');
            url.searchParams.append('x_cg_pro_api_key', this.apiKey);

            const response = await fetch(url.toString());
            if (!response.ok) {
                throw new Error(`CoinGecko historical API error: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Got historical data for ${coinId} on ${date}`);

            await this.setCachedData(cacheKey, data, 86400); // 24 hours cache
            return data;
        } catch (error) {
            console.error(`Error fetching historical data for ${coinId}:`, error);
            return null;
        }
    }

    /**
     * Get market chart range data (paid plan feature)
     */
    async getMarketChartRange(coinId: string, from: number, to: number, currency: string = 'usd'): Promise<any> {
        if (!this.apiKey) {
            console.warn('CoinGecko API key required for market chart range');
            return null;
        }

        try {
            const cacheKey = `coingecko_market_range_${coinId}_${from}_${to}_${currency}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            console.log(`Fetching CoinGecko market chart range for ${coinId} from ${from} to ${to}`);

            const url = new URL(`${this.PRO_API_BASE_URL}/coins/${coinId}/market_chart/range`);
            url.searchParams.append('vs_currency', currency);
            url.searchParams.append('from', from.toString());
            url.searchParams.append('to', to.toString());
            url.searchParams.append('x_cg_pro_api_key', this.apiKey);

            const response = await fetch(url.toString());
            if (!response.ok) {
                throw new Error(`CoinGecko market chart range API error: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Got market chart range data for ${coinId}:`, data.prices?.length || 0, 'price points');

            await this.setCachedData(cacheKey, data, 900); // 15 minutes cache
            return data;
        } catch (error) {
            console.error(`Error fetching market chart range for ${coinId}:`, error);
            return null;
        }
    }

    /**
     * Get contract market chart for specific contract address
     */
    async getContractMarketChart(coinId: string, contractAddress: string, days: number = 30, currency: string = 'usd'): Promise<any> {
        try {
            const cacheKey = `coingecko_contract_chart_${coinId}_${contractAddress}_${days}_${currency}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            console.log(`Fetching CoinGecko contract market chart for ${contractAddress} (${days} days)`);

            const url = new URL(`${this.API_BASE_URL}/coins/${coinId}/contract/${contractAddress}/market_chart`);
            url.searchParams.append('vs_currency', currency);
            url.searchParams.append('days', days.toString());

            const response = await fetch(url.toString());
            if (!response.ok) {
                throw new Error(`CoinGecko contract market chart API error: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Got contract market chart data for ${contractAddress}:`, data.prices?.length || 0, 'price points');

            await this.setCachedData(cacheKey, data, 900); // 15 minutes cache
            return data;
        } catch (error) {
            console.error(`Error fetching contract market chart for ${contractAddress}:`, error);
            return null;
        }
    }

    /**
     * Get contract market chart range (paid plan feature)
     */
    async getContractMarketChartRange(coinId: string, contractAddress: string, from: number, to: number, currency: string = 'usd'): Promise<any> {
        if (!this.apiKey) {
            console.warn('CoinGecko API key required for contract market chart range');
            return null;
        }

        try {
            const cacheKey = `coingecko_contract_range_${coinId}_${contractAddress}_${from}_${to}_${currency}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            console.log(`Fetching CoinGecko contract market chart range for ${contractAddress} from ${from} to ${to}`);

            const url = new URL(`${this.PRO_API_BASE_URL}/coins/${coinId}/contract/${contractAddress}/market_chart/range`);
            url.searchParams.append('vs_currency', currency);
            url.searchParams.append('from', from.toString());
            url.searchParams.append('to', to.toString());
            url.searchParams.append('x_cg_pro_api_key', this.apiKey);

            const response = await fetch(url.toString());
            if (!response.ok) {
                throw new Error(`CoinGecko contract market chart range API error: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Got contract market chart range data for ${contractAddress}:`, data.prices?.length || 0, 'price points');

            await this.setCachedData(cacheKey, data, 900); // 15 minutes cache
            return data;
        } catch (error) {
            console.error(`Error fetching contract market chart range for ${contractAddress}:`, error);
            return null;
        }
    }

    /**
     * Get comprehensive token analysis including historical data and market charts
     */
    async getTokenAnalysis(tokenAddress: string, symbol?: string): Promise<any> {
        try {
            console.log(`Getting comprehensive CoinGecko analysis for ${tokenAddress} (symbol: ${symbol})`);

            let coinId: string | null = null;
            let coinData: any = null;
            let resolvedSymbol = symbol; // Declare resolvedSymbol at function scope

            // First, try to get the coins list to find the coin ID
            const coinsList = await this.getCoinsList();
            if (coinsList && coinsList.length > 0) {
                console.log(`Got ${coinsList.length} coins from CoinGecko list`);

                // Try to get symbol from Birdeye cache first
                if (!resolvedSymbol) {
                    try {
                        const birdeyeTokens = await this.runtime.getCache<any[]>('tokens_solana');
                        if (birdeyeTokens) {
                            const token = birdeyeTokens.find(t => t.address === tokenAddress);
                            if (token && token.symbol) {
                                resolvedSymbol = token.symbol;
                                console.log(`Got symbol ${resolvedSymbol} from Birdeye cache for ${tokenAddress}`);
                            }
                        }
                    } catch (error) {
                        console.log('Failed to get symbol from Birdeye cache:', error);
                    }
                }

                // Try to find by symbol first (most reliable)
                if (resolvedSymbol) {
                    const foundBySymbol = coinsList.find((coin: any) =>
                        coin.symbol && resolvedSymbol && coin.symbol.toLowerCase() === resolvedSymbol.toLowerCase()
                    );
                    if (foundBySymbol) {
                        coinId = foundBySymbol.id;
                        console.log(`Found coin ID ${coinId} for symbol ${resolvedSymbol}`);
                    }
                }

                // If not found by symbol, try to find by name (partial match)
                if (!coinId && resolvedSymbol) {
                    const foundByName = coinsList.find((coin: any) =>
                        coin.name && resolvedSymbol && coin.name.toLowerCase().includes(resolvedSymbol.toLowerCase())
                    );
                    if (foundByName) {
                        coinId = foundByName.id;
                        console.log(`Found coin ID ${coinId} for name match with ${resolvedSymbol}`);
                    }
                }

                // If still not found, try to search by address (for contract tokens)
                if (!coinId) {
                    const searchResults = await this.searchCoin(tokenAddress);
                    if (searchResults && searchResults.coins && searchResults.coins.length > 0) {
                        // Try to match with coins list
                        const foundInSearch = searchResults.coins.find((searchCoin: any) =>
                            coinsList.some((listCoin: any) => listCoin.id === searchCoin.id)
                        );
                        if (foundInSearch) {
                            coinId = foundInSearch.id;
                            console.log(`Found coin ID ${coinId} for address ${tokenAddress} via search`);
                        }
                    }
                }

                // If still not found, try to search by the resolved symbol
                if (!coinId && resolvedSymbol) {
                    const searchResults = await this.searchCoin(resolvedSymbol);
                    if (searchResults && searchResults.coins && searchResults.coins.length > 0) {
                        // Try to match with coins list
                        const foundInSearch = searchResults.coins.find((searchCoin: any) =>
                            coinsList.some((listCoin: any) => listCoin.id === searchCoin.id)
                        );
                        if (foundInSearch) {
                            coinId = foundInSearch.id;
                            console.log(`Found coin ID ${coinId} for symbol ${resolvedSymbol} via search`);
                        }
                    }
                }
            }

            if (!coinId) {
                console.log(`No CoinGecko coin found for ${tokenAddress} (symbol: ${symbol}, resolved symbol: ${resolvedSymbol})`);
                return null;
            }

            // Get coin data
            coinData = await this.getCoinData(coinId);
            if (!coinData) {
                console.log(`Failed to get coin data for ${coinId}`);
                return null;
            }

            // Get market chart data
            const marketChart = await this.getMarketChart(coinId, 30);

            // Try to get contract-specific data if we have a contract address
            let contractChart = null;
            if (tokenAddress && tokenAddress.length > 20) { // Likely a contract address
                try {
                    contractChart = await this.getContractMarketChart(coinId, tokenAddress, 30);
                } catch (error) {
                    console.log(`Contract chart not available for ${tokenAddress}, using general market chart`);
                }
            }

            // Use contract chart if available, otherwise use general market chart
            const chartData = contractChart || marketChart;

            return {
                coinId,
                coinData,
                marketChart: chartData,
                symbol: coinData.symbol,
                name: coinData.name,
                currentPrice: coinData.market_data?.current_price?.usd,
                priceChange24h: coinData.market_data?.price_change_percentage_24h,
                marketCap: coinData.market_data?.market_cap?.usd,
                volume24h: coinData.market_data?.total_volume?.usd,
                priceHistory: chartData?.prices || [],
                volumeHistory: chartData?.total_volumes || []
            };
        } catch (error) {
            console.error('Error getting CoinGecko token analysis:', error);
            return null;
        }
    }

    /**
     * Get the complete list of coins with their IDs, names, and symbols
     */
    async getCoinsList(includeInactive: boolean = false): Promise<any> {
        try {
            const cacheKey = `coingecko_coins_list_${includeInactive ? 'inactive' : 'active'}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            console.log(`Fetching CoinGecko coins list (${includeInactive ? 'including inactive' : 'active only'})`);

            const url = new URL(`${this.API_BASE_URL}/coins/list`);
            if (includeInactive) {
                url.searchParams.append('include_platform', 'false');
                url.searchParams.append('status', 'inactive');
            }

            const response = await fetch(url.toString());
            if (!response.ok) {
                throw new Error(`CoinGecko coins list API error: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Got coins list:`, data.length || 0, 'coins');

            await this.setCachedData(cacheKey, data, 86400); // 24 hours cache
            return data;
        } catch (error) {
            console.error('Error fetching CoinGecko coins list:', error);
            return null;
        }
    }

    /**
     * Get the complete list of coins with their IDs, names, and symbols (Pro API)
     */
    async getCoinsListPro(includeInactive: boolean = false): Promise<any> {
        if (!this.apiKey) {
            console.warn('CoinGecko API key required for pro coins list');
            return null;
        }

        try {
            const cacheKey = `coingecko_coins_list_pro_${includeInactive ? 'inactive' : 'active'}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            console.log(`Fetching CoinGecko pro coins list (${includeInactive ? 'including inactive' : 'active only'})`);

            const url = new URL(`${this.PRO_API_BASE_URL}/coins/list`);
            url.searchParams.append('include_platform', 'false');
            if (includeInactive) {
                url.searchParams.append('status', 'inactive');
            }
            url.searchParams.append('x_cg_pro_api_key', this.apiKey);

            const response = await fetch(url.toString());
            if (!response.ok) {
                throw new Error(`CoinGecko pro coins list API error: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Got pro coins list:`, data.length || 0, 'coins');

            await this.setCachedData(cacheKey, data, 86400); // 24 hours cache
            return data;
        } catch (error) {
            console.error('Error fetching CoinGecko pro coins list:', error);
            return null;
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
            await this.runtime.setCache(key, data);
        } catch (error) {
            console.error('Failed to cache CoinGecko data:', error);
        }
    }
} 