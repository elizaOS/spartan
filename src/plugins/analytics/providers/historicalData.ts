import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { AnalyticsService } from '../services/analyticsService';

export const historicalDataProvider: Provider = {
    name: 'HISTORICAL_DATA',
    description: 'Historical price data and trend analysis for tokens across different timeframes',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('HISTORICAL_DATA')

        let historicalStr = ''

        // Extract token address from message if available
        const messageText = message.content?.text || '';
        const tokenMatch = messageText.match(/0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}/);

        if (tokenMatch) {
            try {
                const analyticsService = new AnalyticsService(runtime);
                const response = await analyticsService.getTokenAnalytics({
                    tokenAddress: tokenMatch[0],
                    chain: 'solana',
                    timeframe: '1d',
                    includeHistorical: true,
                    includeHolders: false,
                    includeSnipers: false
                });

                if (response.success && response.data && response.data.historicalData.length > 0) {
                    const historicalData = response.data.historicalData;
                    const firstPrice = historicalData[0].close;
                    const lastPrice = historicalData[historicalData.length - 1].close;
                    const totalChange = ((lastPrice - firstPrice) / firstPrice) * 100;

                    historicalStr += `📈 HISTORICAL DATA: ${response.data.symbol}\n\n`
                    historicalStr += `Period: ${historicalData.length} days\n`
                    historicalStr += `Start Price: $${firstPrice.toFixed(6)}\n`
                    historicalStr += `End Price: $${lastPrice.toFixed(6)}\n`
                    historicalStr += `Total Change: ${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(2)}%\n`
                } else {
                    historicalStr = 'No historical data available for this token.'
                }
            } catch (error) {
                historicalStr = 'Error fetching historical data.'
            }
        } else {
            historicalStr = 'Please provide a token address to analyze historical data.'
        }

        const data = {
            historicalData: historicalStr
        };

        const values = {};

        const text = historicalStr + '\n';

        return {
            data,
            values,
            text,
        };
    },
}; 