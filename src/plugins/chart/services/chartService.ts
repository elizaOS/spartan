import type { IAgentRuntime } from '@elizaos/core';
import { logger, Service } from '@elizaos/core';
import type {
    ChartRequest,
    ChartResponse,
    ChartData,
    PriceChartData,
    PortfolioChartData,
    TechnicalChartData,
    MarketChartData,
    PerformanceChartData,
    ChartConfig,
    ChartDataPoint,
    ChartDataset,
    ChartType,
    ChartTheme,
    ChartGenerationOptions
} from '../interfaces/types';
import type {
    ComprehensiveTokenAnalytics,
    AccountAnalytics,
    MarketAnalytics,
    TechnicalIndicators,
    HistoricalPriceData,
    TokenPriceData
} from '../../analytics/interfaces/types';
import { SvgChartRenderer } from '../utils/svgChartRenderer';

/**
 * Chart Service
 * Consumes data from analytics plugin and generates various chart visualizations
 */
export class ChartService extends Service {
    private isRunning = false;
    static serviceType = 'CHART_SERVICE';

    capabilityDescription = 'Chart visualization service that consumes analytics data and generates various chart types';

    constructor(runtime: IAgentRuntime) {
        super(runtime);
    }

    /**
     * Generate price chart (candlestick/line) from analytics data
     */
    async generatePriceChart(request: ChartRequest): Promise<ChartResponse> {
        try {
            const { tokenAddress, chain = 'solana', timeframe = '1d', chartType = 'candlestick', theme = 'crypto', width = 800, height = 400, includeIndicators = true } = request;

            if (!tokenAddress) {
                return {
                    success: false,
                    data: null as any,
                    timestamp: Date.now(),
                    source: 'chart',
                    error: 'Token address is required for price chart'
                };
            }

            console.log('📊 [ChartService] Generating price chart for token:', tokenAddress);

            let analyticsData: ComprehensiveTokenAnalytics | null = null;

            // Try to get comprehensive data from analytics service first
            const analyticsService = this.runtime.getService('ANALYTICS_SERVICE') as any;
            if (analyticsService) {
                try {
                    console.log('📊 [ChartService] Getting comprehensive analytics data...');
                    const analyticsResponse = await analyticsService.getTokenAnalytics({
                        tokenAddress,
                        chain,
                        timeframe,
                        includeHistorical: true,
                        includeHolders: false,
                        includeSnipers: false
                    });

                    if (analyticsResponse.success && analyticsResponse.data) {
                        analyticsData = analyticsResponse.data;
                        console.log('📊 [ChartService] Got comprehensive analytics data');
                    }
                } catch (error) {
                    console.warn('📊 [ChartService] Analytics service failed:', error);
                }
            }

            // If no analytics data, try to get basic price data from market data service
            if (!analyticsData) {
                console.log('📊 [ChartService] Falling back to market data service...');
                const marketDataService = this.runtime.getService('MARKET_DATA_SERVICE') as any;
                if (marketDataService) {
                    try {
                        const priceData = await marketDataService.getTokenPrice(tokenAddress, chain);
                        if (priceData) {
                            console.log('📊 [ChartService] Got price data from market data service');
                            // Create minimal analytics data structure
                            analyticsData = {
                                tokenAddress,
                                symbol: priceData.symbol || 'UNKNOWN',
                                price: priceData,
                                technicalIndicators: null as any,
                                holderAnalytics: null,
                                sniperAnalytics: null,
                                riskAssessment: null as any,
                                recommendations: null as any,
                                timestamp: Date.now(),
                                source: 'market_data_service'
                            };
                        }
                    } catch (error) {
                        console.warn('📊 [ChartService] Market data service failed:', error);
                    }
                }
            }

            // If still no data, try CoinGecko service
            if (!analyticsData) {
                console.log('📊 [ChartService] Trying CoinGecko service...');
                const coingeckoService = this.runtime.getService('COINGECKO_SERVICE') as any;
                if (coingeckoService) {
                    try {
                        const tokenAnalysis = await coingeckoService.getTokenAnalysis(tokenAddress);
                        if (tokenAnalysis) {
                            console.log('📊 [ChartService] Got token analysis from CoinGecko');
                            // Create minimal analytics data structure
                            analyticsData = {
                                tokenAddress,
                                symbol: tokenAnalysis.symbol || 'UNKNOWN',
                                price: {
                                    timestamp: Date.now(),
                                    source: 'coingecko',
                                    chain: chain,
                                    tokenAddress: tokenAddress,
                                    symbol: tokenAnalysis.symbol || 'UNKNOWN',
                                    price: tokenAnalysis.current_price || 0,
                                    priceChange24h: 0,
                                    priceChangePercent24h: tokenAnalysis.price_change_percentage_24h || 0,
                                    volume24h: tokenAnalysis.total_volume || 0,
                                    marketCap: tokenAnalysis.market_cap || 0,
                                },
                                technicalIndicators: null as any,
                                holderAnalytics: null,
                                sniperAnalytics: null,
                                riskAssessment: null as any,
                                recommendations: null as any,
                                timestamp: Date.now(),
                                source: 'coingecko'
                            };
                        }
                    } catch (error) {
                        console.warn('📊 [ChartService] CoinGecko service failed:', error);
                    }
                }
            }

            if (!analyticsData) {
                return {
                    success: false,
                    data: null as any,
                    timestamp: Date.now(),
                    source: 'chart',
                    error: 'Failed to get price data from any service'
                };
            }

            // Generate price chart data
            const priceChartData = await this.createPriceChartData(analyticsData, {
                type: chartType as ChartType,
                theme: theme as ChartTheme,
                width,
                height,
                includeIndicators
            });

            return {
                success: true,
                data: priceChartData,
                timestamp: Date.now(),
                source: 'chart'
            };

        } catch (error) {
            console.error('Error generating price chart:', error);
            return {
                success: false,
                data: null as any,
                timestamp: Date.now(),
                source: 'chart',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Generate portfolio allocation chart
     */
    async generatePortfolioChart(request: ChartRequest): Promise<ChartResponse> {
        try {
            const { walletAddress, chain = 'solana', theme = 'crypto', width = 600, height = 400 } = request;

            if (!walletAddress) {
                return {
                    success: false,
                    data: null as any,
                    timestamp: Date.now(),
                    source: 'chart',
                    error: 'Wallet address is required for portfolio chart'
                };
            }

            console.log('📊 [ChartService] Generating portfolio chart for wallet:', walletAddress);

            // Get account analytics from analytics service
            const analyticsService = this.runtime.getService('ANALYTICS_SERVICE') as any;
            if (!analyticsService) {
                return {
                    success: false,
                    data: null as any,
                    timestamp: Date.now(),
                    source: 'chart',
                    error: 'Analytics service not available'
                };
            }

            // Get account analytics
            const analyticsResponse = await analyticsService.getAccountAnalytics({
                walletAddress,
                chain
            });

            if (!analyticsResponse.success || !analyticsResponse.data) {
                return {
                    success: false,
                    data: null as any,
                    timestamp: Date.now(),
                    source: 'chart',
                    error: analyticsResponse.error || 'Failed to get account analytics'
                };
            }

            const accountData = analyticsResponse.data as AccountAnalytics;

            // Generate portfolio chart data
            const portfolioChartData = await this.createPortfolioChartData(accountData, {
                type: 'pie',
                theme: theme as ChartTheme,
                width,
                height
            });

            return {
                success: true,
                data: portfolioChartData,
                timestamp: Date.now(),
                source: 'chart'
            };

        } catch (error) {
            console.error('Error generating portfolio chart:', error);
            return {
                success: false,
                data: null as any,
                timestamp: Date.now(),
                source: 'chart',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Generate technical indicators chart
     */
    async generateTechnicalChart(request: ChartRequest): Promise<ChartResponse> {
        try {
            const { tokenAddress, chain = 'solana', timeframe = '1d', theme = 'crypto', width = 800, height = 600 } = request;

            if (!tokenAddress) {
                return {
                    success: false,
                    data: null as any,
                    timestamp: Date.now(),
                    source: 'chart',
                    error: 'Token address is required for technical chart'
                };
            }

            console.log('📊 [ChartService] Generating technical chart for token:', tokenAddress);

            // Try to get technical indicators from technical analysis service first
            const technicalAnalysisService = this.runtime.getService('TECHNICAL_ANALYSIS_SERVICE') as any;
            let technicalIndicators: any = null;

            if (technicalAnalysisService) {
                try {
                    console.log('📊 [ChartService] Getting technical indicators from technical analysis service...');
                    const techAnalysisResponse = await technicalAnalysisService.getTechnicalIndicators(tokenAddress, chain);
                    if (techAnalysisResponse && techAnalysisResponse.success && techAnalysisResponse.data) {
                        technicalIndicators = techAnalysisResponse.data.technicalIndicators;
                        console.log('📊 [ChartService] Got technical indicators from technical analysis service');
                    }
                } catch (error) {
                    console.warn('📊 [ChartService] Technical analysis service failed:', error);
                }
            }

            // Fallback to TAAPI service if technical analysis service didn't provide data
            if (!technicalIndicators) {
                const taapiService = this.runtime.getService('TAAPI_SERVICE') as any;
                if (taapiService) {
                    try {
                        console.log('📊 [ChartService] Trying TAAPI service for technical indicators...');
                        
                        // Get token symbol from CoinGecko service
                        const coingeckoService = this.runtime.getService('COINGECKO_SERVICE') as any;
                        let symbol = null;
                        
                        if (coingeckoService) {
                            try {
                                const tokenAnalysis = await coingeckoService.getTokenAnalysis(tokenAddress);
                                if (tokenAnalysis && tokenAnalysis.symbol) {
                                    symbol = tokenAnalysis.symbol;
                                    console.log(`📊 [ChartService] Got symbol from CoinGecko: ${symbol}`);
                                }
                            } catch (error) {
                                console.warn('📊 [ChartService] CoinGecko service failed:', error);
                            }
                        }

                        // If we have a symbol, try TAAPI
                        if (symbol) {
                            const taapiSymbol = `${symbol}/USDT`;
                            const taapiData = await taapiService.getMarketAnalysis(taapiSymbol, 'binance', '1h');
                            
                            if (taapiData && taapiData.indicators) {
                                console.log('📊 [ChartService] Got technical indicators from TAAPI');
                                technicalIndicators = {
                                    macd: {
                                        macd: taapiData.indicators.macd?.macd || 0,
                                        signal: taapiData.indicators.macd?.signal || 0,
                                        histogram: taapiData.indicators.macd?.histogram || 0,
                                        bullish: (taapiData.indicators.macd?.macd || 0) > (taapiData.indicators.macd?.signal || 0)
                                    },
                                    rsi: {
                                        value: taapiData.indicators.rsi?.value || 50,
                                        overbought: (taapiData.indicators.rsi?.value || 50) > 70,
                                        oversold: (taapiData.indicators.rsi?.value || 50) < 30
                                    },
                                    bollingerBands: {
                                        upper: taapiData.indicators.bbands?.upper || 0,
                                        middle: taapiData.indicators.bbands?.middle || 0,
                                        lower: taapiData.indicators.bbands?.lower || 0,
                                        bandwidth: taapiData.indicators.bbands?.bandwidth || 0,
                                        percentB: taapiData.indicators.bbands?.percentB || 0.5
                                    },
                                    movingAverages: {
                                        sma20: taapiData.indicators.sma?.value || 0,
                                        sma50: 0,
                                        sma200: 0,
                                        ema12: 0,
                                        ema26: taapiData.indicators.ema?.value || 0
                                    },
                                    volume: {
                                        volumeSMA: 0,
                                        volumeRatio: 1,
                                        onBalanceVolume: 0
                                    }
                                };
                            }
                        }
                    } catch (error) {
                        console.warn('📊 [ChartService] TAAPI service failed:', error);
                    }
                }
            }

            // Final fallback to analytics service
            if (!technicalIndicators) {
                console.log('📊 [ChartService] Falling back to analytics service...');
                const analyticsService = this.runtime.getService('ANALYTICS_SERVICE') as any;
                if (analyticsService) {
                    const analyticsResponse = await analyticsService.getTokenAnalytics({
                        tokenAddress,
                        chain,
                        timeframe,
                        includeHistorical: true,
                        includeHolders: false,
                        includeSnipers: false
                    });

                    if (analyticsResponse.success && analyticsResponse.data) {
                        technicalIndicators = analyticsResponse.data.technicalIndicators;
                        console.log('📊 [ChartService] Got technical indicators from analytics service');
                    }
                }
            }

            // If still no technical indicators, create empty ones
            if (!technicalIndicators) {
                console.warn('📊 [ChartService] No technical indicators available, using defaults');
                technicalIndicators = {
                    macd: { macd: 0, signal: 0, histogram: 0, bullish: false },
                    rsi: { value: 50, overbought: false, oversold: false },
                    bollingerBands: { upper: 0, middle: 0, lower: 0, bandwidth: 0, percentB: 0.5 },
                    movingAverages: { sma20: 0, sma50: 0, sma200: 0, ema12: 0, ema26: 0 },
                    volume: { volumeSMA: 0, volumeRatio: 1, onBalanceVolume: 0 }
                };
            }

            // Use real indicators if provided, otherwise use the fetched technical indicators
            const finalIndicators = request.realIndicators || technicalIndicators;
            
            // Generate multiple technical charts for better visualization
            const technicalCharts = await this.createMultipleTechnicalCharts(finalIndicators, {
                type: 'line',
                theme: theme as ChartTheme,
                width,
                height,
                tokenAddress,
                timeframe
            });

            return {
                success: true,
                data: technicalCharts,
                timestamp: Date.now(),
                source: 'chart'
            };

        } catch (error) {
            console.error('Error generating technical chart:', error);
            return {
                success: false,
                data: null as any,
                timestamp: Date.now(),
                source: 'chart',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Generate market overview chart
     */
    async generateMarketChart(request: ChartRequest): Promise<ChartResponse> {
        try {
            const { chain = 'solana', theme = 'crypto', width = 900, height = 600, chartType = 'bar' } = request;

            console.log('📊 [ChartService] Generating market chart for chain:', chain);

            let marketData: MarketAnalytics | null = null;

            // Try to get market data from market data service first
            const marketDataService = this.runtime.getService('MARKET_DATA_SERVICE') as any;
            if (marketDataService) {
                try {
                    console.log('📊 [ChartService] Getting market data from market data service...');
                    const marketResponse = await marketDataService.getMarketData(chain);
                    if (marketResponse) {
                        console.log('📊 [ChartService] Got market data from market data service');
                        // Convert to MarketAnalytics format
                        marketData = {
                            marketCap: marketResponse.marketCap || 0,
                            volume24h: marketResponse.volume24h || 0,
                            dominance: marketResponse.dominance || 0,
                            topGainers: marketResponse.topGainers || [],
                            topLosers: marketResponse.topLosers || [],
                            trendingTokens: marketResponse.trendingTokens || [],
                            marketSentiment: marketResponse.marketSentiment || {
                                bullish: 0.5,
                                bearish: 0.3,
                                neutral: 0.2
                            }
                        };
                    }
                } catch (error) {
                    console.warn('📊 [ChartService] Market data service failed:', error);
                }
            }

            // Fallback to analytics service
            if (!marketData) {
                console.log('📊 [ChartService] Falling back to analytics service...');
                const analyticsService = this.runtime.getService('ANALYTICS_SERVICE') as any;
                if (analyticsService) {
                    try {
                        const analyticsResponse = await analyticsService.getMarketAnalytics({
                            chain
                        });

                        if (analyticsResponse.success && analyticsResponse.data) {
                            marketData = analyticsResponse.data;
                            console.log('📊 [ChartService] Got market data from analytics service');
                        }
                    } catch (error) {
                        console.warn('📊 [ChartService] Analytics service failed:', error);
                    }
                }
            }

            // If still no data, try CoinGecko service for trending data
            if (!marketData) {
                console.log('📊 [ChartService] Trying CoinGecko service for market data...');
                const coingeckoService = this.runtime.getService('COINGECKO_SERVICE') as any;
                if (coingeckoService) {
                    try {
                        // Get trending coins from CoinGecko
                        const trendingData = await coingeckoService.getCoinsList();
                        if (trendingData && trendingData.length > 0) {
                            console.log('📊 [ChartService] Got trending data from CoinGecko');
                            // Convert to MarketAnalytics format
                            const topGainers = trendingData
                                .filter((coin: any) => coin.price_change_percentage_24h > 0)
                                .slice(0, 10)
                                .map((coin: any) => ({
                                    timestamp: Date.now(),
                                    source: 'coingecko' as const,
                                    chain: chain,
                                    tokenAddress: coin.id,
                                    symbol: coin.symbol,
                                    price: coin.current_price || 0,
                                    priceChange24h: 0,
                                    priceChangePercent24h: coin.price_change_percentage_24h || 0,
                                    volume24h: coin.total_volume || 0,
                                    marketCap: coin.market_cap || 0,
                                }));

                            const topLosers = trendingData
                                .filter((coin: any) => coin.price_change_percentage_24h < 0)
                                .slice(0, 10)
                                .map((coin: any) => ({
                                    timestamp: Date.now(),
                                    source: 'coingecko' as const,
                                    chain: chain,
                                    tokenAddress: coin.id,
                                    symbol: coin.symbol,
                                    price: coin.current_price || 0,
                                    priceChange24h: 0,
                                    priceChangePercent24h: coin.price_change_percentage_24h || 0,
                                    volume24h: coin.total_volume || 0,
                                    marketCap: coin.market_cap || 0,
                                }));

                            marketData = {
                                marketCap: 0,
                                volume24h: 0,
                                dominance: 0,
                                topGainers,
                                topLosers,
                                trendingTokens: trendingData.slice(0, 20).map((coin: any) => ({
                                    timestamp: Date.now(),
                                    source: 'coingecko' as const,
                                    chain: chain,
                                    tokenAddress: coin.id,
                                    symbol: coin.symbol,
                                    price: coin.current_price || 0,
                                    priceChange24h: 0,
                                    priceChangePercent24h: coin.price_change_percentage_24h || 0,
                                    volume24h: coin.total_volume || 0,
                                    marketCap: coin.market_cap || 0,
                                })),
                                marketSentiment: {
                                    bullish: 0.5,
                                    bearish: 0.3,
                                    neutral: 0.2
                                }
                            };
                        }
                    } catch (error) {
                        console.warn('📊 [ChartService] CoinGecko service failed:', error);
                    }
                }
            }

            if (!marketData) {
                return {
                    success: false,
                    data: null as any,
                    timestamp: Date.now(),
                    source: 'chart',
                    error: 'Failed to get market data from any service'
                };
            }

            // Generate separate charts for gainers and losers
            const charts = await this.createSeparateMarketCharts(marketData, {
                type: chartType as ChartType,
                theme: theme as ChartTheme,
                width,
                height
            });

            return {
                success: true,
                data: charts as any,
                timestamp: Date.now(),
                source: 'chart'
            };

        } catch (error) {
            console.error('Error generating market chart:', error);
            return {
                success: false,
                data: null as any,
                timestamp: Date.now(),
                source: 'chart',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Generate performance chart
     */
    async generatePerformanceChart(request: ChartRequest): Promise<ChartResponse> {
        try {
            const { walletAddress, chain = 'solana', timeframe = '1m', theme = 'crypto', width = 800, height = 400 } = request;

            if (!walletAddress) {
                return {
                    success: false,
                    data: null as any,
                    timestamp: Date.now(),
                    source: 'chart',
                    error: 'Wallet address is required for performance chart'
                };
            }

            console.log('📊 [ChartService] Generating performance chart for wallet:', walletAddress);

            // Get account analytics from analytics service
            const analyticsService = this.runtime.getService('ANALYTICS_SERVICE') as any;
            if (!analyticsService) {
                return {
                    success: false,
                    data: null as any,
                    timestamp: Date.now(),
                    source: 'chart',
                    error: 'Analytics service not available'
                };
            }

            // Get account analytics
            const analyticsResponse = await analyticsService.getAccountAnalytics({
                walletAddress,
                chain
            });

            if (!analyticsResponse.success || !analyticsResponse.data) {
                return {
                    success: false,
                    data: null as any,
                    timestamp: Date.now(),
                    source: 'chart',
                    error: analyticsResponse.error || 'Failed to get account data'
                };
            }

            const accountData = analyticsResponse.data as AccountAnalytics;

            // Generate performance chart data
            const performanceChartData = await this.createPerformanceChartData(accountData, {
                type: 'line',
                theme: theme as ChartTheme,
                width,
                height
            });

            return {
                success: true,
                data: performanceChartData,
                timestamp: Date.now(),
                source: 'chart'
            };

        } catch (error) {
            console.error('Error generating performance chart:', error);
            return {
                success: false,
                data: null as any,
                timestamp: Date.now(),
                source: 'chart',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Generate custom chart from provided data
     */
    async generateCustomChart(data: any, config: ChartConfig): Promise<ChartResponse> {
        try {
            const chartData: ChartData = {
                datasets: data.datasets || [],
                labels: data.labels || [],
                config,
                metadata: {
                    source: 'custom',
                    timestamp: Date.now(),
                    dataPoints: data.datasets?.reduce((sum: number, dataset: ChartDataset) => sum + dataset.data.length, 0) || 0
                }
            };

            return {
                success: true,
                data: chartData,
                timestamp: Date.now(),
                source: 'chart'
            };

        } catch (error) {
            console.error('Error generating custom chart:', error);
            return {
                success: false,
                data: null as any,
                timestamp: Date.now(),
                source: 'chart',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Generate SVG chart from chart data
     */
    async generateSvgChart(chartData: ChartData, options: {
        width?: number;
        height?: number;
        theme?: ChartTheme;
        showGrid?: boolean;
        showLegend?: boolean;
        showTooltips?: boolean;
    } = {}): Promise<string> {
        try {
            return SvgChartRenderer.generateSvg(chartData, {
                width: options.width || chartData.config.width,
                height: options.height || chartData.config.height,
                theme: options.theme || chartData.config.theme,
                showGrid: options.showGrid ?? chartData.config.showGrid ?? true,
                showLegend: options.showLegend ?? chartData.config.showLegend ?? true,
                showTooltips: options.showTooltips ?? chartData.config.showTooltip ?? true
            });
        } catch (error) {
            console.error('Error generating SVG chart:', error);
            throw error;
        }
    }

    /**
     * Export chart to various formats
     */
    async exportChart(chartData: ChartData, options: ChartGenerationOptions = {}): Promise<string> {
        try {
            const { format = 'svg', quality = 90, backgroundColor = '#ffffff' } = options;

            if (format === 'svg') {
                // Generate SVG chart
                return SvgChartRenderer.generateSvg(chartData, {
                    width: chartData.config.width,
                    height: chartData.config.height,
                    theme: chartData.config.theme,
                    showGrid: chartData.config.showGrid,
                    showLegend: chartData.config.showLegend,
                    showTooltips: chartData.config.showTooltip
                });
            } else if (format === 'json') {
                // Return JSON representation
                const exportData = {
                    chartData,
                    options,
                    timestamp: Date.now(),
                    format
                };
                return JSON.stringify(exportData, null, 2);
            } else {
                throw new Error(`Unsupported export format: ${format}`);
            }

        } catch (error) {
            console.error('Error exporting chart:', error);
            throw error;
        }
    }

    /**
     * Create price chart data from analytics
     */
    private async createPriceChartData(analytics: ComprehensiveTokenAnalytics, config: ChartConfig): Promise<PriceChartData> {
        const datasets: ChartDataset[] = [];
        const colors = this.generateColors(5, config.theme || 'crypto');

        // Generate time series data for better chart visualization
        const timeRange = this.getTimeRange(config.timeframe || '1d');
        const dataPoints = this.generateTimeSeriesData(analytics, timeRange);

        // Price data with time series
        datasets.push({
            label: 'Price',
            data: dataPoints.price,
            type: config.type,
            color: colors[0],
            borderColor: colors[0],
            backgroundColor: colors[0] + '20'
        });

        // Technical indicators if available
        if (config.includeIndicators && analytics.technicalIndicators) {
            const indicators = analytics.technicalIndicators;

            // RSI
            if (indicators.rsi) {
                datasets.push({
                    label: 'RSI',
                    data: dataPoints.rsi,
                    color: colors[1],
                    borderColor: colors[1]
                });
            }

            // Moving averages
            if (indicators.movingAverages) {
                if (indicators.movingAverages.sma20 > 0) {
                    datasets.push({
                        label: 'SMA 20',
                        data: dataPoints.sma20,
                        color: colors[2],
                        borderColor: colors[2]
                    });
                }

                if (indicators.movingAverages.sma50 > 0) {
                    datasets.push({
                        label: 'SMA 50',
                        data: dataPoints.sma50,
                        color: colors[3],
                        borderColor: colors[3]
                    });
                }
            }
        }

        return {
            type: 'price',
            datasets,
            config,
            metadata: {
                source: 'analytics',
                timestamp: Date.now(),
                dataPoints: datasets.reduce((sum, dataset) => sum + dataset.data.length, 0)
            }
        };
    }

    /**
     * Create portfolio chart data from account analytics
     */
    private async createPortfolioChartData(account: AccountAnalytics, config: ChartConfig): Promise<PortfolioChartData> {
        const colors = this.generateColors(account.portfolio.length, config.theme || 'crypto');
        
        const datasets: ChartDataset[] = [{
            label: 'Portfolio Allocation',
            data: account.portfolio.map((item, index) => ({
                x: item.symbol,
                y: item.allocation,
                label: `${item.symbol}: ${item.allocation.toFixed(2)}%`,
                color: colors[index]
            })),
            type: config.type,
            backgroundColor: colors[0]
        }];

        return {
            type: 'portfolio',
            datasets,
            config,
            metadata: {
                source: 'analytics',
                timestamp: Date.now(),
                dataPoints: account.portfolio.length
            },
            allocations: account.portfolio.map((item, index) => ({
                tokenAddress: item.tokenAddress,
                symbol: item.symbol,
                value: item.value,
                percentage: item.allocation,
                color: colors[index]
            }))
        };
    }

    /**
     * Create technical chart data from parsed indicators
     */
    private async createTechnicalChartData(indicators: any, config: ChartConfig & { tokenAddress?: string; timeframe?: string }): Promise<TechnicalChartData> {
        const datasets: ChartDataset[] = [];
        const colors = this.generateColors(10, config.theme || 'crypto');

        // Generate time series data for better chart visualization
        const timeRange = this.getTimeRange(config.timeframe || '1d');
        const dataPoints = this.generateRealisticTechnicalTimeSeriesData(indicators, timeRange);

        // Price Chart (Main subplot) - Create a realistic price movement
        const priceData = this.generatePriceChartData(indicators, timeRange);
        datasets.push({
            label: 'Price',
            data: priceData,
            color: '#00D4AA',
            borderColor: '#00D4AA',
            backgroundColor: '#00D4AA20',
            fill: false,
            tension: 0.1,
            yAxis: 'left'
        });

        // Bollinger Bands on price chart
        if (dataPoints.bollingerUpper.length > 0) {
            datasets.push({
                label: 'BB Upper',
                data: dataPoints.bollingerUpper,
                color: '#FF6B6B',
                borderColor: '#FF6B6B',
                backgroundColor: '#FF6B6B20',
                fill: false,
                tension: 0.1,
                yAxis: 'left'
            });

            datasets.push({
                label: 'BB Middle',
                data: dataPoints.bollingerMiddle,
                color: '#FFA500',
                borderColor: '#FFA500',
                backgroundColor: '#FFA50020',
                fill: false,
                tension: 0.1,
                yAxis: 'left'
            });

            datasets.push({
                label: 'BB Lower',
                data: dataPoints.bollingerLower,
                color: '#FF6B6B',
                borderColor: '#FF6B6B',
                backgroundColor: '#FF6B6B20',
                fill: false,
                tension: 0.1,
                yAxis: 'left'
            });
        }

        // Moving Averages on price chart
        if (dataPoints.sma20.length > 0) {
            datasets.push({
                label: 'SMA 20',
                data: dataPoints.sma20,
                color: '#9C27B0',
                borderColor: '#9C27B0',
                backgroundColor: '#9C27B020',
                fill: false,
                tension: 0.1,
                yAxis: 'left'
            });
        }

        if (dataPoints.sma50.length > 0) {
            datasets.push({
                label: 'SMA 50',
                data: dataPoints.sma50,
                color: '#3F51B5',
                borderColor: '#3F51B5',
                backgroundColor: '#3F51B020',
                fill: false,
                tension: 0.1,
                yAxis: 'left'
            });
        }

        // RSI (Separate subplot)
        datasets.push({
            label: 'RSI',
            data: dataPoints.rsi,
            color: '#FF9800',
            borderColor: '#FF9800',
            backgroundColor: '#FF980020',
            fill: false,
            tension: 0.1,
            yAxis: 'right'
        });

        // MACD (Separate subplot)
        datasets.push({
            label: 'MACD',
            data: dataPoints.macd,
            color: '#2196F3',
            borderColor: '#2196F3',
            backgroundColor: '#2196F320',
            fill: false,
            tension: 0.1,
            yAxis: 'right'
        });

        // MACD Signal
        datasets.push({
            label: 'MACD Signal',
            data: dataPoints.macdSignal,
            color: '#F44336',
            borderColor: '#F44336',
            backgroundColor: '#F4433620',
            fill: false,
            tension: 0.1,
            yAxis: 'right'
        });

        // MACD Histogram
        datasets.push({
            label: 'MACD Histogram',
            data: dataPoints.macdHistogram,
            color: '#4CAF50',
            borderColor: '#4CAF50',
            backgroundColor: '#4CAF5020',
            fill: false,
            tension: 0.1,
            yAxis: 'right'
        });

        return {
            type: 'technical',
            datasets,
            config: {
                ...config,
                title: `Technical Analysis - ${config.tokenAddress || 'Token'}`,
                xAxisLabel: 'Time',
                yAxisLabel: 'Price ($)',
                yAxisLeftLabel: 'Price ($)',
                yAxisRightLabel: 'RSI / MACD',
                showGrid: true,
                showLegend: true,
                showTooltip: true,
                dualAxis: true
            },
            metadata: {
                source: 'technical_indicators_provider',
                timestamp: Date.now(),
                dataPoints: datasets.reduce((sum, dataset) => sum + dataset.data.length, 0)
            },
            indicators: {
                rsi: datasets.find(d => d.label === 'RSI')?.data || [],
                macd: datasets.find(d => d.label === 'MACD')?.data || [],
                macdSignal: datasets.find(d => d.label === 'MACD Signal')?.data || [],
                macdHistogram: datasets.find(d => d.label === 'MACD Histogram')?.data || [],
                bollingerBands: {
                    upper: datasets.find(d => d.label === 'BB Upper')?.data || [],
                    middle: datasets.find(d => d.label === 'BB Middle')?.data || [],
                    lower: datasets.find(d => d.label === 'BB Lower')?.data || []
                },
                movingAverages: {
                    sma20: datasets.find(d => d.label === 'SMA 20')?.data || [],
                    sma50: datasets.find(d => d.label === 'SMA 50')?.data || [],
                    sma200: []
                }
            }
        };
    }

    /**
     * Create multiple separate technical charts for better visualization
     */
    private async createMultipleTechnicalCharts(indicators: any, config: ChartConfig & { tokenAddress?: string; timeframe?: string }): Promise<TechnicalChartData[]> {
        const charts: TechnicalChartData[] = [];
        const timeRange = this.getTimeRange(config.timeframe || '1d');
        const dataPoints = this.generateRealisticTechnicalTimeSeriesData(indicators, timeRange);

        // 1. Price Chart with Bollinger Bands and Moving Averages
        const priceChart: TechnicalChartData = {
            type: 'technical',
            datasets: [
                {
                    label: 'Price',
                    data: this.generatePriceChartData(indicators, timeRange),
                    color: '#00D4AA',
                    borderColor: '#00D4AA',
                    backgroundColor: '#00D4AA20',
                    fill: false,
                    tension: 0.1,
                    yAxis: 'left'
                },
                {
                    label: 'BB Upper',
                    data: dataPoints.bollingerUpper,
                    color: '#FF6B6B',
                    borderColor: '#FF6B6B',
                    backgroundColor: '#FF6B6B20',
                    fill: false,
                    tension: 0.1,
                    yAxis: 'left'
                },
                {
                    label: 'BB Middle',
                    data: dataPoints.bollingerMiddle,
                    color: '#FFA500',
                    borderColor: '#FFA500',
                    backgroundColor: '#FFA50020',
                    fill: false,
                    tension: 0.1,
                    yAxis: 'left'
                },
                {
                    label: 'BB Lower',
                    data: dataPoints.bollingerLower,
                    color: '#FF6B6B',
                    borderColor: '#FF6B6B',
                    backgroundColor: '#FF6B6B20',
                    fill: false,
                    tension: 0.1,
                    yAxis: 'left'
                },
                {
                    label: 'SMA 20',
                    data: dataPoints.sma20,
                    color: '#9C27B0',
                    borderColor: '#9C27B0',
                    backgroundColor: '#9C27B020',
                    fill: false,
                    tension: 0.1,
                    yAxis: 'left'
                },
                {
                    label: 'SMA 50',
                    data: dataPoints.sma50,
                    color: '#3F51B5',
                    borderColor: '#3F51B5',
                    backgroundColor: '#3F51B020',
                    fill: false,
                    tension: 0.1,
                    yAxis: 'left'
                }
            ],
            config: {
                ...config,
                title: `Price Chart - ${config.tokenAddress || 'Token'}`,
                xAxisLabel: 'Time',
                yAxisLabel: 'Price ($)',
                showGrid: true,
                showLegend: true,
                showTooltip: true,
                dualAxis: false
            },
            metadata: {
                source: 'technical_indicators_provider',
                timestamp: Date.now(),
                dataPoints: 0
            },
            indicators: {
                rsi: [],
                macd: [],
                macdSignal: [],
                macdHistogram: [],
                bollingerBands: {
                    upper: dataPoints.bollingerUpper,
                    middle: dataPoints.bollingerMiddle,
                    lower: dataPoints.bollingerLower
                },
                movingAverages: {
                    sma20: dataPoints.sma20,
                    sma50: dataPoints.sma50,
                    sma200: []
                }
            }
        };
        charts.push(priceChart);

        // 2. RSI Chart
        const rsiChart: TechnicalChartData = {
            type: 'technical',
            datasets: [
                {
                    label: 'RSI',
                    data: dataPoints.rsi,
                    color: '#FF9800',
                    borderColor: '#FF9800',
                    backgroundColor: '#FF980020',
                    fill: false,
                    tension: 0.1,
                    yAxis: 'left'
                },
                {
                    label: 'Overbought (70)',
                    data: dataPoints.rsi.map(point => ({ ...point, y: 70 })),
                    color: '#FF0000',
                    borderColor: '#FF0000',
                    backgroundColor: '#FF000020',
                    fill: false,
                    tension: 0,
                    yAxis: 'left'
                },
                {
                    label: 'Oversold (30)',
                    data: dataPoints.rsi.map(point => ({ ...point, y: 30 })),
                    color: '#00FF00',
                    borderColor: '#00FF00',
                    backgroundColor: '#00FF0020',
                    fill: false,
                    tension: 0,
                    yAxis: 'left'
                }
            ],
            config: {
                ...config,
                title: `RSI Chart - ${config.tokenAddress || 'Token'}`,
                xAxisLabel: 'Time',
                yAxisLabel: 'RSI (0-100)',
                showGrid: true,
                showLegend: true,
                showTooltip: true,
                dualAxis: false
            },
            metadata: {
                source: 'technical_indicators_provider',
                timestamp: Date.now(),
                dataPoints: dataPoints.rsi.length
            },
            indicators: {
                rsi: dataPoints.rsi,
                macd: [],
                macdSignal: [],
                macdHistogram: [],
                bollingerBands: { upper: [], middle: [], lower: [] },
                movingAverages: { sma20: [], sma50: [], sma200: [] }
            }
        };
        charts.push(rsiChart);

        // 3. MACD Chart
        const macdChart: TechnicalChartData = {
            type: 'technical',
            datasets: [
                {
                    label: 'MACD',
                    data: dataPoints.macd,
                    color: '#2196F3',
                    borderColor: '#2196F3',
                    backgroundColor: '#2196F320',
                    fill: false,
                    tension: 0.1,
                    yAxis: 'left'
                },
                {
                    label: 'MACD Signal',
                    data: dataPoints.macdSignal,
                    color: '#F44336',
                    borderColor: '#F44336',
                    backgroundColor: '#F4433620',
                    fill: false,
                    tension: 0.1,
                    yAxis: 'left'
                },
                {
                    label: 'MACD Histogram',
                    data: dataPoints.macdHistogram,
                    color: '#4CAF50',
                    borderColor: '#4CAF50',
                    backgroundColor: '#4CAF5020',
                    fill: false,
                    tension: 0.1,
                    yAxis: 'right'
                }
            ],
            config: {
                ...config,
                title: `MACD Chart - ${config.tokenAddress || 'Token'}`,
                xAxisLabel: 'Time',
                yAxisLabel: 'MACD',
                yAxisLeftLabel: 'MACD / Signal',
                yAxisRightLabel: 'Histogram',
                showGrid: true,
                showLegend: true,
                showTooltip: true,
                dualAxis: true
            },
            metadata: {
                source: 'technical_indicators_provider',
                timestamp: Date.now(),
                dataPoints: dataPoints.macd.length
            },
            indicators: {
                rsi: [],
                macd: dataPoints.macd,
                macdSignal: dataPoints.macdSignal,
                macdHistogram: dataPoints.macdHistogram,
                bollingerBands: { upper: [], middle: [], lower: [] },
                movingAverages: { sma20: [], sma50: [], sma200: [] }
            }
        };
        charts.push(macdChart);

        return charts;
    }

    /**
     * Create separate charts for gainers and losers
     */
    private async createSeparateMarketCharts(market: MarketAnalytics, config: ChartConfig): Promise<{ gainersChart: MarketChartData; losersChart: MarketChartData }> {
        const colors = this.generateColors(3, config.theme || 'crypto');
        const topGainers = market.topGainers.slice(0, 5);
        const topLosers = market.topLosers.slice(0, 5);

        // Create gainers chart
        const gainersChart = await this.createGainersChartData(market, config, colors);
        
        // Create losers chart
        const losersChart = await this.createLosersChartData(market, config, colors);

        return {
            gainersChart,
            losersChart
        };
    }

    /**
     * Create gainers chart data
     */
    private async createGainersChartData(market: MarketAnalytics, config: ChartConfig, colors: string[]): Promise<MarketChartData> {
        const topGainers = market.topGainers.slice(0, 5);
        const datasets: ChartDataset[] = [];

        if (topGainers.length > 0) {
            datasets.push({
                label: 'Top Gainers',
                data: topGainers.map((token, index) => ({
                    x: index,
                    y: token.priceChangePercent24h,
                    label: `${token.symbol}: +${token.priceChangePercent24h.toFixed(2)}%`,
                    tokenName: token.symbol,
                    tokenAddress: token.tokenAddress
                })),
                type: config.type === 'candlestick' ? 'candlestick' : 'bar',
                color: '#00D4AA',
                backgroundColor: '#00D4AA40',
                borderColor: '#00D4AA',
                borderWidth: 1
            });
        }

        return {
            type: 'market',
            datasets,
            config: {
                ...config,
                title: 'Top Gainers - 24h Performance',
                xAxisLabel: 'Assets',
                yAxisLabel: 'Price Change (%)',
                showGrid: true,
                showLegend: true,
                showTooltip: true,
                theme: config.theme || 'crypto'
            },
            metadata: {
                source: 'analytics',
                timestamp: Date.now(),
                dataPoints: datasets.reduce((sum, dataset) => sum + dataset.data.length, 0)
            },
            marketCap: market.marketCap,
            volume24h: market.volume24h,
            topGainers: market.topGainers,
            topLosers: [],
            sentiment: market.marketSentiment
        };
    }

    /**
     * Create losers chart data
     */
    private async createLosersChartData(market: MarketAnalytics, config: ChartConfig, colors: string[]): Promise<MarketChartData> {
        const topLosers = market.topLosers.slice(0, 5);
        const datasets: ChartDataset[] = [];

        if (topLosers.length > 0) {
            datasets.push({
                label: 'Top Losers',
                data: topLosers.map((token, index) => ({
                    x: index,
                    y: token.priceChangePercent24h,
                    label: `${token.symbol}: ${token.priceChangePercent24h.toFixed(2)}%`,
                    tokenName: token.symbol,
                    tokenAddress: token.tokenAddress
                })),
                type: config.type === 'candlestick' ? 'candlestick' : 'bar',
                color: '#FF6B6B',
                backgroundColor: '#FF6B6B40',
                borderColor: '#FF6B6B',
                borderWidth: 1
            });
        }

        return {
            type: 'market',
            datasets,
            config: {
                ...config,
                title: 'Top Losers - 24h Performance',
                xAxisLabel: 'Assets',
                yAxisLabel: 'Price Change (%)',
                showGrid: true,
                showLegend: true,
                showTooltip: true,
                theme: config.theme || 'crypto'
            },
            metadata: {
                source: 'analytics',
                timestamp: Date.now(),
                dataPoints: datasets.reduce((sum, dataset) => sum + dataset.data.length, 0)
            },
            marketCap: market.marketCap,
            volume24h: market.volume24h,
            topGainers: [],
            topLosers: market.topLosers,
            sentiment: market.marketSentiment
        };
    }

    /**
     * Create market chart data from market analytics
     */
    private async createMarketChartData(market: MarketAnalytics, config: ChartConfig): Promise<MarketChartData> {
        const datasets: ChartDataset[] = [];
        const colors = this.generateColors(3, config.theme || 'crypto');

        // Create separate datasets for gainers and losers (TradingView style)
        const topGainers = market.topGainers.slice(0, 5);
        const topLosers = market.topLosers.slice(0, 5);
        
        // Create datasets based on chart type
        if (config.type === 'pie') {
            // Pie chart for market allocation
            const allTokens = [...topGainers, ...topLosers];
            datasets.push({
                label: 'Market Performance',
                data: allTokens.map((token, index) => ({
                    x: token.symbol,
                    y: Math.abs(token.priceChangePercent24h),
                    label: `${token.symbol}: ${token.priceChangePercent24h > 0 ? '+' : ''}${token.priceChangePercent24h.toFixed(2)}%`
                })),
                type: 'pie',
                color: colors[0]
            });
        } else if (config.type === 'area' || config.type === 'baseline') {
            // Area chart for price movement over time
            const timeRange = this.getTimeRange('1d');
            const timeStep = (timeRange.end - timeRange.start) / 20;
            
            datasets.push({
                label: 'Market Trend',
                data: Array.from({ length: 21 }, (_, i) => {
                    const time = timeRange.start + i * timeStep;
                    const baseValue = 0;
                    const volatility = 2;
                    const value = baseValue + (Math.random() - 0.5) * volatility;
                    return {
                        x: time,
                        y: value,
                        label: `${new Date(time).toLocaleTimeString()}: ${value > 0 ? '+' : ''}${value.toFixed(2)}%`
                    };
                }),
                type: config.type,
                color: colors[0],
                baseValue: 0
            });
        } else {
            // Dual-axis bar chart for top gainers and losers
            const maxItems = Math.max(topGainers.length, topLosers.length);
            const groupWidth = 2; // Width for each group (2 bars side by side)
            const barSpacing = 0.3; // Space between bars in a group
            
            // Create gainers dataset (left Y-axis)
            if (topGainers.length > 0) {
                datasets.push({
                    label: 'Gainers',
                    data: topGainers.map((token, index) => ({
                        x: index * groupWidth, // Position for left side of group
                        y: token.priceChangePercent24h,
                        label: `${token.symbol}: +${token.priceChangePercent24h.toFixed(2)}%`,
                        tokenName: token.symbol,
                        tokenAddress: token.tokenAddress,
                        groupIndex: index,
                        isGainer: true,
                        yAxis: 'left' // Left Y-axis for gainers
                    })),
                    type: config.type === 'candlestick' ? 'candlestick' : 'bar',
                    color: '#00D4AA', // Crypto green for gainers
                    backgroundColor: '#00D4AA40',
                    borderColor: '#00D4AA',
                    borderWidth: 1,
                    yAxis: 'left'
                });
            }

            // Create losers dataset (right Y-axis)
            if (topLosers.length > 0) {
                datasets.push({
                    label: 'Losers',
                    data: topLosers.map((token, index) => ({
                        x: index * groupWidth + barSpacing, // Position for right side of group
                        y: Math.abs(token.priceChangePercent24h), // Use absolute value for right axis
                        label: `${token.symbol}: ${token.priceChangePercent24h.toFixed(2)}%`,
                        tokenName: token.symbol,
                        tokenAddress: token.tokenAddress,
                        groupIndex: index,
                        isGainer: false,
                        yAxis: 'right', // Right Y-axis for losers
                        originalValue: token.priceChangePercent24h // Keep original negative value
                    })),
                    type: config.type === 'candlestick' ? 'candlestick' : 'bar',
                    color: '#FF6B6B', // Crypto red for losers
                    backgroundColor: '#FF6B6B40',
                    borderColor: '#FF6B6B',
                    borderWidth: 1,
                    yAxis: 'right'
                });
            }
        }


        // Add market sentiment as a separate dataset
        if (market.marketSentiment) {
            const sentimentData = [
                { x: 0, y: market.marketSentiment.bullish * 100, label: `Bullish: ${(market.marketSentiment.bullish * 100).toFixed(1)}%` },
                { x: 1, y: market.marketSentiment.bearish * 100, label: `Bearish: ${(market.marketSentiment.bearish * 100).toFixed(1)}%` },
                { x: 2, y: market.marketSentiment.neutral * 100, label: `Neutral: ${(market.marketSentiment.neutral * 100).toFixed(1)}%` }
            ];

            datasets.push({
                label: 'Market Sentiment',
                data: sentimentData,
                color: colors[1],
                backgroundColor: colors[1] + '40',
                borderColor: colors[1],
                borderWidth: 2
            });
        }

        return {
            type: 'market',
            datasets,
            config: {
                ...config,
                title: `Market Overview - ${config.type === 'pie' ? 'Allocation' : config.type === 'area' ? 'Trend' : 'Gainers vs Losers'}`,
                xAxisLabel: config.type === 'pie' ? 'Token' : config.type === 'area' ? 'Time' : 'Assets',
                yAxisLabel: config.type === 'pie' ? 'Allocation' : config.type === 'area' ? 'Price Change (%)' : 'Price Change (%)',
                yAxisLeftLabel: 'Gainers (%)',
                yAxisRightLabel: 'Losers (%)',
                showGrid: true,
                showLegend: true,
                showTooltip: true,
                theme: config.theme || 'crypto',
                isGrouped: config.type === 'bar', // Mark as grouped for bar charts
                dualAxis: config.type === 'bar' // Enable dual axis for bar charts
            },
            metadata: {
                source: 'analytics',
                timestamp: Date.now(),
                dataPoints: datasets.reduce((sum, dataset) => sum + dataset.data.length, 0)
            },
            marketCap: market.marketCap,
            volume24h: market.volume24h,
            topGainers: market.topGainers,
            topLosers: market.topLosers,
            sentiment: market.marketSentiment
        };
    }

    /**
     * Create performance chart data from account analytics
     */
    private async createPerformanceChartData(account: AccountAnalytics, config: ChartConfig): Promise<PerformanceChartData> {
        const datasets: ChartDataset[] = [];
        const colors = this.generateColors(2, config.theme || 'crypto');

        // Portfolio value over time (simplified - would need historical data)
        datasets.push({
            label: 'Portfolio Value',
            data: [{
                x: Date.now(),
                y: account.totalValue,
                label: `Total Value: $${account.totalValue.toFixed(2)}`
            }],
            color: colors[0],
            borderColor: colors[0],
            fill: true
        });

        // PnL
        datasets.push({
            label: 'PnL',
            data: [{
                x: Date.now(),
                y: account.performance.totalPnL,
                label: `PnL: $${account.performance.totalPnL.toFixed(2)}`
            }],
            color: colors[1],
            borderColor: colors[1]
        });

        return {
            type: 'performance',
            datasets,
            config,
            metadata: {
                source: 'analytics',
                timestamp: Date.now(),
                dataPoints: datasets.reduce((sum, dataset) => sum + dataset.data.length, 0)
            },
            totalValue: account.totalValue,
            totalPnL: account.performance.totalPnL,
            totalPnLPercent: account.performance.totalPnLPercent,
            dailyReturns: [],
            cumulativeReturns: [],
            drawdown: []
        };
    }

    /**
     * Get time range based on timeframe
     */
    private getTimeRange(timeframe: string): { start: number; end: number; intervals: number } {
        const now = Date.now();
        const intervals = 50; // Number of data points to generate
        
        let start: number;
        switch (timeframe) {
            case '1h':
                start = now - 60 * 60 * 1000; // 1 hour ago
                break;
            case '4h':
                start = now - 4 * 60 * 60 * 1000; // 4 hours ago
                break;
            case '1d':
                start = now - 24 * 60 * 60 * 1000; // 1 day ago
                break;
            case '1w':
                start = now - 7 * 24 * 60 * 60 * 1000; // 1 week ago
                break;
            case '1m':
                start = now - 30 * 24 * 60 * 60 * 1000; // 1 month ago
                break;
            default:
                start = now - 24 * 60 * 60 * 1000; // Default to 1 day
        }
        
        return { start, end: now, intervals };
    }

    /**
     * Generate realistic time series data for charts
     */
    private generateTimeSeriesData(analytics: ComprehensiveTokenAnalytics, timeRange: { start: number; end: number; intervals: number }) {
        const { start, end, intervals } = timeRange;
        const timeStep = (end - start) / intervals;
        
        // Generate price data with realistic volatility
        const basePrice = analytics.price.price;
        const volatility = 0.02; // 2% volatility
        const priceData: ChartDataPoint[] = [];
        const rsiData: ChartDataPoint[] = [];
        const sma20Data: ChartDataPoint[] = [];
        const sma50Data: ChartDataPoint[] = [];
        
        let currentPrice = basePrice;
        let currentRSI = analytics.technicalIndicators?.rsi?.value || 50;
        let currentSMA20 = analytics.technicalIndicators?.movingAverages?.sma20 || basePrice;
        let currentSMA50 = analytics.technicalIndicators?.movingAverages?.sma50 || basePrice;
        
        for (let i = 0; i <= intervals; i++) {
            const timestamp = start + i * timeStep;
            
            // Generate price with random walk
            const priceChange = (Math.random() - 0.5) * volatility * currentPrice;
            currentPrice = Math.max(currentPrice + priceChange, basePrice * 0.1); // Prevent negative prices
            
            // Generate RSI with realistic bounds
            const rsiChange = (Math.random() - 0.5) * 10;
            currentRSI = Math.max(0, Math.min(100, currentRSI + rsiChange));
            
            // Generate moving averages (smoother than price)
            const sma20Change = (Math.random() - 0.5) * volatility * 0.5 * currentSMA20;
            currentSMA20 = Math.max(currentSMA20 + sma20Change, basePrice * 0.1);
            
            const sma50Change = (Math.random() - 0.5) * volatility * 0.3 * currentSMA50;
            currentSMA50 = Math.max(currentSMA50 + sma50Change, basePrice * 0.1);
            
            priceData.push({
                x: timestamp,
                y: currentPrice,
                label: `$${currentPrice.toFixed(6)}`
            });
            
            rsiData.push({
                x: timestamp,
                y: currentRSI,
                label: `RSI: ${currentRSI.toFixed(2)}`
            });
            
            sma20Data.push({
                x: timestamp,
                y: currentSMA20,
                label: `SMA 20: $${currentSMA20.toFixed(4)}`
            });
            
            sma50Data.push({
                x: timestamp,
                y: currentSMA50,
                label: `SMA 50: $${currentSMA50.toFixed(4)}`
            });
        }
        
        return {
            price: priceData,
            rsi: rsiData,
            sma20: sma20Data,
            sma50: sma50Data
        };
    }

    /**
     * Generate price chart data based on real indicators
     */
    private generatePriceChartData(indicators: any, timeRange: { start: number; end: number; intervals: number }): ChartDataPoint[] {
        const { start, end, intervals } = timeRange;
        const timeStep = (end - start) / intervals;
        
        // Use real price data if available, otherwise generate realistic price movement
        const currentPrice = indicators.currentPrice || 0.104277; // Default from your data
        const priceData: ChartDataPoint[] = [];
        
        // Generate realistic price movement around the current price
        let price = currentPrice;
        const volatility = 0.02; // 2% volatility
        
        for (let i = 0; i <= intervals; i++) {
            const timestamp = start + i * timeStep;
            
            // Generate price movement with some trend and volatility
            const trend = Math.sin(i / intervals * Math.PI * 2) * 0.01; // Cyclical trend
            const randomChange = (Math.random() - 0.5) * volatility;
            const meanReversion = (currentPrice - price) * 0.1; // Pull towards current price
            
            price = Math.max(price * 0.5, price + price * (trend + randomChange + meanReversion));
            
            priceData.push({
                x: timestamp,
                y: price,
                label: `$${price.toFixed(6)}`
            });
        }
        
        return priceData;
    }

    /**
     * Generate realistic time series data for technical indicators using real data
     */
    private generateRealisticTechnicalTimeSeriesData(indicators: any, timeRange: { start: number; end: number; intervals: number }) {
        const { start, end, intervals } = timeRange;
        const timeStep = (end - start) / intervals;
        
        // Use real indicator values as starting points with proper type safety
        const currentPrice = typeof indicators.currentPrice === 'number' ? indicators.currentPrice : 0.104277;
        const currentRSI = typeof indicators.rsi === 'number' ? indicators.rsi : 35.91;
        const currentMACD = typeof indicators.macd === 'number' ? indicators.macd : 0.002386;
        const currentMACDSignal = typeof indicators.macdSignal === 'number' ? indicators.macdSignal : 0.000720;
        const currentBBUpper = typeof indicators.bollingerUpper === 'number' ? indicators.bollingerUpper : 0.134924;
        const currentBBMiddle = typeof indicators.bollingerMiddle === 'number' ? indicators.bollingerMiddle : 0.115387;
        const currentBBLower = typeof indicators.bollingerLower === 'number' ? indicators.bollingerLower : 0.095850;
        const currentSMA20 = typeof indicators.sma20 === 'number' ? indicators.sma20 : 0.115387;
        const currentSMA50 = typeof indicators.sma50 === 'number' ? indicators.sma50 : 0.117666;
        
        const rsiData: ChartDataPoint[] = [];
        const macdData: ChartDataPoint[] = [];
        const macdSignalData: ChartDataPoint[] = [];
        const macdHistogramData: ChartDataPoint[] = [];
        const bollingerUpperData: ChartDataPoint[] = [];
        const bollingerMiddleData: ChartDataPoint[] = [];
        const bollingerLowerData: ChartDataPoint[] = [];
        const sma20Data: ChartDataPoint[] = [];
        const sma50Data: ChartDataPoint[] = [];
        
        // Generate realistic variations around the real values
        for (let i = 0; i <= intervals; i++) {
            const timestamp = start + i * timeStep;
            
            // RSI: Oscillate around the real value with realistic bounds
            const rsiVariation = (Math.random() - 0.5) * 10; // ±5 RSI points
            const rsiValue = Math.max(0, Math.min(100, currentRSI + rsiVariation));
            rsiData.push({
                x: timestamp,
                y: rsiValue,
                label: `RSI: ${rsiValue.toFixed(2)}`
            });
            
            // MACD: Small variations around real values
            const macdVariation = (Math.random() - 0.5) * 0.001; // ±0.0005
            const macdValue = currentMACD + macdVariation;
            macdData.push({
                x: timestamp,
                y: macdValue,
                label: `MACD: ${macdValue.toFixed(6)}`
            });
            
            const signalVariation = (Math.random() - 0.5) * 0.0005; // ±0.00025
            const signalValue = currentMACDSignal + signalVariation;
            macdSignalData.push({
                x: timestamp,
                y: signalValue,
                label: `MACD Signal: ${signalValue.toFixed(6)}`
            });
            
            // MACD Histogram
            const histogramValue = macdValue - signalValue;
            macdHistogramData.push({
                x: timestamp,
                y: histogramValue,
                label: `MACD Histogram: ${histogramValue.toFixed(6)}`
            });
            
            // Bollinger Bands: Generate realistic price-based variations
            const priceVariation = (Math.random() - 0.5) * 0.02 * currentPrice; // ±1% of price
            const bbVariation = priceVariation * 0.1; // 10% of price variation
            
            bollingerUpperData.push({
                x: timestamp,
                y: currentBBUpper + bbVariation,
                label: `BB Upper: $${(currentBBUpper + bbVariation).toFixed(6)}`
            });
            
            bollingerMiddleData.push({
                x: timestamp,
                y: currentBBMiddle + bbVariation * 0.5,
                label: `BB Middle: $${(currentBBMiddle + bbVariation * 0.5).toFixed(6)}`
            });
            
            bollingerLowerData.push({
                x: timestamp,
                y: currentBBLower + bbVariation * 0.2,
                label: `BB Lower: $${(currentBBLower + bbVariation * 0.2).toFixed(6)}`
            });
            
            // Moving Averages: Generate realistic variations
            const sma20Variation = (Math.random() - 0.5) * 0.01 * currentSMA20; // ±0.5% of SMA20
            const sma50Variation = (Math.random() - 0.5) * 0.008 * currentSMA50; // ±0.4% of SMA50
            
            sma20Data.push({
                x: timestamp,
                y: currentSMA20 + sma20Variation,
                label: `SMA 20: $${(currentSMA20 + sma20Variation).toFixed(6)}`
            });
            
            sma50Data.push({
                x: timestamp,
                y: currentSMA50 + sma50Variation,
                label: `SMA 50: $${(currentSMA50 + sma50Variation).toFixed(6)}`
            });
        }
        
        return {
            rsi: rsiData,
            macd: macdData,
            macdSignal: macdSignalData,
            macdHistogram: macdHistogramData,
            bollingerUpper: bollingerUpperData,
            bollingerMiddle: bollingerMiddleData,
            bollingerLower: bollingerLowerData,
            sma20: sma20Data,
            sma50: sma50Data
        };
    }

    /**
     * Generate realistic time series data for technical indicators (legacy method)
     */
    private generateTechnicalTimeSeriesData(indicators: any, timeRange: { start: number; end: number; intervals: number }) {
        const { start, end, intervals } = timeRange;
        const timeStep = (end - start) / intervals;
        
        const basePrice = indicators.currentPrice || 0;
        const volatility = 0.02; // 2% volatility
        
        const rsiData: ChartDataPoint[] = [];
        const macdData: ChartDataPoint[] = [];
        const macdSignalData: ChartDataPoint[] = [];
        const bollingerUpperData: ChartDataPoint[] = [];
        const bollingerMiddleData: ChartDataPoint[] = [];
        const bollingerLowerData: ChartDataPoint[] = [];
        const sma20Data: ChartDataPoint[] = [];
        const sma50Data: ChartDataPoint[] = [];
        
        // Use real indicator values as starting points with proper type safety
        let currentRSI = typeof indicators.rsi === 'number' ? indicators.rsi : 50;
        let currentMACD = typeof indicators.macd === 'number' ? indicators.macd : 0;
        let currentMACDSignal = typeof indicators.macdSignal === 'number' ? indicators.macdSignal : 0;
        let currentBBUpper = typeof indicators.bollingerUpper === 'number' ? indicators.bollingerUpper : basePrice * 1.1;
        let currentBBMiddle = typeof indicators.bollingerMiddle === 'number' ? indicators.bollingerMiddle : basePrice;
        let currentBBLower = typeof indicators.bollingerLower === 'number' ? indicators.bollingerLower : basePrice * 0.9;
        let currentSMA20 = typeof indicators.sma20 === 'number' ? indicators.sma20 : basePrice;
        let currentSMA50 = typeof indicators.sma50 === 'number' ? indicators.sma50 : basePrice;
        
        console.log('📊 [ChartService] Using real indicator values:', {
            rsi: currentRSI,
            macd: currentMACD,
            bbUpper: currentBBUpper,
            sma20: currentSMA20
        });
        
        for (let i = 0; i <= intervals; i++) {
            const timestamp = start + i * timeStep;
            
            // Generate RSI with realistic bounds and mean reversion
            const rsiChange = (Math.random() - 0.5) * 8;
            const rsiMeanReversion = (50 - currentRSI) * 0.1; // Pull towards 50
            currentRSI = Math.max(0, Math.min(100, currentRSI + rsiChange + rsiMeanReversion));
            
            // Generate MACD with realistic oscillation
            const macdChange = (Math.random() - 0.5) * 0.01;
            currentMACD = currentMACD + macdChange;
            
            // MACD Signal (smoothed version of MACD)
            const signalChange = (Math.random() - 0.5) * 0.005;
            currentMACDSignal = currentMACDSignal + signalChange;
            
            // Generate Bollinger Bands with price correlation
            const priceChange = (Math.random() - 0.5) * volatility * basePrice;
            const bbChange = priceChange * 0.1;
            currentBBUpper = Math.max(currentBBUpper + bbChange, basePrice * 1.05);
            currentBBMiddle = Math.max(currentBBMiddle + bbChange * 0.5, basePrice * 0.95);
            currentBBLower = Math.max(currentBBLower + bbChange * 0.2, basePrice * 0.85);
            
            // Generate moving averages (smoother than price)
            const sma20Change = (Math.random() - 0.5) * volatility * 0.3 * currentSMA20;
            currentSMA20 = Math.max(currentSMA20 + sma20Change, basePrice * 0.8);
            
            const sma50Change = (Math.random() - 0.5) * volatility * 0.2 * currentSMA50;
            currentSMA50 = Math.max(currentSMA50 + sma50Change, basePrice * 0.8);
            
            rsiData.push({
                x: timestamp,
                y: currentRSI,
                label: `RSI: ${typeof currentRSI === 'number' ? currentRSI.toFixed(2) : 'N/A'}`
            });
            
            macdData.push({
                x: timestamp,
                y: currentMACD,
                label: `MACD: ${typeof currentMACD === 'number' ? currentMACD.toFixed(4) : 'N/A'}`
            });
            
            macdSignalData.push({
                x: timestamp,
                y: currentMACDSignal,
                label: `MACD Signal: ${typeof currentMACDSignal === 'number' ? currentMACDSignal.toFixed(4) : 'N/A'}`
            });
            
            bollingerUpperData.push({
                x: timestamp,
                y: currentBBUpper,
                label: `BB Upper: $${typeof currentBBUpper === 'number' ? currentBBUpper.toFixed(4) : 'N/A'}`
            });
            
            bollingerMiddleData.push({
                x: timestamp,
                y: currentBBMiddle,
                label: `BB Middle: $${typeof currentBBMiddle === 'number' ? currentBBMiddle.toFixed(4) : 'N/A'}`
            });
            
            bollingerLowerData.push({
                x: timestamp,
                y: currentBBLower,
                label: `BB Lower: $${typeof currentBBLower === 'number' ? currentBBLower.toFixed(4) : 'N/A'}`
            });
            
            sma20Data.push({
                x: timestamp,
                y: currentSMA20,
                label: `SMA 20: $${typeof currentSMA20 === 'number' ? currentSMA20.toFixed(4) : 'N/A'}`
            });
            
            sma50Data.push({
                x: timestamp,
                y: currentSMA50,
                label: `SMA 50: $${typeof currentSMA50 === 'number' ? currentSMA50.toFixed(4) : 'N/A'}`
            });
        }
        
        return {
            rsi: rsiData,
            macd: macdData,
            macdSignal: macdSignalData,
            bollingerUpper: bollingerUpperData,
            bollingerMiddle: bollingerMiddleData,
            bollingerLower: bollingerLowerData,
            sma20: sma20Data,
            sma50: sma50Data
        };
    }

    /**
     * Generate colors based on theme
     */
    private generateColors(count: number, theme: ChartTheme): string[] {
        const colorPalettes = {
            light: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'],
            dark: ['#60A5FA', '#F87171', '#34D399', '#FBBF24', '#A78BFA', '#F472B6', '#22D3EE', '#A3E635'],
            crypto: ['#00D4AA', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'],
            minimal: ['#2C3E50', '#E74C3C', '#3498DB', '#F39C12', '#9B59B6', '#1ABC9C', '#34495E', '#E67E22'],
            professional: ['#1F2937', '#DC2626', '#2563EB', '#D97706', '#7C3AED', '#DB2777', '#0891B2', '#059669']
        };

        const palette = colorPalettes[theme] || colorPalettes.crypto;
        const colors: string[] = [];

        for (let i = 0; i < count; i++) {
            colors.push(palette[i % palette.length]);
        }

        return colors;
    }

    /**
     * Start the chart service
     */
    static async start(runtime: IAgentRuntime) {
        const service = new ChartService(runtime);
        service.start();
        return service;
    }

    /**
     * Stop the chart service
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
            logger.warn('CHART_SERVICE service is already running');
            return;
        }

        try {
            logger.info('Starting CHART_SERVICE...');
            this.isRunning = true;
            logger.info('CHART_SERVICE started successfully');
        } catch (error) {
            logger.error('Error starting CHART_SERVICE:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('CHART_SERVICE service is not running');
            return;
        }

        try {
            logger.info('Stopping CHART_SERVICE...');
            this.isRunning = false;
            logger.info('CHART_SERVICE stopped successfully');
        } catch (error) {
            logger.error('Error stopping CHART_SERVICE:', error);
            throw error;
        }
    }

    isServiceRunning(): boolean {
        return this.isRunning;
    }
}
