import type { IAgentRuntime } from '@elizaos/core';
import { logger, Service } from '@elizaos/core';
import {
    calculateMACD,
    calculateRSI,
    calculateBollingerBands,
    calculateVolumeIndicators,
    generateSignals
} from '../utils/technicalAnalysis';

export class TechnicalAnalysisService extends Service {
    private isRunning = false;
    static serviceType = 'TECHNICAL_ANALYSIS_SERVICE';

    capabilityDescription = 'Technical analysis service for calculating indicators and signals';

    constructor(runtime: IAgentRuntime) {
        super(runtime);
    }

    /**
     * Get technical indicators for a token using Birdeye data
     */
    async getTechnicalIndicators(tokenAddress: string, chain: string = 'solana'): Promise<any> {
        try {
            // Get Birdeye service for price data
            const birdeyeService = this.runtime.getService('birdeye');
            if (!birdeyeService) {
                logger.warn('Birdeye service not available for technical analysis');
                return this.getEmptyTechnicalIndicators();
            }

            // Get current market data
            const marketData = await birdeyeService.getTokenMarketData(tokenAddress);
            if (!marketData || marketData.price <= 0) {
                logger.warn(`No valid price data available for ${tokenAddress}`);
                return this.getEmptyTechnicalIndicators();
            }

            // Get price history for technical analysis
            const priceHistory = marketData.priceHistory || [];
            if (priceHistory.length < 50) {
                logger.warn(`Insufficient price history for ${tokenAddress}: ${priceHistory.length} points (need at least 50)`);
                return this.getEmptyTechnicalIndicators();
            }

            // Calculate technical indicators
            const technicalIndicators = await this.calculateTechnicalIndicatorsFromPrices(priceHistory);

            return {
                success: true,
                data: {
                    tokenAddress,
                    symbol: 'UNKNOWN', // Birdeye doesn't provide symbol in getTokenMarketData
                    price: marketData.price,
                    volume24h: marketData.volume24h,
                    marketCap: marketData.marketCap,
                    technicalIndicators
                }
            };

        } catch (error) {
            logger.error('Error calculating technical indicators:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                data: this.getEmptyTechnicalIndicators()
            };
        }
    }

    /**
     * Calculate technical indicators from price data
     */
    private async calculateTechnicalIndicatorsFromPrices(prices: number[]): Promise<any> {
        if (prices.length < 50) {
            return this.getEmptyTechnicalIndicators();
        }

        // Calculate MACD
        const macdResult = calculateMACD(prices);
        const currentMACD = macdResult.macd[macdResult.macd.length - 1] || 0;
        const currentSignal = macdResult.signal[macdResult.signal.length - 1] || 0;
        const currentHistogram = macdResult.histogram[macdResult.histogram.length - 1] || 0;

        // Calculate RSI
        const rsiResult = calculateRSI(prices);
        const currentRSI = rsiResult[rsiResult.length - 1] || 50;

        // Calculate Bollinger Bands
        const bbResult = calculateBollingerBands(prices);
        const currentBB = {
            upper: bbResult.upper[bbResult.upper.length - 1] || 0,
            middle: bbResult.middle[bbResult.middle.length - 1] || 0,
            lower: bbResult.lower[bbResult.lower.length - 1] || 0,
            bandwidth: bbResult.bandwidth[bbResult.bandwidth.length - 1] || 0,
            percentB: bbResult.percentB[bbResult.percentB.length - 1] || 0.5
        };

        // Calculate Moving Averages
        const sma20 = this.calculateSMA(prices, 20);
        const sma50 = this.calculateSMA(prices, 50);
        const sma200 = this.calculateSMA(prices, 200);
        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);

        // Calculate Volume indicators (using price as proxy for volume since we don't have volume data)
        const volumeResult = calculateVolumeIndicators(prices, prices); // Using prices as proxy for volumes

        return {
            macd: {
                macd: currentMACD,
                signal: currentSignal,
                histogram: currentHistogram,
                bullish: currentMACD > currentSignal
            },
            rsi: {
                value: currentRSI,
                overbought: currentRSI > 70,
                oversold: currentRSI < 30
            },
            bollingerBands: currentBB,
            movingAverages: {
                sma20: sma20[sma20.length - 1] || 0,
                sma50: sma50[sma50.length - 1] || 0,
                sma200: sma200[sma200.length - 1] || 0,
                ema12: ema12[ema12.length - 1] || 0,
                ema26: ema26[ema26.length - 1] || 0
            },
            volume: {
                volumeSMA: volumeResult.volumeSMA[volumeResult.volumeSMA.length - 1] || 0,
                volumeRatio: volumeResult.volumeRatio[volumeResult.volumeRatio.length - 1] || 1,
                onBalanceVolume: volumeResult.onBalanceVolume[volumeResult.onBalanceVolume.length - 1] || 0
            }
        };
    }

    /**
     * Get empty technical indicators when data is insufficient
     */
    private getEmptyTechnicalIndicators() {
        return {
            macd: { macd: 0, signal: 0, histogram: 0, bullish: false },
            rsi: { value: 50, overbought: false, oversold: false },
            bollingerBands: { upper: 0, middle: 0, lower: 0, bandwidth: 0, percentB: 0.5 },
            movingAverages: { sma20: 0, sma50: 0, sma200: 0, ema12: 0, ema26: 0 },
            volume: { volumeSMA: 0, volumeRatio: 1, onBalanceVolume: 0 }
        };
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
            result[period] = this.calculateSMA(prices, period);
        }
        return result;
    }

    calculateVolumeIndicators(prices: number[], volumes: number[], period: number = 20) {
        return calculateVolumeIndicators(prices, volumes, period);
    }

    generateSignals(prices: number[], volumes: number[], highs: number[], lows: number[]) {
        return generateSignals(prices, volumes, highs, lows);
    }

    /**
     * Calculate Simple Moving Average
     */
    private calculateSMA(prices: number[], period: number): number[] {
        if (prices.length < period) return [];

        const sma: number[] = [];
        for (let i = period - 1; i < prices.length; i++) {
            const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            sma.push(sum / period);
        }
        return sma;
    }

    /**
     * Calculate Exponential Moving Average
     */
    private calculateEMA(prices: number[], period: number): number[] {
        if (prices.length < period) return [];

        const ema: number[] = [];
        const multiplier = 2 / (period + 1);

        // First EMA is SMA
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += prices[i];
        }
        ema.push(sum / period);

        // Calculate EMA for remaining prices
        for (let i = period; i < prices.length; i++) {
            const currentEMA = (prices[i] * multiplier) + (ema[ema.length - 1] * (1 - multiplier));
            ema.push(currentEMA);
        }

        return ema;
    }

    /**
     * Start the technical analysis service with the given runtime.
     * @param {IAgentRuntime} runtime - The agent runtime
     * @returns {Promise<TechnicalAnalysisService>} - The started technical analysis service
     */
    static async start(runtime: IAgentRuntime) {
        const service = new TechnicalAnalysisService(runtime);
        service.start();
        return service;
    }

    /**
     * Stops the Technical Analysis service associated with the given runtime.
     *
     * @param {IAgentRuntime} runtime The runtime to stop the service for.
     * @throws {Error} When the Technical Analysis service is not found.
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
            logger.warn('TECHNICAL_ANALYSIS_SERVICE service is already running');
            return;
        }

        try {
            logger.info('Starting TECHNICAL_ANALYSIS_SERVICE...');

            this.isRunning = true;
            logger.info('TECHNICAL_ANALYSIS_SERVICE service started successfully');
        } catch (error) {
            logger.error('Error starting TECHNICAL_ANALYSIS_SERVICE service:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('TECHNICAL_ANALYSIS_SERVICE service is not running');
            return;
        }

        try {
            logger.info('Stopping TECHNICAL_ANALYSIS_SERVICE service...');

            this.isRunning = false;
            logger.info('TECHNICAL_ANALYSIS_SERVICE stopped successfully');
        } catch (error) {
            logger.error('Error stopping TECHNICAL_ANALYSIS_SERVICE service:', error);
            throw error;
        }
    }

    isServiceRunning(): boolean {
        return this.isRunning;
    }
} 