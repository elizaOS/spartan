import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { SteerLiquidityService } from '../services/steerLiquidityService';

/**
 * Steer Finance Liquidity Protocol Provider
 * Provides information about Steer Finance vaults and staking pools
 */
export const steerLiquidityProvider: Provider = {
    name: 'STEER_LIQUIDITY',
    description: 'Provides information about Steer Finance vaults, staking pools, and token-specific liquidity data across multiple chains',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('🚀 STEER_LIQUIDITY provider called');
        console.log('📝 Message content:', message.content.text);
        console.log('📺 Channel type:', message.content.channelType);
        console.log('🔧 Runtime methods available:', {
            getService: !!runtime.getService,
            getCache: !!runtime.getCache,
            getSetting: !!runtime.getSetting
        });

        let liquidityInfo = '';

        try {
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

            // Extract token address and chain from message content
            const content = message.content.text || '';
            console.log('Searching for token address and chain in content:', content);
            
            // More flexible regex to catch various formats
            const tokenMatch = content.match(/(0x[a-fA-F0-9]{40})/);
            console.log('Token match result:', tokenMatch);

            // Also try to find any 0x pattern that might be a token address
            const anyHexMatch = content.match(/(0x[a-fA-F0-9]+)/);
            console.log('Any hex match result:', anyHexMatch);

            // Extract chain name from content
            const chainMatch = content.match(/\b(base|ethereum|mainnet|polygon|arbitrum|optimism)\b/i);
            console.log('Chain match result:', chainMatch);
            
            // Map chain names to chain IDs
            const chainNameToId: { [key: string]: number } = {
                'ethereum': 1,
                'mainnet': 1,
                'polygon': 137,
                'arbitrum': 42161,
                'optimism': 10,
                'base': 8453
            };
            
            const targetChainId = chainMatch ? chainNameToId[chainMatch[1].toLowerCase()] : null;
            console.log('Target chain ID:', targetChainId);
            
            // Validate chain if specified
            if (targetChainId && chainMatch && !chainNameToId[chainMatch[1].toLowerCase()]) {
                liquidityInfo += `❌ Unsupported chain: ${chainMatch[1]}\n`;
                liquidityInfo += `Supported chains: ${Object.keys(chainNameToId).join(', ')}\n\n`;
                return {
                    data: { steerLiquidity: liquidityInfo },
                    values: {},
                    text: liquidityInfo,
                };
            }

            if (tokenMatch) {
                const tokenIdentifier = tokenMatch[1];
                console.log(`Token identifier found: ${tokenIdentifier}`);

                // Validate token address format
                if (!isValidEthereumAddress(tokenIdentifier)) {
                    liquidityInfo += `❌ Invalid Ethereum address format: ${tokenIdentifier}\n`;
                    liquidityInfo += `Ethereum addresses must be exactly 40 hex characters (42 total with 0x prefix).\n\n`;
                    liquidityInfo += `Please provide a valid address like:\n`;
                    liquidityInfo += `• 0xA0b86a33E6441b8c4C8C1C1B8c4C8C1C1B8c4C8C1B8 (USDC)\n`;
                    liquidityInfo += `• 0x6B175474E89094C44Da98b954EedeAC495271d0F (DAI)\n`;
                    liquidityInfo += `• 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 (WETH)\n\n`;
                } else {
                    // Get token-specific liquidity stats with optional chain filtering
                    const tokenStats = await getSteerLiquidityStats(steerLiquidityService, tokenIdentifier, targetChainId);
                    liquidityInfo += tokenStats;

                    // Add single-asset deposit information if available
                    const depositInfo = await getSingleAssetDepositInfo(steerLiquidityService, tokenIdentifier, targetChainId);
                    liquidityInfo += depositInfo;
                }
            } else if (anyHexMatch) {
                // Found a hex pattern but it's not exactly 40 characters
                const foundHex = anyHexMatch[1];
                liquidityInfo += `⚠️ Found potential token address: ${foundHex}\n`;
                liquidityInfo += `❌ Invalid Ethereum address format: ${foundHex}\n`;
                liquidityInfo += `Ethereum addresses must be exactly 40 hex characters (42 total with 0x prefix).\n\n`;
                liquidityInfo += `Please provide a valid address like:\n`;
                liquidityInfo += `• 0x1234567890123456789012345678901234567890\n`;
                liquidityInfo += `• 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd\n`;
                liquidityInfo += `• 0x9876543210987654321098765432109876543210\n\n`;
                liquidityInfo += `🔍 Your input "${foundHex}" has ${foundHex.length - 2} hex characters, but needs exactly 40.\n\n`;
            } else {
                // No specific token provided, show protocol overview
                    liquidityInfo += `=== STEER FINANCE PROTOCOL OVERVIEW ===\n\n`;
                    liquidityInfo += `🔍 Steer Finance Liquidity Protocol Information\n\n`;

                    // Use testConnection to get basic info without making expensive RPC calls
                    const testResults = await steerLiquidityService.testConnection();
                    
                    liquidityInfo += `📊 Protocol Status:\n`;
                    liquidityInfo += `   ✅ Connection: ${testResults.connectionTest ? 'Connected' : 'Failed'}\n`;
                    liquidityInfo += `   🌐 Supported Chains: ${testResults.supportedChains.map(getChainName).join(', ')}\n`;
                    liquidityInfo += `   📈 Available Vaults: ${testResults.vaultCount}\n`;
                    liquidityInfo += `   🔒 Available Staking Pools: ${testResults.stakingPoolCount}\n\n`;

                    // Add general Steer Finance protocol info
                    liquidityInfo += await getSteerProtocolInfo(steerLiquidityService);

                    // Add usage instructions
                    liquidityInfo += `💡 How to use:\n`;
                    liquidityInfo += `   • Provide a token address to search for specific liquidity pools\n`;
                    liquidityInfo += `   • Optionally specify a chain to filter results (faster)\n`;
                    liquidityInfo += `   • Example: "Check Steer Finance pools for 0xA0b86a33E6441b8c4C8C1C1B8c4C8C1C1B8c4C8C1B8 on base"\n`;
                    liquidityInfo += `   • Supported chains: ${Object.keys(chainNameToId).join(', ')}\n`;
                    liquidityInfo += `   • Visit https://app.steer.finance to view all pools\n\n`;
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
async function getSteerLiquidityStats(steerLiquidityService: SteerLiquidityService, tokenIdentifier: string, targetChainId?: number | null): Promise<string> {
    let statsInfo = '';

    try {
        // Add chain filtering info if specified
        if (targetChainId) {
            const chainName = getChainName(targetChainId);
            statsInfo += `🔍 SEARCHING FOR STEER FINANCE LIQUIDITY POOLS ON ${chainName.toUpperCase()}...\n\n`;
        } else {
            statsInfo += `🔍 SEARCHING FOR STEER FINANCE LIQUIDITY POOLS...\n\n`;
        }

        // Get detailed liquidity stats for the token with optional chain filtering
        const tokenStats = await steerLiquidityService.getTokenLiquidityStats(tokenIdentifier, targetChainId);

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
    let details = `🏦 VAULT: ${vault.address}\n`;
    details += `   📈 Name: ${vault.name}\n`;
    details += `   🌐 Chain: ${getChainName(vault.chainId)}\n`;
    details += `   💰 TVL: $${vault.tvl.toLocaleString()}\n`;
    details += `   📊 24h Volume: $${vault.volume24h.toLocaleString()}\n`;
    details += `   🎯 APY: ${vault.apy.toFixed(2)}%\n`;
    details += `   🔄 Strategy Type: ${vault.strategyType}\n`;
    details += `   💸 Fee: ${vault.fee}%\n`;
    details += `   🕒 Created: ${new Date(vault.createdAt).toLocaleDateString()}\n`;
    details += `   ✅ Status: ${vault.isActive ? 'Active' : 'Inactive'}\n`;
    
    // Show full token addresses if available
    if (vault.token0 && vault.token0 !== 'Unknown') {
        const token0Address = typeof vault.token0 === 'string' ? vault.token0 : vault.token0?.address || 'Unknown';
        const token0Symbol = getTokenSymbol(token0Address);
        details += `   🪙 Token0: ${token0Address} (${token0Symbol})\n`;
    } else {
        details += `   🪙 Token0: Unknown\n`;
    }
    
    if (vault.token1 && vault.token1 !== 'Unknown') {
        const token1Address = typeof vault.token1 === 'string' ? vault.token1 : vault.token1?.address || 'Unknown';
        const token1Symbol = getTokenSymbol(token1Address);
        details += `   🪙 Token1: ${token1Address} (${token1Symbol})\n`;
    } else {
        details += `   🪙 Token1: Unknown\n`;
    }

    // Display GraphQL enriched data if available
    if (vault.graphqlData) {
        details += `\n   📊 GRAPHQL ENRICHED DATA:\n`;
        details += `      🎯 Weekly Fee APR: ${vault.graphqlData.weeklyFeeAPR.toFixed(2)}%\n`;
        details += `      🪙 Token0 Symbol: ${vault.graphqlData.token0Symbol}\n`;
        details += `      🪙 Token0 Decimals: ${vault.graphqlData.token0Decimals}\n`;
        details += `      🪙 Token1 Symbol: ${vault.graphqlData.token1Symbol}\n`;
        details += `      🪙 Token1 Decimals: ${vault.graphqlData.token1Decimals}\n`;
        details += `      💰 Token0 Balance: ${vault.graphqlData.token0Balance}\n`;
        details += `      💰 Token1 Balance: ${vault.graphqlData.token1Balance}\n`;
        details += `      🏊 Total LP Tokens: ${vault.graphqlData.totalLPTokensIssued}\n`;
        details += `      💸 Fee Tier: ${vault.graphqlData.feeTier} (${(vault.graphqlData.feeTier / 10000).toFixed(2)}%)\n`;
        details += `      💰 Fees0: ${vault.graphqlData.fees0}\n`;
        details += `      💰 Fees1: ${vault.graphqlData.fees1}\n`;
        
        if (vault.graphqlData.strategyToken) {
            details += `      🎭 Strategy Token: ${vault.graphqlData.strategyToken.name}\n`;
            details += `      👤 Creator: ${vault.graphqlData.strategyToken.creator.id}\n`;
            details += `      👑 Admin: ${vault.graphqlData.strategyToken.admin}\n`;
        }
        
        details += `      🔧 Beacon Name: ${vault.graphqlData.beaconName}\n`;
        details += `      📝 Payload IPFS: ${vault.graphqlData.payloadIpfs}\n`;
        details += `      🚀 Deployer: ${vault.graphqlData.deployer}\n`;
        
        if (vault.calculatedTvl !== undefined) {
            details += `      💰 Calculated TVL: $${vault.calculatedTvl.toLocaleString()}\n`;
        }
    }

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
    let details = `🔒 STAKING POOL: ${pool.address}\n`;
    details += `   📈 Name: ${pool.name}\n`;
    details += `   🌐 Chain: ${getChainName(pool.chainId)}\n`;
    details += `   💰 Total Staked: $${pool.totalStakedUSD.toLocaleString()}\n`;
    details += `   🎯 APR: ${pool.apr.toFixed(2)}%\n`;
    details += `   🪙 Staking Token: ${pool.stakingToken}\n`;
    details += `   🎁 Reward Token: ${pool.rewardToken}\n`;
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

        // Test GraphQL connection
        const graphqlStatus = await steerLiquidityService.testGraphQLConnection();
        info += `🔍 GraphQL Subgraph: ${graphqlStatus.success ? 'Connected' : 'Failed'}\n`;
        if (!graphqlStatus.success && graphqlStatus.error) {
            info += `   ⚠️ GraphQL Error: ${graphqlStatus.error}\n`;
        }
        info += `\n`;

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
async function getSingleAssetDepositInfo(steerLiquidityService: SteerLiquidityService, tokenIdentifier: string, targetChainId?: number | null): Promise<string> {
    let depositInfo = '\n💎 SINGLE-ASSET DEPOSIT INFORMATION:\n\n';

    try {
        // Get token stats to find vaults with optional chain filtering
        const tokenStats = await steerLiquidityService.getTokenLiquidityStats(tokenIdentifier, targetChainId);

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
                depositInfo += `   🏊 Pool: ${vault.poolAddress || 'N/A'}\n`;
                depositInfo += `   📝 Single-Asset Contract: ${vault.singleAssetDepositContract}\n`;
                depositInfo += `   🪙 Token0: ${vault.token0} (${getTokenSymbol(typeof vault.token0 === 'string' ? vault.token0 : vault.token0?.address || 'Unknown')})\n`;
                depositInfo += `   🪙 Token1: ${vault.token1} (${getTokenSymbol(typeof vault.token1 === 'string' ? vault.token1 : vault.token1?.address || 'Unknown')})\n`;
                
                // Add additional APY breakdown if available
                if (vault.apr1d || vault.apr7d || vault.apr14d) {
                    depositInfo += `   📊 APY Breakdown:\n`;
                    if (vault.apr1d) depositInfo += `      • 1D: ${vault.apr1d.toFixed(2)}%\n`;
                    if (vault.apr7d) depositInfo += `      • 7D: ${vault.apr7d.toFixed(2)}%\n`;
                    if (vault.apr14d) depositInfo += `      • 14D: ${vault.apr14d.toFixed(2)}%\n`;
                }
                
                // Add fee breakdown if available
                if (vault.feeApr || vault.stakingApr || vault.merklApr) {
                    depositInfo += `   💸 Fee Breakdown:\n`;
                    if (vault.feeApr) depositInfo += `      • Fee APY: ${vault.feeApr.toFixed(2)}%\n`;
                    if (vault.stakingApr) depositInfo += `      • Staking APY: ${vault.stakingApr.toFixed(2)}%\n`;
                    if (vault.merklApr) depositInfo += `      • Merkl APY: ${vault.merklApr.toFixed(2)}%\n`;
                }
                depositInfo += `\n`;

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

/**
 * Validate Ethereum address format
 */
function isValidEthereumAddress(address: string): boolean {
    // Check if it starts with 0x and has exactly 40 hex characters
    const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    return ethereumAddressRegex.test(address);
}

/**
 * Get token symbol from token address
 */
function getTokenSymbol(address: string): string {
    if (!address || address === 'Unknown') {
        return 'Unknown';
    }
    
    // Return shortened address for all tokens
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
