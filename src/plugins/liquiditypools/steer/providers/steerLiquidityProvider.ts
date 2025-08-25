import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { SteerLiquidityService } from '../services/steerLiquidityService';
import { getAccountFromMessage } from '../../../autonomous-trader/utils';

/**
 * Steer Finance Liquidity Protocol Provider
 * Provides information about Steer Finance vaults and staking pools
 */
export const steerLiquidityProvider: Provider = {
    name: 'STEER_LIQUIDITY',
    description: 'Provides information about Steer Finance vaults, staking pools, and token-specific liquidity data across multiple chains',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('STEER_LIQUIDITY provider called');

        let liquidityInfo = '';

        try {
            // Check if this is a DM (private message)
            const isDM = message.content.channelType?.toUpperCase() === 'DM';
            if (isDM) {
                const account = await getAccountFromMessage(runtime, message);
                if (!account) {
                    console.log('No account found for user');
                    return {
                        data: {},
                        values: {},
                        text: 'No account found for this user.',
                    };
                }

                console.log('Account found, getting Steer service...');

                // Get Steer liquidity service with proper type casting
                const steerLiquidityService = runtime.getService('STEER_LIQUIDITY_SERVICE') as unknown as SteerLiquidityService;
                if (!steerLiquidityService) {
                    console.log('Steer liquidity service not available');
                    return {
                        data: {},
                        values: {},
                        text: 'Steer liquidity service not available.',
                    };
                }

                console.log('Steer liquidity service found, generating report...');

                liquidityInfo += `=== STEER FINANCE LIQUIDITY POOLS REPORT ===\n\n`;

                // Extract token address from message content
                const content = message.content.text || '';
                const tokenMatch = content.match(/(0x[a-fA-F0-9]{40})/);

                if (tokenMatch) {
                    const tokenIdentifier = tokenMatch[1];
                    console.log(`Token identifier found: ${tokenIdentifier}`);

                    // Get token-specific liquidity stats
                    const tokenStats = await getSteerLiquidityStats(steerLiquidityService, tokenIdentifier);
                    liquidityInfo += tokenStats;

                    // Add single-asset deposit information if available
                    const depositInfo = await getSingleAssetDepositInfo(steerLiquidityService, tokenIdentifier);
                    liquidityInfo += depositInfo;
                } else {
                    // Get general Steer Finance overview
                    const generalOverview = await getSteerGeneralOverview(steerLiquidityService);
                    liquidityInfo += generalOverview;
                }

            } else {
                liquidityInfo = 'Steer Finance liquidity pool information is only available in private messages.';
            }
        } catch (error) {
            console.error('Error in Steer liquidity provider:', error);
            liquidityInfo = `Error generating Steer liquidity report: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }

        const data = {
            steerLiquidity: liquidityInfo
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
 * Get Steer Finance liquidity pool statistics for a specific token
 */
async function getSteerLiquidityStats(steerLiquidityService: SteerLiquidityService, tokenIdentifier: string): Promise<string> {
    let statsInfo = '';

    try {
        statsInfo += `🔍 SEARCHING FOR STEER FINANCE LIQUIDITY POOLS...\n\n`;

        // Get detailed liquidity stats for the token
        const tokenStats = await steerLiquidityService.getTokenLiquidityStats(tokenIdentifier);

        if (tokenStats.vaults.length > 0 || tokenStats.stakingPools.length > 0) {
            statsInfo += `📊 FOUND ${tokenStats.vaultCount} VAULTS AND ${tokenStats.stakingPoolCount} STAKING POOLS:\n\n`;
            statsInfo += `Token: ${tokenStats.tokenName}\n`;
            statsInfo += `Total TVL: $${tokenStats.totalTvl.toLocaleString()}\n`;
            statsInfo += `24h Volume: $${tokenStats.totalVolume.toLocaleString()}\n`;
            statsInfo += `APY Range: ${tokenStats.apyRange.min.toFixed(2)}% - ${tokenStats.apyRange.max.toFixed(2)}%\n\n`;

            // Display vaults
            if (tokenStats.vaults.length > 0) {
                statsInfo += `🏦 VAULTS (${tokenStats.vaults.length}):\n\n`;
                for (const vault of tokenStats.vaults) {
                    statsInfo += await getVaultDetails(vault);
                }
            }

            // Display staking pools
            if (tokenStats.stakingPools.length > 0) {
                statsInfo += `🔒 STAKING POOLS (${tokenStats.stakingPools.length}):\n\n`;
                for (const pool of tokenStats.stakingPools) {
                    statsInfo += await getStakingPoolDetails(pool);
                }
            }

            // Add direct link to Steer app for found strategies
            statsInfo += `🔗 **View on Steer Finance:** https://app.steer.finance\n\n`;
        } else {
            statsInfo += `❌ No Steer Finance liquidity pools found for ${tokenIdentifier}\n\n`;
            statsInfo += `This token may not be part of any active Steer Finance vaults or staking pools.\n`;
            statsInfo += `You can check available pools at: https://app.steer.finance\n`;
        }

        // Add general Steer Finance protocol info
        statsInfo += await getSteerProtocolInfo(steerLiquidityService);

    } catch (error) {
        console.error('Error getting Steer liquidity stats:', error);
        statsInfo += `❌ Error fetching liquidity data: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
    }

    return statsInfo;
}

/**
 * Get detailed information about a specific vault
 */
async function getVaultDetails(vault: any): Promise<string> {
    let details = `🏦 VAULT: ${vault.address.slice(0, 8)}...${vault.address.slice(-8)}\n`;
    details += `   📈 Name: ${vault.name}\n`;
    details += `   🌐 Chain: ${getChainName(vault.chainId)}\n`;
    details += `   💰 TVL: $${vault.tvl.toLocaleString()}\n`;
    details += `   📊 24h Volume: $${vault.volume24h.toLocaleString()}\n`;
    details += `   🎯 APY: ${vault.apy.toFixed(2)}%\n`;
    details += `   🔄 Strategy Type: ${vault.strategyType}\n`;
    details += `   💸 Fee: ${vault.fee}%\n`;
    details += `   🕒 Created: ${new Date(vault.createdAt).toLocaleDateString()}\n`;
    details += `   ✅ Status: ${vault.isActive ? 'Active' : 'Inactive'}\n`;
    details += `   🪙 Token0: ${vault.token0.slice(0, 8)}...${vault.token0.slice(-6)}\n`;
    details += `   🪙 Token1: ${vault.token1.slice(0, 8)}...${vault.token1.slice(-6)}\n`;

    if (vault.positions && vault.positions.length > 0) {
        details += `   📍 Positions:\n`;
        for (const position of vault.positions) {
            details += `      • ${position.type}: ${position.range} ($${position.liquidity.toLocaleString()})\n`;
        }
    }

    details += `\n`;

    return details;
}

/**
 * Get detailed information about a specific staking pool
 */
async function getStakingPoolDetails(pool: any): Promise<string> {
    let details = `🔒 STAKING POOL: ${pool.address.slice(0, 8)}...${pool.address.slice(-8)}\n`;
    details += `   📈 Name: ${pool.name}\n`;
    details += `   🌐 Chain: ${getChainName(pool.chainId)}\n`;
    details += `   💰 Total Staked: $${pool.totalStakedUSD.toLocaleString()}\n`;
    details += `   🎯 APR: ${pool.apr.toFixed(2)}%\n`;
    details += `   🪙 Staking Token: ${pool.stakingToken.slice(0, 8)}...${pool.stakingToken.slice(-6)}\n`;
    details += `   🎁 Reward Token: ${pool.rewardToken.slice(0, 8)}...${pool.rewardToken.slice(-6)}\n`;
    details += `   📊 Reward Rate: ${pool.rewardRate.toLocaleString()}\n`;
    details += `   🕒 Period Finish: ${new Date(pool.periodFinish).toLocaleDateString()}\n`;
    details += `   ✅ Status: ${pool.isActive ? 'Active' : 'Inactive'}\n`;

    details += `\n`;

    return details;
}

/**
 * Get chain name from chain ID
 */
function getChainName(chainId: number): string {
    const chainNames: { [key: number]: string } = {
        1: 'Ethereum Mainnet',
        137: 'Polygon',
        42161: 'Arbitrum One',
        10: 'Optimism'
    };
    return chainNames[chainId] || `Chain ${chainId}`;
}

/**
 * Get general Steer Finance protocol information
 */
async function getSteerProtocolInfo(steerLiquidityService: SteerLiquidityService): Promise<string> {
    let info = `🎯 STEER FINANCE PROTOCOL INFO:\n\n`;

    try {
        const testResults = await steerLiquidityService.testConnection();

        info += `🌐 Supported Chains: ${testResults.supportedChains.map(getChainName).join(', ')}\n`;
        info += `✅ Connection Status: ${testResults.connectionTest ? 'Connected' : 'Failed'}\n`;
        info += `📊 Total Vaults: ${testResults.vaultCount}\n`;
        info += `🔒 Total Staking Pools: ${testResults.stakingPoolCount}\n\n`;

        if (testResults.error) {
            info += `⚠️ Connection Errors: ${testResults.error}\n\n`;
        }

        info += `🔗 Useful Links:\n`;
        info += `   • Steer Finance App: https://app.steer.finance\n`;
        info += `   • Documentation: https://docs.steer.finance\n`;
        info += `   • GitHub: https://github.com/steer-finance\n\n`;

        info += `💡 How to use:\n`;
        info += `   • Visit the Steer Finance app to view all available vaults and staking pools\n`;
        info += `   • Deposit tokens into vaults to earn yield from automated market making\n`;
        info += `   • Stake tokens in staking pools to earn additional rewards\n`;
        info += `   • Vaults automatically rebalance to maintain optimal positions\n`;

    } catch (error) {
        console.error('Error getting protocol info:', error);
        info += `❌ Error fetching protocol information\n`;
    }

    return info;
}

/**
 * Get general Steer Finance overview
 */
async function getSteerGeneralOverview(steerLiquidityService: SteerLiquidityService): Promise<string> {
    let overview = '📊 STEER FINANCE OVERVIEW:\n\n';

    try {
        const testResults = await steerLiquidityService.testConnection();

        overview += `🌐 Supported Chains: ${testResults.supportedChains.map(getChainName).join(', ')}\n`;
        overview += `✅ Connection Status: ${testResults.connectionTest ? 'Connected' : 'Failed'}\n`;
        overview += `📊 Total Vaults: ${testResults.vaultCount}\n`;
        overview += `🔒 Total Staking Pools: ${testResults.stakingPoolCount}\n\n`;

        if (testResults.error) {
            overview += `⚠️ Connection Errors: ${testResults.error}\n\n`;
        }

    } catch (error) {
        console.error('Error getting general overview:', error);
        overview += `❌ Error fetching general overview\n`;
    }

    return overview;
}

/**
 * Get single-asset deposit information for a token
 */
async function getSingleAssetDepositInfo(steerLiquidityService: SteerLiquidityService, tokenIdentifier: string): Promise<string> {
    let depositInfo = '\n💎 SINGLE-ASSET DEPOSIT INFORMATION:\n\n';

    try {
        // Get token stats to find vaults
        const tokenStats = await steerLiquidityService.getTokenLiquidityStats(tokenIdentifier);

        if (tokenStats.vaults.length === 0) {
            depositInfo += 'No vaults found for this token.\n';
            return depositInfo;
        }

        depositInfo += `Found ${tokenStats.vaults.length} vault(s) supporting single-asset deposits:\n\n`;

        for (const vault of tokenStats.vaults) {
            if (vault.singleAssetDepositContract) {
                depositInfo += `🏦 Vault: ${vault.name}\n`;
                depositInfo += `   📍 Address: ${vault.address}\n`;
                depositInfo += `   🌐 Chain: ${getChainName(vault.chainId)}\n`;
                depositInfo += `   💰 TVL: $${vault.tvl.toLocaleString()}\n`;
                depositInfo += `   🎯 APY: ${vault.apy.toFixed(2)}%\n`;
                depositInfo += `   🔄 Strategy: ${vault.strategyType}\n`;
                depositInfo += `   🏊 Pool: ${vault.poolAddress ? vault.poolAddress.slice(0, 8) + '...' + vault.poolAddress.slice(-6) : 'N/A'}\n`;
                depositInfo += `   📝 Single-Asset Contract: ${vault.singleAssetDepositContract.slice(0, 8)}...${vault.singleAssetDepositContract.slice(-6)}\n`;
                depositInfo += `   🪙 Token0: ${vault.token0.slice(0, 8)}...${vault.token0.slice(-6)}\n`;
                depositInfo += `   🪙 Token1: ${vault.token1.slice(0, 8)}...${vault.token1.slice(-6)}\n\n`;

                depositInfo += `   💡 Single-Asset Deposit Features:\n`;
                depositInfo += `      • Deposit only one token (${tokenIdentifier === vault.token0.toLowerCase() ? 'Token0' : 'Token1'})\n`;
                depositInfo += `      • Automatic internal swap to balance the pair\n`;
                depositInfo += `      • Configurable slippage protection\n`;
                depositInfo += `      • Preview functionality before execution\n`;
                depositInfo += `      • UniswapV3 AMM support\n\n`;
            }
        }

        depositInfo += `🔗 To use single-asset deposits:\n`;
        depositInfo += `   • Visit https://app.steer.finance\n`;
        depositInfo += `   • Select a vault that supports single-asset deposits\n`;
        depositInfo += `   • Choose your token and amount\n`;
        depositInfo += `   • Preview the transaction before executing\n\n`;

    } catch (error) {
        console.error('Error getting single-asset deposit info:', error);
        depositInfo += `❌ Error fetching single-asset deposit information\n`;
    }

    return depositInfo;
}
