import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import type { TradeChainService } from '../services/srv_chain';
import type { TradeDataProviderService } from '../services/srv_dataprovider';

export const tokenResearchProvider: Provider = {
  name: 'INTEL_TOKEN_RESEARCH',
  description: 'Provides the available information we have on a mentioned token',
  dynamic: true,
  get: async (runtime: IAgentRuntime, message: Memory, state: State) => {

    console.log('INTEL_TOKEN_RESEARCH', message.content?.text)
    const chainService = await runtime.getService('INTEL_CHAIN') as TradeChainService | null
    if (!chainService) {
      console.log('INTEL_TOKEN_RESEARCH - INTEL_CHAIN service not available')
      return {
        data: {},
        values: {},
        text: '',
      };
    }
    const addies = await chainService.detectAddressesFromString(message.content?.text || '')
    console.log('INTEL_TOKEN_RESEARCH - INTEL_CHAIN', message.content?.text, '=>', addies)

    // is it a token?

    const infoService = await runtime.getService('INTEL_DATAPROVIDER') as TradeDataProviderService | null
    if (!infoService) {
      console.log('INTEL_TOKEN_RESEARCH - INTEL_DATAPROVIDER service not available')
      return {
        data: {},
        values: {},
        text: '',
      };
    }

    let str = '\nAvailable market data\n';
    let idx = 1;
    let cnt = 0
    str += 'chain, address, price (in USD), liquidity (in USD), priceChange24h %\n'
    for (const a of addies) {
      //str += ['"' + a.chain + '"', '"' + a.addresses.join(',') + '"'].join(',') + '\n'
      // ask data provider about this token?
      const chain = a.chain
      for (const addr of a.addresses) {
        const info = await infoService.getTokenInfo(chain, addr)
        /*
          priceSol: 0.0000010611810627217276,
          priceUsd: 0.0002202013010324857,
          liquidity: 55210.09249756655,
          priceChange24h: 3543.4224516052623,
        */
        console.log(chain, addr, info)
        str += [chain, addr, info.priceUsd.toFixed(4), info.liquidity.toFixed(2), info.priceChange24h].join(',') + '\n'
        cnt++
      }
      idx++;
    }
    console.log('INTEL_TOKEN_RESEARCH', str)
    if (!cnt) {
      console.log('INTEL_TOKEN_RESEARCH - CLEARED')
      str = ''
    }

    //console.log('intel:provider - sentimentData', sentiments)

    const data = {
      //sentimentData,
    };

    const values = {};

    // Combine all text sections
    const text = str

    return {
      data,
      values,
      text,
    };
  },
};
