import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { AnalyticsService } from '../services/analyticsService';

export const technicalIndicatorsProvider: Provider = {
    name: 'TECHNICAL_INDICATORS',
    description: 'Real-time technical indicators including MACD, RSI, Bollinger Bands, moving averages, and trading signals',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('TECHNICAL_INDICATORS')

        let technicalStr = ''

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

                if (response.success && response.data) {
                    const tech = response.data.technicalIndicators;

                    technicalStr += `📊 TECHNICAL INDICATORS: ${response.data.symbol}\n\n`

                    technicalStr += `📈 MACD: ${tech.macd.bullish ? '🟢 Bullish' : '🔴 Bearish'}\n`
                    technicalStr += `📊 RSI: ${tech.rsi.value.toFixed(2)} ${tech.rsi.overbought ? '(Overbought)' : tech.rsi.oversold ? '(Oversold)' : '(Neutral)'}\n`
                    technicalStr += `📏 BB %B: ${tech.bollingerBands.percentB.toFixed(3)}\n`
                    technicalStr += `📊 Volume: ${tech.volume.volumeRatio.toFixed(2)}x average\n`
                } else {
                    technicalStr = 'Unable to calculate technical indicators for this token.'
                }
            } catch (error) {
                technicalStr = 'Error calculating technical indicators.'
            }
        } else {
            technicalStr = 'Please provide a token address to analyze technical indicators.'
        }

        const data = {
            technicalIndicators: technicalStr
        };

        const values = {};

        const text = technicalStr + '\n';

        return {
            data,
            values,
            text,
        };
    },
}; 