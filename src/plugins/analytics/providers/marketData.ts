import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { AnalyticsService } from '../services/analyticsService';

export const marketDataProvider: Provider = {
    name: 'MARKET_DATA',
    description: 'Real-time market data including top gainers, losers, trending tokens, and market sentiment across multiple chains',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('MARKET_DATA')

        let marketStr = ''

        try {
            const analyticsService = new AnalyticsService(runtime);
            const response = await analyticsService.getMarketAnalytics({ chain: 'solana' });

            if (response.success && response.data) {
                const marketData = response.data;

                marketStr += `🌍 MARKET OVERVIEW\n`
                marketStr += `Total Market Cap: $${marketData.marketCap.toLocaleString()}\n`
                marketStr += `24h Volume: $${marketData.volume24h.toLocaleString()}\n\n`

                marketStr += `🚀 TOP GAINERS (24h):\n`
                for (let i = 0; i < Math.min(3, marketData.topGainers.length); i++) {
                    const token = marketData.topGainers[i];
                    marketStr += `${i + 1}. ${token.symbol}: +${token.priceChangePercent24h.toFixed(2)}%\n`
                }
                marketStr += '\n'

                marketStr += `📉 TOP LOSERS (24h):\n`
                for (let i = 0; i < Math.min(3, marketData.topLosers.length); i++) {
                    const token = marketData.topLosers[i];
                    marketStr += `${i + 1}. ${token.symbol}: ${token.priceChangePercent24h.toFixed(2)}%\n`
                }
                marketStr += '\n'

                marketStr += `🔥 TRENDING:\n`
                for (let i = 0; i < Math.min(3, marketData.trendingTokens.length); i++) {
                    const token = marketData.trendingTokens[i];
                    marketStr += `${i + 1}. ${token.symbol}: $${token.volume24h.toLocaleString()} volume\n`
                }
            } else {
                marketStr = 'Unable to fetch market data at this time.'
            }
        } catch (error) {
            marketStr = 'Error fetching market data.'
        }

        const data = {
            marketData: marketStr
        };

        const values = {};

        const text = marketStr + '\n';

        return {
            data,
            values,
            text,
        };
    },
}; 