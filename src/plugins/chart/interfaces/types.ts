import type { IAgentRuntime, Memory, State } from '@elizaos/core';
import type {
    ComprehensiveTokenAnalytics,
    AccountAnalytics,
    MarketAnalytics,
    TechnicalIndicators,
    HistoricalPriceData,
    TokenPriceData
} from '../../analytics/interfaces/types';

/**
 * Chart types supported by the chart plugin
 */
export type ChartType = 
    | 'line' 
    | 'candlestick' 
    | 'bar' 
    | 'area' 
    | 'baseline'
    | 'histogram'
    | 'scatter' 
    | 'pie' 
    | 'donut' 
    | 'gauge' 
    | 'heatmap'
    | 'treemap'
    | 'radar'
    | 'polar';

/**
 * Chart themes for styling
 */
export type ChartTheme = 
    | 'light' 
    | 'dark' 
    | 'crypto' 
    | 'minimal' 
    | 'professional';

/**
 * Chart configuration options
 */
export interface ChartConfig {
    type: ChartType;
    theme?: ChartTheme;
    width?: number;
    height?: number;
    responsive?: boolean;
    animation?: boolean;
    showLegend?: boolean;
    showGrid?: boolean;
    showTooltip?: boolean;
    colors?: string[];
    title?: string;
    subtitle?: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
    yAxisLeftLabel?: string;
    yAxisRightLabel?: string;
    timeFormat?: string;
    numberFormat?: string;
    includeIndicators?: boolean;
    timeframe?: string;
    dualAxis?: boolean;
    isGrouped?: boolean;
}

/**
 * Chart data point structure
 */
export interface ChartDataPoint {
    x: number | string | Date;
    y: number;
    label?: string;
    color?: string;
    metadata?: Record<string, any>;
}

/**
 * Chart dataset structure
 */
export interface ChartDataset {
    label: string;
    data: ChartDataPoint[];
    type?: ChartType;
    color?: string;
    fill?: boolean;
    borderColor?: string;
    backgroundColor?: string;
    borderWidth?: number;
    pointRadius?: number;
    tension?: number;
    baseValue?: number;
    yAxis?: 'left' | 'right';
    metadata?: Record<string, any>;
}

/**
 * Complete chart data structure
 */
export interface ChartData {
    datasets: ChartDataset[];
    labels?: string[];
    config: ChartConfig;
    metadata?: {
        source: string;
        timestamp: number;
        dataPoints: number;
        timeRange?: {
            start: number;
            end: number;
        };
    };
}

/**
 * Price chart specific data (candlestick/line)
 */
export interface PriceChartData extends ChartData {
    type: 'price';
    ohlc?: {
        timestamp: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
    }[];
    indicators?: {
        sma20?: ChartDataPoint[];
        sma50?: ChartDataPoint[];
        sma200?: ChartDataPoint[];
        ema12?: ChartDataPoint[];
        ema26?: ChartDataPoint[];
        bollingerUpper?: ChartDataPoint[];
        bollingerMiddle?: ChartDataPoint[];
        bollingerLower?: ChartDataPoint[];
        rsi?: ChartDataPoint[];
        macd?: ChartDataPoint[];
        macdSignal?: ChartDataPoint[];
        macdHistogram?: ChartDataPoint[];
        volume?: ChartDataPoint[];
    };
}

/**
 * Portfolio allocation chart data
 */
export interface PortfolioChartData extends ChartData {
    type: 'portfolio';
    allocations: {
        tokenAddress: string;
        symbol: string;
        value: number;
        percentage: number;
        color: string;
    }[];
}

/**
 * Technical indicators chart data
 */
export interface TechnicalChartData extends ChartData {
    type: 'technical';
    indicators: {
        rsi: ChartDataPoint[];
        macd: ChartDataPoint[];
        macdSignal: ChartDataPoint[];
        macdHistogram: ChartDataPoint[];
        bollingerBands: {
            upper: ChartDataPoint[];
            middle: ChartDataPoint[];
            lower: ChartDataPoint[];
        };
        movingAverages: {
            sma20: ChartDataPoint[];
            sma50: ChartDataPoint[];
            sma200: ChartDataPoint[];
        };
    };
}

/**
 * Market overview chart data
 */
export interface MarketChartData extends ChartData {
    type: 'market';
    marketCap: number;
    volume24h: number;
    topGainers: TokenPriceData[];
    topLosers: TokenPriceData[];
    sentiment: {
        bullish: number;
        bearish: number;
        neutral: number;
    };
}

/**
 * Performance chart data
 */
export interface PerformanceChartData extends ChartData {
    type: 'performance';
    totalValue: number;
    totalPnL: number;
    totalPnLPercent: number;
    dailyReturns: ChartDataPoint[];
    cumulativeReturns: ChartDataPoint[];
    drawdown: ChartDataPoint[];
}

/**
 * Chart request parameters
 */
export interface ChartRequest {
    tokenAddress?: string;
    walletAddress?: string;
    chain?: string;
    timeframe?: '1h' | '4h' | '1d' | '1w' | '1m' | '3m' | '6m' | '1y';
    chartType?: ChartType;
    theme?: ChartTheme;
    width?: number;
    height?: number;
    includeIndicators?: boolean;
    includeVolume?: boolean;
    indicators?: string[];
    dataSource?: 'analytics' | 'market' | 'portfolio' | 'technical';
}

/**
 * Chart response structure
 */
export interface ChartResponse {
    success: boolean;
    data: ChartData | PriceChartData | PortfolioChartData | TechnicalChartData | MarketChartData | PerformanceChartData;
    timestamp: number;
    source: string;
    error?: string;
    chartUrl?: string; // URL to generated chart image
    chartHtml?: string; // HTML for embedding
}

/**
 * Chart generation options
 */
export interface ChartGenerationOptions {
    format?: 'png' | 'svg' | 'html' | 'json';
    quality?: number;
    backgroundColor?: string;
    watermark?: string;
    export?: boolean;
    embed?: boolean;
}

/**
 * Chart service interface
 */
export interface ChartService {
    generatePriceChart(request: ChartRequest): Promise<ChartResponse>;
    generatePortfolioChart(request: ChartRequest): Promise<ChartResponse>;
    generateTechnicalChart(request: ChartRequest): Promise<ChartResponse>;
    generateMarketChart(request: ChartRequest): Promise<ChartResponse>;
    generatePerformanceChart(request: ChartRequest): Promise<ChartResponse>;
    generateCustomChart(data: any, config: ChartConfig): Promise<ChartResponse>;
    exportChart(chartData: ChartData, options: ChartGenerationOptions): Promise<string>;
}

/**
 * Chart provider interface
 */
export interface ChartProvider {
    name: string;
    generateChart(data: ChartData, options?: ChartGenerationOptions): Promise<string>;
    getSupportedFormats(): string[];
    getSupportedChartTypes(): ChartType[];
}

/**
 * Chart utility functions interface
 */
export interface ChartUtils {
    formatPriceData(historicalData: HistoricalPriceData[]): ChartDataPoint[];
    formatTechnicalIndicators(indicators: TechnicalIndicators, timestamps: number[]): any;
    formatPortfolioData(accountAnalytics: AccountAnalytics): any;
    formatMarketData(marketAnalytics: MarketAnalytics): any;
    generateColors(count: number, theme: ChartTheme): string[];
    calculateChartDimensions(width?: number, height?: number): { width: number; height: number };
    validateChartData(data: any): boolean;
}

/**
 * Chart cache interface
 */
export interface ChartCache {
    get(key: string): Promise<ChartData | null>;
    set(key: string, data: ChartData, ttl?: number): Promise<void>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
    generateKey(request: ChartRequest): string;
}
