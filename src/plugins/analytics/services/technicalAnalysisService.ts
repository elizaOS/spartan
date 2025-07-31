import type { IAgentRuntime } from '@elizaos/core';
import {
    calculateMACD,
    calculateRSI,
    calculateBollingerBands,
    calculateVolumeIndicators,
    generateSignals
} from '../utils/technicalAnalysis';

export class TechnicalAnalysisService {
    private runtime: IAgentRuntime;

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
    }

    calculateMACD(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) {
        return calculateMACD(prices, fastPeriod, slowPeriod, signalPeriod);
    }

    calculateRSI(prices: number[], period: number = 14) {
        return calculateRSI(prices, period);
    }

    calculateBollingerBands(prices: number[], period: number = 20, standardDeviations: number = 2) {
        return calculateBollingerBands(prices, period, standardDeviations);
    }

    calculateMovingAverages(prices: number[], periods: number[]) {
        const result: { [period: number]: number[] } = {};
        for (const period of periods) {
            result[period] = calculateSMA(prices, period);
        }
        return result;
    }

    calculateVolumeIndicators(prices: number[], volumes: number[], period: number = 20) {
        return calculateVolumeIndicators(prices, volumes, period);
    }

    generateSignals(prices: number[], volumes: number[], highs: number[], lows: number[]) {
        return generateSignals(prices, volumes, highs, lows);
    }
}

// Helper function for SMA calculation
function calculateSMA(prices: number[], period: number): number[] {
    if (prices.length < period) return [];

    const sma: number[] = [];
    for (let i = period - 1; i < prices.length; i++) {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
    }
    return sma;
} 