import type { AgentRuntime, Memory, Provider, State, IAgentRuntime } from '@elizaos/core';
import { ModelType } from '@elizaos/core';
import { KaminoLiquidityService } from '../services/kaminoLiquidityService';

/**
 * Kamino Pool-Specific Provider
 * Provides detailed information about specific Kamino pools by their address
 */
export const kaminoPoolProvider: Provider = {
    name: 'KAMINO_POOL',
    description: 'Provides detailed information about specific Kamino liquidity pools by pool address',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('KAMINO_POOL provider called');

        let poolInfo = '';

        try {
            // Extract pool address from message content
            const content = message.content.text || '';
            const poolMatch = content.match(/([A-Za-z0-9]{32,44})/);

            let poolAddress = '';
            if (poolMatch) {
                poolAddress = poolMatch[1];
            }

            // Get Kamino liquidity service
            const kaminoLiquidityService = runtime.getService('KAMINO_LIQUIDITY_SERVICE') as unknown as KaminoLiquidityService;
            if (!kaminoLiquidityService) {
                poolInfo += '❌ Kamino liquidity service not available.\n';
            } else {
                if (poolAddress) {
                    console.log(`Pool address found: ${poolAddress}`);

                    poolInfo += `=== KAMINO POOL ANALYSIS ===\n\n`;
                    poolInfo += `🔍 Pool Address: ${poolAddress}\n\n`;

                    // Get detailed pool information
                    const poolData = await kaminoLiquidityService.getPoolByAddress(poolAddress);
                    
                    if (poolData) {
                        poolInfo += await generatePoolReport(runtime, poolData, kaminoLiquidityService);
                    } else {
                        poolInfo += `❌ No Kamino pool found for address: ${poolAddress}\n\n`;
                        poolInfo += `🔍 Analysis Results:\n`;
                        poolInfo += `   • Address: ${poolAddress}\n`;
                        poolInfo += `   • Searched through Kamino liquidity program\n`;
                        poolInfo += `   • No active pool or strategy found for this address\n\n`;
                        poolInfo += `💡 Possible reasons:\n`;
                        poolInfo += `   • Address may not be a valid Kamino pool address\n`;
                        poolInfo += `   • Pool may have been closed or migrated\n`;
                        poolInfo += `   • Address might be a token address rather than a pool address\n`;
                        poolInfo += `   • Pool might be in a different protocol\n\n`;
                        poolInfo += `🔗 Check available pools at: https://app.kamino.finance/liquidity\n`;
                    }
                } else {
                    // No specific pool address provided, show usage instructions
                    poolInfo += `=== KAMINO POOL PROVIDER ===\n\n`;
                    poolInfo += `🔍 Kamino Pool-Specific Information\n\n`;

                    // Use testConnection to get basic info
                    const testResults = await kaminoLiquidityService.testConnection();
                    
                    poolInfo += `📊 Service Status:\n`;
                    poolInfo += `   ✅ Connection: ${testResults.connectionTest ? 'Connected' : 'Failed'}\n`;
                    poolInfo += `   📋 Program ID: ${testResults.programId}\n`;
                    poolInfo += `   🔗 RPC Endpoint: ${testResults.rpcEndpoint}\n`;
                    poolInfo += `   📈 Available Strategies: ${testResults.strategyCount}\n\n`;

                    // Add usage instructions
                    poolInfo += `💡 How to use:\n`;
                    poolInfo += `   • Provide a pool address to get detailed information\n`;
                    poolInfo += `   • Example: "Kamino stats on pool cccsdfsdsdsxcxcxcsdsdsd"\n`;
                    poolInfo += `   • Example: "Tell me about Kamino pool HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC"\n`;
                    poolInfo += `   • Visit https://app.kamino.finance/liquidity to find pool addresses\n\n`;
                }
            }

        } catch (error) {
            console.error('Error in Kamino pool provider:', error);
            poolInfo = `Error generating Kamino pool report: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }

        const data = {
            kaminoPool: poolInfo
        };

        const values = {};

        const text = poolInfo + '\n';

        return {
            data,
            values,
            text,
        };
    },
};

/**
 * Generate detailed pool report
 */
async function generatePoolReport(runtime: IAgentRuntime, poolData: any, kaminoLiquidityService: KaminoLiquidityService): Promise<string> {
    let report = '';

    try {
        // Pool basic information
        report += `🏊‍♂️ POOL OVERVIEW:\n`;
        report += `   📍 Address: ${poolData.address}\n`;
        report += `   📅 Last Updated: ${new Date(poolData.timestamp).toLocaleString()}\n\n`;

        if (poolData.strategy) {
            const strategy = poolData.strategy;
            
            report += `📊 STRATEGY DETAILS:\n`;
            report += `   🏷️ Type: ${strategy.strategyType}\n`;
            report += `   💰 TVL: $${strategy.estimatedTvl.toLocaleString()}\n`;
            report += `   📈 24h Volume: $${strategy.volume24h.toLocaleString()}\n`;
            report += `   🎯 APY: ${strategy.apy.toFixed(2)}%\n`;
            report += `   💸 Fee Tier: ${strategy.feeTier}\n`;
            report += `   🔄 Rebalancing: ${strategy.rebalancing}\n`;
            report += `   🕒 Last Rebalance: ${new Date(strategy.lastRebalance).toLocaleDateString()}\n\n`;

            // Token information
            report += `🪙 TOKEN PAIR:\n`;
            report += `   Token A: ${strategy.tokenA}\n`;
            report += `   Token B: ${strategy.tokenB}\n\n`;

            // Position details
            if (strategy.positions && strategy.positions.length > 0) {
                report += `📍 POSITIONS:\n`;
                for (const position of strategy.positions) {
                    report += `   • ${position.type}: ${position.range}\n`;
                    report += `     💧 Liquidity: $${position.liquidity.toLocaleString()}\n`;
                    report += `     💰 Fees Earned: $${position.feesEarned.toLocaleString()}\n`;
                }
                report += `\n`;
            }
        }

        // Token information if available
        if (poolData.tokenInfo) {
            const tokenInfo = poolData.tokenInfo;
            report += `🔍 TOKEN INFORMATION:\n`;
            report += `   📝 Name: ${tokenInfo.name}\n`;
            report += `   🔖 Symbol: ${tokenInfo.symbol}\n`;
            report += `   🔗 Address: ${tokenInfo.address}\n`;
            if (tokenInfo.price) {
                report += `   💵 Price: $${tokenInfo.price.toFixed(6)}\n`;
            }
            if (tokenInfo.liquidity) {
                report += `   💧 Liquidity: $${tokenInfo.liquidity.toLocaleString()}\n`;
            }
            if (tokenInfo.marketCap) {
                report += `   📊 Market Cap: $${tokenInfo.marketCap.toLocaleString()}\n`;
            }
            if (tokenInfo.priceChange24h) {
                report += `   📈 24h Change: ${tokenInfo.priceChange24h.toFixed(2)}%\n`;
            }
            report += `\n`;
        }

        // Metrics summary
        if (poolData.metrics) {
            const metrics = poolData.metrics;
            report += `📈 PERFORMANCE METRICS:\n`;
            report += `   💰 Total Value Locked: $${metrics.totalValueLocked.toLocaleString()}\n`;
            report += `   📊 24h Volume: $${metrics.volume24h.toLocaleString()}\n`;
            report += `   🎯 Current APY: ${metrics.apy.toFixed(2)}%\n`;
            report += `   💸 Fee Structure: ${metrics.feeTier}\n`;
            report += `   🔄 Rebalancing Strategy: ${metrics.rebalancing}\n`;
            report += `   📍 Active Positions: ${metrics.positionCount}\n`;
            report += `   🕒 Last Activity: ${new Date(metrics.lastRebalance).toLocaleString()}\n\n`;
        }

        // Generate enhanced analysis using LLM
        const enhancedAnalysis = await generateEnhancedPoolAnalysis(runtime, poolData);
        if (enhancedAnalysis) {
            report += enhancedAnalysis;
        }

        // Add action links
        report += `🔗 ACTIONS:\n`;
        report += `   • View on Kamino: https://app.kamino.finance/liquidity\n`;
        report += `   • Add Liquidity: https://app.kamino.finance/liquidity/deposit\n`;
        report += `   • Monitor Performance: https://app.kamino.finance/liquidity/strategies\n\n`;

    } catch (error) {
        console.error('Error generating pool report:', error);
        report += `❌ Error generating detailed pool report: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
    }

    return report;
}

/**
 * Generate enhanced pool analysis using LLM
 */
async function generateEnhancedPoolAnalysis(runtime: IAgentRuntime, poolData: any): Promise<string> {
    try {
        // Create a focused prompt for the LLM
        const analysisPrompt = `You are a professional DeFi analyst specializing in Kamino Finance liquidity pools. Generate a concise, insightful analysis for the pool with address ${poolData.address}.

POOL DATA:
${JSON.stringify(poolData, null, 2)}

Please provide a brief but comprehensive analysis that includes:

1. **Pool Health Assessment** - Is this pool performing well? What are the key indicators?
2. **Risk Analysis** - What are the main risks for liquidity providers in this pool?
3. **Opportunity Assessment** - What opportunities does this pool present?
4. **Market Context** - How does this pool compare to similar strategies?
5. **Recommendations** - Should someone consider providing liquidity to this pool?

Keep the analysis:
- Professional but accessible
- Focused on actionable insights
- Based on the provided data
- Under 200 words total

Generate a concise Kamino pool analysis:`;

        // Use LLM to generate the enhanced analysis
        const enhancedAnalysis = await runtime.useModel(ModelType.TEXT_LARGE, {
            prompt: analysisPrompt
        });

        if (enhancedAnalysis) {
            return `🧠 AI ANALYSIS:\n${enhancedAnalysis}\n\n`;
        }

        return '';

    } catch (error) {
        console.error('Error generating enhanced pool analysis:', error);
        return ''; // Return empty string if LLM analysis fails
    }
}
