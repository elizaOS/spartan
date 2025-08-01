import type { IAgentRuntime } from '@elizaos/core';
import { logger, Service } from '@elizaos/core';
import { CoingeckoProvider } from '../providers/coingeckoProvider';

export class CoingeckoService extends Service {
    private isRunning = false;
    static serviceType = 'COINGECKO_SERVICE';

    capabilityDescription = 'CoinGecko data service for comprehensive token information and historical data';

    private coingeckoProvider?: CoingeckoProvider;

    constructor(runtime: IAgentRuntime) {
        super(runtime);

        try {
            console.log('Initializing CoinGecko service...');
            const apiKey = runtime.getSetting('COINGECKO_API_KEY');
            console.log('CoinGecko API key configured:', !!apiKey);

            this.coingeckoProvider = new CoingeckoProvider(runtime);
            console.log('CoinGecko provider initialized successfully');
        } catch (error) {
            console.warn('CoinGecko provider not available for data service:', error);
        }
    }

    /**
     * Get the complete list of coins with their IDs, names, and symbols
     */
    async getCoinsList(includeInactive: boolean = false): Promise<any> {
        if (!this.coingeckoProvider) {
            logger.warn('CoinGecko provider not available');
            return null;
        }

        return await this.coingeckoProvider.getCoinsList(includeInactive);
    }

    /**
     * Get the complete list of coins with their IDs, names, and symbols (Pro API)
     */
    async getCoinsListPro(includeInactive: boolean = false): Promise<any> {
        if (!this.coingeckoProvider) {
            logger.warn('CoinGecko provider not available');
            return null;
        }

        return await this.coingeckoProvider.getCoinsListPro(includeInactive);
    }

    /**
     * Search for a coin by symbol or name
     */
    async searchCoin(query: string): Promise<any> {
        if (!this.coingeckoProvider) {
            logger.warn('CoinGecko provider not available');
            return null;
        }

        return await this.coingeckoProvider.searchCoin(query);
    }

    /**
     * Get coin data by ID
     */
    async getCoinData(coinId: string): Promise<any> {
        if (!this.coingeckoProvider) {
            logger.warn('CoinGecko provider not available');
            return null;
        }

        return await this.coingeckoProvider.getCoinData(coinId);
    }

    /**
     * Get market chart data for a coin
     */
    async getMarketChart(coinId: string, days: number = 30, currency: string = 'usd'): Promise<any> {
        if (!this.coingeckoProvider) {
            logger.warn('CoinGecko provider not available');
            return null;
        }

        return await this.coingeckoProvider.getMarketChart(coinId, days, currency);
    }

    /**
     * Get OHLC (Open, High, Low, Close) data for a coin
     */
    async getOHLC(coinId: string, days: number = 30, currency: string = 'usd'): Promise<any> {
        if (!this.coingeckoProvider) {
            logger.warn('CoinGecko provider not available');
            return null;
        }

        return await this.coingeckoProvider.getOHLC(coinId, days, currency);
    }

    /**
     * Get comprehensive historical data including OHLC and market charts
     */
    async getComprehensiveHistoricalData(coinId: string, days: number = 30, currency: string = 'usd'): Promise<any> {
        if (!this.coingeckoProvider) {
            logger.warn('CoinGecko provider not available');
            return null;
        }

        return await this.coingeckoProvider.getComprehensiveHistoricalData(coinId, days, currency);
    }

    /**
     * Get historical data for a coin (paid plan feature)
     */
    async getHistoricalData(coinId: string, date: string, currency: string = 'usd'): Promise<any> {
        if (!this.coingeckoProvider) {
            logger.warn('CoinGecko provider not available');
            return null;
        }

        return await this.coingeckoProvider.getHistoricalData(coinId, date, currency);
    }

    /**
     * Get market chart range data (paid plan feature)
     */
    async getMarketChartRange(coinId: string, from: number, to: number, currency: string = 'usd'): Promise<any> {
        if (!this.coingeckoProvider) {
            logger.warn('CoinGecko provider not available');
            return null;
        }

        return await this.coingeckoProvider.getMarketChartRange(coinId, from, to, currency);
    }

    /**
     * Get contract market chart for specific contract address
     */
    async getContractMarketChart(coinId: string, contractAddress: string, days: number = 30, currency: string = 'usd'): Promise<any> {
        if (!this.coingeckoProvider) {
            logger.warn('CoinGecko provider not available');
            return null;
        }

        return await this.coingeckoProvider.getContractMarketChart(coinId, contractAddress, days, currency);
    }

    /**
     * Get contract market chart range (paid plan feature)
     */
    async getContractMarketChartRange(coinId: string, contractAddress: string, from: number, to: number, currency: string = 'usd'): Promise<any> {
        if (!this.coingeckoProvider) {
            logger.warn('CoinGecko provider not available');
            return null;
        }

        return await this.coingeckoProvider.getContractMarketChartRange(coinId, contractAddress, from, to, currency);
    }

    /**
     * Get comprehensive token analysis including historical data and market charts
     */
    async getTokenAnalysis(tokenAddress: string, symbol?: string): Promise<any> {
        if (!this.coingeckoProvider) {
            logger.warn('CoinGecko provider not available');
            return null;
        }

        return await this.coingeckoProvider.getTokenAnalysis(tokenAddress, symbol);
    }

    /**
     * Start the service
     */
    static async start(runtime: IAgentRuntime): Promise<CoingeckoService> {
        logger.log('Starting CoinGecko Service');
        const service = new CoingeckoService(runtime);
        await service.start();
        return service;
    }

    /**
     * Stop the service
     */
    static async stop(runtime: IAgentRuntime): Promise<void> {
        const service = runtime.getService('COINGECKO_SERVICE') as CoingeckoService;
        if (service) {
            await service.stop();
        }
    }

    /**
     * Start the service instance
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('CoinGecko service is already running');
            return;
        }

        this.isRunning = true;
        logger.log('CoinGecko service started');
    }

    /**
     * Stop the service instance
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('CoinGecko service is not running');
            return;
        }

        this.isRunning = false;
        logger.log('CoinGecko service stopped');
    }

    /**
     * Check if service is running
     */
    isServiceRunning(): boolean {
        return this.isRunning;
    }
} 