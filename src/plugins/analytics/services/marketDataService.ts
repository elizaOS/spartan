import type { IAgentRuntime } from '@elizaos/core';
import { BirdeyeProvider } from '../providers/birdeyeProvider';
import { CoinMarketCapProvider } from '../providers/coinmarketcapProvider';

export class MarketDataService {
    private runtime: IAgentRuntime;
    private birdeyeProvider?: BirdeyeProvider;
    private coinmarketcapProvider?: CoinMarketCapProvider;

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;

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
} 