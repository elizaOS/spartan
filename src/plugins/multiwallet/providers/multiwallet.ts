import type { Action, IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { addHeader, composeActionExamples, formatActionNames, formatActions } from '@elizaos/core';
import type { IToken } from '../types';
import { getAccountFromMessage, solanaWalletToLLMString } from '../../autonomous-trader/utils'

function formatYYMMDD_HHMMSS(date) {
  const pad2 = num => num.toString().padStart(2, '0');

  const year = date.getFullYear() % 100;      // last two digits
  const month = date.getMonth() + 1;          // 0-based
  const day = date.getDate();

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  return (
    pad2(year) +
    pad2(month) +
    pad2(day) +
    ' ' +
    pad2(hours) +
    ':' +
    pad2(minutes) +
    ':' +
    pad2(seconds)
  );
}

/**
 * Provider for User (meta) wallets data
 *
 * @typedef {import('./Provider').Provider} Provider
 * @typedef {import('./Runtime').IAgentRuntime} IAgentRuntime
 * @typedef {import('./Memory').Memory} Memory
 * @typedef {import('./State').State} State
 * @typedef {import('./Action').Action} Action
 *
 * @type {Provider}
 * @property {string} name - The name of the provider
 * @property {string} description - Description of the provider
 * @property {number} position - The position of the provider
 * @property {Function} get - Asynchronous function to get actions that validate for a given message
 *
 * @param {IAgentRuntime} runtime - The agent runtime
 * @param {Memory} message - The message memory
 * @param {State} state - The state of the agent
 * @returns {Object} Object containing data, values, and text related to actions
 */
export const multiwalletProvider: Provider = {
  name: 'USERWALLETS_DATA',
  // , only needs to be used with REPLY action
  description: 'Information about a users wallet (tokens, balances) and positions we maybe managing for them',
  dynamic: true,
  //position: -1,
  get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    console.log('USERWALLETS_DATA')

    let balanceStr = ''

    // DM or public?
    const isDM = message.content.channelType?.toUpperCase() === 'DM'
    if (isDM) {
      // give private data about your wallets
      const account = await getAccountFromMessage(runtime, message)
      const solanaWallets: any[] = []
      const solanaPositions: any[] = []
      for (const mw of account.metawallets) {
        const kp = mw.keypairs.solana
        if (kp) {
          //console.log('kp', kp)
          solanaWallets.push({ ...kp, strategy: mw.strategy })
        }
      }

      // gather balance information for each of their wallets
      // FIXME: could be parallelized
      const solanaService = runtime.getService('chain_solana') as any;
      for (const kp of solanaWallets) {
        const pubKey = kp.publicKey
        //console.log('USERWALLETS_DATA - kp', kp)
        balanceStr += await solanaService.walletAddressToLLMString(pubKey)
        balanceStr += 'Current wallet: ' + pubKey + ' \n'
        balanceStr += '  strategy: ' + kp.strategy + '\n'
        if (kp.positions) {
          balanceStr += '  positions in csv format:\n'
          balanceStr += '    CA,solAmount,openTimestamp,openDate,closeTimestamp,tokenAmount,status,pnl\n'
          for (const p of kp.positions) {
            //console.log('p', p)
            let amount = p.solAmount
            let pnl = ''
            let openTimestamp = p.timestamp
            let closeTimestamp = ''

            if (p.close) {
              if (p.close.type !== 'unknown' && p.close.type !== 'unknwon') {
                //console.log('closed p', p.close, parseFloat(p.close.outAmount))
                const outAmountSol = parseFloat(p.close.outAmount) / 1e9
                amount += ' => ' + outAmountSol

                // Calculate PnL
                const initialSol = parseFloat(p.solAmount)
                const finalSol = outAmountSol
                const pnlAbsolute = finalSol - initialSol
                const pnlPercentage = (pnlAbsolute / initialSol) * 100

                pnl = `${pnlAbsolute.toFixed(6)} SOL (${pnlPercentage > 0 ? '+' : ''}${pnlPercentage.toFixed(2)}%)`

                // Add close timestamp if available
                if (p.close.timestamp) {
                  closeTimestamp = p.close.timestamp
                } else {
                  // If no close timestamp, use current time or leave empty
                  closeTimestamp = ''
                }
              }
            }
            /*
            8|odi-dev  | p {
            8|odi-dev  |   id: "202ef36e-0b60-4049-a96b-59d45aa2be46",
            8|odi-dev  |   chain: "solana",
            8|odi-dev  |   close: {
            8|odi-dev  |     fees: {
            8|odi-dev  |       sol: 0.000105,
            8|odi-dev  |       lamports: 105000,
            8|odi-dev  |     },
            8|odi-dev  |     type: "win",
            8|odi-dev  |     outAmount: "3768179",
            8|odi-dev  |     signature: "2PrUcjJqvmfLS5nMoccg3a3DXkC7tprigtzXGRQVxFGgzVayrenz6wSGfmoUVhoQY2mxLkbcqnbhGeTW8nDArNH4",
            8|odi-dev  |     sellRequest: 273584798,
            8|odi-dev  |   },
            8|odi-dev  |   token: "GJU3bXxNkNtYxgjkoFhAdq7VrXJAB2GW4Cpt6kLcbonk",
            8|odi-dev  |   swapFee: 105000,
            8|odi-dev  |   publicKey: "HZoGUehwBuXkFhTkkov7VkKDo2uhUKqdoijVb9vByE9B",
            8|odi-dev  |   solAmount: 0.003093,
            8|odi-dev  |   timestamp: 1752103641542,
            8|odi-dev  |   tokenAmount: 273584798,
            8|odi-dev  |   exitConditions: {
            8|odi-dev  |     priceDrop: "0.001",
            8|odi-dev  |     reasoning: "If price drops below $0.001, liquidity falls below $100k, or sentiment analysis (if available) turns negative",
            8|odi-dev  |     volumeDrop: "50000",
            8|odi-dev  |     targetPrice: "0.002",
            8|odi-dev  |     liquidityDrop: "100000",
            8|odi-dev  |     sentimentDrop: "-20",
            8|odi-dev  |   },
            8|odi-dev  | }
            */
            const openDate = formatYYMMDD_HHMMSS(new Date(openTimestamp))
            balanceStr += '    ' + [p.token, amount, openTimestamp, openDate, closeTimestamp, p.tokenAmount, !!p.close ? p.close.type : 'open', pnl].join(',') + '\n'
          }
        }
        balanceStr += '==='
      }
    } else {
      // give generalize data
    }
    console.log('USERWALLETS_DATA - balanceStr', balanceStr)

    let latestTxt = balanceStr;

    const data = {
      //tokens,
    };

    const values = {};

    // Combine all text sections
    const text = latestTxt + '\n';

    return {
      data,
      values,
      text,
    };
    return false;
  },
};
