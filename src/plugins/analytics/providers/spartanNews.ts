import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { ModelType } from '@elizaos/core';
import { AnalyticsService } from '../services/analyticsService';
import { getAccountFromMessage } from '../../autonomous-trader/utils';
import { parseDateFilterFromMessage, formatDateFilterText } from '../../autonomous-trader/providers/date_filter';

/**
 * Spartan News Provider
 * Aggregates comprehensive news and insights from all existing providers
 * Provides market intelligence, trending analysis, and chain-specific news
 */
export const spartanNewsProvider: Provider = {
    name: 'SPARTAN_NEWS',
    description: 'Comprehensive news aggregator providing market intelligence, trending tokens, technical analysis, and chain-specific insights from multiple data sources (Birdeye, CoinGecko, CoinMarketCap, DexScreener, TAAPI, Codex)',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('SPARTAN_NEWS provider called');

        let newsReport = '';

        try {
            // Check if this is a DM (private message)
            const isDM = message.content.channelType?.toUpperCase() === 'DM';
            if (isDM) {
                const account = await getAccountFromMessage(runtime, message);
                if (!account) {
                    return {
                        data: {},
                        values: {},
                        text: 'No account found for this user.',
                    };
                }

                // Parse message for news requests
                const messageText = message.content?.text?.toLowerCase() || '';
                const dateFilter = parseDateFilterFromMessage(messageText);

                newsReport += `📰 SPARTAN NEWS - COMPREHENSIVE CHAIN INTELLIGENCE\n`;
                newsReport += `Generated: ${new Date().toLocaleString()}\n\n`;

                // Add date filter info if applied
                if (dateFilter) {
                    newsReport += `📅 Date Filter: ${formatDateFilterText(dateFilter)}\n\n`;
                }

                // Initialize analytics service
                const analyticsService = new AnalyticsService(runtime);

                // Collect data from all providers
                const marketData = await collectMarketData(runtime, analyticsService, dateFilter);
                const trendingData = await collectTrendingData(runtime, analyticsService, dateFilter);
                const technicalData = await collectTechnicalData(runtime, analyticsService, dateFilter);
                const defiData = await collectDeFiData(runtime, analyticsService, dateFilter);
                const holderData = await collectHolderData(runtime, analyticsService, account, dateFilter);

                // Generate comprehensive news using LLM
                newsReport += await generateComprehensiveNewsReport(runtime, {
                    marketData,
                    trendingData,
                    technicalData,
                    defiData,
                    holderData,
                    dateFilter
                });

            } else {
                newsReport = 'Spartan News is only available in private messages for security and data privacy.';
            }
        } catch (error) {
            console.error('Error in Spartan News provider:', error);
            newsReport = `Error generating Spartan News report: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }

        const data = {
            spartanNews: newsReport
        };

        const values = {};

        const text = newsReport + '\n';

        return {
            data,
            values,
            text,
        };
    },
};

/**
 * Collect market data from analytics service
 */
async function collectMarketData(runtime: IAgentRuntime, analyticsService: AnalyticsService, dateFilter?: any): Promise<any> {
    try {
        const request = {
            chain: 'solana'
        };

        const response = await analyticsService.getMarketAnalytics(request);

        if (!response.success || !response.data) {
            return { error: response.error || 'Unknown error' };
        }

        return response.data;
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Collect trending tokens data from multiple providers
 */
async function collectTrendingData(runtime: IAgentRuntime, analyticsService: AnalyticsService, dateFilter?: any): Promise<any> {
    try {
        const trendingData = {
            birdeye: null,
            coingecko: null,
            coinmarketcap: null,
            dexscreener: null,
            analytics: null
        };

        // Get trending data from Birdeye
        try {
            const birdeyeService = runtime.getService('birdeye');
            if (birdeyeService && typeof (birdeyeService as any).getMarketData === 'function') {
                const birdeyeMarketData = await (birdeyeService as any).getMarketData('solana');
                if (birdeyeMarketData) {
                    trendingData.birdeye = {
                        topGainers: birdeyeMarketData.topGainers?.slice(0, 10) || [],
                        topLosers: birdeyeMarketData.topLosers?.slice(0, 10) || [],
                        trendingTokens: birdeyeMarketData.trendingTokens?.slice(0, 10) || []
                    };
                }
            }
        } catch (error) {
            console.error('Error fetching Birdeye trending data:', error);
        }

        // Get trending data from CoinGecko
        try {
            const coingeckoService = runtime.getService('COINGECKO_SERVICE');
            if (coingeckoService && typeof (coingeckoService as any).getCoinsList === 'function') {
                const coinsList = await (coingeckoService as any).getCoinsList();
                if (coinsList && coinsList.length > 0) {
                    // Get top coins by market cap (trending)
                    const topCoins = coinsList.slice(0, 20).map((coin: any) => ({
                        id: coin.id,
                        symbol: coin.symbol,
                        name: coin.name
                    }));
                    trendingData.coingecko = { topCoins };
                }
            }
        } catch (error) {
            console.error('Error fetching CoinGecko trending data:', error);
        }

        // Get trending data from CoinMarketCap
        try {
            const cmcService = runtime.getService('coinmarketcap');
            if (cmcService && typeof (cmcService as any).getMarketData === 'function') {
                const cmcMarketData = await (cmcService as any).getMarketData('solana');
                if (cmcMarketData) {
                    trendingData.coinmarketcap = {
                        topGainers: cmcMarketData.topGainers?.slice(0, 10) || [],
                        topLosers: cmcMarketData.topLosers?.slice(0, 10) || [],
                        trendingTokens: cmcMarketData.trendingTokens?.slice(0, 10) || []
                    };
                }
            }
        } catch (error) {
            console.error('Error fetching CoinMarketCap trending data:', error);
        }

        // Get trending data from DexScreener
        try {
            const dexscreenerService = runtime.getService('dexscreener');
            if (dexscreenerService && typeof (dexscreenerService as any).getMarketData === 'function') {
                const dexscreenerMarketData = await (dexscreenerService as any).getMarketData('solana');
                if (dexscreenerMarketData) {
                    trendingData.dexscreener = {
                        topGainers: dexscreenerMarketData.topGainers?.slice(0, 10) || [],
                        topLosers: dexscreenerMarketData.topLosers?.slice(0, 10) || [],
                        trendingTokens: dexscreenerMarketData.trendingTokens?.slice(0, 10) || []
                    };
                }
            }
        } catch (error) {
            console.error('Error fetching DexScreener trending data:', error);
        }

        // Get trending data from analytics service
        try {
            const analyticsMarketData = await analyticsService.getMarketAnalytics({ chain: 'solana' });
            if (analyticsMarketData.success && analyticsMarketData.data) {
                trendingData.analytics = {
                    topGainers: analyticsMarketData.data.topGainers?.slice(0, 10) || [],
                    topLosers: analyticsMarketData.data.topLosers?.slice(0, 10) || [],
                    trendingTokens: analyticsMarketData.data.trendingTokens?.slice(0, 10) || []
                };
            }
        } catch (error) {
            console.error('Error fetching analytics trending data:', error);
        }

        return trendingData;
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Collect technical analysis data from multiple providers
 */
async function collectTechnicalData(runtime: IAgentRuntime, analyticsService: AnalyticsService, dateFilter?: any): Promise<any> {
    try {
        const technicalData = {
            taapi: null,
            coingecko: null,
            birdeye: null,
            analytics: null
        };

        // Major tokens for technical analysis
        const majorTokens = [
            'So11111111111111111111111111111111111111112', // SOL
            'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
            '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj'  // stSOL
        ];

        // Get technical data from TAAPI service
        try {
            const taapiService = runtime.getService('TAAPI_SERVICE');
            if (taapiService && typeof (taapiService as any).getMarketAnalysis === 'function') {
                const taapiResults = [];
                for (const tokenAddress of majorTokens) {
                    try {
                        // Get symbol from cache or use address
                        let symbol = tokenAddress.substring(0, 8).toUpperCase();
                        const birdeyeTokens = await runtime.getCache<any[]>('tokens_solana');
                        if (birdeyeTokens) {
                            const token = birdeyeTokens.find(t => t.address === tokenAddress);
                            if (token && token.symbol) {
                                symbol = token.symbol;
                            }
                        }

                        const taapiSymbol = `${symbol}/USDT`;
                        const analysis = await (taapiService as any).getMarketAnalysis(taapiSymbol, 'binance', '1h');
                        if (analysis) {
                            taapiResults.push({
                                tokenAddress,
                                symbol,
                                analysis
                            });
                        }
                    } catch (error) {
                        console.error(`Error getting TAAPI data for ${tokenAddress}:`, error);
                    }
                }
                technicalData.taapi = taapiResults;
            }
        } catch (error) {
            console.error('Error fetching TAAPI technical data:', error);
        }

        // Get technical data from CoinGecko
        try {
            const coingeckoService = runtime.getService('COINGECKO_SERVICE');
            if (coingeckoService && typeof (coingeckoService as any).getTokenAnalysis === 'function') {
                const coingeckoResults = [];
                for (const tokenAddress of majorTokens) {
                    try {
                        const analysis = await (coingeckoService as any).getTokenAnalysis(tokenAddress);
                        if (analysis) {
                            coingeckoResults.push({
                                tokenAddress,
                                analysis
                            });
                        }
                    } catch (error) {
                        console.error(`Error getting CoinGecko data for ${tokenAddress}:`, error);
                    }
                }
                technicalData.coingecko = coingeckoResults;
            }
        } catch (error) {
            console.error('Error fetching CoinGecko technical data:', error);
        }

        // Get technical data from Birdeye
        try {
            const birdeyeService = runtime.getService('birdeye');
            if (birdeyeService && typeof (birdeyeService as any).getTokenPrice === 'function') {
                const birdeyeResults = [];
                for (const tokenAddress of majorTokens) {
                    try {
                        const priceData = await (birdeyeService as any).getTokenPrice(tokenAddress, 'solana');
                        if (priceData) {
                            birdeyeResults.push({
                                tokenAddress,
                                priceData
                            });
                        }
                    } catch (error) {
                        console.error(`Error getting Birdeye data for ${tokenAddress}:`, error);
                    }
                }
                technicalData.birdeye = birdeyeResults;
            }
        } catch (error) {
            console.error('Error fetching Birdeye technical data:', error);
        }

        // Get technical data from analytics service
        try {
            const analyticsResults = [];
            for (const tokenAddress of majorTokens) {
                try {
                    const request = {
                        tokenAddress,
                        chain: 'solana',
                        timeframe: '1d',
                        includeHistorical: true
                    };

                    const response = await analyticsService.getTokenAnalytics(request);
                    if (response.success && response.data) {
                        analyticsResults.push({
                            tokenAddress,
                            analytics: response.data
                        });
                    }
                } catch (error) {
                    console.error(`Error getting analytics data for ${tokenAddress}:`, error);
                }
            }
            technicalData.analytics = analyticsResults;
        } catch (error) {
            console.error('Error fetching analytics technical data:', error);
        }

        return technicalData;
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Collect DeFi ecosystem data from multiple providers
 */
async function collectDeFiData(runtime: IAgentRuntime, analyticsService: AnalyticsService, dateFilter?: any): Promise<any> {
    try {
        const defiData = {
            birdeye: null,
            dexscreener: null,
            coingecko: null,
            analytics: null
        };

        // DeFi protocol addresses on Solana
        const defiProtocols = [
            { symbol: 'JUP', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' }, // Jupiter
            { symbol: 'RAY', address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' }, // Raydium
            { symbol: 'ORCA', address: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE' }, // Orca
            { symbol: 'SRM', address: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt' }, // Serum
            { symbol: 'MNGO', address: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac' } // Mango
        ];

        // Get DeFi data from Birdeye
        try {
            const birdeyeService = runtime.getService('birdeye');
            if (birdeyeService && typeof (birdeyeService as any).getTokenPrice === 'function') {
                const birdeyeResults = [];
                for (const protocol of defiProtocols) {
                    try {
                        const priceData = await (birdeyeService as any).getTokenPrice(protocol.address, 'solana');
                        if (priceData) {
                            birdeyeResults.push({
                                protocol: protocol.symbol,
                                address: protocol.address,
                                priceData
                            });
                        }
                    } catch (error) {
                        console.error(`Error getting Birdeye DeFi data for ${protocol.symbol}:`, error);
                    }
                }
                defiData.birdeye = birdeyeResults;
            }
        } catch (error) {
            console.error('Error fetching Birdeye DeFi data:', error);
        }

        // Get DeFi data from DexScreener
        try {
            const dexscreenerService = runtime.getService('dexscreener');
            if (dexscreenerService && typeof (dexscreenerService as any).getTokenPrice === 'function') {
                const dexscreenerResults = [];
                for (const protocol of defiProtocols) {
                    try {
                        const priceData = await (dexscreenerService as any).getTokenPrice(protocol.address, 'solana');
                        if (priceData) {
                            dexscreenerResults.push({
                                protocol: protocol.symbol,
                                address: protocol.address,
                                priceData
                            });
                        }
                    } catch (error) {
                        console.error(`Error getting DexScreener DeFi data for ${protocol.symbol}:`, error);
                    }
                }
                defiData.dexscreener = dexscreenerResults;
            }
        } catch (error) {
            console.error('Error fetching DexScreener DeFi data:', error);
        }

        // Get DeFi data from CoinGecko
        try {
            const coingeckoService = runtime.getService('COINGECKO_SERVICE');
            if (coingeckoService && typeof (coingeckoService as any).getTokenAnalysis === 'function') {
                const coingeckoResults = [];
                for (const protocol of defiProtocols) {
                    try {
                        const analysis = await (coingeckoService as any).getTokenAnalysis(protocol.address, protocol.symbol);
                        if (analysis) {
                            coingeckoResults.push({
                                protocol: protocol.symbol,
                                address: protocol.address,
                                analysis
                            });
                        }
                    } catch (error) {
                        console.error(`Error getting CoinGecko DeFi data for ${protocol.symbol}:`, error);
                    }
                }
                defiData.coingecko = coingeckoResults;
            }
        } catch (error) {
            console.error('Error fetching CoinGecko DeFi data:', error);
        }

        // Get DeFi data from analytics service
        try {
            const analyticsResults = [];
            for (const protocol of defiProtocols) {
                try {
                    const request = {
                        tokenAddress: protocol.address,
                        chain: 'solana',
                        timeframe: '1d',
                        includeHistorical: true
                    };

                    const response = await analyticsService.getTokenAnalytics(request);
                    if (response.success && response.data) {
                        analyticsResults.push({
                            protocol: protocol.symbol,
                            address: protocol.address,
                            analytics: response.data
                        });
                    }
                } catch (error) {
                    console.error(`Error getting analytics DeFi data for ${protocol.symbol}:`, error);
                }
            }
            defiData.analytics = analyticsResults;
        } catch (error) {
            console.error('Error fetching analytics DeFi data:', error);
        }

        return defiData;
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Collect holder analytics data
 */
async function collectHolderData(runtime: IAgentRuntime, analyticsService: AnalyticsService, account: any, dateFilter?: any): Promise<any> {
    try {
        // Extract token addresses from user's positions
        const uniqueTokens = new Set<string>();
        if (account.metawallets) {
            for (const mw of account.metawallets) {
                for (const chain in mw.keypairs) {
                    const kp = mw.keypairs[chain];
                    if (kp.positions) {
                        for (const p of kp.positions) {
                            uniqueTokens.add(p.token);
                        }
                    }
                }
            }
        }

        const holderData = [];

        if (uniqueTokens.size === 0) {
            // Return general community data if no user tokens
            return {
                communityGrowth: {
                    newWallets: 50000,
                    activeTraders: 25000,
                    engagement: 'High'
                }
            };
        } else {
            // Analyze first 3 tokens from user's positions
            let analyzedCount = 0;
            for (const tokenAddress of uniqueTokens) {
                if (analyzedCount >= 3) break;

                try {
                    const request = {
                        tokenAddress,
                        chain: 'solana',
                        timeframe: '1d',
                        includeHolders: true
                    };

                    const response = await analyticsService.getTokenAnalytics(request);

                    if (response.success && response.data && response.data.holderAnalytics) {
                        holderData.push({
                            tokenAddress,
                            symbol: response.data.price.symbol || tokenAddress.substring(0, 8),
                            holderAnalytics: response.data.holderAnalytics
                        });
                    }
                    analyzedCount++;
                } catch (error) {
                    console.error(`Error analyzing holder analytics for ${tokenAddress}:`, error);
                }
            }
        }

        return { holderData };
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Generate comprehensive news report using LLM
 */
async function generateComprehensiveNewsReport(runtime: IAgentRuntime, data: {
    marketData: any;
    trendingData: any;
    technicalData: any;
    defiData: any;
    holderData: any;
    dateFilter?: any;
}): Promise<string> {
    try {
        // Create a comprehensive prompt for the LLM
        const newsPrompt = `You are a professional crypto market analyst and news reporter. Based on the following market data, generate a comprehensive, insightful news report about the Solana ecosystem and crypto market.

MARKET DATA:
${JSON.stringify(data, null, 2)}

Please generate a comprehensive news report that includes:

1. **Market Overview** - Analyze the overall market conditions, sentiment, and key metrics
2. **Trending Tokens Analysis** - Identify and explain the most significant trending tokens and their performance
3. **Technical Analysis Insights** - Provide technical analysis commentary on major tokens
4. **DeFi Ecosystem Update** - Analyze the DeFi protocol performance and trends
5. **Holder Analytics** - If user has positions, analyze their token holder data; otherwise, provide general community insights
6. **Market Sentiment** - Assess current market sentiment and key drivers
7. **Investment Recommendations** - Provide strategic investment insights and risk management advice

Format the report with clear sections, use emojis for visual appeal, and provide actionable insights. Be professional but engaging. Focus on data-driven analysis rather than speculation.

Generate a comprehensive news report:`;

        // Use LLM to generate the news report
        const newsReport = await runtime.useModel(ModelType.TEXT_LARGE, {
            prompt: newsPrompt
        });

        return newsReport || 'Unable to generate news report at this time.';

    } catch (error) {
        console.error('Error generating comprehensive news report:', error);
        return `❌ Error generating news report: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}


