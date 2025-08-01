import type { IAgentRuntime } from '@elizaos/core';
import { logger, Service } from '@elizaos/core';
import { TaapiProvider } from '../providers/taapiProvider';

export class TaapiService extends Service {
    private isRunning = false;
    static serviceType = 'TAAPI_SERVICE';

    capabilityDescription = 'Technical analysis service using TAAPI.IO for comprehensive indicators';

    private taapiProvider?: TaapiProvider;

    constructor(runtime: IAgentRuntime) {
        super(runtime);

        try {
            console.log('Initializing TAAPI service...');
            const apiKey = runtime.getSetting('TAAPI_API_KEY');
            console.log('TAAPI API key configured:', !!apiKey);

            this.taapiProvider = new TaapiProvider(runtime);
            console.log('TAAPI provider initialized successfully');
        } catch (error) {
            console.warn('TAAPI provider not available for technical analysis service:', error);
        }
    }

    /**
     * Get comprehensive technical indicators for a token
     */
    async getTechnicalIndicators(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        indicators: string[] = ['rsi', 'macd', 'bbands', 'sma', 'ema', 'stoch', 'adx', 'cci', 'willr', 'mfi']
    ): Promise<any> {
        if (!this.taapiProvider) {
            logger.warn('TAAPI provider not available');
            return null;
        }

        return await this.taapiProvider.getTechnicalIndicators(symbol, exchange, interval, indicators);
    }

    /**
     * Get specific indicator data
     */
    async getIndicator(
        symbol: string,
        indicator: string,
        exchange: string = 'binance',
        interval: string = '1h',
        parameters: any = {}
    ): Promise<any> {
        if (!this.taapiProvider) {
            logger.warn('TAAPI provider not available');
            return null;
        }

        return await this.taapiProvider.getIndicator(symbol, indicator, exchange, interval, parameters);
    }

    /**
     * Get RSI (Relative Strength Index)
     */
    async getRSI(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        period: number = 14
    ): Promise<any> {
        if (!this.taapiProvider) {
            logger.warn('TAAPI provider not available');
            return null;
        }

        return await this.taapiProvider.getRSI(symbol, exchange, interval, period);
    }

    /**
     * Get MACD (Moving Average Convergence Divergence)
     */
    async getMACD(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        fastPeriod: number = 12,
        slowPeriod: number = 26,
        signalPeriod: number = 9
    ): Promise<any> {
        if (!this.taapiProvider) {
            logger.warn('TAAPI provider not available');
            return null;
        }

        return await this.taapiProvider.getMACD(symbol, exchange, interval, fastPeriod, slowPeriod, signalPeriod);
    }

    /**
     * Get Bollinger Bands
     */
    async getBollingerBands(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        period: number = 20,
        stdDev: number = 2
    ): Promise<any> {
        if (!this.taapiProvider) {
            logger.warn('TAAPI provider not available');
            return null;
        }

        return await this.taapiProvider.getBollingerBands(symbol, exchange, interval, period, stdDev);
    }

    /**
     * Get Stochastic Oscillator
     */
    async getStochastic(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        kPeriod: number = 14,
        dPeriod: number = 3
    ): Promise<any> {
        if (!this.taapiProvider) {
            logger.warn('TAAPI provider not available');
            return null;
        }

        return await this.taapiProvider.getStochastic(symbol, exchange, interval, kPeriod, dPeriod);
    }

    /**
     * Get ADX (Average Directional Index)
     */
    async getADX(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        period: number = 14
    ): Promise<any> {
        if (!this.taapiProvider) {
            logger.warn('TAAPI provider not available');
            return null;
        }

        return await this.taapiProvider.getADX(symbol, exchange, interval, period);
    }

    /**
     * Get CCI (Commodity Channel Index)
     */
    async getCCI(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        period: number = 20
    ): Promise<any> {
        if (!this.taapiProvider) {
            logger.warn('TAAPI provider not available');
            return null;
        }

        return await this.taapiProvider.getCCI(symbol, exchange, interval, period);
    }

    /**
     * Get Williams %R
     */
    async getWilliamsR(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        period: number = 14
    ): Promise<any> {
        if (!this.taapiProvider) {
            logger.warn('TAAPI provider not available');
            return null;
        }

        return await this.taapiProvider.getWilliamsR(symbol, exchange, interval, period);
    }

    /**
     * Get MFI (Money Flow Index)
     */
    async getMFI(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        period: number = 14
    ): Promise<any> {
        if (!this.taapiProvider) {
            logger.warn('TAAPI provider not available');
            return null;
        }

        return await this.taapiProvider.getMFI(symbol, exchange, interval, period);
    }

    /**
     * Get Simple Moving Average
     */
    async getSMA(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        period: number = 20
    ): Promise<any> {
        if (!this.taapiProvider) {
            logger.warn('TAAPI provider not available');
            return null;
        }

        return await this.taapiProvider.getSMA(symbol, exchange, interval, period);
    }

    /**
     * Get Exponential Moving Average
     */
    async getEMA(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        period: number = 20
    ): Promise<any> {
        if (!this.taapiProvider) {
            logger.warn('TAAPI provider not available');
            return null;
        }

        return await this.taapiProvider.getEMA(symbol, exchange, interval, period);
    }

    /**
     * Get VWAP (Volume Weighted Average Price)
     */
    async getVWAP(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h'
    ): Promise<any> {
        if (!this.taapiProvider) {
            logger.warn('TAAPI provider not available');
            return null;
        }

        return await this.taapiProvider.getVWAP(symbol, exchange, interval);
    }

    /**
     * Get ATR (Average True Range)
     */
    async getATR(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        period: number = 14
    ): Promise<any> {
        if (!this.taapiProvider) {
            logger.warn('TAAPI provider not available');
            return null;
        }

        return await this.taapiProvider.getATR(symbol, exchange, interval, period);
    }

    /**
     * Get comprehensive market analysis
     */
    async getMarketAnalysis(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h'
    ): Promise<any> {
        console.log(`TAAPI service getMarketAnalysis called with symbol: ${symbol}, exchange: ${exchange}, interval: ${interval}`);

        if (!this.taapiProvider) {
            logger.warn('TAAPI provider not available');
            return null;
        }

        try {
            const result = await this.taapiProvider.getMarketAnalysis(symbol, exchange, interval);
            console.log(`TAAPI getMarketAnalysis result:`, !!result);
            return result;
        } catch (error) {
            console.error('Error in TAAPI getMarketAnalysis:', error);
            return null;
        }
    }

    /**
     * Start the TAAPI service with the given runtime.
     * @param {IAgentRuntime} runtime - The agent runtime
     * @returns {Promise<TaapiService>} - The started TAAPI service
     */
    static async start(runtime: IAgentRuntime) {
        const service = new TaapiService(runtime);
        service.start();
        return service;
    }

    /**
     * Stops the TAAPI service associated with the given runtime.
     *
     * @param {IAgentRuntime} runtime The runtime to stop the service for.
     * @throws {Error} When the TAAPI service is not found.
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
            logger.warn('TAAPI_SERVICE service is already running');
            return;
        }

        try {
            logger.info('Starting TAAPI_SERVICE...');

            this.isRunning = true;
            logger.info('TAAPI_SERVICE service started successfully');
        } catch (error) {
            logger.error('Error starting TAAPI_SERVICE service:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('TAAPI_SERVICE service is not running');
            return;
        }

        try {
            logger.info('Stopping TAAPI_SERVICE service...');

            this.isRunning = false;
            logger.info('TAAPI_SERVICE stopped successfully');
        } catch (error) {
            logger.error('Error stopping TAAPI_SERVICE service:', error);
            throw error;
        }
    }

    isServiceRunning(): boolean {
        return this.isRunning;
    }
} 