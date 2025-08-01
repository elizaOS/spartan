import {
    type Action,
    type ActionExample,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    logger,
} from '@elizaos/core';
import { HasEntityIdFromMessage, getAccountFromMessage, takeItPrivate2 } from '../../autonomous-trader/utils';

/**
 * Action to query notification settings
 */
export const queryNotificationSettingsAction: Action = {
    name: 'QUERY_NOTIFICATION_SETTINGS',
    similes: [
        'CHECK_NOTIFICATION_SETTINGS',
        'VIEW_NOTIFICATION_SETTINGS',
        'SHOW_NOTIFICATION_SETTINGS',
        'GET_NOTIFICATION_SETTINGS',
        'NOTIFICATION_STATUS',
        'NOTIFICATION_SETTINGS',
        'ALERT_SETTINGS',
        'CHECK_ALERTS',
        'VIEW_ALERTS',
        'SHOW_ALERTS',
        'GET_ALERTS',
        'ALERT_STATUS',
        'NOTIFICATION_PREFERENCES',
        'ALERT_PREFERENCES',
        'NOTIFICATION_CONFIG',
        'ALERT_CONFIG',
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // Check if user is registered
        if (!await HasEntityIdFromMessage(runtime, message)) {
            console.log('QUERY_NOTIFICATION_SETTINGS validate - author not found');
            return false;
        }

        const account = await getAccountFromMessage(runtime, message);
        if (!account) {
            return false;
        }

        // Check if message contains notification query keywords
        const messageText = message.content?.text?.toLowerCase() || '';
        const notificationKeywords = [
            'notification settings', 'notification status', 'notification preferences',
            'notification config', 'check notifications', 'view notifications',
            'show notifications', 'get notifications', 'notification state',
            'alert settings', 'alert status', 'alert preferences', 'alert config',
            'check alerts', 'view alerts', 'show alerts', 'get alerts', 'alert state',
            'are notifications on', 'are notifications enabled', 'do i have notifications',
            'notification status', 'alert status', 'what are my notification settings',
            'show me my notification settings', 'what notifications do i have',
            'notification info', 'alert info'
        ];

        return notificationKeywords.some(keyword => messageText.includes(keyword));
    },
    description: 'Query current notification settings for trading alerts and position updates.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State | undefined,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: any[] = []
    ): Promise<boolean> => {
        logger.log('QUERY_NOTIFICATION_SETTINGS Starting handler...');

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

            // Get current notification status
            const notificationsEnabled = account.notifications === true;

            let responseText = `🔔 **Notification Settings**\n\n`;

            if (notificationsEnabled) {
                responseText += `✅ **Notifications are ENABLED**\n\n`;
                responseText += `You are currently receiving notifications for:\n`;
                responseText += `• Position updates and status changes\n`;
                responseText += `• Trading alerts and market movements\n`;
                responseText += `• Portfolio performance updates\n`;
                responseText += `• Important trading events\n\n`;
                responseText += `To turn off notifications, say "turn off notifications" or "disable notifications".`;
            } else {
                responseText += `🔕 **Notifications are DISABLED**\n\n`;
                responseText += `You are not currently receiving notifications for:\n`;
                responseText += `• Position updates and status changes\n`;
                responseText += `• Trading alerts and market movements\n`;
                responseText += `• Portfolio performance updates\n`;
                responseText += `• Important trading events\n\n`;
                responseText += `To turn on notifications, say "turn on notifications" or "enable notifications".`;
            }

            takeItPrivate2(runtime, message, responseText, callback);
            return true;

        } catch (error) {
            logger.error('Error during notification settings query:', error);
            takeItPrivate2(runtime, message, `Failed to query notification settings: ${error instanceof Error ? error.message : 'Unknown error'}`, callback);
            return false;
        }
    },
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'what are my notification settings?',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll check your current notification settings for your trading account.",
                    actions: ['QUERY_NOTIFICATION_SETTINGS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'are notifications enabled for my account?',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "Let me check your notification settings to see if alerts are currently enabled.",
                    actions: ['QUERY_NOTIFICATION_SETTINGS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'show me my notification preferences',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll display your current notification preferences and settings.",
                    actions: ['QUERY_NOTIFICATION_SETTINGS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'check if I have alerts turned on',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll verify your current alert settings and notification status.",
                    actions: ['QUERY_NOTIFICATION_SETTINGS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'notification status',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll check the current status of your notification settings.",
                    actions: ['QUERY_NOTIFICATION_SETTINGS'],
                },
            },
        ],
    ] as ActionExample[][],
};

// Export the action as default
export default [queryNotificationSettingsAction]; 