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
import { takeItPrivate, getAccountFromMessage, HasEntityIdFromMessage } from '../../autonomous-trader/utils';

/**
 * Interface for TWAP task metadata
 */
interface TwapTaskMetadata {
    twapId: string;
    positionId?: string;
    senderWalletAddress: string;
    tokenSymbol: string;
    tokenCA: string;
    totalAmount: number;
    remainingAmount: number;
    endDate: Date;
    intervalMinutes: number;
    stopLossPrice?: number;
    takeProfitPrice?: number;
    exitReasoning?: string;
    description?: string;
    createdAt: Date;
    lastExecution?: Date;
    executions: Array<{
        timestamp: Date;
        amount: number;
        txid?: string;
        success: boolean;
    }>;
}

export default {
    name: 'LIST_TWAP',
    similes: [
        'LIST_TWAP_ORDERS',
        'LIST_TWAP_POSITIONS',
        'SHOW_TWAP',
        'VIEW_TWAP',
        'TWAP_STATUS',
        'TWAP_LIST',
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // they have to be registered
        if (!await HasEntityIdFromMessage(runtime, message)) {
            console.log('LIST_TWAP validate - author not found')
            return false
        }
        const account = await getAccountFromMessage(runtime, message)
        if (!account) {
            return false;
        }

        // Check if message contains list TWAP keywords
        const messageText = message.content?.text?.toLowerCase() || ''
        const listKeywords = [
            'list twap', 'show twap', 'view twap', 'twap status', 'twap list',
            'my twap', 'active twap', 'twap orders', 'twap positions'
        ]

        return listKeywords.some(keyword => messageText.includes(keyword))
    },
    description: 'List all active TWAP orders and positions for the user.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: any[] = []
    ): Promise<void> => {
        logger.log('LIST_TWAP Starting handler...');
        
        const account = await getAccountFromMessage(runtime, message)
        if (!account) return;

        try {
            // Get all TWAP tasks
            const twapTasks = await runtime.getTasksByName('EXECUTE_TWAP_ORDER');
            const twapPositionTasks = await runtime.getTasksByName('EXECUTE_TWAP_POSITION');
            
            // Filter tasks for this user
            const userTwapTasks = twapTasks.filter(task => task.entityId === account.entityId);
            const userTwapPositionTasks = twapPositionTasks.filter(task => task.entityId === account.entityId);

            if (userTwapTasks.length === 0 && userTwapPositionTasks.length === 0) {
                callback?.(takeItPrivate(runtime, message, "You don't have any active TWAP orders or positions."));
                return;
            }

            let responseText = "📊 **Your Active TWAP Orders & Positions:**\n\n";

            // List TWAP orders
            if (userTwapTasks.length > 0) {
                responseText += "🔄 **TWAP Orders:**\n";
                for (const task of userTwapTasks) {
                    const metadata = task.metadata as unknown as TwapTaskMetadata;
                    const progress = ((metadata.totalAmount - metadata.remainingAmount) / metadata.totalAmount * 100).toFixed(1);
                    const successfulExecutions = metadata.executions.filter(e => e.success).length;
                    const failedExecutions = metadata.executions.filter(e => !e.success).length;
                    
                    responseText += `\n• **${metadata.tokenSymbol}** (${metadata.twapId})\n`;
                    responseText += `  💰 ${metadata.totalAmount} SOL → ${metadata.tokenSymbol}\n`;
                    responseText += `  📈 Progress: ${progress}% (${metadata.remainingAmount.toFixed(4)} SOL remaining)\n`;
                    responseText += `  ⏰ End Date: ${metadata.endDate.toLocaleDateString()}\n`;
                    responseText += `  🔄 Interval: ${metadata.intervalMinutes} minutes\n`;
                    responseText += `  ✅ Executions: ${successfulExecutions} successful, ${failedExecutions} failed\n`;
                    if (metadata.lastExecution) {
                        responseText += `  🕐 Last Execution: ${metadata.lastExecution.toLocaleString()}\n`;
                    }
                    if (metadata.description) {
                        responseText += `  📝 ${metadata.description}\n`;
                    }
                }
            }

            // List TWAP positions
            if (userTwapPositionTasks.length > 0) {
                responseText += "\n🎯 **TWAP Positions:**\n";
                for (const task of userTwapPositionTasks) {
                    const metadata = task.metadata as unknown as TwapTaskMetadata;
                    const progress = ((metadata.totalAmount - metadata.remainingAmount) / metadata.totalAmount * 100).toFixed(1);
                    const successfulExecutions = metadata.executions.filter(e => e.success).length;
                    const failedExecutions = metadata.executions.filter(e => !e.success).length;
                    
                    responseText += `\n• **${metadata.tokenSymbol}** (${metadata.twapId})\n`;
                    responseText += `  💰 ${metadata.totalAmount} SOL → ${metadata.tokenSymbol}\n`;
                    responseText += `  📈 Progress: ${progress}% (${metadata.remainingAmount.toFixed(4)} SOL remaining)\n`;
                    responseText += `  ⏰ End Date: ${metadata.endDate.toLocaleDateString()}\n`;
                    responseText += `  🔄 Interval: ${metadata.intervalMinutes} minutes\n`;
                    responseText += `  ✅ Executions: ${successfulExecutions} successful, ${failedExecutions} failed\n`;
                    if (metadata.stopLossPrice) {
                        responseText += `  🛑 Stop Loss: $${metadata.stopLossPrice}\n`;
                    }
                    if (metadata.takeProfitPrice) {
                        responseText += `  🎯 Take Profit: $${metadata.takeProfitPrice}\n`;
                    }
                    if (metadata.lastExecution) {
                        responseText += `  🕐 Last Execution: ${metadata.lastExecution.toLocaleString()}\n`;
                    }
                    if (metadata.description) {
                        responseText += `  📝 ${metadata.description}\n`;
                    }
                }
            }

            responseText += "\n💡 **To cancel a TWAP order/position, use:** `spartan cancel twap position <TWAP_ID>`";

            callback?.(takeItPrivate(runtime, message, responseText));

        } catch (error) {
            logger.error('Error listing TWAP orders:', error);
            callback?.(takeItPrivate(runtime, message, `Failed to list TWAP orders: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    },
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'spartan list my twap orders',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll show you your active TWAP orders and positions",
                    actions: ['LIST_TWAP'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'show me my twap status',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "Here are your active TWAP orders and positions",
                    actions: ['LIST_TWAP'],
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
