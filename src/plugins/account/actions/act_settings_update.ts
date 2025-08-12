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
 * Interface representing settings update content
 */
interface SettingsUpdateContent extends Content {
    settingType: 'notifications' | 'risk' | 'technical' | 'trading' | 'gas' | 'performance';
    settingKey: string;
    settingValue: any;
}

/**
 * Checks if the given settings update content is valid
 */
function isValidSettingsUpdateContent(content: SettingsUpdateContent): boolean {
    logger.log('Content for settings update', content);

    if (!['notifications', 'risk', 'technical', 'trading', 'gas', 'performance'].includes(content.settingType)) {
        console.warn('Invalid setting type:', content.settingType);
        return false;
    }

    if (!content.settingKey || typeof content.settingKey !== 'string') {
        console.warn('Invalid setting key:', content.settingKey);
        return false;
    }

    console.log('Settings update content is valid');
    return true;
}

export default {
    name: 'UPDATE_ACCOUNT_SETTINGS',
    similes: [
        'CHANGE_SETTINGS',
        'MODIFY_SETTINGS',
        'SET_SETTINGS',
        'CONFIGURE_SETTINGS',
        'ADJUST_SETTINGS',
        'UPDATE_SETTINGS',
        'EDIT_SETTINGS',
        'CHANGE_CONFIGURATION',
        'MODIFY_CONFIGURATION',
        'SET_CONFIGURATION',
        'CONFIGURE_ACCOUNT',
        'ADJUST_CONFIGURATION',
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // Check if user is registered
        if (!await HasEntityIdFromMessage(runtime, message)) {
            console.log('UPDATE_ACCOUNT_SETTINGS validate - author not found');
            return false;
        }

        const account = await getAccountFromMessage(runtime, message);
        if (!account) {
            return false;
        }

        // Check if message contains settings update keywords
        const messageText = message.content?.text?.toLowerCase() || '';
        const updateKeywords = [
            'change', 'modify', 'set', 'configure', 'adjust', 'update', 'edit',
            'turn on', 'turn off', 'enable', 'disable', 'increase', 'decrease',
            'set to', 'change to', 'make it', 'set my', 'change my'
        ];

        return updateKeywords.some(keyword => messageText.includes(keyword));
    },
    description: 'Update account settings including notifications, risk management, technical indicators, and trading preferences.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: any[] = []
    ): Promise<boolean> => {
        logger.log('UPDATE_ACCOUNT_SETTINGS Starting handler...');

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
            let success = false;
            let responseText = '';

            // Parse settings updates from message
            const updates: Array<{ type: string, key: string, value: any }> = [];

            // Notification settings
            if (messageText.includes('notification')) {
                if (messageText.includes('turn on') || messageText.includes('enable')) {
                    updates.push({ type: 'notifications', key: 'enabled', value: true });
                } else if (messageText.includes('turn off') || messageText.includes('disable')) {
                    updates.push({ type: 'notifications', key: 'enabled', value: false });
                }

                // Parse notification intervals
                const intervalMatch = messageText.match(/(\d+)\s*(minute|hour|day)/);
                if (intervalMatch) {
                    const value = parseInt(intervalMatch[1]);
                    const unit = intervalMatch[2];
                    if (unit === 'minute') {
                        updates.push({ type: 'notifications', key: 'intervals.updates', value });
                    } else if (unit === 'hour') {
                        updates.push({ type: 'notifications', key: 'intervals.summaries', value });
                    }
                }

                // Parse notification channels
                if (messageText.includes('discord')) {
                    updates.push({ type: 'notifications', key: 'channels.discord', value: !messageText.includes('disable discord') });
                }
                if (messageText.includes('telegram')) {
                    updates.push({ type: 'notifications', key: 'channels.telegram', value: !messageText.includes('disable telegram') });
                }
                if (messageText.includes('email')) {
                    updates.push({ type: 'notifications', key: 'channels.email', value: !messageText.includes('disable email') });
                }
            }

            // Risk management settings
            if (messageText.includes('risk') || messageText.includes('drawdown') || messageText.includes('loss') || messageText.includes('exposure')) {
                // Parse percentage values
                const percentageMatch = messageText.match(/(\d+(?:\.\d+)?)\s*%/);
                if (percentageMatch) {
                    const value = parseFloat(percentageMatch[1]);

                    if (messageText.includes('max exposure') || messageText.includes('total exposure')) {
                        updates.push({ type: 'risk', key: 'maxTotalExposure', value });
                    } else if (messageText.includes('drawdown')) {
                        updates.push({ type: 'risk', key: 'maxDrawdown', value });
                    } else if (messageText.includes('daily loss')) {
                        updates.push({ type: 'risk', key: 'dailyLossLimit', value });
                    } else if (messageText.includes('weekly loss')) {
                        updates.push({ type: 'risk', key: 'weeklyLossLimit', value });
                    } else if (messageText.includes('position size')) {
                        updates.push({ type: 'risk', key: 'position.maxPositionSize', value });
                    } else if (messageText.includes('stop loss')) {
                        updates.push({ type: 'risk', key: 'position.stopLossPercentage', value });
                    } else if (messageText.includes('take profit')) {
                        updates.push({ type: 'risk', key: 'position.takeProfitPercentage', value });
                    }
                }

                // Parse trade limits
                const tradeMatch = messageText.match(/(\d+)\s*trades?/);
                if (tradeMatch) {
                    updates.push({ type: 'risk', key: 'maxTradesPerDay', value: parseInt(tradeMatch[1]) });
                }
            }

            // Trading settings
            if (messageText.includes('trading') || messageText.includes('strategy')) {
                if (messageText.includes('enable trading')) {
                    updates.push({ type: 'trading', key: 'enabled', value: true });
                } else if (messageText.includes('disable trading')) {
                    updates.push({ type: 'trading', key: 'enabled', value: false });
                }

                if (messageText.includes('strategy')) {
                    if (messageText.includes('llm') || messageText.includes('ai')) {
                        updates.push({ type: 'trading', key: 'strategy', value: 'llm' });
                    } else if (messageText.includes('copy')) {
                        updates.push({ type: 'trading', key: 'strategy', value: 'copy' });
                    } else if (messageText.includes('none')) {
                        updates.push({ type: 'trading', key: 'strategy', value: 'none' });
                    }
                }

                if (messageText.includes('buy only')) {
                    updates.push({ type: 'trading', key: 'buyVsSell', value: 'buy' });
                } else if (messageText.includes('sell only')) {
                    updates.push({ type: 'trading', key: 'buyVsSell', value: 'sell' });
                } else if (messageText.includes('both')) {
                    updates.push({ type: 'trading', key: 'buyVsSell', value: 'both' });
                }
            }

            // Technical indicator settings
            if (messageText.includes('rsi') || messageText.includes('macd') || messageText.includes('moving average')) {
                const numberMatch = messageText.match(/(\d+)/);
                if (numberMatch) {
                    const value = parseInt(numberMatch[1]);

                    if (messageText.includes('rsi period')) {
                        updates.push({ type: 'technical', key: 'rsi.period', value });
                    } else if (messageText.includes('rsi oversold')) {
                        updates.push({ type: 'technical', key: 'rsi.oversoldThreshold', value });
                    } else if (messageText.includes('rsi overbought')) {
                        updates.push({ type: 'technical', key: 'rsi.overboughtThreshold', value });
                    } else if (messageText.includes('macd fast')) {
                        updates.push({ type: 'technical', key: 'macd.fastPeriod', value });
                    } else if (messageText.includes('macd slow')) {
                        updates.push({ type: 'technical', key: 'macd.slowPeriod', value });
                    }
                }
            }

            // Gas settings
            if (messageText.includes('gas') || messageText.includes('fee')) {
                if (messageText.includes('enable gas optimization')) {
                    updates.push({ type: 'gas', key: 'optimization', value: true });
                } else if (messageText.includes('disable gas optimization')) {
                    updates.push({ type: 'gas', key: 'optimization', value: false });
                }

                if (messageText.includes('low priority')) {
                    updates.push({ type: 'gas', key: 'priorityFees', value: 'low' });
                } else if (messageText.includes('medium priority')) {
                    updates.push({ type: 'gas', key: 'priorityFees', value: 'medium' });
                } else if (messageText.includes('high priority')) {
                    updates.push({ type: 'gas', key: 'priorityFees', value: 'high' });
                }
            }

            // Apply updates
            if (updates.length > 0) {
                const currentSettings = await settingsService.getAccountSettings(account.accountEntityId);

                for (const update of updates) {
                    // Apply nested property updates
                    const keys = update.key.split('.');
                    let current = currentSettings;
                    for (let i = 0; i < keys.length - 1; i++) {
                        current = current[keys[i]];
                    }
                    current[keys[keys.length - 1]] = update.value;
                }

                // Validate settings before saving
                const validation = settingsService.validateSettings(currentSettings);
                if (!validation.valid) {
                    responseText = `Settings validation failed:\n${validation.errors.join('\n')}`;
                    takeItPrivate2(runtime, message, responseText, callback);
                    return false;
                }

                success = await settingsService.updateAccountSettings(account.accountEntityId, currentSettings);

                if (success) {
                    responseText = `Settings updated successfully!\n\nUpdated settings:\n`;
                    for (const update of updates) {
                        responseText += `• ${update.type}.${update.key}: ${update.value}\n`;
                    }
                } else {
                    responseText = "Failed to update settings. Please try again.";
                }
            } else {
                responseText = "I couldn't understand what settings you want to change. Please be more specific. For example:\n" +
                    "• 'Turn on notifications'\n" +
                    "• 'Set max drawdown to 10%'\n" +
                    "• 'Change RSI period to 21'\n" +
                    "• 'Enable trading'\n" +
                    "• 'Set gas priority to high'";
            }

            takeItPrivate2(runtime, message, responseText, callback);
            return success;

        } catch (error) {
            logger.error('Error updating account settings:', error);
            takeItPrivate2(runtime, message, "Error updating settings. Please try again.", callback);
            return false;
        }
    },
    examples: [
        [
            {
                name: 'Enable notifications',
                content: {
                    text: 'Turn on notifications',
                    settingType: 'notifications',
                    settingKey: 'enabled',
                    settingValue: true
                }
            },
            {
                name: 'Set max drawdown',
                content: {
                    text: 'Set max drawdown to 15%',
                    settingType: 'risk',
                    settingKey: 'maxDrawdown',
                    settingValue: 15
                }
            },
            {
                name: 'Change trading strategy',
                content: {
                    text: 'Change strategy to llm',
                    settingType: 'trading',
                    settingKey: 'strategy',
                    settingValue: 'llm'
                }
            }
        ]
    ] as ActionExample[][]
}; 