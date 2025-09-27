import type { AgentRuntime, Memory, Provider, State, IAgentRuntime } from '@elizaos/core';
import { ModelType } from '@elizaos/core';
import { KaminoLiquidityService } from '../services/kaminoLiquidityService';

// Import the KaminoStrategy type from the service
interface KaminoStrategy {
    address: string;
    dataSize: number;
    lamports: number;
    owner: string;
    strategyType: string;
    estimatedTvl: number;
    volume24h: number;
    apy: number;
    tokenA: string;
    tokenB: string;
    feeTier: string;
    rebalancing: string;
    lastRebalance: string;
    positions: any[];
}

/**
 * Kamino Liquidity Protocol Provider
 * Provides information about Kamino liquidity pools and strategies
 */
export const kaminoLiquidityProvider: Provider = {
    name: 'KAMINO_LIQUIDITY',
    description: 'Provides information about Kamino liquidity pools, strategies, and token-specific liquidity data',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('KAMINO_LIQUIDITY provider called');

        let liquidityInfo = '';

        try {
            // Extract token address from message content
            const content = message.content.text || '';
            const tokenMatch = content.match(/([A-Za-z0-9]{32,44})/);

            let tokenIdentifier = '';
            if (tokenMatch) {
                tokenIdentifier = tokenMatch[1];
            }

            // Get Kamino liquidity service
            const kaminoLiquidityService = runtime.getService('KAMINO_LIQUIDITY_SERVICE') as unknown as KaminoLiquidityService;
            if (!kaminoLiquidityService) {
                liquidityInfo += '❌ Kamino liquidity service not available.\n';
            } else {
                if (tokenIdentifier) {
                    console.log(`Token identifier found: ${tokenIdentifier}`);

                    liquidityInfo += `=== KAMINO LIQUIDITY POOL STATS ===\n\n`;
                    liquidityInfo += `Token: ${tokenIdentifier}\n\n`;

                    // Resolve token information using Birdeye through the service
                    const tokenInfo = await kaminoLiquidityService.resolveTokenWithBirdeye(tokenIdentifier);
                    if (tokenInfo) {
                        liquidityInfo += `🔍 Token Resolution via Birdeye:\n`;
                        liquidityInfo += `   📝 Name: ${tokenInfo.name}\n`;
                        liquidityInfo += `   🔖 Symbol: ${tokenInfo.symbol}\n`;
                        liquidityInfo += `   🔗 Address: ${tokenInfo.address}\n`;
                        liquidityInfo += `   💵 Price: $${tokenInfo.price?.toFixed(6) || 'N/A'}\n`;
                        liquidityInfo += `   💧 Liquidity: $${tokenInfo.liquidity?.toLocaleString() || 'N/A'}\n`;
                        liquidityInfo += `   📊 Market Cap: $${tokenInfo.marketCap?.toLocaleString() || 'N/A'}\n`;
                        liquidityInfo += `   📈 24h Change: ${tokenInfo.priceChange24h?.toFixed(2) || 'N/A'}%\n\n`;
                    }

                    // Get liquidity pool stats for the specific token using optimized method
                    const poolStats = await getKaminoLiquidityStats(kaminoLiquidityService, tokenIdentifier);
                    
                    // Generate enhanced response using LLM
                    const enhancedReport = await generateEnhancedKaminoLiquidityReport(runtime, {
                        tokenIdentifier,
                        tokenInfo,
                        poolStats,
                        kaminoLiquidityService
                    });
                    
                    liquidityInfo += enhancedReport;
                } else {
                    // No specific token provided, show protocol overview without wasting RPC calls
                    liquidityInfo += `=== KAMINO LIQUIDITY PROTOCOL OVERVIEW ===\n\n`;
                    liquidityInfo += `🔍 Kamino Liquidity Protocol Information\n\n`;

                    // Use testConnection to get basic info without making expensive RPC calls
                    const testResults = await kaminoLiquidityService.testConnection();
                    
                    liquidityInfo += `📊 Protocol Status:\n`;
                    liquidityInfo += `   ✅ Connection: ${testResults.connectionTest ? 'Connected' : 'Failed'}\n`;
                    liquidityInfo += `   📋 Program ID: ${testResults.programId}\n`;
                    liquidityInfo += `   🔗 RPC Endpoint: ${testResults.rpcEndpoint}\n`;
                    liquidityInfo += `   📈 Available Strategies: ${testResults.strategyCount}\n\n`;

                    // Add general Kamino liquidity protocol info
                    liquidityInfo += await getKaminoProtocolInfo(kaminoLiquidityService);

                    // Add usage instructions
                    liquidityInfo += `💡 How to use:\n`;
                    liquidityInfo += `   • Provide a token address to search for specific liquidity pools\n`;
                    liquidityInfo += `   • Example: "Check Kamino liquidity for HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC"\n`;
                    liquidityInfo += `   • Visit https://app.kamino.finance/liquidity to view all pools\n\n`;
                }
            }

        } catch (error) {
            console.error('Error in Kamino liquidity provider:', error);
            liquidityInfo = `Error generating Kamino liquidity report: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }

        const data = {
            kaminoLiquidity: liquidityInfo
        };

        const values = {};

        const text = liquidityInfo + '\n';

        return {
            data,
            values,
            text,
        };
    },
};

/**
 * Get Kamino liquidity pool statistics for a specific token using optimized method
 */
async function getKaminoLiquidityStats(kaminoLiquidityService: KaminoLiquidityService, tokenIdentifier: string): Promise<string> {
    let statsInfo = '';

    try {
        statsInfo += `🔍 SEARCHING FOR KAMINO LIQUIDITY POOLS...\n\n`;

        // Use the optimized getTokenLiquidityStats method that uses filters and getStrategyByAddress
        const tokenStats = await kaminoLiquidityService.getTokenLiquidityStats(tokenIdentifier);

        if (tokenStats.strategies.length > 0) {
            statsInfo += `📊 FOUND ${tokenStats.strategies.length} RELEVANT STRATEGIES:\n\n`;
            statsInfo += `Token: ${tokenStats.tokenName}\n`;
            statsInfo += `Total TVL: $${tokenStats.totalTvl.toLocaleString()}\n`;
            statsInfo += `24h Volume: $${tokenStats.totalVolume.toLocaleString()}\n`;
            statsInfo += `APY Range: ${tokenStats.apyRange.min.toFixed(2)}% - ${tokenStats.apyRange.max.toFixed(2)}%\n\n`;

            // Group strategies by type for better organization
            const strategyTypes = new Map<string, KaminoStrategy[]>();
            tokenStats.strategies.forEach(strategy => {
                const type = strategy.strategyType;
                if (!strategyTypes.has(type)) {
                    strategyTypes.set(type, []);
                }
                strategyTypes.get(type)!.push(strategy);
            });

            for (const [type, strategies] of strategyTypes) {
                statsInfo += `🏊‍♂️ ${type.toUpperCase()} (${strategies.length} strategies):\n`;
                const totalTvl = strategies.reduce((sum, s) => sum + (s.estimatedTvl || 0), 0);
                const avgApy = strategies.reduce((sum, s) => sum + (s.apy || 0), 0) / strategies.length;
                statsInfo += `   💰 Total TVL: $${totalTvl.toLocaleString()}\n`;
                statsInfo += `   🎯 Average APY: ${avgApy.toFixed(2)}%\n\n`;

                // Show details for each strategy in this type
                for (const strategy of strategies) {
                    statsInfo += await getStrategyDetails(strategy);
                }
            }

            // Add direct link to Kamino app for found strategies
            statsInfo += `🔗 **View on Kamino:** https://app.kamino.finance/liquidity\n\n`;
        } else {
            statsInfo += `❌ No Kamino liquidity strategies found for ${tokenIdentifier}\n\n`;
            statsInfo += `🔍 Analysis Results:\n`;
            statsInfo += `   • Token: ${tokenStats.tokenName}\n`;
            statsInfo += `   • Searched through Kamino liquidity program with optimized filters\n`;
            statsInfo += `   • No strategies containing this token were found\n\n`;
            statsInfo += `💡 Possible reasons:\n`;
            statsInfo += `   • Token may not be listed on Kamino liquidity pools\n`;
            statsInfo += `   • Token might be too new or have low liquidity\n`;
            statsInfo += `   • Token may be listed under a different address\n`;
            statsInfo += `   • Token might be in a different strategy type\n\n`;
            statsInfo += `🔗 Check available strategies at: https://app.kamino.finance/liquidity\n`;
        }

        // Add general Kamino liquidity protocol info
        statsInfo += await getKaminoProtocolInfo(kaminoLiquidityService);

    } catch (error) {
        console.error('Error getting Kamino liquidity stats:', error);
        statsInfo += `❌ Error fetching liquidity data: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
    }

    return statsInfo;
}

/**
 * Get detailed information about a specific strategy
 */
async function getStrategyDetails(strategy: any): Promise<string> {
    let details = `   🏊‍♂️ STRATEGY: ${strategy.address}\n`;
    details += `      📈 Type: ${strategy.strategyType}\n`;
    details += `      💰 TVL: $${strategy.estimatedTvl.toLocaleString()}\n`;
    details += `      📊 24h Volume: $${strategy.volume24h.toLocaleString()}\n`;
    details += `      🎯 APY: ${strategy.apy.toFixed(2)}%\n`;
    details += `      🔄 Rebalancing: ${strategy.rebalancing}\n`;
    details += `      💸 Fee Tier: ${strategy.feeTier}\n`;
    details += `      🕒 Last Rebalance: ${new Date(strategy.lastRebalance).toLocaleDateString()}\n`;

    if (strategy.positions && strategy.positions.length > 0) {
        details += `      📍 Positions:\n`;
        for (const position of strategy.positions) {
            details += `         • ${position.type}: ${position.range} ($${position.liquidity.toLocaleString()})\n`;
        }
    }

    details += `\n`;

    return details;
}

/**
 * Get general Kamino protocol information
 */
async function getKaminoProtocolInfo(kaminoLiquidityService: KaminoLiquidityService): Promise<string> {
    let info = `🌊 KAMINO LIQUIDITY PROTOCOL INFO:\n\n`;

    try {
        const testResults = await kaminoLiquidityService.testConnection();

        info += `📋 Program ID: ${testResults.programId}\n`;
        info += `🔗 RPC Endpoint: ${testResults.rpcEndpoint}\n`;
        info += `✅ Connection Status: ${testResults.connectionTest ? 'Connected' : 'Failed'}\n`;
        info += `📊 Strategy Count: ${testResults.strategyCount}\n\n`;

        info += `🔗 Useful Links:\n`;
        info += `   • Kamino App: https://app.kamino.finance/liquidity\n`;
        info += `   • Documentation: https://docs.kamino.finance\n`;
        info += `   • GitHub: https://github.com/Kamino-Finance\n\n`;

        info += `💡 How to use:\n`;
        info += `   • Visit the Kamino app to view all available liquidity pools\n`;
        info += `   • Deposit tokens to earn yield from automated market making\n`;
        info += `   • Strategies automatically rebalance to maintain optimal positions\n`;

    } catch (error) {
        console.error('Error getting protocol info:', error);
        info += `❌ Error fetching protocol information\n`;
    }

    return info;
}

/**
 * Generate enhanced Kamino liquidity report using LLM
 */
async function generateEnhancedKaminoLiquidityReport(runtime: IAgentRuntime, data: {
    tokenIdentifier: string;
    tokenInfo: any;
    poolStats: string;
    kaminoLiquidityService: KaminoLiquidityService;
}): Promise<string> {
    try {
        // Get additional market context
        const marketStats = await data.kaminoLiquidityService.getMarketStatistics();
        
        // Create a focused prompt for the LLM
        const liquidityPrompt = `You are a professional DeFi analyst specializing in Kamino Finance liquidity protocols. Generate a comprehensive, well-crafted analysis report for the token ${data.tokenIdentifier}.

TOKEN INFORMATION:
${JSON.stringify(data.tokenInfo, null, 2)}

POOL STATISTICS:
${data.poolStats}

MARKET CONTEXT:
${JSON.stringify(marketStats, null, 2)}

Please generate a professional, engaging report that includes:

1. **Token Overview** - Brief introduction to the token and its market position
2. **Liquidity Analysis** - Detailed breakdown of Kamino liquidity pools and strategies
3. **Performance Metrics** - TVL, APY ranges, volume analysis, and key performance indicators
4. **Strategy Assessment** - Analysis of different strategy types (staking, Limo trading) and their effectiveness
5. **Market Insights** - How this token's liquidity compares to market trends
6. **Risk & Opportunity Analysis** - Key risks and opportunities for liquidity providers
7. **Investment Recommendations** - Clear, actionable insights for potential investors

Format the report with:
- Clear sections with descriptive headers
- Use emojis for visual appeal and quick scanning
- Include specific numbers and percentages
- Provide professional but engaging tone
- Focus on actionable insights
- Include relevant comparisons to market standards
- End with a concise summary

Make it comprehensive yet easy to read. Be specific about the data and provide clear insights about this particular token's liquidity situation on Kamino Finance.

Generate a professional Kamino liquidity analysis report:`;

        // Use LLM to generate the enhanced report
        const enhancedReport = await runtime.useModel(ModelType.TEXT_LARGE, {
            prompt: liquidityPrompt
        });

        return enhancedReport || data.poolStats;

    } catch (error) {
        console.error('Error generating enhanced Kamino liquidity report:', error);
        return data.poolStats; // Fallback to original stats
    }
}