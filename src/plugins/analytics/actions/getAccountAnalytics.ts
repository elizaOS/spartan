import type { Action, IAgentRuntime, Memory, State, ActionResult } from '@elizaos/core';
import { AnalyticsService } from '../services/analyticsService';
import { getAccountFromMessage } from '../../autonomous-trader/utils';
import type { AccountAnalytics } from '../interfaces/types';

/**
 * Get account analytics action
 */
export const getAccountAnalytics: Action = {
    name: 'GET_ACCOUNT_ANALYTICS',
    description: 'Get comprehensive analytics for a wallet account including portfolio performance, risk metrics, and trading history',
    parameters: {
        type: 'object',
        properties: {
            walletAddress: {
                type: 'string',
                description: 'The wallet address to analyze (optional, will use current user if not provided)'
            },
            chain: {
                type: 'string',
                description: 'The blockchain chain (solana, ethereum, base)',
                enum: ['solana', 'ethereum', 'base'],
                default: 'solana'
            }
        }
    },
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        // Always allow this action to be executed
        return true;
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state?: State, options?: { [key: string]: unknown }): Promise<ActionResult> => {
        try {
            let { walletAddress, chain = 'solana' } = options as any || {};

            // If no wallet address provided, get from current user
            if (!walletAddress) {
                const account = await getAccountFromMessage(runtime, message);
                if (!account) {
                    return {
                        success: false,
                        error: 'No account found for current user',
                        data: {
                            thought: 'No account found for current user',
                            response: '❌ No account found for this user. Please provide a wallet address or ensure you are registered.'
                        }
                    };
                }
                walletAddress = account.walletAddress;
            }

            // Initialize analytics service
            const analyticsService = new AnalyticsService(runtime);

            const request = {
                walletAddress,
                chain
            };

            const response = await analyticsService.getAccountAnalytics(request);

            if (!response.success) {
                return {
                    success: false,
                    error: response.error,
                    data: {
                        thought: `Failed to get account analytics: ${response.error}`,
                        response: `❌ Error analyzing account ${walletAddress}: ${response.error}`
                    }
                };
            }

            // Type guard to ensure we have AccountAnalytics
            if (!response.data || typeof response.data !== 'object' || !('totalValue' in response.data)) {
                return {
                    success: false,
                    error: 'Invalid account analytics data received',
                    data: {
                        thought: 'Invalid account analytics data received',
                        response: '❌ Error: Invalid account analytics data received'
                    }
                };
            }

            const accountData = response.data as AccountAnalytics;

            // Format comprehensive response
            let responseText = `📊 ACCOUNT ANALYTICS: ${walletAddress.substring(0, 8)}...\n\n`;

            // Portfolio Overview
            responseText += `💰 PORTFOLIO OVERVIEW:\n`;
            responseText += `• Total Value: $${accountData.totalValue.toLocaleString()}\n`;
            responseText += `• 24h Change: ${accountData.totalValueChangePercent24h >= 0 ? '+' : ''}${accountData.totalValueChangePercent24h.toFixed(2)}%\n`;
            responseText += `• Total PnL: ${accountData.performance.totalPnLPercent >= 0 ? '+' : ''}${accountData.performance.totalPnLPercent.toFixed(2)}%\n\n`;

            // Performance Metrics
            responseText += `📈 PERFORMANCE METRICS:\n`;
            responseText += `• Best Performer: ${accountData.performance.bestPerformer}\n`;
            responseText += `• Worst Performer: ${accountData.performance.worstPerformer}\n`;
            responseText += `• Sharpe Ratio: ${accountData.performance.riskMetrics.sharpeRatio.toFixed(2)}\n`;
            responseText += `• Max Drawdown: ${accountData.performance.riskMetrics.maxDrawdown.toFixed(2)}%\n`;
            responseText += `• Volatility: ${accountData.performance.riskMetrics.volatility.toFixed(2)}%\n\n`;

            // Trading History
            responseText += `🔄 TRADING HISTORY:\n`;
            responseText += `• Total Trades: ${accountData.tradingHistory.totalTrades}\n`;
            responseText += `• Win Rate: ${accountData.tradingHistory.winRate.toFixed(1)}%\n`;
            responseText += `• Winning Trades: ${accountData.tradingHistory.winningTrades}\n`;
            responseText += `• Losing Trades: ${accountData.tradingHistory.losingTrades}\n`;
            responseText += `• Average Trade Size: $${accountData.tradingHistory.averageTradeSize.toLocaleString()}\n\n`;

            // Top Holdings
            responseText += `🎯 TOP HOLDINGS:\n`;
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
            responseText += `⚠️ RISK ASSESSMENT:\n`;
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
            responseText += `💡 RECOMMENDATIONS:\n`;
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

            return {
                success: true,
                data: {
                    thought: `Successfully analyzed account ${walletAddress} with comprehensive portfolio analytics. The account shows ${accountData.performance.totalPnLPercent >= 0 ? 'positive' : 'negative'} performance with ${riskLevel.toLowerCase()} risk level.`,
                    response: responseText
                }
            };

        } catch (error) {
            console.error('Error in getAccountAnalytics action:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                data: {
                    thought: `Error occurred while analyzing account: ${error}`,
                    response: `❌ Error analyzing account: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            };
        }
    }
}; 