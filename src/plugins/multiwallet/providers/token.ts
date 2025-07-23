import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { getAccountFromMessage } from '../../autonomous-trader/utils'
import { parseDateFilterFromMessage, applyDateFilterToAccount, formatDateFilterText } from '../../autonomous-trader/providers/date_filter'

/**
 * Provider for token summaries and performance
 * Provides detailed token-level information including averages and performance metrics
 */
export const tokenProvider: Provider = {
    name: 'TOKEN_DETAILS',
    description: 'Token-level summaries including averages, performance metrics, and position details',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('TOKEN_DETAILS')

        let tokenStr = ''

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

            // Apply date filter if specified in message
            const messageText = message.content?.text?.toLowerCase() || '';
            const dateFilter = parseDateFilterFromMessage(messageText);
            const filteredAccount = dateFilter ? applyDateFilterToAccount(account, dateFilter) : account;

            tokenStr += `=== TOKEN SUMMARY ===\n`

            // Add date filter info if applied
            if (dateFilter) {
                tokenStr += `📅 Date Filter: ${formatDateFilterText(dateFilter)}\n\n`
            }

            // Collect all positions by token
            const tokenPositions: Record<string, any[]> = {}
            const tokenStats: Record<string, any> = {}

            if (filteredAccount.metawallets) {
                for (const mw of filteredAccount.metawallets) {
                    for (const chain in mw.keypairs) {
                        const kp = mw.keypairs[chain]
                        if (kp.positions) {
                            for (const p of kp.positions) {
                                const positionWithContext = {
                                    ...p,
                                    chain,
                                    strategy: mw.strategy,
                                    walletAddress: kp.publicKey
                                }

                                // Group by token
                                if (!tokenPositions[p.token]) {
                                    tokenPositions[p.token] = []
                                }
                                tokenPositions[p.token].push(positionWithContext)
                            }
                        }
                    }
                }
            }

            // Calculate statistics for each token
            for (const token in tokenPositions) {
                const positions = tokenPositions[token]
                const openPositions = positions.filter(p => !p.close)
                const closedPositions = positions.filter(p => p.close)

                // Calculate averages and totals
                let totalSolInvested = 0
                let totalTokenAmount = 0
                let totalPnL = 0
                let totalPnLPercentage = 0
                let closedCount = 0
                let avgSolPerPosition = 0
                let avgTokenPerPosition = 0

                // Calculate totals
                for (const p of positions) {
                    totalSolInvested += parseFloat(p.solAmount)
                    totalTokenAmount += parseFloat(p.tokenAmount)

                    if (p.close && p.close.type !== 'unknown' && p.close.type !== 'unknwon') {
                        const initialSol = parseFloat(p.solAmount)
                        const finalSol = parseFloat(p.close.outAmount) / 1e9
                        const pnl = finalSol - initialSol
                        totalPnL += pnl
                        totalPnLPercentage += (pnl / initialSol) * 100
                        closedCount++
                    }
                }

                // Calculate averages
                if (positions.length > 0) {
                    avgSolPerPosition = totalSolInvested / positions.length
                    avgTokenPerPosition = totalTokenAmount / positions.length
                }

                const avgPnLPercentage = closedCount > 0 ? totalPnLPercentage / closedCount : 0

                tokenStats[token] = {
                    totalPositions: positions.length,
                    openPositions: openPositions.length,
                    closedPositions: closedPositions.length,
                    totalSolInvested,
                    totalTokenAmount,
                    avgSolPerPosition,
                    avgTokenPerPosition,
                    totalPnL,
                    avgPnLPercentage,
                    closedCount,
                    positions
                }
            }

            // Display token summary
            const tokenCount = Object.keys(tokenPositions).length
            tokenStr += `Total Unique Tokens: ${tokenCount}\n`
            tokenStr += `Total Positions Across All Tokens: ${Object.values(tokenStats).reduce((sum, stats) => sum + stats.totalPositions, 0)}\n\n`

            // Display each token's summary
            for (const token in tokenStats) {
                const stats = tokenStats[token]
                tokenStr += `=== TOKEN: ${token} ===\n`
                tokenStr += `Total Positions: ${stats.totalPositions}\n`
                tokenStr += `Open Positions: ${stats.openPositions}\n`
                tokenStr += `Closed Positions: ${stats.closedPositions}\n`
                tokenStr += `Total SOL Invested: ${stats.totalSolInvested.toFixed(6)} SOL\n`
                tokenStr += `Total Token Amount: ${stats.totalTokenAmount.toLocaleString()}\n`
                tokenStr += `Average SOL per Position: ${stats.avgSolPerPosition.toFixed(6)} SOL\n`
                tokenStr += `Average Token per Position: ${stats.avgTokenPerPosition.toLocaleString()}\n`

                if (stats.closedCount > 0) {
                    tokenStr += `Total PnL: ${stats.totalPnL.toFixed(6)} SOL (${stats.avgPnLPercentage > 0 ? '+' : ''}${stats.avgPnLPercentage.toFixed(2)}% avg)\n`
                }

                tokenStr += `\n`
            }

            // Detailed position breakdown by token
            tokenStr += `=== DETAILED TOKEN POSITIONS ===\n`
            for (const token in tokenPositions) {
                const positions = tokenPositions[token]
                const openPositions = positions.filter(p => !p.close)
                const closedPositions = positions.filter(p => p.close)

                tokenStr += `\n--- ${token} ---\n`

                // Open positions for this token
                if (openPositions.length > 0) {
                    tokenStr += `Open Positions (${openPositions.length}):\n`
                    tokenStr += `Wallet,SOL Amount,Token Amount,Strategy,Open Time\n`
                    for (const p of openPositions) {
                        const openTime = new Date(p.timestamp).toISOString().split('T')[0]
                        tokenStr += `${p.walletAddress.substring(0, 8)}...,${p.solAmount},${p.tokenAmount},${p.strategy},${openTime}\n`
                    }
                }

                // Closed positions for this token
                if (closedPositions.length > 0) {
                    tokenStr += `Closed Positions (${closedPositions.length}):\n`
                    tokenStr += `Wallet,SOL Amount,Close Amount,Strategy,Open Time,Close Time,Status,PnL\n`
                    for (const p of closedPositions) {
                        const openTime = new Date(p.timestamp).toISOString().split('T')[0]
                        const closeTime = p.close.timestamp ? new Date(p.close.timestamp).toISOString().split('T')[0] : ''
                        const closeAmount = p.close.outAmount ? (parseFloat(p.close.outAmount) / 1e9).toFixed(6) : ''
                        const status = p.close.type || 'unknown'

                        let pnl = ''
                        if (p.close.type !== 'unknown' && p.close.type !== 'unknwon') {
                            const initialSol = parseFloat(p.solAmount)
                            const finalSol = parseFloat(p.close.outAmount) / 1e9
                            const pnlAbsolute = finalSol - initialSol
                            const pnlPercentage = (pnlAbsolute / initialSol) * 100
                            pnl = `${pnlAbsolute.toFixed(6)} SOL (${pnlPercentage > 0 ? '+' : ''}${pnlPercentage.toFixed(2)}%)`
                        }

                        tokenStr += `${p.walletAddress.substring(0, 8)}...,${p.solAmount},${closeAmount},${p.strategy},${openTime},${closeTime},${status},${pnl}\n`
                    }
                }
            }

            // Performance ranking by token
            const tokenPerformance = Object.entries(tokenStats)
                .filter(([_, stats]) => stats.closedCount > 0)
                .sort(([_, statsA], [__, statsB]) => statsB.avgPnLPercentage - statsA.avgPnLPercentage)

            if (tokenPerformance.length > 0) {
                tokenStr += `\n=== TOKEN PERFORMANCE RANKING ===\n`
                tokenStr += `Token,Avg PnL %,Total PnL SOL,Positions\n`
                for (const [token, stats] of tokenPerformance) {
                    tokenStr += `${token},${stats.avgPnLPercentage > 0 ? '+' : ''}${stats.avgPnLPercentage.toFixed(2)}%,${stats.totalPnL.toFixed(6)},${stats.closedCount}\n`
                }
            }

        } else {
            tokenStr = 'Token details are only available in private messages.'
        }

        console.log('tokenStr', tokenStr)

        const data = {
            tokenDetails: tokenStr
        };

        const values = {};

        const text = tokenStr + '\n';

        return {
            data,
            values,
            text,
        };
    },
};