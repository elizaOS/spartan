import type { AgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { KaminoLiquidityService } from '../services/kaminoLiquidityService';

/**
 * Kamino Liquidity Protocol Provider
 * Provides information about Kamino liquidity pools and strategies
 */
export const kaminoLiquidityProvider: Provider = {
    name: 'KAMINO_LIQUIDITY',
    description: 'Provides information about Kamino liquidity pools, strategies, and token-specific liquidity data',
    dynamic: true,
    get: async (runtime: AgentRuntime, message: Memory, state: State) => {
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

            if (tokenIdentifier) {
                console.log(`Token identifier found: ${tokenIdentifier}`);

                liquidityInfo += `=== KAMINO LIQUIDITY POOL STATS ===\n\n`;
                liquidityInfo += `Token: ${tokenIdentifier}\n\n`;

                // Get Kamino liquidity service
                const kaminoLiquidityService = runtime.getService('KAMINO_LIQUIDITY_SERVICE') as unknown as KaminoLiquidityService;
                if (!kaminoLiquidityService) {
                    liquidityInfo += '❌ Kamino liquidity service not available.\n';
                } else {
                    // Get liquidity pool stats for the specific token
                    const poolStats = await getKaminoLiquidityStats(kaminoLiquidityService, tokenIdentifier);
                    liquidityInfo += poolStats;
                }

            } else {
                liquidityInfo = 'Please provide a valid token address to get Kamino liquidity pool statistics.';
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
 * Get Kamino liquidity pool statistics for a specific token
 */
async function getKaminoLiquidityStats(kaminoLiquidityService: KaminoLiquidityService, tokenIdentifier: string): Promise<string> {
    let statsInfo = '';

    try {
        statsInfo += `🔍 SEARCHING FOR KAMINO LIQUIDITY POOLS...\n\n`;

        // Get detailed liquidity stats for the token
        const tokenStats = await kaminoLiquidityService.getTokenLiquidityStats(tokenIdentifier);

        if (tokenStats.strategies.length > 0) {
            statsInfo += `📊 FOUND ${tokenStats.strategies.length} RELEVANT STRATEGIES:\n\n`;
            statsInfo += `Token: ${tokenStats.tokenName}\n`;
            statsInfo += `Total TVL: $${tokenStats.totalTvl.toLocaleString()}\n`;
            statsInfo += `24h Volume: $${tokenStats.totalVolume.toLocaleString()}\n`;
            statsInfo += `APY Range: ${tokenStats.apyRange.min.toFixed(2)}% - ${tokenStats.apyRange.max.toFixed(2)}%\n\n`;

            for (const strategy of tokenStats.strategies) {
                statsInfo += await getStrategyDetails(strategy);
            }

            // Add direct link to Kamino app for found strategies
            statsInfo += `🔗 **View on Kamino:** https://app.kamino.finance/liquidity\n\n`;
        } else {
            statsInfo += `❌ No Kamino liquidity strategies found for ${tokenIdentifier}\n\n`;
            statsInfo += `This token may not be part of any active Kamino liquidity pools.\n`;
            statsInfo += `You can check available strategies at: https://app.kamino.finance/liquidity\n`;
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
    let details = `🏊‍♂️ STRATEGY: ${strategy.address.slice(0, 8)}...${strategy.address.slice(-8)}\n`;
    details += `   📈 Type: ${strategy.strategyType}\n`;
    details += `   💰 TVL: $${strategy.estimatedTvl.toLocaleString()}\n`;
    details += `   📊 24h Volume: $${strategy.volume24h.toLocaleString()}\n`;
    details += `   🎯 APY: ${strategy.apy.toFixed(2)}%\n`;
    details += `   🔄 Rebalancing: ${strategy.rebalancing}\n`;
    details += `   💸 Fee Tier: ${strategy.feeTier}\n`;
    details += `   🕒 Last Rebalance: ${new Date(strategy.lastRebalance).toLocaleDateString()}\n`;

    if (strategy.positions && strategy.positions.length > 0) {
        details += `   📍 Positions:\n`;
        for (const position of strategy.positions) {
            details += `      • ${position.type}: ${position.range} ($${position.liquidity.toLocaleString()})\n`;
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
