import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { ModelType } from '@elizaos/core';
import { AnalyticsService } from '../services/analyticsService';
import { getAccountFromMessage } from '../../autonomous-trader/utils';
import { parseDateFilterFromMessage, formatDateFilterText } from '../../autonomous-trader/providers/date_filter';
import type { ComprehensiveTokenAnalytics, MarketAnalytics } from '../interfaces/types';

/**
 * Spartan News Provider
 * Provides comprehensive news and insights for a specific token
 * Aggregates data from multiple sources for focused analysis
 */
export const spartanNewsProvider: Provider = {
    name: 'SPARTAN_NEWS',
    description: 'Token-specific news aggregator providing market intelligence, technical analysis, and insights for a specific token from multiple data sources (Birdeye, CoinGecko, CoinMarketCap, DexScreener, Codex)',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('SPARTAN_NEWS provider called');

        let newsReport = '';

        try {
            // Check if this is a DM (private message)
            const isDM = message.content.channelType?.toUpperCase() === 'DM';
            if (!isDM) {
                return {
                    data: {},
                    values: {},
                    text: 'Spartan News is only available in private messages for security and data privacy.',
                };
            }

            // Extract token address from message if available
            const messageText = message.content?.text || '';
            const tokenMatch = messageText.match(/0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}/);

            if (!tokenMatch) {
                return {
                    data: {},
                    values: {},
                    text: 'Please provide a token address to generate Spartan News analysis. Example: "spartan news 0x1234..." or "spartan news HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC"',
                };
            }

            const tokenAddress = tokenMatch[0];
            console.log(`Generating Spartan News for token ${tokenAddress}...`);

            const account = await getAccountFromMessage(runtime, message);

            // Parse message for news requests
            const dateFilter = parseDateFilterFromMessage(messageText);

            newsReport += `📰 SPARTAN NEWS - TOKEN INTELLIGENCE\n`;
            newsReport += `Token: ${tokenAddress}\n`;
            newsReport += `Generated: ${new Date().toLocaleString()}\n\n`;

            // Add date filter info if applied
            if (dateFilter) {
                newsReport += `📅 Date Filter: ${formatDateFilterText(dateFilter)}\n\n`;
            }

            // Initialize analytics service
            const analyticsService = new AnalyticsService(runtime);

            // Collect token-specific data from all providers
            const tokenData = await collectTokenData(runtime, analyticsService, tokenAddress, dateFilter);
            const marketContext = await collectMarketContext(runtime, analyticsService, dateFilter);

            let holderData = {};
            if (account) {
                holderData = await collectHolderData(runtime, analyticsService, account, tokenAddress, dateFilter);
            }

            // Generate focused news report using LLM
            newsReport += await generateTokenNewsReport(runtime, {
                tokenAddress,
                tokenData,
                marketContext,
                holderData,
                dateFilter
            });

            // Add fallback message if no data was collected
            const hasData = tokenData && Object.keys(tokenData).length > 0 ||
                           marketContext && Object.keys(marketContext).length > 0 ||
                           holderData && Object.keys(holderData).length > 0;

            if (!hasData) {
                newsReport += `\n\n⚠️ NOTE: Limited data available for this token due to API rate limits or service unavailability.\n`;
            }

        } catch (error) {
            console.error('Error in Spartan News provider:', error);
            newsReport = `❌ Error generating Spartan News report: ${error instanceof Error ? error.message : 'Unknown error'}\n\n`;
            newsReport += `🔧 This may be due to:\n`;
            newsReport += `• API rate limits\n`;
            newsReport += `• Service unavailability\n`;
            newsReport += `• Network connectivity issues\n\n`;
            newsReport += `Please try again in a few minutes.`;
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
 * Type guard to check if data is ComprehensiveTokenAnalytics
 */
function isComprehensiveTokenAnalytics(data: any): data is ComprehensiveTokenAnalytics {
    return data && typeof data === 'object' && 'tokenAddress' in data && 'price' in data && 'technicalIndicators' in data;
}

/**
 * Collect comprehensive data for a specific token
 */
async function collectTokenData(runtime: IAgentRuntime, analyticsService: AnalyticsService, tokenAddress: string, dateFilter?: any): Promise<any> {
    try {
        const tokenData: {
            coingecko: any;
            birdeye: any;
            coinmarketcap: any;
            dexscreener: any;
            analytics: any;
            taapi: any;
        } = {
            coingecko: null,
            birdeye: null,
            coinmarketcap: null,
            dexscreener: null,
            analytics: null,
            taapi: null
        };

        let tokenSymbol: string | null = null;

        // Try to get symbol from cache first
        const birdeyeTokens = await runtime.getCache<any[]>('tokens_solana');
        if (birdeyeTokens) {
            const token = birdeyeTokens.find(t => t.address === tokenAddress);
            if (token && token.symbol) {
                tokenSymbol = token.symbol;
                console.log(`Got symbol from cache: ${tokenSymbol}`);
            }
        }

        // If no symbol from cache, use fallback
        if (!tokenSymbol) {
            tokenSymbol = tokenAddress.substring(0, 8).toUpperCase();
            console.log(`Using fallback symbol: ${tokenSymbol}`);
        }

        // Get data from CoinGecko
        try {
            const coingeckoService = runtime.getService('COINGECKO_SERVICE');
            if (coingeckoService && typeof (coingeckoService as any).getTokenAnalysis === 'function') {
                // Add delay to prevent rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));

                const coingeckoData = await (coingeckoService as any).getTokenAnalysis(tokenAddress, tokenSymbol);
                if (coingeckoData) {
                    tokenData.coingecko = coingeckoData;
                    tokenSymbol = coingeckoData.symbol || tokenSymbol;
                    console.log(`Got CoinGecko data for ${tokenSymbol}`);
                }
            }
        } catch (error) {
            console.error('Error fetching CoinGecko data:', error);
        }

        // Get data from Birdeye
        try {
            const birdeyeService = runtime.getService('birdeye');
            if (birdeyeService && typeof (birdeyeService as any).getTokenMarketData === 'function') {
                const birdeyeData = await (birdeyeService as any).getTokenMarketData(tokenAddress);
                if (birdeyeData) {
                    tokenData.birdeye = birdeyeData;
                    console.log(`Got Birdeye data for ${tokenSymbol}`);
                }
            }
        } catch (error) {
            console.error('Error fetching Birdeye data:', error);
        }

        // Get data from CoinMarketCap
        try {
            const cmcService = runtime.getService('coinmarketcap');
            if (cmcService && typeof (cmcService as any).getTokenPrice === 'function') {
                const cmcData = await (cmcService as any).getTokenPrice(tokenAddress, 'solana');
                if (cmcData) {
                    tokenData.coinmarketcap = cmcData;
                    console.log(`Got CoinMarketCap data for ${tokenSymbol}`);
                }
            }
        } catch (error) {
            console.error('Error fetching CoinMarketCap data:', error);
        }

        // Get data from DexScreener
        try {
            const dexscreenerService = runtime.getService('dexscreener');
            if (dexscreenerService && typeof (dexscreenerService as any).getTokenPrice === 'function') {
                const dexscreenerData = await (dexscreenerService as any).getTokenPrice(tokenAddress, 'solana');
                if (dexscreenerData) {
                    tokenData.dexscreener = dexscreenerData;
                    console.log(`Got DexScreener data for ${tokenSymbol}`);
                }
            }
        } catch (error) {
            console.error('Error fetching DexScreener data:', error);
        }

        // Get data from analytics service
        try {
            const request = {
                tokenAddress,
                chain: 'solana',
                timeframe: '1d' as const,
                includeHistorical: true,
                includeHolders: true
            };

            const analyticsResponse = await analyticsService.getTokenAnalytics(request);
            if (analyticsResponse.success && analyticsResponse.data) {
                tokenData.analytics = analyticsResponse.data;
                console.log(`Got analytics data for ${tokenSymbol}`);
            }
        } catch (error) {
            console.error('Error fetching analytics data:', error);
        }

        // // Get technical analysis from TAAPI
        // try {
        //     const taapiService = runtime.getService('TAAPI_SERVICE');
        //     if (taapiService && typeof (taapiService as any).getMarketAnalysis === 'function' && tokenSymbol) {
        //         const taapiSymbol = `${tokenSymbol}/USDT`;
        //         const taapiData = await (taapiService as any).getMarketAnalysis(taapiSymbol, 'binance', '1h');
        //         if (taapiData) {
        //             tokenData.taapi = taapiData;
        //             console.log(`Got TAAPI data for ${taapiSymbol}`);
        //         }
        //     }
        // } catch (error) {
        //     console.error('Error fetching TAAPI data:', error);
        // }

        return tokenData;
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Collect market context data for comparison
 */
async function collectMarketContext(runtime: IAgentRuntime, analyticsService: AnalyticsService, dateFilter?: any): Promise<any> {
    try {
        const marketContext: {
            marketData: any;
            trendingData: any;
        } = {
            marketData: null,
            trendingData: null
        };

        // Get general market data
        try {
            const request = { chain: 'solana' };
            const response = await analyticsService.getMarketAnalytics(request);
            if (response.success && response.data) {
                marketContext.marketData = response.data;
            }
        } catch (error) {
            console.error('Error fetching market data:', error);
        }

        // Get trending data for context
        try {
            const trendingData: {
                birdeye: any;
                coingecko: any;
            } = {
                birdeye: null,
                coingecko: null
            };

            // Get trending from Birdeye
            const birdeyeService = runtime.getService('birdeye');
            if (birdeyeService && typeof (birdeyeService as any).getMarketData === 'function') {
                const birdeyeMarketData = await (birdeyeService as any).getMarketData('solana');
                if (birdeyeMarketData) {
                    trendingData.birdeye = {
                        topGainers: birdeyeMarketData.topGainers?.slice(0, 5) || [],
                        topLosers: birdeyeMarketData.topLosers?.slice(0, 5) || []
                    };
                }
            }

            // Get trending from CoinGecko
            const coingeckoService = runtime.getService('COINGECKO_SERVICE');
            if (coingeckoService && typeof (coingeckoService as any).getCoinsList === 'function') {
                const coinsList = await (coingeckoService as any).getCoinsList();
                if (coinsList && coinsList.length > 0) {
                    trendingData.coingecko = {
                        topCoins: coinsList.slice(0, 10).map((coin: any) => ({
                            id: coin.id,
                            symbol: coin.symbol,
                            name: coin.name
                        }))
                    };
                }
            }

            marketContext.trendingData = trendingData;
        } catch (error) {
            console.error('Error fetching trending data:', error);
        }

        return marketContext;
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Collect holder analytics data for the specific token
 */
async function collectHolderData(runtime: IAgentRuntime, analyticsService: AnalyticsService, account: any, tokenAddress: string, dateFilter?: any): Promise<any> {
    try {
        // Check if user holds this specific token
        let userHoldsToken = false;
        let userPosition = null;

        if (account.metawallets) {
            for (const mw of account.metawallets) {
                for (const chain in mw.keypairs) {
                    const kp = mw.keypairs[chain];
                    if (kp.positions) {
                        for (const p of kp.positions) {
                            if (p.token === tokenAddress) {
                                userHoldsToken = true;
                                userPosition = p;
                                break;
                            }
                        }
                    }
                }
            }
        }

        if (!userHoldsToken) {
            return {
                userHoldsToken: false,
                message: 'You do not hold this token in your portfolio.'
            };
        }

        // Get holder analytics for this specific token
        try {
            const request = {
                tokenAddress,
                chain: 'solana',
                timeframe: '1d' as const,
                includeHolders: true
            };

            const response = await analyticsService.getTokenAnalytics(request);
            if (response.success && response.data && isComprehensiveTokenAnalytics(response.data) && response.data.holderAnalytics) {
                return {
                    userHoldsToken: true,
                    userPosition,
                    holderAnalytics: response.data.holderAnalytics
                };
            }
        } catch (error) {
            console.error('Error getting holder analytics:', error);
        }

        return {
            userHoldsToken: true,
            userPosition,
            message: 'Holder analytics not available for this token.'
        };
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Generate focused token news report using LLM
 */
async function generateTokenNewsReport(runtime: IAgentRuntime, data: {
    tokenAddress: string;
    tokenData: any;
    marketContext: any;
    holderData: any;
    dateFilter?: any;
}): Promise<string> {
    try {
        // Create a focused prompt for the LLM
        const newsPrompt = `You are a professional crypto market analyst. Generate a comprehensive, focused news report for the specific token ${data.tokenAddress}.

TOKEN DATA:
${JSON.stringify(data.tokenData, null, 2)}

MARKET CONTEXT:
${JSON.stringify(data.marketContext, null, 2)}

HOLDER DATA:
${JSON.stringify(data.holderData, null, 2)}

Please generate a focused news report that includes:

1. **Token Overview** - Current price, market cap, volume, and key metrics
2. **Price Analysis** - Recent price movements, trends, and technical indicators
3. **Market Position** - How this token compares to market trends and competitors
4. **Technical Analysis** - Key technical indicators and trading signals
5. **Holder Insights** - If user holds the token, provide portfolio-specific analysis
6. **Risk Assessment** - Key risks and opportunities for this specific token
7. **Investment Outlook** - Short-term and long-term outlook with actionable insights

Format the report with clear sections, use emojis for visual appeal, and provide specific insights about this token. Be professional but engaging. Focus on data-driven analysis rather than speculation.

Generate a focused token news report:`;

        // Use LLM to generate the news report
        const newsReport = await runtime.useModel(ModelType.TEXT_LARGE, {
            prompt: newsPrompt
        });

        return newsReport || 'Unable to generate token news report at this time.';

    } catch (error) {
        console.error('Error generating token news report:', error);
        return `❌ Error generating token news report: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}




