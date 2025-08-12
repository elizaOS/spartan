import {
    type Provider,
    type IAgentRuntime,
    type Memory,
    type State,
    logger,
} from '@elizaos/core';
import { getAccountFromMessage } from '../../autonomous-trader/utils';
import { InterfaceSettingsService } from '../services/srv_settings';

export const settingsProvider: Provider = {
    name: 'settings',
    description: 'Provides current account settings information including notifications, risk management, technical indicators, and trading preferences.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State
    ): Promise<string> => {
        try {
            const settingsService = runtime.getService(InterfaceSettingsService.serviceType) as InterfaceSettingsService;
            if (!settingsService) {
                logger.warn('Settings service not available for provider');
                return '';
            }

            const account = await getAccountFromMessage(runtime, message);
            if (!account) {
                return '';
            }

            const settings = await settingsService.getAccountSettings(account.accountEntityId);

            // Create a concise summary of current settings
            const settingsSummary = {
                notifications: {
                    enabled: settings.notifications.enabled,
                    channels: Object.keys(settings.notifications.channels).filter(channel =>
                        settings.notifications.channels[channel as keyof typeof settings.notifications.channels]
                    ),
                    intervals: settings.notifications.intervals
                },
                trading: {
                    enabled: settings.trading.enabled,
                    strategy: settings.trading.strategy,
                    buyVsSell: settings.trading.buyVsSell
                },
                riskManagement: {
                    maxTotalExposure: settings.riskManagement.maxTotalExposure,
                    maxDrawdown: settings.riskManagement.maxDrawdown,
                    dailyLossLimit: settings.riskManagement.dailyLossLimit,
                    maxTradesPerDay: settings.riskManagement.maxTradesPerDay,
                    maxPositionSize: settings.riskManagement.position.maxPositionSize,
                    stopLossPercentage: settings.riskManagement.position.stopLossPercentage,
                    takeProfitPercentage: settings.riskManagement.position.takeProfitPercentage
                },
                technicalIndicators: {
                    rsi: {
                        period: settings.technicalIndicators.rsi.period,
                        oversold: settings.technicalIndicators.rsi.oversoldThreshold,
                        overbought: settings.technicalIndicators.rsi.overboughtThreshold
                    },
                    macd: {
                        fastPeriod: settings.technicalIndicators.macd.fastPeriod,
                        slowPeriod: settings.technicalIndicators.macd.slowPeriod,
                        signalPeriod: settings.technicalIndicators.macd.signalPeriod
                    },
                    movingAverages: {
                        fastMA: settings.technicalIndicators.movingAverages.fastMA,
                        slowMA: settings.technicalIndicators.movingAverages.slowMA,
                        maType: settings.technicalIndicators.movingAverages.maType
                    }
                },
                gas: {
                    optimization: settings.gas.optimization,
                    priorityFees: settings.gas.priorityFees
                },
                performanceMonitoring: {
                    summaryFrequency: settings.performanceMonitoring.summaryFrequency,
                    rebalancingIntervals: settings.performanceMonitoring.rebalancingIntervals
                }
            };

            return `Current Account Settings:
- Notifications: ${settingsSummary.notifications.enabled ? 'Enabled' : 'Disabled'} (${settingsSummary.notifications.channels.join(', ')}) - Updates: ${settingsSummary.notifications.intervals.updates}min, Summaries: ${settingsSummary.notifications.intervals.summaries}h
- Trading: ${settingsSummary.trading.enabled ? 'Enabled' : 'Disabled'} (Strategy: ${settingsSummary.trading.strategy}, Mode: ${settingsSummary.trading.buyVsSell})
- Risk Management: Max Exposure ${settingsSummary.riskManagement.maxTotalExposure}%, Max Drawdown ${settingsSummary.riskManagement.maxDrawdown}%, Daily Loss Limit ${settingsSummary.riskManagement.dailyLossLimit}%, Max Trades/Day ${settingsSummary.riskManagement.maxTradesPerDay}, Max Position Size ${settingsSummary.riskManagement.maxPositionSize}%, Stop Loss ${settingsSummary.riskManagement.stopLossPercentage}%, Take Profit ${settingsSummary.riskManagement.takeProfitPercentage}%
- Technical Indicators: RSI(${settingsSummary.technicalIndicators.rsi.period},${settingsSummary.technicalIndicators.rsi.oversold}-${settingsSummary.technicalIndicators.rsi.overbought}), MACD(${settingsSummary.technicalIndicators.macd.fastPeriod},${settingsSummary.technicalIndicators.macd.slowPeriod},${settingsSummary.technicalIndicators.macd.signalPeriod}), MA(${settingsSummary.technicalIndicators.movingAverages.fastMA},${settingsSummary.technicalIndicators.movingAverages.slowMA},${settingsSummary.technicalIndicators.movingAverages.maType})
- Gas: Optimization ${settingsSummary.gas.optimization ? 'Enabled' : 'Disabled'}, Priority ${settingsSummary.gas.priorityFees}
- Performance: ${settingsSummary.performanceMonitoring.summaryFrequency} summaries, ${settingsSummary.performanceMonitoring.rebalancingIntervals}h rebalancing`;

        } catch (error) {
            logger.error('Error in settings provider:', error);
            return '';
        }
    }
}; 