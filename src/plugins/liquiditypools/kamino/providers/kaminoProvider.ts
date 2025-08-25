import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { KaminoService } from '../services/kaminoService';
import { getAccountFromMessage } from '../../../autonomous-trader/utils';

// Kamino Lend Program constants
const KAMINO_LEND_PROGRAM_ID = 'GzFgdRJXmawPhGeBsyRCDLx4jAKPsvbUqoqitzppkzkW';

/**
 * Kamino Lending Protocol Provider
 * Provides information about Kamino lending positions and market data
 */
export const kaminoProvider: Provider = {
    name: 'KAMINO_LENDING',
    description: 'Provides information about Kamino lending protocol positions, market data, and available lending/borrowing opportunities',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('KAMINO_LENDING provider called');

        let kaminoInfo = '';

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

                console.log('Account found, getting Kamino service...');

                // Get Kamino service with proper type casting
                const kaminoService = runtime.getService('KAMINO_SERVICE') as unknown as KaminoService;
                if (!kaminoService) {
                    console.log('Kamino service not available');
                    return {
                        data: {},
                        values: {},
                        text: 'Kamino service not available.',
                    };
                }

                console.log('Kamino service found, generating report...');

                kaminoInfo += `=== KAMINO LENDING PROTOCOL REPORT ===\n\n`;

                // Get user's Kamino positions
                const userPositions = await getUserKaminoPositions(kaminoService, account);
                kaminoInfo += userPositions;

                // Get available reserves
                const availableReserves = await getAvailableKaminoReserves(kaminoService);
                kaminoInfo += availableReserves;

                // Get market overview
                const marketOverview = await getKaminoMarketOverview(kaminoService);
                kaminoInfo += marketOverview;

                // Get discovered markets
                const discoveredMarkets = await getDiscoveredKaminoMarkets(kaminoService);
                kaminoInfo += discoveredMarkets;

            } else {
                kaminoInfo = 'Kamino lending protocol information is only available in private messages.';
            }
        } catch (error) {
            console.error('Error in Kamino provider:', error);
            kaminoInfo = `Error generating Kamino report: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }

        const data = {
            kaminoLending: kaminoInfo
        };

        const values = {};

        const text = kaminoInfo + '\n';

        return {
            data,
            values,
            text,
        };
    },
};

/**
 * Get user's Kamino positions
 */
async function getUserKaminoPositions(
    kaminoService: KaminoService,
    account: any
): Promise<string> {
    let positionsInfo = '📊 YOUR KAMINO POSITIONS:\n\n';

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
                // Get real positions from Kamino service
                const positions = await kaminoService.getUserPositions(walletAddress);

                if (positions.error) {
                    positionsInfo += `   ❌ Error: ${positions.error}\n\n`;
                } else if (positions.message) {
                    positionsInfo += `   ℹ️ ${positions.message}\n\n`;
                } else if (positions.lending.length === 0 && positions.borrowing.length === 0) {
                    positionsInfo += '   No Kamino positions found.\n\n';

                    // Show discovered markets info
                    if (positions.markets && positions.markets.length > 0) {
                        positionsInfo += `   🔍 Discovered ${positions.markets.length} Kamino markets\n`;
                        positionsInfo += `   📊 User has ${positions.userAccounts || 0} token accounts\n\n`;
                    }
                } else {
                    // Display lending positions
                    if (positions.lending.length > 0) {
                        positionsInfo += `   💰 LENDING POSITIONS (${positions.lending.length}):\n\n`;

                        for (const position of positions.lending) {
                            positionsInfo += `   📈 ${position.token || 'Unknown Token'}\n`;
                            positionsInfo += `      Amount: ${position.amount?.toFixed(6) || 'N/A'}\n`;
                            positionsInfo += `      Value: $${position.value?.toFixed(2) || 'N/A'}\n`;
                            positionsInfo += `      APY: ${position.apy?.toFixed(2) || 'N/A'}%\n`;
                            positionsInfo += `      Market: ${position.market?.slice(0, 8)}...${position.market?.slice(-8) || 'N/A'}\n\n`;
                        }
                    }

                    // Display borrowing positions
                    if (positions.borrowing.length > 0) {
                        positionsInfo += `   💳 BORROWING POSITIONS (${positions.borrowing.length}):\n\n`;

                        for (const position of positions.borrowing) {
                            positionsInfo += `   📉 ${position.token || 'Unknown Token'}\n`;
                            positionsInfo += `      Amount: ${position.amount?.toFixed(6) || 'N/A'}\n`;
                            positionsInfo += `      Value: $${position.value?.toFixed(2) || 'N/A'}\n`;
                            positionsInfo += `      APY: ${position.apy?.toFixed(2) || 'N/A'}%\n`;
                            positionsInfo += `      Market: ${position.market?.slice(0, 8)}...${position.market?.slice(-8) || 'N/A'}\n\n`;
                        }
                    }

                    // Display total portfolio value
                    if (positions.totalValue !== undefined) {
                        positionsInfo += `   💼 TOTAL PORTFOLIO VALUE: $${positions.totalValue.toFixed(2)}\n\n`;
                    }
                }
            } catch (error) {
                console.error(`Error fetching positions for wallet ${walletAddress}:`, error);
                positionsInfo += '   Error fetching positions for this wallet.\n\n';
            }
        }

    } catch (error) {
        console.error('Error fetching user Kamino positions:', error);
        positionsInfo += 'Error fetching positions. Please try again later.\n\n';
    }

    return positionsInfo;
}

/**
 * Get available Kamino reserves for lending/borrowing
 */
async function getAvailableKaminoReserves(kaminoService: KaminoService): Promise<string> {
    let reservesInfo = '🏦 AVAILABLE KAMINO RESERVES:\n\n';

    try {
        // Get real reserves from Kamino service
        const reserves = await kaminoService.getAvailableReserves();

        if (reserves.length === 0) {
            reservesInfo += 'No reserves available at the moment.\n';
            reservesInfo += 'This may be due to:\n';
            reservesInfo += '- Kamino SDK not being installed\n';
            reservesInfo += '- Network connectivity issues\n';
            reservesInfo += '- Service initialization problems\n\n';
            return reservesInfo;
        }

        // Show top reserves by supply APY
        const topLendingReserves = reserves
            .filter(r => r.supplyApy > 0)
            .sort((a, b) => (b.supplyApy || 0) - (a.supplyApy || 0))
            .slice(0, 5); // Show top 5 lending opportunities

        if (topLendingReserves.length > 0) {
            reservesInfo += '💰 TOP LENDING OPPORTUNITIES:\n\n';

            for (const reserve of topLendingReserves) {
                reservesInfo += `🔸 ${reserve.symbol || 'Unknown'}\n`;
                reservesInfo += `   Supply APY: ${reserve.supplyApy?.toFixed(2) || 'N/A'}%\n`;
                reservesInfo += `   Borrow APY: ${reserve.borrowApy?.toFixed(2) || 'N/A'}%\n`;
                reservesInfo += `   Total Supply: $${reserve.totalSupply?.toLocaleString() || 'N/A'}\n`;
                reservesInfo += `   Total Borrow: $${reserve.totalBorrow?.toLocaleString() || 'N/A'}\n`;
                reservesInfo += `   Utilization: ${(reserve.utilization * 100)?.toFixed(2) || 'N/A'}%\n`;
                reservesInfo += `   Market: ${reserve.marketName || 'Unknown'}\n\n`;
            }
        }

        reservesInfo += `Total reserves available: ${reserves.length}\n\n`;

    } catch (error) {
        console.error('Error fetching available Kamino reserves:', error);
        reservesInfo += 'Error fetching reserves. Please try again later.\n\n';
    }

    return reservesInfo;
}

/**
 * Get Kamino market overview
 */
async function getKaminoMarketOverview(kaminoService: KaminoService): Promise<string> {
    let marketInfo = '📈 KAMINO MARKET OVERVIEW:\n\n';

    try {
        // Get real market overview from Kamino service
        const overview = await kaminoService.getMarketOverview();

        if (!overview) {
            marketInfo += 'Market data not available at the moment.\n';
            marketInfo += 'This may be due to:\n';
            marketInfo += '- Kamino SDK not being installed\n';
            marketInfo += '- Network connectivity issues\n';
            marketInfo += '- Service initialization problems\n\n';
            return marketInfo;
        }

        marketInfo += `📊 Total Markets: ${overview.totalMarkets}\n`;
        marketInfo += `💰 Total TVL: $${overview.totalTvl?.toLocaleString() || 'N/A'}\n`;
        marketInfo += `💳 Total Borrowed: $${overview.totalBorrowed?.toLocaleString() || 'N/A'}\n\n`;

        // Show top markets by TVL
        if (overview.markets && overview.markets.length > 0) {
            marketInfo += '🏆 TOP MARKETS BY TVL:\n\n';

            const topMarkets = overview.markets
                .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
                .slice(0, 3);

            for (const market of topMarkets) {
                marketInfo += `🔸 ${market.name || 'Unknown Market'}\n`;
                marketInfo += `   TVL: $${market.tvl?.toLocaleString() || 'N/A'}\n`;
                marketInfo += `   Borrowed: $${market.borrowed?.toLocaleString() || 'N/A'}\n`;
                marketInfo += `   Utilization: ${(market.utilization * 100)?.toFixed(2) || 'N/A'}%\n\n`;
            }
        }

    } catch (error) {
        console.error('Error fetching Kamino market overview:', error);
        marketInfo += 'Error fetching market data. Please try again later.\n\n';
    }

    return marketInfo;
}

/**
 * Get discovered Kamino markets
 */
async function getDiscoveredKaminoMarkets(kaminoService: KaminoService): Promise<string> {
    let marketsInfo = '🔍 DISCOVERED KAMINO MARKETS:\n\n';

    try {
        // Get discovered markets from Kamino service
        const markets = await kaminoService.discoverMarkets();

        if (markets.length === 0) {
            marketsInfo += 'No markets discovered at the moment.\n\n';
            return marketsInfo;
        }

        marketsInfo += `📊 Total Markets Discovered: ${markets.length}\n\n`;

        // Display discovered markets
        marketsInfo += '🏪 DISCOVERED MARKET ADDRESSES:\n\n';

        for (let i = 0; i < markets.length; i++) {
            const market = markets[i];
            marketsInfo += `${i + 1}. ${market.toString()}\n`;
        }

        marketsInfo += '\n';

        // Show market discovery statistics
        marketsInfo += '📈 MARKET DISCOVERY STATS:\n';
        marketsInfo += `• Program ID: ${KAMINO_LEND_PROGRAM_ID}\n`;
        marketsInfo += `• Discovery Method: Program Account Query\n`;
        marketsInfo += `• Data Size Filter: 1024 bytes\n`;
        marketsInfo += `• Discovery Time: ${new Date().toLocaleString()}\n\n`;

    } catch (error) {
        console.error('Error fetching discovered Kamino markets:', error);
        marketsInfo += 'Error discovering markets. Please try again later.\n\n';
    }

    return marketsInfo;
}
