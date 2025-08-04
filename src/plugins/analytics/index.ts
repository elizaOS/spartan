import type { Plugin } from '@elizaos/core';

// Actions
import getTokenAnalytics from './actions/getTokenAnalytics';
import getAccountAnalytics from './actions/getAccountAnalytics';
import getMarketAnalytics from './actions/getMarketAnalytics';
import getHistoricalAnalytics from './actions/getHistoricalAnalytics';
import getTechnicalIndicators from './actions/getTechnicalIndicators';

// Providers
import { analyticsProvider } from './providers/analytics';
import { marketDataProvider } from './providers/marketData';
import { technicalIndicatorsProvider } from './providers/technicalIndicators';
import { historicalDataProvider } from './providers/historicalData';

// Services
import { AnalyticsService } from './services/analyticsService';
import { MarketDataService } from './services/marketDataService';
import { TechnicalAnalysisService } from './services/technicalAnalysisService';
import { TaapiService } from './services/taapiService';
import { CoingeckoService } from './services/coingeckoService';

export const analyticsPlugin: Plugin = {
    name: 'analytics',
    description: 'Comprehensive analytics platform integrating data from multiple providers (Birdeye, CoinMarketCap, Codex, TAAPI.IO, CoinGecko) with advanced technical indicators, historical analysis, and account-specific insights',
    evaluators: [],
    providers: [
        analyticsProvider,
        marketDataProvider,
        technicalIndicatorsProvider,
        historicalDataProvider
    ],
    actions: [
        getTokenAnalytics,
        getAccountAnalytics,
        getMarketAnalytics,
        getHistoricalAnalytics,
        getTechnicalIndicators
    ],
    services: [
        AnalyticsService,
        MarketDataService,
        TechnicalAnalysisService,
        TaapiService,
        CoingeckoService
    ],
};

export default analyticsPlugin;