import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';

/**
 * Provider for account details and summary
 * Provides account-level information including all metawallets
 */
export const coinProvider: Provider = {
  name: 'COIN_PROVIDER',
  description: 'Provides data on coins were marketing',
  //dynamic: true,
  get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    console.log('SPARTAN_LINKS')

    const coins = [
      { chain: 'solana', ca: 'Gu3LDkn7Vx3bmCzLafYNKcDxv2mH7YN44NJZFXnypump' },
      { chain: 'solana', ca: 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC' },
    ]

    let coinStr = '# Coins that we are marketing\n'
    const infoService = runtime.getService('INTEL_DATAPROVIDER') as any | null;
    coinStr += 'chain,ca,symbol,price USD (in USD),liquidity (in USD)\n'
    for (const c of coins) {
      const token = await infoService.getTokenInfo(c.chain, c.ca)
      //console.log('token', token)
      if (token?.priceUsd) {
        coinStr += [c.chain, c.ca, '??', token.priceUsd.toFixed(4), token.liquidity.toFixed(2)].join(',') + '\n'
      } else {
        console.log('c', c, 'failed for token', token)
      }
      //coinStr += c.chain + ' ' + c.ca + ' Price: $' + Number(token.priceUsd).toFixed(2).toLocaleString() + '(liq: ' + token.liquidity +')\n'
    }
    coinStr += '\nNEVER VIOLATE SEC RULES, NEVER PROMISE ANYTHING like SPECIFIC RETURNS\n'
    coinStr += 'Always remember to thank Shaw\n'

    console.log('coinStr', coinStr)

    const data = {
      marketingCoinData: coinStr
    };

    const values = {};

    const text = coinStr + '\n';

    return {
      data,
      values,
      text,
    };
  },
};