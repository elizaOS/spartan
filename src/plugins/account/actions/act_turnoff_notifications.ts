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
import { HasEntityIdFromMessage, getAccountFromMessage, takeItPrivate2, accountMockComponent } from '../../autonomous-trader/utils';
import { interface_account_update } from '../interfaces/int_accounts';

/**
 * Interface representing notification settings content
 */
interface NotificationContent extends Content {
    enableNotifications: boolean;
}

/**
 * Checks if the given notification content is valid
 */
function isValidNotificationContent(content: NotificationContent): boolean {
    logger.log('Content for notification settings', content);

    if (typeof content.enableNotifications !== 'boolean') {
        console.warn('Invalid enableNotifications value:', content.enableNotifications);
        return false;
    }

    console.log('Notification content is valid');
    return true;
}

export default {
    name: 'TURN_OFF_NOTIFICATIONS',
    similes: [
        'DISABLE_NOTIFICATIONS',
        'DEACTIVATE_NOTIFICATIONS',
        'STOP_NOTIFICATIONS',
        'NOTIFICATIONS_OFF',
        'TURN_OFF_ALERTS',
        'DISABLE_ALERTS',
        'DEACTIVATE_ALERTS',
        'STOP_ALERTS',
        'ALERTS_OFF',
        'DONT_NOTIFY_ME',
        'STOP_SENDING_NOTIFICATIONS',
        'STOP_RECEIVING_NOTIFICATIONS',
        'QUIET_MODE',
        'SILENCE_NOTIFICATIONS',
    ],
    description: 'Turn off notifications for trading alerts and position updates.',
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // Check if user is registered
        if (!await HasEntityIdFromMessage(runtime, message)) {
            console.log('TURN_OFF_NOTIFICATIONS validate - author not found');
            return false;
        }

        const account = await getAccountFromMessage(runtime, message);
        if (!account) {
            return false;
        }

        // Check if message contains notification disabling keywords
        const messageText = message.content?.text?.toLowerCase() || '';
        const notificationKeywords = [
            'turn off notifications', 'disable notifications', 'deactivate notifications',
            'stop notifications', 'notifications off', 'turn off alerts', 'disable alerts',
            'deactivate alerts', 'stop alerts', 'alerts off', 'dont notify me', 'stop sending notifications',
            'stop receiving notifications', 'quiet mode', 'silence notifications', 'no notifications',
            'mute notifications', 'turn notifications off', 'disable alerts'
        ];

        return notificationKeywords.some(keyword => messageText.includes(keyword));
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: any[] = []
    ): Promise<boolean> => {
        logger.log('TURN_OFF_NOTIFICATIONS Starting handler...');

        const account = await getAccountFromMessage(runtime, message);
        if (!account) {
            takeItPrivate2(runtime, message, "Account not found. Please register first.", callback);
            return false;
        }

        try {
            // Check if account component exists
            if (!account.componentId) {
                takeItPrivate2(runtime, message, "Account component not found. Please try again.", callback);
                return false;
            }

            // Update account component with notifications disabled
            const updatedAccount = {
                ...account,
                notifications: false
            };

            const component = accountMockComponent(updatedAccount)
            const success = await interface_account_update(runtime, component);

            if (!success) {
                takeItPrivate2(runtime, message, "Failed to update notification settings. Please try again.", callback);
                return false;
            }

            const responseText = `🔕 **Notifications Disabled!**

You will no longer receive notifications for:
• Position updates and status changes
• Trading alerts and market movements
• Portfolio performance updates
• Important trading events

To turn notifications back on later, just say "turn on notifications" or "enable notifications".`;

            takeItPrivate2(runtime, message, responseText, callback);
            return true;

        } catch (error) {
            logger.error('Error during notification disabling:', error);
            takeItPrivate2(runtime, message, `Failed to disable notifications: ${error instanceof Error ? error.message : 'Unknown error'}`, callback);
            return false;
        }
    },
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'turn off notifications for my trading account',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll disable notifications for your trading account so you won't receive alerts anymore.",
                    actions: ['TURN_OFF_NOTIFICATIONS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'disable alerts for my positions',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll turn off notifications so you won't receive alerts about your trading positions anymore.",
                    actions: ['TURN_OFF_NOTIFICATIONS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'I want to stop receiving notifications about my trading activity',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll disable notifications so you won't receive updates about your trading activity anymore.",
                    actions: ['TURN_OFF_NOTIFICATIONS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'quiet mode - no more notifications',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll enable quiet mode by turning off all notifications for your trading account.",
                    actions: ['TURN_OFF_NOTIFICATIONS'],
                },
            },
        ],
    ] as ActionExample[][],
} as Action;