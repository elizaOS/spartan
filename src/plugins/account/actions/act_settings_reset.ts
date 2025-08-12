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
 * Interface representing settings reset content
 */
interface SettingsResetContent extends Content {
    resetType?: 'all' | 'notifications' | 'risk' | 'technical' | 'trading' | 'gas' | 'performance';
}

/**
 * Checks if the given settings reset content is valid
 */
function isValidSettingsResetContent(content: SettingsResetContent): boolean {
    logger.log('Content for settings reset', content);

    if (content.resetType && !['all', 'notifications', 'risk', 'technical', 'trading', 'gas', 'performance'].includes(content.resetType)) {
        console.warn('Invalid reset type:', content.resetType);
        return false;
    }

    console.log('Settings reset content is valid');
    return true;
}

export default {
    name: 'RESET_ACCOUNT_SETTINGS',
    similes: [
        'RESET_SETTINGS',
        'DEFAULT_SETTINGS',
        'RESTORE_SETTINGS',
        'FACTORY_RESET',
        'RESET_TO_DEFAULT',
        'RESTORE_DEFAULT',
        'DEFAULT_CONFIGURATION',
        'RESET_CONFIGURATION',
        'RESTORE_CONFIGURATION',
        'FACTORY_DEFAULT',
        'RESET_TO_FACTORY',
        'CLEAR_SETTINGS',
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // Check if user is registered
        if (!await HasEntityIdFromMessage(runtime, message)) {
            console.log('RESET_ACCOUNT_SETTINGS validate - author not found');
            return false;
        }

        const account = await getAccountFromMessage(runtime, message);
        if (!account) {
            return false;
        }

        // Check if message contains settings reset keywords
        const messageText = message.content?.text?.toLowerCase() || '';
        const resetKeywords = [
            'reset', 'default', 'restore', 'factory', 'clear',
            'reset to default', 'restore default', 'factory reset',
            'reset settings', 'default settings', 'restore settings',
            'clear settings', 'reset configuration', 'default configuration'
        ];

        return resetKeywords.some(keyword => messageText.includes(keyword));
    },
    description: 'Reset account settings to default values for notifications, risk management, technical indicators, and trading preferences.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: any[] = []
    ): Promise<boolean> => {
        logger.log('RESET_ACCOUNT_SETTINGS Starting handler...');

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

            const messageText = message.content?.text?.toLowerCase() || '';
            let resetType: 'all' | 'notifications' | 'risk' | 'technical' | 'trading' | 'gas' | 'performance' = 'all';
            let responseText = '';

            // Determine which settings to reset based on user query
            if (messageText.includes('notification')) {
                resetType = 'notifications';
            } else if (messageText.includes('risk') || messageText.includes('drawdown') || messageText.includes('loss')) {
                resetType = 'risk';
            } else if (messageText.includes('technical') || messageText.includes('indicator') || messageText.includes('rsi') || messageText.includes('macd')) {
                resetType = 'technical';
            } else if (messageText.includes('trading') || messageText.includes('strategy')) {
                resetType = 'trading';
            } else if (messageText.includes('gas') || messageText.includes('fee')) {
                resetType = 'gas';
            } else if (messageText.includes('performance') || messageText.includes('monitoring')) {
                resetType = 'performance';
            }

            let success = false;

            if (resetType === 'all') {
                // Reset all settings to defaults
                success = await settingsService.resetAccountSettings(account.accountEntityId);
                if (success) {
                    responseText = "✅ All settings have been reset to default values!\n\n" +
                        "**Default Settings Applied:**\n" +
                        "• Notifications: Enabled (15min updates, 1hr summaries)\n" +
                        "• Risk Management: 80% max exposure, 10% max drawdown\n" +
                        "• Trading: Enabled with LLM strategy\n" +
                        "• Technical Indicators: Standard RSI, MACD, Moving Averages\n" +
                        "• Gas: Optimization enabled, medium priority\n" +
                        "• Performance: Daily summaries, 24hr rebalancing";
                } else {
                    responseText = "❌ Failed to reset settings. Please try again.";
                }
            } else {
                // Reset specific settings category
                const currentSettings = await settingsService.getAccountSettings(account.accountEntityId);
                const defaultSettings = settingsService['defaultSettings']; // Access private property

                let updatedSettings = { ...currentSettings };

                switch (resetType) {
                    case 'notifications':
                        updatedSettings.notifications = defaultSettings.notifications;
                        responseText = "✅ Notification settings reset to defaults:\n" +
                            "• Enabled: Yes\n" +
                            "• Update intervals: 15 minutes\n" +
                            "• Summary intervals: 1 hour\n" +
                            "• Report intervals: 24 hours\n" +
                            "• Channels: Discord & Telegram enabled\n" +
                            "• All alerts enabled\n" +
                            "• Signatures enabled";
                        break;

                    case 'risk':
                        updatedSettings.riskManagement = defaultSettings.riskManagement;
                        responseText = "✅ Risk management settings reset to defaults:\n" +
                            "• Max total exposure: 80%\n" +
                            "• Max drawdown: 10%\n" +
                            "• Daily loss limit: 5%\n" +
                            "• Weekly loss limit: 15%\n" +
                            "• Emergency stop loss: 20%\n" +
                            "• Max trades per day: 10\n" +
                            "• Minimum trade: 0.1%\n" +
                            "• Max position size: 10%\n" +
                            "• Stop loss: 5%\n" +
                            "• Take profit: 15%";
                        break;

                    case 'technical':
                        updatedSettings.technicalIndicators = defaultSettings.technicalIndicators;
                        responseText = "✅ Technical indicator settings reset to defaults:\n" +
                            "• RSI: Period 14, Oversold 30, Overbought 70\n" +
                            "• MACD: Fast 12, Slow 26, Signal 9\n" +
                            "• Moving Averages: Fast 20, Slow 50, SMA\n" +
                            "• Bollinger Bands: Period 20, Std Dev 2\n" +
                            "• Stochastic: K 14, D 3\n" +
                            "• ATR: Period 14, Volatility Multiplier 2";
                        break;

                    case 'trading':
                        updatedSettings.trading = defaultSettings.trading;
                        responseText = "✅ Trading settings reset to defaults:\n" +
                            "• Enabled: Yes\n" +
                            "• Strategy: LLM\n" +
                            "• Buy/Sell: Both\n" +
                            "• Adjust for volatility: Yes\n" +
                            "• Burst range: 0.1% - 5.0%";
                        break;

                    case 'gas':
                        updatedSettings.gas = defaultSettings.gas;
                        responseText = "✅ Gas settings reset to defaults:\n" +
                            "• Optimization: Enabled\n" +
                            "• Priority fees: Medium";
                        break;

                    case 'performance':
                        updatedSettings.performanceMonitoring = defaultSettings.performanceMonitoring;
                        responseText = "✅ Performance monitoring settings reset to defaults:\n" +
                            "• Summary frequency: Daily\n" +
                            "• Rebalancing intervals: 24 hours";
                        break;
                }

                success = await settingsService.updateAccountSettings(account.accountEntityId, updatedSettings);
                if (!success) {
                    responseText = "❌ Failed to reset settings. Please try again.";
                }
            }

            takeItPrivate2(runtime, message, responseText, callback);
            return success;

        } catch (error) {
            logger.error('Error resetting account settings:', error);
            takeItPrivate2(runtime, message, "Error resetting settings. Please try again.", callback);
            return false;
        }
    },
    examples: [
        [
            {
                name: 'Reset all settings',
                content: {
                    text: 'Reset all settings to default',
                    resetType: 'all'
                }
            },
            {
                name: 'Reset notification settings',
                content: {
                    text: 'Reset notification settings to default',
                    resetType: 'notifications'
                }
            },
            {
                name: 'Reset risk management settings',
                content: {
                    text: 'Reset risk management to default',
                    resetType: 'risk'
                }
            }
        ]
    ] as ActionExample[][]
}; 