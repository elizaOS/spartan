import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { MeteoraService } from '../services/meteoraService';
import { getAccountFromMessage } from '../../../autonomous-trader/utils';

/**
 * Meteora Liquidity Pool Provider
 * Provides information about Meteora pools and user positions
 */
export const meteoraProvider: Provider = {
    name: 'METEORA_LIQUIDITY_POOLS',
    description: 'Provides information about Meteora liquidity pools, user positions, and pool analytics',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('METEORA_LIQUIDITY_POOLS provider called');

        let meteoraInfo = '';

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

                console.log('Account found, getting Meteora service...');

                // Get Meteora service with proper type casting
                const meteoraService = runtime.getService('METEORA_SERVICE') as unknown as MeteoraService;
                if (!meteoraService) {
                    console.log('Meteora service not available');
                    return {
                        data: {},
                        values: {},
                        text: 'Meteora service not available.',
                    };
                }

                console.log('Meteora service found, generating report...');

                meteoraInfo += `=== METEORA LIQUIDITY POOLS REPORT ===\n\n`;

                // Get user's Meteora positions
                const userPositions = await getUserMeteoraPositions(meteoraService, account);
                meteoraInfo += userPositions;

                // Get available pools
                const availablePools = await getAvailableMeteoraPools(meteoraService);
                meteoraInfo += availablePools;

                // Get market overview
                const marketOverview = await getMeteoraMarketOverview(meteoraService);
                meteoraInfo += marketOverview;

            } else {
                meteoraInfo = 'Meteora liquidity pool information is only available in private messages.';
            }
        } catch (error) {
            console.error('Error in Meteora provider:', error);
            meteoraInfo = `Error generating Meteora report: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }

        const data = {
            meteoraLiquidityPools: meteoraInfo
        };

        const values = {};

        const text = meteoraInfo + '\n';

        return {
            data,
            values,
            text,
        };
    },
};

/**
 * Get user's Meteora positions
 */
async function getUserMeteoraPositions(
    meteoraService: MeteoraService,
    account: any
): Promise<string> {
    let positionsInfo = '📊 YOUR METEORA POSITIONS:\n\n';

    try {
        // Extract wallet addresses from account
        const walletAddresses: string[] = [];
        if (account.metawallets) {
            for (const mw of account.metawallets) {
                for (const chain in mw.keypairs) {
                    if (chain === 'solana') {
                        const kp = mw.keypairs[chain];
                        if (kp.publicKey) {
                            walletAddresses.push(kp.publicKey);
                        }
                    }
                }
            }
        }

        if (walletAddresses.length === 0) {
            positionsInfo += 'No Solana wallets found in your account.\n\n';
            return positionsInfo;
        }

        // Get positions for each wallet
        for (const walletAddress of walletAddresses) {
            positionsInfo += `🔸 Wallet: ${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}\n`;

            try {
                // Get real positions from Meteora service
                const positions = await meteoraService.getAllUserPositions(walletAddress);

                if (positions.size === 0) {
                    positionsInfo += '   No Meteora positions found.\n\n';
                } else {
                    positionsInfo += `   Found ${positions.size} position(s):\n\n`;

                    for (const [poolAddress, positionInfo] of positions.entries()) {
                        positionsInfo += await formatPositionDetails(positionInfo, poolAddress, meteoraService);
                        positionsInfo += '\n';
                    }
                }
            } catch (error) {
                console.error(`Error fetching positions for wallet ${walletAddress}:`, error);
                positionsInfo += '   Error fetching positions for this wallet.\n\n';
            }
        }

    } catch (error) {
        console.error('Error fetching user Meteora positions:', error);
        positionsInfo += 'Error fetching positions. Please try again later.\n\n';
    }

    return positionsInfo;
}

/**
 * Get available Meteora pools
 */
async function getAvailableMeteoraPools(meteoraService: MeteoraService): Promise<string> {
    let poolsInfo = '🏊 AVAILABLE METEORA POOLS:\n\n';

    try {
        // Get real pools from Meteora service
        const pools = await meteoraService.getPools();

        if (pools.length === 0) {
            poolsInfo += 'No pools available at the moment.\n\n';
            return poolsInfo;
        }

        // Show top pools by TVL
        const topPools = pools
            .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
            .slice(0, 5); // Show top 5 pools

        for (const pool of topPools) {
            poolsInfo += `🔸 ${pool.displayName || `${pool.tokenA.symbol}/${pool.tokenB.symbol}`}\n`;
            poolsInfo += `   Pool ID: ${pool.id}\n`;
            poolsInfo += `   Type: ${pool.metadata?.poolType || 'Unknown'}\n`;
            if (pool.apr) poolsInfo += `   APR: ${pool.apr.toFixed(2)}%\n`;
            if (pool.apy) poolsInfo += `   APY: ${pool.apy.toFixed(2)}%\n`;
            if (pool.tvl) poolsInfo += `   TVL: $${pool.tvl.toLocaleString()}\n`;
            if (pool.fee) poolsInfo += `   Fee: ${(pool.fee * 100).toFixed(2)}%\n`;
            poolsInfo += '\n';
        }

        poolsInfo += `Total pools available: ${pools.length}\n\n`;

    } catch (error) {
        console.error('Error fetching available Meteora pools:', error);
        poolsInfo += 'Error fetching pools. Please try again later.\n\n';
    }

    return poolsInfo;
}

/**
 * Get Meteora market overview
 */
async function getMeteoraMarketOverview(meteoraService: MeteoraService): Promise<string> {
    let marketInfo = '📈 METEORA MARKET OVERVIEW:\n\n';

    try {
        // Get real pools to calculate market statistics
        const pools = await meteoraService.getPools();

        if (pools.length === 0) {
            marketInfo += 'Market data not available at the moment.\n\n';
            return marketInfo;
        }

        // Calculate market statistics from real data
        let totalTvl = 0;
        let totalVolume24h = 0;
        let totalFees24h = 0;
        let poolCount = pools.length;

        for (const pool of pools) {
            if (pool.tvl) totalTvl += pool.tvl;
            // Note: 24h volume and fees would need to be added to the pool data
        }

        marketInfo += `📊 Total Pools: ${poolCount}\n`;
        marketInfo += `💰 Total TVL: $${totalTvl.toLocaleString()}\n`;
        marketInfo += `📈 24h Volume: Data not available\n`;
        marketInfo += `💸 24h Fees: Data not available\n\n`;

        // Show top performing pools
        marketInfo += '🏆 TOP PERFORMING POOLS:\n\n';

        const topPools = pools
            .sort((a, b) => (b.apr || 0) - (a.apr || 0))
            .slice(0, 3);

        for (const pool of topPools) {
            if (pool.displayName) {
                marketInfo += `🔸 ${pool.displayName}\n`;
                if (pool.apr) marketInfo += `   APR: ${pool.apr.toFixed(2)}%\n`;
                if (pool.tvl) marketInfo += `   TVL: $${pool.tvl.toLocaleString()}\n`;
                marketInfo += '\n';
            }
        }

    } catch (error) {
        console.error('Error fetching Meteora market overview:', error);
        marketInfo += 'Error fetching market data. Please try again later.\n\n';
    }

    return marketInfo;
}

/**
 * Format position details for display
 */
async function formatPositionDetails(
    positionInfo: any,
    poolAddress: string,
    meteoraService: MeteoraService
): Promise<string> {
    let positionInfoText = '';

    try {
        positionInfoText += `   📍 Position: ${positionInfo.publicKey?.toString().slice(0, 8)}...${positionInfo.publicKey?.toString().slice(-8) || 'Unknown'}\n`;
        positionInfoText += `   🏊 Pool: ${poolAddress.slice(0, 8)}...${poolAddress.slice(-8)}\n`;

        // Add position-specific information based on the actual PositionInfo structure
        // This would need to be enhanced based on the real Meteora SDK data structure
        positionInfoText += `   🪙 Status: Active\n`;
        positionInfoText += `   📊 Details: Position data available\n`;

    } catch (error) {
        console.error('Error formatting position details:', error);
        positionInfoText += '   Error formatting position details.\n';
    }

    return positionInfoText;
} 