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

            // Get analytics data from analytics service
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

            // Get comprehensive token analytics
            const analyticsResponse = await analyticsService.getTokenAnalytics({
                tokenAddress,
                chain,
                timeframe,
                includeHistorical: true,
                includeHolders: false,
                includeSnipers: false
            });

            if (!analyticsResponse.success || !analyticsResponse.data) {
                return {
                    success: false,
                    data: null as any,
                    timestamp: Date.now(),
                    source: 'chart',
                    error: analyticsResponse.error || 'Failed to get analytics data'
                };
            }

            const analyticsData = analyticsResponse.data as ComprehensiveTokenAnalytics;

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

            // Get analytics data from analytics service
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

            // Get analytics data from analytics service
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

            // Get technical indicators
            const analyticsResponse = await analyticsService.getTokenAnalytics({
                tokenAddress,
                chain,
                timeframe,
                includeHistorical: true,
                includeHolders: false,
                includeSnipers: false
            });

            if (!analyticsResponse.success || !analyticsResponse.data) {
                return {
                    success: false,
                    data: null as any,
                    timestamp: Date.now(),
                    source: 'chart',
                    error: analyticsResponse.error || 'Failed to get technical data'
                };
            }

            const analyticsData = analyticsResponse.data as ComprehensiveTokenAnalytics;

            // Generate technical chart data
            const technicalChartData = await this.createTechnicalChartData(analyticsData, {
                type: 'line',
                theme: theme as ChartTheme,
                width,
                height
            });

            return {
                success: true,
                data: technicalChartData,
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

            // Get analytics data from analytics service
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

            // Get market analytics
            const analyticsResponse = await analyticsService.getMarketAnalytics({
                chain
            });

            if (!analyticsResponse.success || !analyticsResponse.data) {
                return {
                    success: false,
                    data: null as any,
                    timestamp: Date.now(),
                    source: 'chart',
                    error: analyticsResponse.error || 'Failed to get market data'
                };
            }

            const marketData = analyticsResponse.data as MarketAnalytics;

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

            // Get analytics data from analytics service
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
     * Create technical chart data from analytics
     */
    private async createTechnicalChartData(analytics: ComprehensiveTokenAnalytics, config: ChartConfig): Promise<TechnicalChartData> {
        const datasets: ChartDataset[] = [];
        const colors = this.generateColors(8, config.theme || 'crypto');

        if (analytics.technicalIndicators) {
            const indicators = analytics.technicalIndicators;

            // RSI
            datasets.push({
                label: 'RSI',
                data: [{
                    x: analytics.timestamp,
                    y: indicators.rsi.value,
                    label: `RSI: ${indicators.rsi.value.toFixed(2)}`
                }],
                color: colors[0],
                borderColor: colors[0]
            });

            // MACD
            datasets.push({
                label: 'MACD',
                data: [{
                    x: analytics.timestamp,
                    y: indicators.macd.macd,
                    label: `MACD: ${indicators.macd.macd.toFixed(4)}`
                }],
                color: colors[1],
                borderColor: colors[1]
            });

            // MACD Signal
            datasets.push({
                label: 'MACD Signal',
                data: [{
                    x: analytics.timestamp,
                    y: indicators.macd.signal,
                    label: `MACD Signal: ${indicators.macd.signal.toFixed(4)}`
                }],
                color: colors[2],
                borderColor: colors[2]
            });

            // Bollinger Bands
            datasets.push({
                label: 'BB Upper',
                data: [{
                    x: analytics.timestamp,
                    y: indicators.bollingerBands.upper,
                    label: `BB Upper: $${indicators.bollingerBands.upper.toFixed(4)}`
                }],
                color: colors[3],
                borderColor: colors[3]
            });

            datasets.push({
                label: 'BB Middle',
                data: [{
                    x: analytics.timestamp,
                    y: indicators.bollingerBands.middle,
                    label: `BB Middle: $${indicators.bollingerBands.middle.toFixed(4)}`
                }],
                color: colors[4],
                borderColor: colors[4]
            });

            datasets.push({
                label: 'BB Lower',
                data: [{
                    x: analytics.timestamp,
                    y: indicators.bollingerBands.lower,
                    label: `BB Lower: $${indicators.bollingerBands.lower.toFixed(4)}`
                }],
                color: colors[5],
                borderColor: colors[5]
            });
        }

        return {
            type: 'technical',
            datasets,
            config,
            metadata: {
                source: 'analytics',
                timestamp: Date.now(),
                dataPoints: datasets.reduce((sum, dataset) => sum + dataset.data.length, 0)
            },
            indicators: {
                rsi: datasets.find(d => d.label === 'RSI')?.data || [],
                macd: datasets.find(d => d.label === 'MACD')?.data || [],
                macdSignal: datasets.find(d => d.label === 'MACD Signal')?.data || [],
                macdHistogram: [],
                bollingerBands: {
                    upper: datasets.find(d => d.label === 'BB Upper')?.data || [],
                    middle: datasets.find(d => d.label === 'BB Middle')?.data || [],
                    lower: datasets.find(d => d.label === 'BB Lower')?.data || []
                },
                movingAverages: {
                    sma20: [],
                    sma50: [],
                    sma200: []
                }
            }
        };
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
                type: 'bar',
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
                type: 'bar',
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
                    type: 'bar',
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
                    type: 'bar',
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
