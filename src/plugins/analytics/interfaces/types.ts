import type { IAgentRuntime, Memory, State } from '@elizaos/core';

/**
 * Base interface for all analytics data
 */
export interface AnalyticsData {
    timestamp: number;
    source: 'birdeye' | 'coinmarketcap' | 'codex' | 'coingecko';
    chain: string;
}

/**
 * Token price data structure
 */
export interface TokenPriceData extends AnalyticsData {
    tokenAddress: string;
    symbol: string;
    price: number;
    priceChange24h: number;
    priceChangePercent24h: number;
    volume24h: number;
    marketCap: number;
    circulatingSupply?: number;
    totalSupply?: number;
}

/**
 * Historical price data for technical analysis
 */
export interface HistoricalPriceData {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/**
 * Technical indicators data
 */
export interface TechnicalIndicators {
    macd: {
        macd: number;
        signal: number;
        histogram: number;
        bullish: boolean;
    };
    rsi: {
        value: number;
        overbought: boolean;
        oversold: boolean;
    };
    bollingerBands: {
        upper: number;
        middle: number;
        lower: number;
        bandwidth: number;
        percentB: number;
    };
    movingAverages: {
        sma20: number;
        sma50: number;
        sma200: number;
        ema12: number;
        ema26: number;
    };
    volume: {
        volumeSMA: number;
        volumeRatio: number;
        onBalanceVolume: number;
    };
}

/**
 * Account analytics data
 */
export interface AccountAnalytics {
    walletAddress: string;
    totalValue: number;
    totalValueChange24h: number;
    totalValueChangePercent24h: number;
    portfolio: {
        tokenAddress: string;
        symbol: string;
        balance: number;
        value: number;
        valueChange24h: number;
        allocation: number;
    }[];
    performance: {
        totalPnL: number;
        totalPnLPercent: number;
        bestPerformer: string;
        worstPerformer: string;
        riskMetrics: {
            sharpeRatio: number;
            maxDrawdown: number;
            volatility: number;
        };
    };
    tradingHistory: {
        totalTrades: number;
        winningTrades: number;
        losingTrades: number;
        winRate: number;
        averageTradeSize: number;
    };
}

/**
 * Market analytics data
 */
export interface MarketAnalytics {
    marketCap: number;
    volume24h: number;
    dominance: number;
    fearGreedIndex?: number;
    topGainers: TokenPriceData[];
    topLosers: TokenPriceData[];
    trendingTokens: TokenPriceData[];
    marketSentiment: {
        bullish: number;
        bearish: number;
        neutral: number;
    };
}

/**
 * Token holder analytics from Codex
 */
export interface TokenHolderAnalytics {
    tokenAddress: string;
    totalHolders: number;
    holdersByAcquisition: {
        swap: number;
        transfer: number;
        airdrop: number;
    };
    holderDistribution: {
        whales: number;
        sharks: number;
        dolphins: number;
        fish: number;
        octopus: number;
        crabs: number;
        shrimps: number;
    };
    holderChange: {
        [timeframe: string]: {
            change: number;
            changePercent: number;
        };
    };
    concentrationRisk: 'low' | 'moderate' | 'high';
    communityGrowth: 'declining' | 'stable' | 'growing' | 'explosive';
}

/**
 * Sniper analytics data
 */
export interface SniperAnalytics {
    tokenAddress: string;
    activeSnipers: number;
    totalSnipedUsd: number;
    totalSoldUsd: number;
    totalProfitUsd: number;
    averageProfitPercent: number;
    topPerformers: Array<{
        walletAddress: string;
        realizedProfitUsd: number;
        realizedProfitPercent: number;
    }>;
}

/**
 * Comprehensive token analytics combining all data sources
 */
export interface ComprehensiveTokenAnalytics {
    tokenAddress: string;
    symbol: string;
    price: TokenPriceData;
    technicalIndicators: TechnicalIndicators;
    holderAnalytics?: any;
    sniperAnalytics?: any;
    riskAssessment: {
        volatility: number;
        liquidity: number;
        concentrationRisk: string;
        technicalRisk: string;
        overallRisk: 'low' | 'moderate' | 'high';
    };
    recommendations: {
        action: 'buy' | 'sell' | 'hold' | 'accumulate';
        confidence: number;
        reasons: string[];
        priceTargets: {
            shortTerm: number;
            mediumTerm: number;
            longTerm: number;
        };
    };
    timestamp: number;
    source: string;
}

/**
 * Analytics request parameters
 */
export interface AnalyticsRequest {
    tokenAddress?: string;
    walletAddress?: string;
    chain?: string;
    timeframe?: '1h' | '4h' | '1d' | '1w' | '1m' | '3m' | '6m' | '1y';
    indicators?: string[];
    includeHistorical?: boolean;
    includeHolders?: boolean;
    includeSnipers?: boolean;
    coinGeckoData?: any; // CoinGecko data for better symbol resolution
    priceHistory?: number[]; // Price history data for technical analysis
}

/**
 * Analytics response structure
 */
export interface AnalyticsResponse {
    success: boolean;
    data: ComprehensiveTokenAnalytics | AccountAnalytics | MarketAnalytics;
    timestamp: number;
    source: string;
    error?: string;
}

/**
 * Provider interface for data sources
 */
export interface DataProvider {
    name: string;
    getTokenPrice(tokenAddress: string, chain: string): Promise<TokenPriceData | null>;
    getHistoricalData(tokenAddress: string, chain: string, timeframe: string): Promise<HistoricalPriceData[]>;
    getMarketData(chain: string): Promise<MarketAnalytics | null>;
    getAccountData(walletAddress: string, chain: string): Promise<AccountAnalytics | null>;
}

/**
 * Technical analysis service interface
 */
export interface TechnicalAnalysisService {
    calculateMACD(prices: number[], fastPeriod?: number, slowPeriod?: number, signalPeriod?: number): {
        macd: number[];
        signal: number[];
        histogram: number[];
    };
    calculateRSI(prices: number[], period?: number): number[];
    calculateBollingerBands(prices: number[], period?: number, standardDeviations?: number): {
        upper: number[];
        middle: number[];
        lower: number[];
    };
    calculateMovingAverages(prices: number[], periods: number[]): { [period: number]: number[] };
    calculateVolumeIndicators(prices: number[], volumes: number[]): {
        volumeSMA: number[];
        onBalanceVolume: number[];
    };
}

/**
 * Cache interface for analytics data
 */
export interface AnalyticsCache {
    get(key: string): Promise<any | null>;
    set(key: string, data: any, ttl?: number): Promise<void>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
} 