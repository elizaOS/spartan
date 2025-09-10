import type { Plugin } from '@elizaos/core';

// Actions
import { generatePriceChart } from './actions/generatePriceChart';
import { generatePortfolioChart } from './actions/generatePortfolioChart';
import { generateTechnicalChart } from './actions/generateTechnicalChart';
import { generateMarketChart } from './actions/generateMarketChart';
import { generatePerformanceChart } from './actions/generatePerformanceChart';

// Services
import { ChartService } from './services/chartService';

export const chartPlugin: Plugin = {
    name: 'chart',
    description: 'Chart visualization plugin that consumes data from the analytics plugin to generate various chart types including price charts, portfolio allocation, technical indicators, market overview, and performance charts',
    evaluators: [],
    providers: [],
    actions: [
        generatePriceChart,
        generatePortfolioChart,
        generateTechnicalChart,
        generateMarketChart,
        generatePerformanceChart
    ],
    services: [
        ChartService
    ],
};

export default chartPlugin;
