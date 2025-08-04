import {
    type Action,
    type ActionExample,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    type Component,
    type UUID,
    logger,
} from '@elizaos/core';
import { HasEntityIdFromMessage, getAccountFromMessage, takeItPrivate2 } from '../../autonomous-trader/utils';
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

/**
 * Creates a proper Component object from account data
 */
function createAccountComponent(account: any, runtime: IAgentRuntime, message: Memory): Component {
    const id = account.componentId;
    const entityId = account.entityId;

    // Remove properties that shouldn't be in component data
    const { componentId, entityId: _, ...accountData } = account;

    return {
        id,
        entityId,
        agentId: runtime.agentId!,
        roomId: message.roomId,
        worldId: message.worldId || runtime.agentId!,
        sourceEntityId: message.entityId,
        type: 'account',
        createdAt: Date.now(),
        data: accountData
    };
}

/**
 * Action to turn on notifications
 */
export const turnOnNotificationsAction: Action = {
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
    ): Promise<boolean> => {
        logger.log('TURN_ON_NOTIFICATIONS Starting handler...');

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

            // Update account component with notifications enabled
            const updatedAccount = {
                ...account,
                notifications: true,
                visualOutput: true // Enable visual output by default when notifications are enabled
            };

            const component = createAccountComponent(updatedAccount, runtime, message);
            const success = await interface_account_update(runtime, component);

            if (!success) {
                takeItPrivate2(runtime, message, "Failed to update notification settings. Please try again.", callback);
                return false;
            }

            const responseText = `✅ **Notifications Enabled!**

🔔 You will now receive notifications for:
• Position updates and status changes
• Trading alerts and market movements
• Portfolio performance updates
• Important trading events

To turn off notifications later, just say "turn off notifications" or "disable notifications".`;

            takeItPrivate2(runtime, message, responseText, callback);
            return true;

        } catch (error) {
            logger.error('Error during notification enabling:', error);
            takeItPrivate2(runtime, message, `Failed to enable notifications: ${error instanceof Error ? error.message : 'Unknown error'}`, callback);
            return false;
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
};

/**
 * Action to turn off notifications
 */
export const turnOffNotificationsAction: Action = {
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
                notifications: false,
                visualOutput: false // Disable visual output when notifications are disabled
            };

            const component = createAccountComponent(updatedAccount, runtime, message);
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
};

/**
 * Action to turn on visual output
 */
export const turnOnVisualOutputAction: Action = {
    name: 'TURN_ON_VISUAL_OUTPUT',
    similes: [
        'ENABLE_VISUAL_OUTPUT',
        'ACTIVATE_VISUAL_OUTPUT',
        'START_VISUAL_OUTPUT',
        'VISUAL_OUTPUT_ON',
        'SHOW_ANALYTICS',
        'DISPLAY_ANALYTICS',
        'SHOW_CHARTS',
        'DISPLAY_CHARTS',
        'VISUAL_MODE',
        'SHOW_DETAILS',
        'DISPLAY_DETAILS',
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // Check if user is registered
        if (!await HasEntityIdFromMessage(runtime, message)) {
            console.log('TURN_ON_VISUAL_OUTPUT validate - author not found');
            return false;
        }

        const account = await getAccountFromMessage(runtime, message);
        if (!account) {
            return false;
        }

        // Check if message contains visual output enabling keywords
        const messageText = message.content?.text?.toLowerCase() || '';
        const visualKeywords = [
            'turn on visual output', 'enable visual output', 'activate visual output',
            'start visual output', 'visual output on', 'show analytics', 'display analytics',
            'show charts', 'display charts', 'visual mode', 'show details', 'display details',
            'show me the data', 'display the data', 'show me charts', 'display charts'
        ];

        return visualKeywords.some(keyword => messageText.includes(keyword));
    },
    description: 'Turn on visual output for analytics and detailed data display.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: any[] = []
    ): Promise<boolean> => {
        logger.log('TURN_ON_VISUAL_OUTPUT Starting handler...');

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

            // Update account component with visual output enabled
            const updatedAccount = {
                ...account,
                visualOutput: true
            };

            const component = createAccountComponent(updatedAccount, runtime, message);
            const success = await interface_account_update(runtime, component);

            if (!success) {
                takeItPrivate2(runtime, message, "Failed to update visual output settings. Please try again.", callback);
                return false;
            }

            const responseText = `📊 **Visual Output Enabled!**

🎨 You will now see:
• Detailed analytics with charts and graphs
• Comprehensive data visualizations
• Rich formatting and emojis in responses
• Extended information displays

To turn off visual output later, just say "turn off visual output" or "disable visual output".`;

            takeItPrivate2(runtime, message, responseText, callback);
            return true;

        } catch (error) {
            logger.error('Error during visual output enabling:', error);
            takeItPrivate2(runtime, message, `Failed to enable visual output: ${error instanceof Error ? error.message : 'Unknown error'}`, callback);
            return false;
        }
    },
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'turn on visual output for my analytics',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll enable visual output so you can see detailed analytics with charts and comprehensive data displays.",
                    actions: ['TURN_ON_VISUAL_OUTPUT'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'show me detailed analytics with charts',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll enable visual output to show you detailed analytics with comprehensive visualizations.",
                    actions: ['TURN_ON_VISUAL_OUTPUT'],
                },
            },
        ],
    ] as ActionExample[][],
};

/**
 * Action to turn off visual output
 */
export const turnOffVisualOutputAction: Action = {
    name: 'TURN_OFF_VISUAL_OUTPUT',
    similes: [
        'DISABLE_VISUAL_OUTPUT',
        'DEACTIVATE_VISUAL_OUTPUT',
        'STOP_VISUAL_OUTPUT',
        'VISUAL_OUTPUT_OFF',
        'HIDE_ANALYTICS',
        'MINIMAL_OUTPUT',
        'SIMPLE_OUTPUT',
        'TEXT_ONLY',
        'NO_CHARTS',
        'NO_VISUALS',
        'COMPACT_MODE',
    ],
    description: 'Turn off visual output for analytics and use minimal text display.',
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // Check if user is registered
        if (!await HasEntityIdFromMessage(runtime, message)) {
            console.log('TURN_OFF_VISUAL_OUTPUT validate - author not found');
            return false;
        }

        const account = await getAccountFromMessage(runtime, message);
        if (!account) {
            return false;
        }

        // Check if message contains visual output disabling keywords
        const messageText = message.content?.text?.toLowerCase() || '';
        const visualKeywords = [
            'turn off visual output', 'disable visual output', 'deactivate visual output',
            'stop visual output', 'visual output off', 'hide analytics', 'minimal output',
            'simple output', 'text only', 'no charts', 'no visuals', 'compact mode',
            'show less', 'display less', 'minimal mode', 'simple mode'
        ];

        return visualKeywords.some(keyword => messageText.includes(keyword));
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: any[] = []
    ): Promise<boolean> => {
        logger.log('TURN_OFF_VISUAL_OUTPUT Starting handler...');

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

            // Update account component with visual output disabled
            const updatedAccount = {
                ...account,
                visualOutput: false
            };

            const component = createAccountComponent(updatedAccount, runtime, message);
            const success = await interface_account_update(runtime, component);

            if (!success) {
                takeItPrivate2(runtime, message, "Failed to update visual output settings. Please try again.", callback);
                return false;
            }

            const responseText = `📝 **Visual Output Disabled!**

You will now see:
• Minimal text-based responses
• Compact data displays
• No charts or detailed visualizations
• Simple, concise information

To turn visual output back on later, just say "turn on visual output" or "enable visual output".`;

            takeItPrivate2(runtime, message, responseText, callback);
            return true;

        } catch (error) {
            logger.error('Error during visual output disabling:', error);
            takeItPrivate2(runtime, message, `Failed to disable visual output: ${error instanceof Error ? error.message : 'Unknown error'}`, callback);
            return false;
        }
    },
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'turn off visual output for my analytics',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll disable visual output so you'll see minimal, text-based analytics without charts or detailed visualizations.",
                    actions: ['TURN_OFF_VISUAL_OUTPUT'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'show me simple text-only analytics',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll enable minimal output mode to show you simple, text-based analytics without visual elements.",
                    actions: ['TURN_OFF_VISUAL_OUTPUT'],
                },
            },
        ],
    ] as ActionExample[][],
};

// Export all actions as default
export default [turnOnNotificationsAction, turnOffNotificationsAction, turnOnVisualOutputAction, turnOffVisualOutputAction]; 