import type { IAgentRuntime, Memory, Provider, State, Content, Metadata } from '@elizaos/core';
import { createUniqueUuid } from '@elizaos/core';
import type { Position } from '../types'
import { getAccountFromMessage } from '../../autonomous-trader/utils'
import { parseDateFilterFromMessage, applyDateFilterToAccount, formatDateFilterText } from '../../autonomous-trader/providers/date_filter'

/*
const positionWithContext = {
    ...p,
    chain,
    strategy: mw.strategy,
    walletAddress: kp.publicKey
}
*/

type posWCtx = Position & {
  chain: string;
  strategy: string;
  walletAddress: string;
}

/**
 * Provider for position details and summaries
 * Provides detailed position information including performance metrics
 */
export const positionProvider: Provider = {
    name: 'POSITION_DETAILS',
    description: 'Detailed position information including summaries, individual positions, and performance metrics',
    // too much data to be static
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('POSITION_DETAILS handler')

        let positionStr = ''

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

            positionStr += `=== POSITION SUMMARY ===\n`

            // Add date filter info if applied
            if (dateFilter) {
                positionStr += `📅 Date Filter: ${formatDateFilterText(dateFilter)}\n\n`
            }

            // Collect all positions across all metawallets
            const allPositions: posWCtx[] = []
            const openPositions: posWCtx[] = []
            const closedPositions: posWCtx[] = []
            let totalPnL = 0
            let totalPnLPercentage = 0
            let closedCount = 0

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
                                allPositions.push(positionWithContext)

                                if (p.close) {
                                    closedPositions.push(positionWithContext)
                                    if (p.close.type !== 'unknown' && p.close.type !== 'unknwon') {
                                        const initialSol = parseFloat(p.solAmount)
                                        const finalSol = parseFloat(p.close.outAmount) / 1e9
                                        const pnl = finalSol - initialSol
                                        totalPnL += pnl
                                        totalPnLPercentage += (pnl / initialSol) * 100
                                        closedCount++
                                    }
                                } else {
                                    openPositions.push(positionWithContext)
                                }
                            }
                        }
                    }
                }
            }

            positionStr += `Total Positions: ${allPositions.length}\n`
            positionStr += `Open Positions: ${openPositions.length}\n`
            positionStr += `Closed Positions: ${closedPositions.length}\n`

            if (closedCount > 0) {
                const avgPnLPercentage = totalPnLPercentage / closedCount
                positionStr += `Total PnL: ${totalPnL.toFixed(6)} SOL (${avgPnLPercentage > 0 ? '+' : ''}${avgPnLPercentage.toFixed(2)}% avg)\n`
            }

            positionStr += `\n`

            // Open positions details
            if (openPositions.length > 0) {
                positionStr += `=== OPEN POSITIONS ===\n`
                positionStr += `Token,Chain,Strategy,Wallet,SOL Amount,Token Amount,Open Time\n`
                for (const p of openPositions) {
                    const openTime = new Date(p.timestamp).toISOString().split('T')[0]
                    positionStr += `${p.token},${p.chain},${p.strategy},${p.walletAddress.substring(0, 8)}...,${p.solAmount},${p.tokenAmount},${openTime}\n`
                }
                positionStr += `\n`
            }

            // Closed positions details with PnL
            if (closedPositions.length > 0) {
                positionStr += `=== CLOSED POSITIONS ===\n`
                positionStr += `Token,Chain,Strategy,Wallet,SOL Amount,Close Amount,Open Time,Close Time,Status,PnL\n`
                for (const p of closedPositions) {
                    const openTime = new Date(p.timestamp).toISOString().split('T')[0]
                    const closeTime = p.close!.timestamp ? new Date(p.close!.timestamp).toISOString().split('T')[0] : ''
                    const closeAmount = p.close!.outAmount ? (parseFloat(p.close!.outAmount) / 1e9).toFixed(6) : ''
                    const status = p.close!.type || 'unknown'

                    let pnl = ''
                    if (p.close!.type !== 'unknown' && p.close!.type !== 'unknwon') {
                        const initialSol = parseFloat(p.solAmount)
                        const finalSol = parseFloat(p.close!.outAmount) / 1e9
                        const pnlAbsolute = finalSol - initialSol
                        const pnlPercentage = (pnlAbsolute / initialSol) * 100
                        pnl = `${pnlAbsolute.toFixed(6)} SOL (${pnlPercentage > 0 ? '+' : ''}${pnlPercentage.toFixed(2)}%)`
                    }

                    positionStr += `${p.token},${p.chain},${p.strategy},${p.walletAddress.substring(0, 8)}...,${p.solAmount},${closeAmount},${openTime},${closeTime},${status},${pnl}\n`
                }
                positionStr += `\n`
            }

            // Performance by strategy
            const strategyPerformance = {}
            for (const p of closedPositions) {
                if (p.close && p.close.type !== 'unknown' && p.close.type !== 'unknwon') {
                    const strategy = p.strategy
                    if (!strategyPerformance[strategy]) {
                        strategyPerformance[strategy] = { totalPnL: 0, count: 0, totalPercentage: 0 }
                    }

                    const initialSol = parseFloat(p.solAmount)
                    const finalSol = parseFloat(p.close.outAmount) / 1e9
                    const pnl = finalSol - initialSol
                    const percentage = (pnl / initialSol) * 100

                    strategyPerformance[strategy].totalPnL += pnl
                    strategyPerformance[strategy].count++
                    strategyPerformance[strategy].totalPercentage += percentage
                }
            }

            if (Object.keys(strategyPerformance).length > 0) {
                positionStr += `=== STRATEGY PERFORMANCE ===\n`
                for (const strategy in strategyPerformance) {
                    const perf = strategyPerformance[strategy]
                    const avgPercentage = perf.totalPercentage / perf.count
                    positionStr += `${strategy}: ${perf.totalPnL.toFixed(6)} SOL (${avgPercentage > 0 ? '+' : ''}${avgPercentage.toFixed(2)}% avg) over ${perf.count} positions\n`
                }
                positionStr += `\n`
            }

        } else {
          //positionStr = 'Position details are only available in private messages.'

          // from strat llm, get what positions you'd want to open
          const roomId = createUniqueUuid(runtime, 'strategy_llm');

          // like 13 of one token and 12 of the next
          // might be more interesting getting it per token...
          // linking the date filter would be good
          const memories: Memory[] = await runtime.getMemories({
            agentId: runtime.agentId,
            // entityId is agentId
            roomId,
            count: 1000,
            unique: true,
            tableName: 'positions',
          });
          if (memories.length) {
            // should we get their current prices?
            // group by chain
            const byChain = {}
            const byKey = {}
            for(const m of memories) {
              const c = m.content
              const md = c.metadata as Metadata & { chain: string; tokenAddress: string; }
              if (byChain[md.chain] === undefined) byChain[md.chain] = []
              byChain[md.chain].push(md.tokenAddress)
              const key = md.chain + '_' + md.tokenAddress
              if (byKey[key] === undefined) byKey[key] = []
              byKey[key].push(c)
            }
            console.log('chain group', byChain, Object.keys(byChain))
            // dispatch
            positionStr = "# My recent opened positions\n"
            positionStr += 'when, chain, token, exitPrice, amount (% of available funds)' + "\n"
            // INTEL_CHAIN . detectAddressesFromString
            //const solanaService = runtime.getService('chain_solana')
            for(const m of memories) {
              const c = m.content
              //console.log('c', c)
              // content.text / content.thought
              /*
              // extract ca from Text
              const pubkeys = await solanaService.detectPubkeysFromString(c.text)
              //console.log('pubkeys', pubkeys)
              let pubkey = ''
              if (pubkeys.length) {
                pubkey = pubkeys[0]
              } else {
                console.log('no pubkeys?', pubkeys)
              }
              */
              //const date = new Date(m.createdAt)
              //console.log(date, 'pubkey', pubkey, 'index', index)

              const md = c.metadata as Metadata & { chain: string; tokenAddress: string; exitPrice: string; amount: string; }
              positionStr += [m.createdAt, md.chain, md.tokenAddress, md.exitPrice, md.amount].join(',') + "\n"
            }
          }
        }
        console.log('positionStr', positionStr)

        const data = {
            positionDetails: positionStr
        };

        const values = {};

        const text = positionStr + '\n';

        return {
            data,
            values,
            text,
        };
    },
};