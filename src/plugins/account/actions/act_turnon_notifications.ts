import {
    type Action,
    type ActionExample,
    type ActionResult,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    logger,
} from '@elizaos/core';
import { HasEntityIdFromMessage, getAccountFromMessage, takeItPrivate2, accountMockComponent } from '../../autonomous-trader/utils';
import { interface_account_update } from '../interfaces/int_accounts';

export default {
    name: 'TURN_ON_NOTIFICATIONS',
    similes: [
        'ENABLE_NOTIFICATIONS',
        'ACTIVATE_NOTIFICATIONS',
        'START_NOTIFICATIONS',
        'NOTIFICATIONS_ON',
        'TURN_ON_ALERTS',
        'ENABLE_ALERTS',
        'ACTIVATE_ALERTS',
        'START_ALERTS',
        'ALERTS_ON',
        'NOTIFY_ME',
        'SEND_NOTIFICATIONS',
        'RECEIVE_NOTIFICATIONS',
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // Check if user is registered
        if (!await HasEntityIdFromMessage(runtime, message)) {
            console.log('TURN_ON_NOTIFICATIONS validate - author not found');
            return false;
        }

        const account = await getAccountFromMessage(runtime, message);
        if (!account) {
            return false;
        }

        // Hi spartan, please enable notification
        // didn't trigger it
        // needs trailing s

        // Check if message contains notification enabling keywords
        const messageText = message.content?.text?.toLowerCase() || '';
        const notificationKeywords = [
            'turn on notifications', 'enable notifications', 'activate notifications',
            'start notifications', 'notifications on', 'turn on alerts', 'enable alerts',
            'activate alerts', 'start alerts', 'alerts on', 'notify me', 'send notifications',
            'receive notifications', 'get notifications', 'want notifications'
        ];

        return notificationKeywords.some(keyword => messageText.includes(keyword));
    },
    description: 'Turn on notifications for trading alerts and position updates.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: any[] = []
    ): Promise<ActionResult | void | undefined> => {
        logger.log('TURN_ON_NOTIFICATIONS Starting handler...');

        const account = await getAccountFromMessage(runtime, message);
        if (!account) {
            if (callback) {
                takeItPrivate2(runtime, message, "Account not found. Please register first.", callback);
            }
            return {
                success: false,
                error: "Account not found. Please register first."
            };
        }

        try {
            // Check if account component exists
            if (!account.componentId) {
                if (callback) {
                    takeItPrivate2(runtime, message, "Account component not found. Please try again.", callback);
                }
                return {
                    success: false,
                    error: "Account component not found. Please try again."
                };
            }

            // Update account component with notifications enabled
            const updatedAccount = {
                ...account,
                notifications: true
            };

            const component = accountMockComponent(updatedAccount)
            const success = await interface_account_update(runtime, component);

            if (!success) {
                if (callback) {
                    takeItPrivate2(runtime, message, "Failed to update notification settings. Please try again.", callback);
                }
                return {
                    success: false,
                    error: "Failed to update notification settings. Please try again."
                };
            }

            const responseText = `✅ **Notifications Enabled!**

🔔 You will now receive notifications for:
• Position updates and status changes
• Trading alerts and market movements
• Portfolio performance updates
• Important trading events

To turn off notifications later, just say "turn off notifications" or "disable notifications".`;

            if (callback) {
                takeItPrivate2(runtime, message, responseText, callback);
            }
            return {
                success: true,
                text: responseText,
                data: {
                    notificationsEnabled: true
                }
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Error during notification enabling:', errorMessage);
            if (callback) {
                takeItPrivate2(runtime, message, `Failed to enable notifications: ${errorMessage}`, callback);
            }
            return {
                success: false,
                error: `Failed to enable notifications: ${errorMessage}`
            };
        }
    },
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'turn on notifications for my trading account',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll enable notifications for your trading account so you can stay updated on your positions and market movements.",
                    actions: ['TURN_ON_NOTIFICATIONS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'enable alerts for my positions',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll turn on notifications to keep you informed about your trading positions and important updates.",
                    actions: ['TURN_ON_NOTIFICATIONS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'I want to receive notifications about my trading activity',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll enable notifications so you can stay updated on all your trading activity and position changes.",
                    actions: ['TURN_ON_NOTIFICATIONS'],
                },
            },
        ],
    ] as ActionExample[][],
} as Action;