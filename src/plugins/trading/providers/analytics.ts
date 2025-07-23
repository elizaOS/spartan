import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { getAccountFromMessage, getCacheExp, setCacheExp } from '../../autonomous-trader/utils'
import { parseDateFilterFromMessage, applyDateFilterToAccount, formatDateFilterText } from '../../autonomous-trader/providers/date_filter'

interface TokenHolderStats {
    totalHolders: number;
    holdersByAcquisition: {
        swap: number;
        transfer: number;
        airdrop: number;
    };
    holderChange: {
        [key: string]: {
            change: number;
            changePercent: number;
        };
    };
    holderDistribution: {
        whales: number;
        sharks: number;
        dolphins: number;
        fish: number;
        octopus: number;
        crabs: number;
        shrimps: number;
    };
}

interface HistoricalTokenHolderStats {
    timestamp: string;
    totalHolders: number;
    netHolderChange: number;
    holderPercentChange: number;
    newHoldersByAcquisition: {
        swap: number;
        transfer: number;
        airdrop: number;
    };
    holdersIn: {
        whales: number;
        sharks: number;
        dolphins: number;
        fish: number;
        octopus: number;
        crab: number;
        shrimps: number;
    };
    holdersOut: {
        whales: number;
        sharks: number;
        dolphins: number;
        fish: number;
        octopus: number;
        crab: number;
        shrimps: number;
    };
}

// TokenSniper interface for type safety (used in getTokenSnipers return type)
type TokenSniper = {
    walletAddress: string;
    snipedTransactions: Array<{
        transactionHash: string;
        transactionTimestamp: string;
        blocksAfterCreation: number;
    }>;
    sellTransactions: Array<{
        transactionHash: string;
        transactionTimestamp: string;
        blocksAfterCreation: number;
    }>;
    totalSellTransactions: number;
    totalSnipedTransactions: number;
    totalTokensSniped: number;
    totalSnipedUsd: number;
    totalTokensSold: number;
    totalSoldUsd: number;
    currentBalance: number;
    currentBalanceUsdValue: number;
    realizedProfitPercentage: number;
    realizedProfitUsd: number;
}

// Codex API interfaces
interface CodexWalletChartData {
    realizedProfitUsd: string;
    swaps: number;
    volumeUsd: string;
    resolution: string;
}

interface CodexWalletChartResponse {
    data: CodexWalletChartData[];
    resolution: string;
    range: {
        start: number;
        end: number;
    };
}

interface CodexDetailedStatsResponse {
    labels: string[];
    lastTransactionAt: string;
    networkBreakdown: Array<{
        nativeTokenBalance: string;
        networkId: number;
        statsDay30: {
            statsNonCurrency: {
                swaps: number;
                losses: number;
                wins: number;
                uniqueTokens: number;
            };
            statsUsd: {
                averageProfitUsdPerTrade: string;
                averageSwapAmountUsd: string;
                heldTokenAcquisitionCostUsd: string;
                realizedProfitPercentage: string;
                realizedProfitUsd: string;
                soldTokenAcquisitionCostUsd: string;
                volumeUsd: string;
            };
        };
    }>;
    scammerScore: number;
}

interface CodexBalancesResponse {
    items: Array<{
        tokenId: string;
        balance: string;
        networkId: number;
        address: string;
        balanceUsd: string;
        tokenPriceUsd: string;
        token: {
            id: string;
        };
        tokenAddress: string;
    }>;
}

/**
 * Provider for comprehensive token analytics using Codex APIs
 * Provides detailed token holder statistics, historical trends, and sniper analysis
 */
export const analyticsProvider: Provider = {
    name: 'TOKEN_ANALYTICS',
    description: 'Comprehensive token analytics including holder statistics, historical trends, and sniper analysis from Codex APIs',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('TOKEN_ANALYTICS')

        let analyticsStr = ''

        // DM or public?
        const isDM = message.content.channelType?.toUpperCase() === 'DM'
        if (isDM) {
            const account = await getAccountFromMessage(runtime, message)
            if (!account) {
                return {
                    data: {},
                    values: {},
                    text: 'No account found for this user.',
                }
            }

            // Get Codex API key from runtime settings
            const codexApiKey = runtime.getSetting('CODEX_API_KEY') as string
            if (!codexApiKey) {
                return {
                    data: {},
                    values: {},
                    text: 'Codex API key not configured. Please set CODEX_API_KEY in your environment.',
                }
            }

            // Apply date filter if specified in message
            const messageText = message.content?.text?.toLowerCase() || '';
            const dateFilter = parseDateFilterFromMessage(messageText);

            analyticsStr += `=== TOKEN ANALYTICS REPORT ===\n`

            // Add date filter info if applied
            if (dateFilter) {
                analyticsStr += `📅 Date Filter: ${formatDateFilterText(dateFilter)}\n\n`
            }

            // Collect unique tokens from user's positions
            const uniqueTokens = new Set<string>()
            if (account.metawallets) {
                for (const mw of account.metawallets) {
                    for (const chain in mw.keypairs) {
                        const kp = mw.keypairs[chain]
                        if (kp.positions) {
                            for (const p of kp.positions) {
                                uniqueTokens.add(p.token)
                            }
                        }
                    }
                }
            }

            if (uniqueTokens.size === 0) {
                analyticsStr += 'No token positions found for analysis.\n'
            } else {
                analyticsStr += `Analyzing ${uniqueTokens.size} unique tokens from your positions...\n\n`

                // Analyze each token individually
                for (const tokenAddress of uniqueTokens) {
                    analyticsStr += await analyzeToken(runtime, tokenAddress, codexApiKey, dateFilter)
                    analyticsStr += '\n' + '='.repeat(50) + '\n\n'
                }

                // Add comparative analysis if multiple tokens
                if (uniqueTokens.size > 1) {
                    analyticsStr += await performComparativeAnalysis(runtime, Array.from(uniqueTokens), codexApiKey, dateFilter)
                }
            }

        } else {
            analyticsStr = 'Token analytics are only available in private messages.'
        }

        console.log('analyticsStr', analyticsStr)

        const data = {
            tokenAnalytics: analyticsStr
        };

        const values = {};

        const text = analyticsStr + '\n';

        return {
            data,
            values,
            text,
        };
    },
};

/**
 * Analyze a specific token using Codex APIs
 */
async function analyzeToken(runtime: IAgentRuntime, tokenAddress: string, apiKey: string, dateFilter?: any): Promise<string> {
    let analysis = `🔍 TOKEN ANALYSIS: ${tokenAddress}\n`

    try {
        // Get current holder stats from Codex
        const holderStats = await getTokenHolderStats(runtime, tokenAddress, apiKey)
        if (holderStats) {
            analysis += formatHolderStats(holderStats)
            analysis += formatHolderConcentrationAnalysis(holderStats)
            analysis += formatCommunityGrowthAnalysis(holderStats)
            analysis += formatWhaleMovementAnalysis(holderStats)
            analysis += formatMarketingEffectivenessAnalysis(holderStats)
        }

        // Get historical data if date filter is specified
        if (dateFilter) {
            const historicalStats = await getHistoricalTokenHolderStats(runtime, tokenAddress, apiKey, dateFilter)
            if (historicalStats && historicalStats.length > 0) {
                analysis += formatHistoricalStats(historicalStats)
                analysis += formatHistoricalCommunityGrowth(historicalStats)
            }
        }

        // Get sniper analysis from Codex
        const sniperData = await getTokenSnipers(runtime, tokenAddress, apiKey)
        if (sniperData && sniperData.result && sniperData.result.length > 0) {
            analysis += formatSniperAnalysis(sniperData)
        }

    } catch (error) {
        analysis += `❌ Error analyzing token: ${error}\n`
    }

    return analysis
}

/**
 * Perform comparative analysis across multiple tokens
 */
async function performComparativeAnalysis(runtime: IAgentRuntime, tokenAddresses: string[], apiKey: string, dateFilter?: any): Promise<string> {
    let analysis = `🔍 COMPARATIVE TOKEN ANALYSIS\n`
    analysis += `Comparing ${tokenAddresses.length} tokens for investment insights...\n\n`

    try {
        // Collect data for all tokens
        const tokenData: Array<{ address: string; stats: TokenHolderStats | null; historical: HistoricalTokenHolderStats[] | null }> = []

        for (const address of tokenAddresses) {
            const stats = await getTokenHolderStats(runtime, address, apiKey)
            const historical = dateFilter ? await getHistoricalTokenHolderStats(runtime, address, apiKey, dateFilter) : null
            tokenData.push({ address, stats, historical })
        }

        // Filter out tokens without data
        const validTokens = tokenData.filter(t => t.stats !== null)

        if (validTokens.length < 2) {
            analysis += `Insufficient data for comparative analysis.\n\n`
            return analysis
        }

        // Compare holder counts
        analysis += `📊 HOLDER COUNT COMPARISON:\n`
        const sortedByHolders = validTokens.sort((a, b) => (b.stats!.totalHolders - a.stats!.totalHolders))
        for (let i = 0; i < sortedByHolders.length; i++) {
            const token = sortedByHolders[i]
            analysis += `  ${i + 1}. ${token.address.substring(0, 8)}...: ${token.stats!.totalHolders.toLocaleString()} holders\n`
        }
        analysis += '\n'

        // Compare growth rates
        analysis += `📈 GROWTH RATE COMPARISON (7d):\n`
        const growthData = validTokens.map(t => ({
            address: t.address,
            growth: t.stats!.holderChange['7d']?.change || 0,
            growthPercent: t.stats!.holderChange['7d']?.changePercent || 0
        })).sort((a, b) => b.growthPercent - a.growthPercent)

        for (let i = 0; i < growthData.length; i++) {
            const token = growthData[i]
            const sign = token.growthPercent >= 0 ? '+' : ''
            analysis += `  ${i + 1}. ${token.address.substring(0, 8)}...: ${sign}${token.growthPercent.toFixed(3)}% (${sign}${token.growth} holders)\n`
        }
        analysis += '\n'

        // Compare concentration risks
        analysis += `🎯 CONCENTRATION RISK COMPARISON:\n`
        const concentrationData = validTokens.map(t => {
            const stats = t.stats!
            const whalePercentage = (stats.holderDistribution.whales / stats.totalHolders) * 100
            const sharkPercentage = (stats.holderDistribution.sharks / stats.totalHolders) * 100
            const topTierPercentage = whalePercentage + sharkPercentage
            return {
                address: t.address,
                concentration: topTierPercentage,
                whaleCount: stats.holderDistribution.whales,
                sharkCount: stats.holderDistribution.sharks
            }
        }).sort((a, b) => b.concentration - a.concentration)

        for (let i = 0; i < concentrationData.length; i++) {
            const token = concentrationData[i]
            let riskLevel = '🟢 LOW'
            if (token.concentration > 50) riskLevel = '🔴 HIGH'
            else if (token.concentration > 20) riskLevel = '🟡 MODERATE'

            analysis += `  ${i + 1}. ${token.address.substring(0, 8)}...: ${riskLevel} (${token.concentration.toFixed(1)}% top tier)\n`
        }
        analysis += '\n'

        // Compare acquisition methods
        analysis += `📢 ACQUISITION METHOD COMPARISON:\n`
        const acquisitionData = validTokens.map(t => {
            const stats = t.stats!
            const swapPercentage = (stats.holdersByAcquisition.swap / stats.totalHolders) * 100
            const airdropPercentage = (stats.holdersByAcquisition.airdrop / stats.totalHolders) * 100
            return {
                address: t.address,
                swapPercentage,
                airdropPercentage,
                organicScore: swapPercentage - airdropPercentage // Higher = more organic
            }
        }).sort((a, b) => b.organicScore - a.organicScore)

        for (let i = 0; i < acquisitionData.length; i++) {
            const token = acquisitionData[i]
            let growthType = '🟢 ORGANIC'
            if (token.organicScore < -10) growthType = '📈 AIRDROP-DRIVEN'
            else if (token.organicScore < 0) growthType = '🟡 MIXED'

            analysis += `  ${i + 1}. ${token.address.substring(0, 8)}...: ${growthType} (${token.swapPercentage.toFixed(1)}% swaps, ${token.airdropPercentage.toFixed(1)}% airdrops)\n`
        }
        analysis += '\n'

        // Investment recommendations
        analysis += `💡 INVESTMENT INSIGHTS:\n`

        // Best growth potential
        const bestGrowth = growthData[0]
        analysis += `  • Best Growth: ${bestGrowth.address.substring(0, 8)}... (+${bestGrowth.growthPercent.toFixed(3)}%)\n`

        // Lowest concentration risk
        const lowestRisk = concentrationData[concentrationData.length - 1]
        analysis += `  • Lowest Risk: ${lowestRisk.address.substring(0, 8)}... (${lowestRisk.concentration.toFixed(1)}% concentration)\n`

        // Most organic growth
        const mostOrganic = acquisitionData[0]
        analysis += `  • Most Organic: ${mostOrganic.address.substring(0, 8)}... (${mostOrganic.swapPercentage.toFixed(1)}% swaps)\n`

        analysis += '\n'

    } catch (error) {
        analysis += `❌ Error in comparative analysis: ${error}\n\n`
    }

    return analysis
}

/**
 * Get cached data using runtime cache system
 */
async function getCachedData(runtime: IAgentRuntime, key: string): Promise<any | null> {
    return await getCacheExp(runtime, key);
}

/**
 * Set data in cache using runtime cache system
 */
async function setCachedData(runtime: IAgentRuntime, key: string, data: any, ttlInSeconds: number): Promise<void> {
    await setCacheExp(runtime, key, data, ttlInSeconds);
}

/**
 * Rate limiting for Codex API calls
 */
async function rateLimitCodex(runtime: IAgentRuntime): Promise<void> {
    const lastCallKey = 'codex_last_call_time';
    const rateLimitDelay = 0.5; // 500ms between calls

    const lastCall = await getCachedData(runtime, lastCallKey);
    if (lastCall) {
        const timeSinceLastCall = Date.now() - lastCall;
        if (timeSinceLastCall < rateLimitDelay * 1000) {
            const sleepTime = (rateLimitDelay * 1000) - timeSinceLastCall;
            await new Promise(resolve => setTimeout(resolve, sleepTime));
        }
    }

    await setCachedData(runtime, lastCallKey, Date.now(), 60);
}

/**
 * Fetch token holder statistics from Codex with caching
 */
async function getTokenHolderStats(runtime: IAgentRuntime, tokenAddress: string, apiKey: string): Promise<TokenHolderStats | null> {
    const cacheKey = `codex_holder_stats_${tokenAddress}`;
    const cached = await getCachedData(runtime, cacheKey);
    if (cached) {
        return cached;
    }

    try {
        await rateLimitCodex(runtime);

        // Codex GraphQL query for token holder stats
        const query = `
        query TokenHolderStats($input: TokenHolderStatsInput!) {
            tokenHolderStats(input: $input) {
                totalHolders
                holdersByAcquisition {
                    swap
                    transfer
                    airdrop
                }
                holderChange {
                    change
                    changePercent
                }
                holderDistribution {
                    whales
                    sharks
                    dolphins
                    fish
                    octopus
                    crabs
                    shrimps
                }
            }
        }
        `;

        const variables = {
            input: {
                tokenAddress: tokenAddress,
                networkId: 1399811149 // Solana network ID
            }
        };

        const response = await fetch('https://api.codex.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey,
                'x-apollo-operation-name': 'TokenHolderStats'
            },
            body: JSON.stringify({ query, variables })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const result = data.data?.tokenHolderStats;

        if (result) {
            await setCachedData(runtime, cacheKey, result, 300); // 5 minutes cache
            return result;
        }

        return null;
    } catch (error) {
        console.error('Error fetching token holder stats from Codex:', error);
        return null;
    }
}

/**
 * Fetch historical token holder statistics from Codex with caching
 */
async function getHistoricalTokenHolderStats(runtime: IAgentRuntime, tokenAddress: string, apiKey: string, dateFilter: any): Promise<HistoricalTokenHolderStats[] | null> {
    const cacheKey = `codex_historical_stats_${tokenAddress}_${dateFilter.type}_${dateFilter.value}`;
    const cached = await getCachedData(runtime, cacheKey);
    if (cached) {
        return cached;
    }

    try {
        await rateLimitCodex(runtime);

        // Calculate date range based on filter
        const now = new Date();
        let fromDate = new Date();

        if (dateFilter.type === 'days') {
            fromDate.setDate(now.getDate() - dateFilter.value);
        } else if (dateFilter.type === 'hours') {
            fromDate.setHours(now.getHours() - dateFilter.value);
        } else if (dateFilter.type === 'weeks') {
            fromDate.setDate(now.getDate() - (dateFilter.value * 7));
        }

        // Codex GraphQL query for historical token holder stats
        const query = `
        query HistoricalTokenHolderStats($input: HistoricalTokenHolderStatsInput!) {
            historicalTokenHolderStats(input: $input) {
                timestamp
                totalHolders
                netHolderChange
                holderPercentChange
                newHoldersByAcquisition {
                    swap
                    transfer
                    airdrop
                }
                holdersIn {
                    whales
                    sharks
                    dolphins
                    fish
                    octopus
                    crab
                    shrimps
                }
                holdersOut {
                    whales
                    sharks
                    dolphins
                    fish
                    octopus
                    crab
                    shrimps
                }
            }
        }
        `;

        const variables = {
            input: {
                tokenAddress: tokenAddress,
                networkId: 1399811149, // Solana network ID
                fromDate: fromDate.getTime() / 1000,
                toDate: now.getTime() / 1000,
                resolution: "1d"
            }
        };

        const response = await fetch('https://api.codex.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey,
                'x-apollo-operation-name': 'HistoricalTokenHolderStats'
            },
            body: JSON.stringify({ query, variables })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const result = data.data?.historicalTokenHolderStats || [];
        await setCachedData(runtime, cacheKey, result, 600); // 10 minutes for historical data
        return result;
    } catch (error) {
        console.error('Error fetching historical token holder stats from Codex:', error);
        return null;
    }
}

/**
 * Fetch token sniper data from Codex with caching
 */
async function getTokenSnipers(runtime: IAgentRuntime, tokenAddress: string, apiKey: string): Promise<{ result: TokenSniper[] } | null> {
    const cacheKey = `codex_sniper_data_${tokenAddress}`;
    const cached = await getCachedData(runtime, cacheKey);
    if (cached) {
        return cached;
    }

    try {
        await rateLimitCodex(runtime);

        // Codex GraphQL query for token sniper data
        const query = `
        query TokenSnipers($input: TokenSnipersInput!) {
            tokenSnipers(input: $input) {
                walletAddress
                snipedTransactions {
                    transactionHash
                    transactionTimestamp
                    blocksAfterCreation
                }
                sellTransactions {
                    transactionHash
                    transactionTimestamp
                    blocksAfterCreation
                }
                totalSellTransactions
                totalSnipedTransactions
                totalTokensSniped
                totalSnipedUsd
                totalTokensSold
                totalSoldUsd
                currentBalance
                currentBalanceUsdValue
                realizedProfitPercentage
                realizedProfitUsd
            }
        }
        `;

        const variables = {
            input: {
                tokenAddress: tokenAddress,
                networkId: 1399811149, // Solana network ID
                blocksAfterCreation: 1000
            }
        };

        const response = await fetch('https://api.codex.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey,
                'x-apollo-operation-name': 'TokenSnipers'
            },
            body: JSON.stringify({ query, variables })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const result = { result: data.data?.tokenSnipers || [] };
        await setCachedData(runtime, cacheKey, result, 900); // 15 minutes for sniper data
        return result;
    } catch (error) {
        console.error('Error fetching token sniper data from Codex:', error);
        return null;
    }
}

/**
 * Format holder statistics for display
 */
function formatHolderStats(stats: TokenHolderStats): string {
    let formatted = `📊 HOLDER STATISTICS\n`
    formatted += `Total Holders: ${stats.totalHolders.toLocaleString()}\n\n`

    // Holder distribution by acquisition method
    formatted += `🔗 ACQUISITION METHODS:\n`
    formatted += `  • Swaps: ${stats.holdersByAcquisition.swap.toLocaleString()} (${((stats.holdersByAcquisition.swap / stats.totalHolders) * 100).toFixed(1)}%)\n`
    formatted += `  • Transfers: ${stats.holdersByAcquisition.transfer.toLocaleString()} (${((stats.holdersByAcquisition.transfer / stats.totalHolders) * 100).toFixed(1)}%)\n`
    formatted += `  • Airdrops: ${stats.holdersByAcquisition.airdrop.toLocaleString()} (${((stats.holdersByAcquisition.airdrop / stats.totalHolders) * 100).toFixed(1)}%)\n\n`

    // Holder distribution by size
    formatted += `🐋 HOLDER DISTRIBUTION:\n`
    formatted += `  • Whales: ${stats.holderDistribution.whales}\n`
    formatted += `  • Sharks: ${stats.holderDistribution.sharks}\n`
    formatted += `  • Dolphins: ${stats.holderDistribution.dolphins}\n`
    formatted += `  • Fish: ${stats.holderDistribution.fish}\n`
    formatted += `  • Octopus: ${stats.holderDistribution.octopus}\n`
    formatted += `  • Crabs: ${stats.holderDistribution.crabs}\n`
    formatted += `  • Shrimps: ${stats.holderDistribution.shrimps.toLocaleString()}\n\n`

    // Holder changes over time
    formatted += `📈 HOLDER CHANGES:\n`
    const timeframes = ['5min', '1h', '6h', '24h', '3d', '7d', '30d']
    for (const timeframe of timeframes) {
        if (stats.holderChange[timeframe]) {
            const change = stats.holderChange[timeframe]
            const sign = change.change >= 0 ? '+' : ''
            formatted += `  • ${timeframe}: ${sign}${change.change} (${sign}${change.changePercent.toFixed(3)}%)\n`
        }
    }
    formatted += '\n'

    return formatted
}

/**
 * Format historical statistics for display
 */
function formatHistoricalStats(stats: HistoricalTokenHolderStats[]): string {
    let formatted = `📅 HISTORICAL TRENDS\n`

    if (stats.length === 0) {
        formatted += `No historical data available for the specified time period.\n\n`
        return formatted
    }

    // Show most recent data point
    const latest = stats[stats.length - 1]
    formatted += `Latest (${new Date(latest.timestamp).toLocaleDateString()}):\n`
    formatted += `  • Total Holders: ${latest.totalHolders.toLocaleString()}\n`
    formatted += `  • Net Change: ${latest.netHolderChange >= 0 ? '+' : ''}${latest.netHolderChange} (${latest.holderPercentChange >= 0 ? '+' : ''}${latest.holderPercentChange.toFixed(2)}%)\n\n`

    // Show trends over time
    if (stats.length > 1) {
        formatted += `📊 TREND ANALYSIS:\n`
        const first = stats[0]
        const last = stats[stats.length - 1]
        const totalChange = last.totalHolders - first.totalHolders
        const totalChangePercent = ((totalChange / first.totalHolders) * 100)

        formatted += `  • Period Change: ${totalChange >= 0 ? '+' : ''}${totalChange} (${totalChangePercent >= 0 ? '+' : ''}${totalChangePercent.toFixed(2)}%)\n`
        formatted += `  • Average Daily Change: ${(totalChange / stats.length).toFixed(0)} holders\n\n`

        // Show inflow/outflow by category
        formatted += `🔄 HOLDER MOVEMENT:\n`
        const categories = ['whales', 'sharks', 'dolphins', 'fish', 'octopus', 'crab', 'shrimps']
        for (const category of categories) {
            const inCount = latest.holdersIn[category] || 0
            const outCount = latest.holdersOut[category] || 0
            const netChange = inCount - outCount
            if (inCount > 0 || outCount > 0) {
                formatted += `  • ${category.charAt(0).toUpperCase() + category.slice(1)}: ${netChange >= 0 ? '+' : ''}${netChange} (${inCount} in, ${outCount} out)\n`
            }
        }
        formatted += '\n'
    }

    return formatted
}

/**
 * Format sniper analysis for display
 */
function formatSniperAnalysis(sniperData: any): string {
    let formatted = `🎯 SNIPER ANALYSIS\n`

    if (!sniperData.result || sniperData.result.length === 0) {
        formatted += `No sniper activity detected.\n\n`
        return formatted
    }

    const snipers = sniperData.result
    formatted += `Active Snipers: ${snipers.length}\n\n`

    // Calculate aggregate statistics
    let totalSnipedUsd = 0
    let totalSoldUsd = 0
    let totalProfitUsd = 0
    let totalProfitPercentage = 0
    let activeSnipers = 0

    for (const sniper of snipers) {
        totalSnipedUsd += sniper.totalSnipedUsd || 0
        totalSoldUsd += sniper.totalSoldUsd || 0
        totalProfitUsd += sniper.realizedProfitUsd || 0
        totalProfitPercentage += sniper.realizedProfitPercentage || 0
        if (sniper.currentBalance > 0) activeSnipers++
    }

    const avgProfitPercentage = snipers.length > 0 ? totalProfitPercentage / snipers.length : 0

    formatted += `💰 AGGREGATE METRICS:\n`
    formatted += `  • Total Sniped: $${totalSnipedUsd.toLocaleString()}\n`
    formatted += `  • Total Sold: $${totalSoldUsd.toLocaleString()}\n`
    formatted += `  • Total Profit: $${totalProfitUsd.toLocaleString()}\n`
    formatted += `  • Average Profit: ${avgProfitPercentage >= 0 ? '+' : ''}${avgProfitPercentage.toFixed(2)}%\n`
    formatted += `  • Active Holders: ${activeSnipers}/${snipers.length}\n\n`

    // Show top performers
    const topSnipers = snipers
        .filter(s => s.realizedProfitUsd > 0)
        .sort((a, b) => b.realizedProfitUsd - a.realizedProfitUsd)
        .slice(0, 5)

    if (topSnipers.length > 0) {
        formatted += `🏆 TOP PERFORMERS:\n`
        for (let i = 0; i < topSnipers.length; i++) {
            const sniper = topSnipers[i]
            formatted += `  ${i + 1}. ${sniper.walletAddress.substring(0, 8)}...: $${sniper.realizedProfitUsd.toFixed(2)} (${sniper.realizedProfitPercentage >= 0 ? '+' : ''}${sniper.realizedProfitPercentage.toFixed(2)}%)\n`
        }
        formatted += '\n'
    }

    return formatted
}

/**
 * Format holder concentration analysis for display
 */
function formatHolderConcentrationAnalysis(stats: TokenHolderStats): string {
    let formatted = `🎯 HOLDER CONCENTRATION ANALYSIS\n`

    const totalHolders = stats.totalHolders;
    const whalePercentage = (stats.holderDistribution.whales / totalHolders) * 100;
    const sharkPercentage = (stats.holderDistribution.sharks / totalHolders) * 100;
    const topTierPercentage = whalePercentage + sharkPercentage;

    // Concentration risk assessment
    if (topTierPercentage > 50) {
        formatted += `⚠️ HIGH CONCENTRATION RISK: Top holders control ${topTierPercentage.toFixed(1)}% of holders\n`
        formatted += `   • Whales: ${whalePercentage.toFixed(1)}% (${stats.holderDistribution.whales} holders)\n`
        formatted += `   • Sharks: ${sharkPercentage.toFixed(1)}% (${stats.holderDistribution.sharks} holders)\n`
        formatted += `   • Risk: Potential manipulation and price volatility\n\n`
    } else if (topTierPercentage > 20) {
        formatted += `🟡 MODERATE CONCENTRATION: Top holders control ${topTierPercentage.toFixed(1)}% of holders\n`
        formatted += `   • Whales: ${whalePercentage.toFixed(1)}% (${stats.holderDistribution.whales} holders)\n`
        formatted += `   • Sharks: ${sharkPercentage.toFixed(1)}% (${stats.holderDistribution.sharks} holders)\n`
        formatted += `   • Risk: Moderate, monitor for large movements\n\n`
    } else {
        formatted += `✅ HEALTHY DISTRIBUTION: Top holders control ${topTierPercentage.toFixed(1)}% of holders\n`
        formatted += `   • Whales: ${whalePercentage.toFixed(1)}% (${stats.holderDistribution.whales} holders)\n`
        formatted += `   • Sharks: ${sharkPercentage.toFixed(1)}% (${stats.holderDistribution.sharks} holders)\n`
        formatted += `   • Risk: Low, good community distribution\n\n`
    }

    // Distribution pattern analysis
    const shrimpPercentage = (stats.holderDistribution.shrimps / totalHolders) * 100;
    if (shrimpPercentage > 80) {
        formatted += `📈 ORGANIC GROWTH: ${shrimpPercentage.toFixed(1)}% are small holders (shrimps)\n`
        formatted += `   • Indicates: Natural community growth and adoption\n`
        formatted += `   • Pattern: Healthy retail investor base\n\n`
    }

    return formatted
}

/**
 * Format community growth analysis for display
 */
function formatCommunityGrowthAnalysis(stats: TokenHolderStats): string {
    let formatted = `🌱 COMMUNITY GROWTH ANALYSIS\n`

    // Analyze holder changes across timeframes
    const recentGrowth = stats.holderChange['24h']?.change || 0;
    const weeklyGrowth = stats.holderChange['7d']?.change || 0;
    const monthlyGrowth = stats.holderChange['30d']?.change || 0;

    // Growth trend assessment
    if (recentGrowth > 0 && weeklyGrowth > 0 && monthlyGrowth > 0) {
        formatted += `📈 STRONG GROWTH TREND:\n`
        formatted += `   • 24h: +${recentGrowth} holders\n`
        formatted += `   • 7d: +${weeklyGrowth} holders\n`
        formatted += `   • 30d: +${monthlyGrowth} holders\n`
        formatted += `   • Status: Community expanding consistently\n\n`
    } else if (recentGrowth > 0 && weeklyGrowth > 0) {
        formatted += `🟢 RECENT GROWTH:\n`
        formatted += `   • 24h: +${recentGrowth} holders\n`
        formatted += `   • 7d: +${weeklyGrowth} holders\n`
        formatted += `   • 30d: ${monthlyGrowth >= 0 ? '+' : ''}${monthlyGrowth} holders\n`
        formatted += `   • Status: Recent positive momentum\n\n`
    } else if (recentGrowth < 0 && weeklyGrowth < 0) {
        formatted += `📉 DECLINING COMMUNITY:\n`
        formatted += `   • 24h: ${recentGrowth} holders\n`
        formatted += `   • 7d: ${weeklyGrowth} holders\n`
        formatted += `   • 30d: ${monthlyGrowth >= 0 ? '+' : ''}${monthlyGrowth} holders\n`
        formatted += `   • Status: Community shrinking, potential red flag\n\n`
    } else {
        formatted += `🟡 MIXED SIGNALS:\n`
        formatted += `   • 24h: ${recentGrowth >= 0 ? '+' : ''}${recentGrowth} holders\n`
        formatted += `   • 7d: ${weeklyGrowth >= 0 ? '+' : ''}${weeklyGrowth} holders\n`
        formatted += `   • 30d: ${monthlyGrowth >= 0 ? '+' : ''}${monthlyGrowth} holders\n`
        formatted += `   • Status: Inconsistent growth patterns\n\n`
    }

    return formatted
}

/**
 * Format whale movement analysis for display
 */
function formatWhaleMovementAnalysis(stats: TokenHolderStats): string {
    let formatted = `🐋 WHALE MOVEMENT ANALYSIS\n`

    const whaleCount = stats.holderDistribution.whales;
    const sharkCount = stats.holderDistribution.sharks;
    const totalLargeHolders = whaleCount + sharkCount;

    // Whale activity assessment
    if (totalLargeHolders === 0) {
        formatted += `📊 NO LARGE HOLDERS DETECTED\n`
        formatted += `   • Whales: 0\n`
        formatted += `   • Sharks: 0\n`
        formatted += `   • Impact: Low manipulation risk, but limited institutional interest\n\n`
    } else {
        formatted += `📊 LARGE HOLDER PRESENCE:\n`
        formatted += `   • Whales: ${whaleCount} (${((whaleCount / stats.totalHolders) * 100).toFixed(3)}%)\n`
        formatted += `   • Sharks: ${sharkCount} (${((sharkCount / stats.totalHolders) * 100).toFixed(3)}%)\n`
        formatted += `   • Total Large Holders: ${totalLargeHolders}\n\n`

        // Movement analysis based on recent changes
        const recentChange = stats.holderChange['24h']?.change || 0;
        if (recentChange > 0) {
            formatted += `🟢 RECENT INFLOW: +${recentChange} new holders in 24h\n`
            formatted += `   • Potential: New institutional or large retail interest\n`
            formatted += `   • Monitor: For sustained growth patterns\n\n`
        } else if (recentChange < 0) {
            formatted += `🔴 RECENT OUTFLOW: ${recentChange} holders left in 24h\n`
            formatted += `   • Risk: Potential selling pressure or loss of confidence\n`
            formatted += `   • Monitor: For continued outflows\n\n`
        } else {
            formatted += `🟡 STABLE: No significant holder changes in 24h\n`
            formatted += `   • Status: Community stability\n`
            formatted += `   • Monitor: For any sudden movements\n\n`
        }
    }

    return formatted
}

/**
 * Format marketing effectiveness analysis for display
 */
function formatMarketingEffectivenessAnalysis(stats: TokenHolderStats): string {
    let formatted = `📢 MARKETING EFFECTIVENESS ANALYSIS\n`

    const totalHolders = stats.totalHolders;
    const swapPercentage = (stats.holdersByAcquisition.swap / totalHolders) * 100;
    const transferPercentage = (stats.holdersByAcquisition.transfer / totalHolders) * 100;
    const airdropPercentage = (stats.holdersByAcquisition.airdrop / totalHolders) * 100;

    // Acquisition method analysis
    formatted += `📊 ACQUISITION BREAKDOWN:\n`
    formatted += `   • Swaps: ${swapPercentage.toFixed(1)}% (${stats.holdersByAcquisition.swap.toLocaleString()} holders)\n`
    formatted += `   • Transfers: ${transferPercentage.toFixed(1)}% (${stats.holdersByAcquisition.transfer.toLocaleString()} holders)\n`
    formatted += `   • Airdrops: ${airdropPercentage.toFixed(1)}% (${stats.holdersByAcquisition.airdrop.toLocaleString()} holders)\n\n`

    // Marketing effectiveness assessment
    if (swapPercentage > 70) {
        formatted += `🟢 STRONG ORGANIC GROWTH:\n`
        formatted += `   • High swap percentage indicates natural market interest\n`
        formatted += `   • Users actively seeking and purchasing the token\n`
        formatted += `   • Marketing: Effective or token has strong fundamentals\n\n`
    } else if (airdropPercentage > 20) {
        formatted += `📈 AIRDROP-DRIVEN GROWTH:\n`
        formatted += `   • Significant airdrop activity (${airdropPercentage.toFixed(1)}%)\n`
        formatted += `   • Marketing: Airdrop campaigns appear effective\n`
        formatted += `   • Monitor: Retention rates post-airdrop\n\n`
    } else if (transferPercentage > 30) {
        formatted += `🔄 TRANSFER-DRIVEN GROWTH:\n`
        formatted += `   • High transfer percentage (${transferPercentage.toFixed(1)}%)\n`
        formatted += `   • Indicates: Community sharing or promotional transfers\n`
        formatted += `   • Marketing: Word-of-mouth or referral programs\n\n`
    } else {
        formatted += `🟡 BALANCED ACQUISITION:\n`
        formatted += `   • Mixed acquisition methods\n`
        formatted += `   • Marketing: Diversified approach\n`
        formatted += `   • Risk: Lower than single-method dependence\n\n`
    }

    return formatted
}

/**
 * Format historical community growth analysis for display
 */
function formatHistoricalCommunityGrowth(historicalStats: HistoricalTokenHolderStats[]): string {
    let formatted = `📈 HISTORICAL COMMUNITY GROWTH\n`

    if (historicalStats.length < 2) {
        formatted += `Insufficient historical data for trend analysis.\n\n`
        return formatted
    }

    // Calculate growth trends
    const first = historicalStats[0];
    const last = historicalStats[historicalStats.length - 1];
    const totalGrowth = last.totalHolders - first.totalHolders;
    const growthRate = ((last.totalHolders - first.totalHolders) / first.totalHolders) * 100;

    formatted += `📊 GROWTH SUMMARY:\n`
    formatted += `   • Period: ${new Date(first.timestamp).toLocaleDateString()} to ${new Date(last.timestamp).toLocaleDateString()}\n`
    formatted += `   • Total Growth: ${totalGrowth >= 0 ? '+' : ''}${totalGrowth} holders\n`
    formatted += `   • Growth Rate: ${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(2)}%\n`
    formatted += `   • Average Daily Growth: ${(totalGrowth / historicalStats.length).toFixed(0)} holders\n\n`

    // Trend analysis
    if (growthRate > 10) {
        formatted += `🚀 EXPLOSIVE GROWTH:\n`
        formatted += `   • Very high growth rate (${growthRate.toFixed(2)}%)\n`
        formatted += `   • Indicates: Strong market interest or effective marketing\n`
        formatted += `   • Monitor: Sustainability and retention\n\n`
    } else if (growthRate > 0) {
        formatted += `📈 STEADY GROWTH:\n`
        formatted += `   • Positive growth rate (${growthRate.toFixed(2)}%)\n`
        formatted += `   • Indicates: Healthy community expansion\n`
        formatted += `   • Status: Sustainable growth pattern\n\n`
    } else {
        formatted += `📉 DECLINING COMMUNITY:\n`
        formatted += `   • Negative growth rate (${growthRate.toFixed(2)}%)\n`
        formatted += `   • Risk: Community shrinking\n`
        formatted += `   • Action: Investigate causes and retention strategies\n\n`
    }

    return formatted
}