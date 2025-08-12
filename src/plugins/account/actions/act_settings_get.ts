import {
    type Action,
    type ActionExample,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    logger,
} from '@elizaos/core';
import { HasEntityIdFromMessage, getAccountFromMessage, takeItPrivate2 } from '../../autonomous-trader/utils';
import { InterfaceSettingsService } from '../services/srv_settings';

/**
 * Interface representing settings query content
 */
interface SettingsQueryContent extends Content {
    settingsType?: 'all' | 'notifications' | 'risk' | 'technical' | 'trading' | 'gas' | 'performance';
}

/**
 * Checks if the given settings query content is valid
 */
function isValidSettingsQueryContent(content: SettingsQueryContent): boolean {
    logger.log('Content for settings query', content);

    if (content.settingsType && !['all', 'notifications', 'risk', 'technical', 'trading', 'gas', 'performance'].includes(content.settingsType)) {
        console.warn('Invalid settings type:', content.settingsType);
        return false;
    }

    console.log('Settings query content is valid');
    return true;
}

export default {
    name: 'GET_ACCOUNT_SETTINGS',
    similes: [
        'VIEW_SETTINGS',
        'SHOW_SETTINGS',
        'DISPLAY_SETTINGS',
        'CHECK_SETTINGS',
        'SEE_SETTINGS',
        'WHAT_ARE_MY_SETTINGS',
        'SHOW_MY_SETTINGS',
        'VIEW_MY_SETTINGS',
        'GET_SETTINGS',
        'SETTINGS_INFO',
        'ACCOUNT_SETTINGS',
        'MY_SETTINGS',
        'CURRENT_SETTINGS',
        'SETTINGS_STATUS',
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // Check if user is registered
        if (!await HasEntityIdFromMessage(runtime, message)) {
            console.log('GET_ACCOUNT_SETTINGS validate - author not found');
            return false;
        }

        const account = await getAccountFromMessage(runtime, message);
        if (!account) {
            return false;
        }

        // Check if message contains settings query keywords
        const messageText = message.content?.text?.toLowerCase() || '';
        const settingsKeywords = [
            'show settings', 'view settings', 'display settings', 'check settings',
            'see settings', 'what are my settings', 'show my settings', 'view my settings',
            'get settings', 'settings info', 'account settings', 'my settings',
            'current settings', 'settings status', 'what settings', 'show configuration',
            'view configuration', 'my configuration', 'account configuration'
        ];

        return settingsKeywords.some(keyword => messageText.includes(keyword));
    },
    description: 'Get current account settings including notifications, risk management, technical indicators, and trading preferences.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: any[] = []
    ): Promise<boolean> => {
        logger.log('GET_ACCOUNT_SETTINGS Starting handler...');

        const account = await getAccountFromMessage(runtime, message);
        if (!account) {
            takeItPrivate2(runtime, message, "Account not found. Please register first.", callback);
            return false;
        }

        try {
            const settingsService = runtime.getService(InterfaceSettingsService.serviceType) as InterfaceSettingsService;
            if (!settingsService) {
                takeItPrivate2(runtime, message, "Settings service not available. Please try again later.", callback);
                return false;
            }

            const settings = await settingsService.getAccountSettings(account.accountEntityId);
            const messageText = message.content?.text?.toLowerCase() || '';

            // Determine which settings to show based on user query
            let settingsType: 'all' | 'notifications' | 'risk' | 'technical' | 'trading' | 'gas' | 'performance' = 'all';

            if (messageText.includes('notification')) {
                settingsType = 'notifications';
            } else if (messageText.includes('risk') || messageText.includes('drawdown') || messageText.includes('loss')) {
                settingsType = 'risk';
            } else if (messageText.includes('technical') || messageText.includes('indicator') || messageText.includes('rsi') || messageText.includes('macd')) {
                settingsType = 'technical';
            } else if (messageText.includes('trading') || messageText.includes('strategy')) {
                settingsType = 'trading';
            } else if (messageText.includes('gas') || messageText.includes('fee')) {
                settingsType = 'gas';
            } else if (messageText.includes('performance') || messageText.includes('monitoring')) {
                settingsType = 'performance';
            }

            let responseText = `**Account Settings for ${account.names?.join(', ') || 'your account'}**\n\n`;

            switch (settingsType) {
                case 'notifications':
                    responseText += `**Notification Settings:**\n`;
                    responseText += `• Enabled: ${settings.notifications.enabled ? 'Yes' : 'No'}\n`;
                    responseText += `• Update intervals: ${settings.notifications.intervals.updates} minutes\n`;
                    responseText += `• Summary intervals: ${settings.notifications.intervals.summaries} hours\n`;
                    responseText += `• Report intervals: ${settings.notifications.intervals.reports} hours\n`;
                    responseText += `• Channels: Discord (${settings.notifications.channels.discord ? 'Yes' : 'No'}), Telegram (${settings.notifications.channels.telegram ? 'Yes' : 'No'}), Email (${settings.notifications.channels.email ? 'Yes' : 'No'})\n`;
                    responseText += `• Alerts: Position opened/closed (${settings.notifications.alerts.positionOpened ? 'Yes' : 'No'}), Stop loss (${settings.notifications.alerts.stopLossTriggered ? 'Yes' : 'No'}), Take profit (${settings.notifications.alerts.takeProfitHit ? 'Yes' : 'No'})\n`;
                    responseText += `• Signatures: ${settings.notifications.signatures ? 'Enabled' : 'Disabled'}\n`;
                    break;

                case 'risk':
                    responseText += `**Risk Management Settings:**\n`;
                    responseText += `• Max total exposure: ${settings.riskManagement.maxTotalExposure}%\n`;
                    responseText += `• Max drawdown: ${settings.riskManagement.maxDrawdown}%\n`;
                    responseText += `• Daily loss limit: ${settings.riskManagement.dailyLossLimit}%\n`;
                    responseText += `• Weekly loss limit: ${settings.riskManagement.weeklyLossLimit}%\n`;
                    responseText += `• Emergency stop loss: ${settings.riskManagement.emergencyStopLoss}%\n`;
                    responseText += `• Max trades per day: ${settings.riskManagement.maxTradesPerDay}\n`;
                    responseText += `• Minimum trade size: ${settings.riskManagement.minimumTrade}%\n`;
                    responseText += `• Max position size: ${settings.riskManagement.position.maxPositionSize}%\n`;
                    responseText += `• Stop loss: ${settings.riskManagement.position.stopLossPercentage}%\n`;
                    responseText += `• Take profit: ${settings.riskManagement.position.takeProfitPercentage}%\n`;
                    break;

                case 'technical':
                    responseText += `**Technical Indicator Settings:**\n`;
                    responseText += `• RSI: Period ${settings.technicalIndicators.rsi.period}, Oversold ${settings.technicalIndicators.rsi.oversoldThreshold}, Overbought ${settings.technicalIndicators.rsi.overboughtThreshold}\n`;
                    responseText += `• MACD: Fast ${settings.technicalIndicators.macd.fastPeriod}, Slow ${settings.technicalIndicators.macd.slowPeriod}, Signal ${settings.technicalIndicators.macd.signalPeriod}\n`;
                    responseText += `• Moving Averages: Fast ${settings.technicalIndicators.movingAverages.fastMA}, Slow ${settings.technicalIndicators.movingAverages.slowMA}, Type ${settings.technicalIndicators.movingAverages.maType}\n`;
                    responseText += `• Bollinger Bands: Period ${settings.technicalIndicators.bollingerBands.period}, Std Dev ${settings.technicalIndicators.bollingerBands.standardDeviations}\n`;
                    responseText += `• Stochastic: K ${settings.technicalIndicators.stochastic.kPeriod}, D ${settings.technicalIndicators.stochastic.dPeriod}\n`;
                    responseText += `• ATR: Period ${settings.technicalIndicators.atr.period}, Volatility Multiplier ${settings.technicalIndicators.atr.volatilityMultiplier}\n`;
                    break;

                case 'trading':
                    responseText += `**Trading Settings:**\n`;
                    responseText += `• Enabled: ${settings.trading.enabled ? 'Yes' : 'No'}\n`;
                    responseText += `• Strategy: ${settings.trading.strategy}\n`;
                    responseText += `• Buy/Sell: ${settings.trading.buyVsSell}\n`;
                    responseText += `• Adjust for volatility: ${settings.trading.adjustForVolatility ? 'Yes' : 'No'}\n`;
                    responseText += `• Burst range: ${settings.trading.burstMinMax.min}% - ${settings.trading.burstMinMax.max}%\n`;
                    break;

                case 'gas':
                    responseText += `**Gas Settings:**\n`;
                    responseText += `• Optimization: ${settings.gas.optimization ? 'Enabled' : 'Disabled'}\n`;
                    responseText += `• Priority fees: ${settings.gas.priorityFees}\n`;
                    break;

                case 'performance':
                    responseText += `**Performance Monitoring Settings:**\n`;
                    responseText += `• Summary frequency: ${settings.performanceMonitoring.summaryFrequency}\n`;
                    responseText += `• Rebalancing intervals: ${settings.performanceMonitoring.rebalancingIntervals} hours\n`;
                    break;

                default:
                    responseText += `**All Settings Summary:**\n`;
                    responseText += `• Notifications: ${settings.notifications.enabled ? 'Enabled' : 'Disabled'}\n`;
                    responseText += `• Trading: ${settings.trading.enabled ? 'Enabled' : 'Disabled'}\n`;
                    responseText += `• Strategy: ${settings.trading.strategy}\n`;
                    responseText += `• Max exposure: ${settings.riskManagement.maxTotalExposure}%\n`;
                    responseText += `• Max drawdown: ${settings.riskManagement.maxDrawdown}%\n`;
                    responseText += `• Gas optimization: ${settings.gas.optimization ? 'Enabled' : 'Disabled'}\n`;
                    responseText += `• Performance monitoring: ${settings.performanceMonitoring.summaryFrequency}\n`;
                    break;
            }

            responseText += `\nLast updated: ${new Date(settings.lastUpdated).toLocaleString()}`;

            takeItPrivate2(runtime, message, responseText, callback);
            return true;

        } catch (error) {
            logger.error('Error getting account settings:', error);
            takeItPrivate2(runtime, message, "Error retrieving settings. Please try again.", callback);
            return false;
        }
    },
    examples: [
        [
            {
                name: 'View all settings',
                content: {
                    text: 'Show me my current settings',
                    settingsType: 'all'
                }
            },
            {
                name: 'View notification settings',
                content: {
                    text: 'What are my notification settings?',
                    settingsType: 'notifications'
                }
            },
            {
                name: 'View risk management settings',
                content: {
                    text: 'Show my risk management configuration',
                    settingsType: 'risk'
                }
            }
        ]
    ] as ActionExample[][]
}; 