import type { IAgentRuntime } from '@elizaos/core';
import { logger, Service } from '@elizaos/core';
import { BirdeyeProvider } from '../providers/birdeyeProvider';
import { CoinMarketCapProvider } from '../providers/coinmarketcapProvider';

export class MarketDataService extends Service {
    private isRunning = false;
    static serviceType = 'MARKET_DATA_SERVICE';

    capabilityDescription = 'Market data service for token prices and market information';

    private birdeyeProvider?: BirdeyeProvider;
    private coinmarketcapProvider?: CoinMarketCapProvider;

    constructor(runtime: IAgentRuntime) {
        super(runtime);

        try {
            this.birdeyeProvider = new BirdeyeProvider(runtime);
        } catch (error) {
            console.warn('Birdeye provider not available for market data service');
        }

        try {
            this.coinmarketcapProvider = new CoinMarketCapProvider(runtime);
        } catch (error) {
            console.warn('CoinMarketCap provider not available for market data service');
        }
    }

    async getMarketData(chain: string = 'solana') {
        if (chain === 'solana' && this.birdeyeProvider) {
            return await this.birdeyeProvider.getMarketData(chain);
        }

        if (this.coinmarketcapProvider) {
            return await this.coinmarketcapProvider.getMarketData(chain);
        }

        return null;
    }

    async getTokenPrice(tokenAddress: string, chain: string = 'solana') {
        if (chain === 'solana' && this.birdeyeProvider) {
            return await this.birdeyeProvider.getTokenPrice(tokenAddress, chain);
        }

        if (this.coinmarketcapProvider) {
            return await this.coinmarketcapProvider.getTokenPrice(tokenAddress, chain);
        }

        return null;
    }


    /**
     * Start the scenario service with the given runtime.
     * @param {IAgentRuntime} runtime - The agent runtime
     * @returns {Promise<ScenarioService>} - The started scenario service
     */
    static async start(runtime: IAgentRuntime) {
        const service = new MarketDataService(runtime);
        service.start();
        return service;
    }
    /**
     * Stops the Scenario service associated with the given runtime.
     *
     * @param {IAgentRuntime} runtime The runtime to stop the service for.
     * @throws {Error} When the Scenario service is not found.
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
            logger.warn('MARKET_DATA_SERVICE service is already running');
            return;
        }

        try {
            logger.info('MARKET_DATA_SERVICE trading service...');

            this.isRunning = true;
            logger.info('MARKET_DATA_SERVICE service started successfully');
        } catch (error) {
            logger.error('Error starting MARKET_DATA_SERVICE service:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('MARKET_DATA_SERVICE service is not running');
            return;
        }

        try {
            logger.info('Stopping MARKET_DATA_SERVICE service...');

            this.isRunning = false;
            logger.info('MARKET_DATA_SERVICE stopped successfully');
        } catch (error) {
            logger.error('Error stopping MARKET_DATA_SERVICE service:', error);
            throw error;
        }
    }

    isServiceRunning(): boolean {
        return this.isRunning;
    }
} 