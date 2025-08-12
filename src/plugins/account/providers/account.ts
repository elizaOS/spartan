import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { getAccountFromMessage } from '../../autonomous-trader/utils'
import { parseDateFilterFromMessage, applyDateFilterToAccount, formatDateFilterText } from '../../autonomous-trader/providers/date_filter'

/**
 * Provider for account details and summary
 * Provides account-level information including all metawallets
 */
export const accountProvider: Provider = {
    name: 'ACCOUNT_DETAILS',
    description: 'Account-level information including verified wallet, metawallets, strategies, and overall performance',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('ACCOUNT_DETAILS')

        let accountStr = ''

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

            accountStr += `=== ACCOUNT DETAILS ===\n`
            // we probably shouldn't expose this
            //accountStr += `Account Entity ID: ${filteredAccount.accountEntityId}\n`
            // email address? through user
            if (filteredAccount.holderCheck) {
                accountStr += `Verified Wallet: ${filteredAccount.holderCheck}\n`
                // check value
            }
            accountStr += `Notifications: ${filteredAccount.notifications}\n`

            // needs to be moved to an extension or something...
            /*
            accountStr += `Total Metawallets: ${filteredAccount.metawallets?.length || 0}\n\n`

            // Add date filter info if applied
            if (dateFilter) {
                accountStr += `📅 Date Filter: ${formatDateFilterText(dateFilter)}\n\n`
            }

            // Account summary across all metawallets
            let totalWallets = 0
            let totalPositions = 0
            let totalOpenPositions = 0
            let totalClosedPositions = 0
            let totalPnL = 0
            let totalPnLPercentage = 0
            let closedCount = 0

            if (filteredAccount.metawallets) {
                for (const mw of filteredAccount.metawallets) {
                    totalWallets++

                    // Count positions for each chain
                    for (const chain in mw.keypairs) {
                        const kp = mw.keypairs[chain]
                        if (kp.positions) {
                            totalPositions += kp.positions.length
                            totalOpenPositions += kp.positions.filter(p => !p.close).length
                            totalClosedPositions += kp.positions.filter(p => p.close).length

                            // Calculate PnL for closed positions
                            for (const p of kp.positions) {
                                if (p.close && p.close.type !== 'unknown' && p.close.type !== 'unknwon') {
                                    const initialSol = parseFloat(p.solAmount)
                                    const finalSol = parseFloat(p.close.outAmount) / 1e9
                                    const pnl = finalSol - initialSol
                                    totalPnL += pnl
                                    totalPnLPercentage += (pnl / initialSol) * 100
                                    closedCount++
                                }
                            }
                        }
                    }
                }
            }

            accountStr += `=== ACCOUNT SUMMARY ===\n`
            accountStr += `Total Wallets: ${totalWallets}\n`
            accountStr += `Total Positions: ${totalPositions}\n`
            accountStr += `Open Positions: ${totalOpenPositions}\n`
            accountStr += `Closed Positions: ${totalClosedPositions}\n`

            if (closedCount > 0) {
                const avgPnLPercentage = totalPnLPercentage / closedCount
                accountStr += `Total PnL: ${totalPnL.toFixed(6)} SOL (${avgPnLPercentage > 0 ? '+' : ''}${avgPnLPercentage.toFixed(2)}% avg)\n`
            }

            accountStr += `\n`

            // Metawallet details
            if (filteredAccount.metawallets) {
                accountStr += `=== METAWALLET DETAILS ===\n`
                for (let i = 0; i < filteredAccount.metawallets.length; i++) {
                    const mw = filteredAccount.metawallets[i]
                    accountStr += `Metawallet ${i + 1}:\n`
                    accountStr += `  Strategy: ${mw.strategy}\n`
                    accountStr += `  Chains: ${Object.keys(mw.keypairs).join(', ')}\n`

                    // Count positions per chain
                    for (const chain in mw.keypairs) {
                        const kp = mw.keypairs[chain]
                        if (kp.positions) {
                            const openPos = kp.positions.filter(p => !p.close).length
                            const closedPos = kp.positions.filter(p => p.close).length
                            accountStr += `  ${chain.toUpperCase()} Positions: ${kp.positions.length} (${openPos} open, ${closedPos} closed)\n`
                        }
                    }
                    accountStr += `\n`
                }
            }
            */
        } else {
            accountStr = 'Account details are only available in private messages.'
        }
        console.log('accountStr', accountStr)

        const data = {
            accountDetails: accountStr
        };

        const values = {};

        const text = accountStr + '\n';

        return {
            data,
            values,
            text,
        };
    },
};