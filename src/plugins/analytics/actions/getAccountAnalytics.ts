import type { Action, IAgentRuntime, Memory, State, ActionResult, ActionExample, HandlerCallback } from '@elizaos/core';
import { AnalyticsService } from '../services/analyticsService';
import { getAccountFromMessage, getWalletsFromText } from '../../autonomous-trader/utils';
import type { AccountAnalytics } from '../interfaces/types';

/**
 * Check if user has visual output enabled
 */
async function isVisualOutputEnabled(runtime: IAgentRuntime, message: Memory): Promise<boolean> {
    try {
        const account = await getAccountFromMessage(runtime, message);
        return account?.visualOutput === true;
    } catch (error) {
        console.warn('Error checking visual output setting:', error);
        return true; // Default to visual output enabled
    }
}

/**
 * Get account analytics action
 */
export default {
    name: 'GET_ACCOUNT_ANALYTICS',
    description: 'Get comprehensive analytics for a wallet account including portfolio performance, risk metrics, and trading history',
    similes: ['account analytics', 'portfolio analysis', 'wallet analytics', 'account performance'],
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me my account analytics',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll analyze your account performance for you",
                    actions: ['GET_ACCOUNT_ANALYTICS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'What is my portfolio performance?',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "Let me check your portfolio analytics",
                    actions: ['GET_ACCOUNT_ANALYTICS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Analyze my wallet 0x1234567890abcdef',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll analyze that wallet address for you",
                    actions: ['GET_ACCOUNT_ANALYTICS'],
                },
            },
        ],
    ] as ActionExample[][],
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {

        // Allow the action for other account analytics requests
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: Memory[] = []
    ): Promise<ActionResult | void | undefined> => {
        try {
            let { walletAddress, chain = 'solana' } = _options as any || {};

            // If no wallet address provided, try to extract from message text
            if (!walletAddress) {
                const wallets = await getWalletsFromText(runtime, message);
                if (wallets.length > 0) {
                    walletAddress = wallets[0];
                } else {
                    // Fallback to current user's account
                    const account = await getAccountFromMessage(runtime, message);
                    if (!account) {
                        const errorResponse = '❌ No account found for this user. Please provide a wallet address or ensure you are registered.';
                        if (callback) {
                            callback({
                                text: errorResponse,
                                attachments: [],
                                source: 'auto',
                                channelType: 'text',
                                inReplyTo: message.id
                            });
                        }
                        return;
                    }
                    walletAddress = account.walletAddress;
                }
            }

            // Get the registered analytics service instead of creating a new instance
            const analyticsService = runtime.getService('ANALYTICS_SERVICE') as AnalyticsService;
            if (!analyticsService) {
                const errorResponse = '❌ Analytics service not available. Please ensure the analytics plugin is properly configured.';
                if (callback) {
                    callback({
                        text: errorResponse,
                        attachments: [],
                        source: 'auto',
                        channelType: 'text',
                        inReplyTo: message.id
                    });
                }
                return;
            }

            const request = {
                walletAddress,
                chain
            };

            const response = await analyticsService.getAccountAnalytics(request);

            if (!response.success) {
                const errorResponse = `❌ Error analyzing account ${walletAddress}: ${response.error}`;
                if (callback) {
                    callback({
                        text: errorResponse,
                        attachments: [],
                        source: 'auto',
                        channelType: 'text',
                        inReplyTo: message.id
                    });
                }
                return;
            }

            // Type guard to ensure we have AccountAnalytics
            if (!response.data || typeof response.data !== 'object' || !('totalValue' in response.data)) {
                const errorResponse = '❌ Error: Invalid account analytics data received';
                if (callback) {
                    callback({
                        text: errorResponse,
                        attachments: [],
                        source: 'auto',
                        channelType: 'text',
                        inReplyTo: message.id
                    });
                }
                return;
            }

            const accountData = response.data as AccountAnalytics;

            // Check if visual output is enabled
            const visualOutput = await isVisualOutputEnabled(runtime, message);

            // Format response based on visual output preference
            let responseText = visualOutput
                ? `📊 ACCOUNT ANALYTICS: ${walletAddress.substring(0, 8)}...\n\n`
                : `Account Analytics: ${walletAddress.substring(0, 8)}...\n\n`;

            // Portfolio Overview
            responseText += visualOutput ? `💰 PORTFOLIO OVERVIEW:\n` : `Portfolio Overview:\n`;
            responseText += `• Total Value: $${accountData.totalValue.toLocaleString()}\n`;
            responseText += `• 24h Change: ${accountData.totalValueChangePercent24h >= 0 ? '+' : ''}${accountData.totalValueChangePercent24h.toFixed(2)}%\n`;
            responseText += `• Total PnL: ${accountData.performance.totalPnLPercent >= 0 ? '+' : ''}${accountData.performance.totalPnLPercent.toFixed(2)}%\n\n`;

            // Performance Metrics
            responseText += visualOutput ? `📈 PERFORMANCE METRICS:\n` : `Performance Metrics:\n`;
            responseText += `• Best Performer: ${accountData.performance.bestPerformer}\n`;
            responseText += `• Worst Performer: ${accountData.performance.worstPerformer}\n`;
            responseText += `• Sharpe Ratio: ${accountData.performance.riskMetrics.sharpeRatio.toFixed(2)}\n`;
            responseText += `• Max Drawdown: ${accountData.performance.riskMetrics.maxDrawdown.toFixed(2)}%\n`;
            responseText += `• Volatility: ${accountData.performance.riskMetrics.volatility.toFixed(2)}%\n\n`;

            // Trading History
            responseText += visualOutput ? `🔄 TRADING HISTORY:\n` : `Trading History:\n`;
            responseText += `• Total Trades: ${accountData.tradingHistory.totalTrades}\n`;
            responseText += `• Win Rate: ${accountData.tradingHistory.winRate.toFixed(1)}%\n`;
            responseText += `• Winning Trades: ${accountData.tradingHistory.winningTrades}\n`;
            responseText += `• Losing Trades: ${accountData.tradingHistory.losingTrades}\n`;
            responseText += `• Average Trade Size: $${accountData.tradingHistory.averageTradeSize.toLocaleString()}\n\n`;

            // Top Holdings
            responseText += visualOutput ? `🎯 TOP HOLDINGS:\n` : `Top Holdings:\n`;
            const sortedPortfolio = accountData.portfolio
                .sort((a, b) => b.value - a.value)
                .slice(0, 10);

            for (let i = 0; i < sortedPortfolio.length; i++) {
                const holding = sortedPortfolio[i];
                const changeSign = holding.valueChange24h >= 0 ? '+' : '';
                responseText += `${i + 1}. ${holding.symbol}: $${holding.value.toLocaleString()} (${holding.allocation.toFixed(1)}%) ${changeSign}${holding.valueChange24h.toFixed(2)}%\n`;
            }
            responseText += '\n';

            // Risk Assessment
            responseText += visualOutput ? `⚠️ RISK ASSESSMENT:\n` : `Risk Assessment:\n`;
            const sharpe = accountData.performance.riskMetrics.sharpeRatio;
            const drawdown = accountData.performance.riskMetrics.maxDrawdown;
            const volatility = accountData.performance.riskMetrics.volatility;

            let riskLevel = 'LOW';
            if (sharpe < 0 || drawdown > 20 || volatility > 50) {
                riskLevel = 'HIGH';
            } else if (sharpe < 1 || drawdown > 10 || volatility > 25) {
                riskLevel = 'MODERATE';
            }

            responseText += `• Risk Level: ${riskLevel}\n`;
            responseText += `• Portfolio Diversification: ${accountData.portfolio.length} tokens\n`;
            responseText += `• Largest Position: ${sortedPortfolio[0]?.allocation.toFixed(1)}% (${sortedPortfolio[0]?.symbol})\n\n`;

            // Recommendations
            responseText += visualOutput ? `💡 RECOMMENDATIONS:\n` : `Recommendations:\n`;
            if (riskLevel === 'HIGH') {
                responseText += `• Consider reducing position sizes\n`;
                responseText += `• Diversify into more stable assets\n`;
                responseText += `• Review trading strategy\n`;
            } else if (riskLevel === 'MODERATE') {
                responseText += `• Monitor high-risk positions\n`;
                responseText += `• Consider rebalancing portfolio\n`;
            } else {
                responseText += `• Portfolio appears well-balanced\n`;
                responseText += `• Continue current strategy\n`;
            }

            if (accountData.tradingHistory.winRate < 50) {
                responseText += `• Improve trading strategy (low win rate)\n`;
            }

            if (callback) {
                callback({
                    text: responseText,
                    attachments: [],
                    source: 'auto',
                    channelType: 'text',
                    inReplyTo: message.id
                });
            }

            return {
                success: true,
                text: responseText,
                data: {
                    walletAddress,
                    analytics: accountData
                }
            };

        } catch (error) {
            console.error('Error in getAccountAnalytics action:', error);
            const errorResponse = `❌ Error analyzing account: ${error instanceof Error ? error.message : 'Unknown error'}`;
            if (callback) {
                callback({
                    text: errorResponse,
                    attachments: [],
                    source: 'auto',
                    channelType: 'text',
                    inReplyTo: message.id
                });
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
} as Action; 