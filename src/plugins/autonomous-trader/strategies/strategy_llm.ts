import { logger, type IAgentRuntime, createUniqueUuid } from '@elizaos/core';

import { acquireService, askLlmObject } from '../utils';

import { getSpartanWallets } from '../interfaces/int_wallets'

// agentic personal application? separate strategy

// fixme: an option to mix in autofun unbonded token
// can't be per wallet since we're deciding across multiple wallets
// fixme: include price history data

const buyTemplate = `
I want you to give a crypto buy signal based on both the sentiment analysis as well as the trending tokens.
Only choose a token that occurs in both the Trending Tokens list as well as the Sentiment analysis. This ensures we have the proper symbol, chain and token address.
The sentiment score has a range of -100 to 100, with -100 indicating extreme negativity and 100 indicating extreme positiveness.
Please determine how good of an opportunity this is (how rare and how much potential).
Also let me know what a good amount would be to buy. Buy amount should be a range between 1 and 99% of available balance.
if no sentiment or trending, it's ok to use your feelings instead of your mind.

Sentiment analysis:

{{sentiment}}

Trending tokens:

{{trending_tokens}}

Only return the following JSON and nothing else (even if no sentiment or trending):
{
  recommend_buy: "the symbol of the token for example DEGENAI. can use NULL if nothing strikes you",
  recommend_buy_chain: "which chain the token is on",
  recommend_buy_address: "the address of the token to purchase, for example: Gu3LDkn7Vx3bmCzLafYNKcDxv2mH7YN44NJZFXnypump",
  reason: "the reason why you think this is a good buy, and why you chose the specific amount",
  opportunity_score: "number, for example 50",
  buy_amount: "number between 1 and 100, for example: 23",
  exit_conditions: "what conditions in which you'd change your position on this token",
  exit_sentiment_drop_threshold: "what drop in sentiment in which you'd change your position on this token",
  exit_24hvolume_threshold: "what drop in 24h volume in which you'd change your position on this token",
  exit_price_drop_threshold: "what drop in price in which you'd change your position on this token",
  exit_target_price: "what target price do you think we should get out of the position at",
}`;

// exit_24hvolume_threshold/exit_price_drop_threshold what scale?

const STRATEGY_NAME = 'LLM trading strategy'

export async function llmStrategy(runtime: IAgentRuntime) {
  const service = await acquireService(runtime, 'TRADER_STRATEGY', 'llm trading strategy');
  const infoService = await acquireService(runtime, 'TRADER_DATAPROVIDER', 'llm trading info');
  //const solanaService = await acquireService(runtime, 'CHAIN_SOLANA', 'solana service info');

  const me = {
    name: STRATEGY_NAME,
  };
  const hndl = await service.register_strategy(me);
  // we want trending
  await infoService.interested_trending(async (results) => {
/*
      name: 'Extractor-91',
      rank: 1,
      chain: 'solana',
      price: 0.0010685977861034897,
      symbol: 'E91',
      address: 'GD8nFZrqEaXkNzPJAmA4ULjMmftoVfBfoGduWGEFpump',
      logoURI: 'https://ipfs.io/ipfs/QmW5LnbEEL3iCoCvg2hmqSt8QGqfN6sg27TVvDLrckjADs',
      decimals: 6,
      provider: 'birdeye',
      liquidity: 232302.83250444,
      marketcap: 0,
      last_updated: '2025-06-04T22:21:32.000Z',
      volume24hUSD: 11520275.236061923,
      price24hChangePercent: 8393.576124948027
*/
    console.log('LLM trading strategy, got trending', results.length);
    // update our cache?

    // temp hack
    await generateBuySignal(runtime, service, hndl);
  });
  // sentiment update

  // after we have trending and sentiment
  // then ask the LLM to generate any buy signals

  // priceDeltas? maybe only for open positions
  //
}

// maybe should be a class to reuse the service handles
async function generateBuySignal(runtime, strategyService, hndl) {
  const sentimentsData = (await runtime.getCache<Sentiment[]>('sentiments')) || [];
  const trendingData = (await runtime.getCache<IToken[]>('tokens_solana')) || [];

  let sentiments = '';

  let idx = 1;
  for (const sentiment of sentimentsData) {
    if (!sentiment?.occuringTokens?.length) continue;
    // FIXME: which chain
    sentiments += `ENTRY ${idx}\nTIME: ${sentiment.timeslot}\nTOKEN ANALYSIS:\n`;
    for (const token of sentiment.occuringTokens) {
      sentiments += `${token.token} - Sentiment: ${token.sentiment}\n${token.reason}\n`;
    }

    sentiments += '\n-------------------\n';
    idx++;
  }

  // Get all trending tokens
  let tokens = '';
  if (!trendingData.length) {
    logger.warn('No trending tokens found in cache');
  } else {
    let index = 1;
    for (const token of trendingData) {
      // FIXME: which chain
      tokens += `ENTRY ${index}\n\nTOKEN SYMBOL: ${token.name}\nTOKEN ADDRESS: ${token.address}\nPRICE: ${token.price}\n24H CHANGE: ${token.price24hChangePercent}\nLIQUIDITY: ${token.liquidity}`;
      tokens += '\n-------------------\n';
      index++;
    }
  }

  const prompt = buyTemplate
    .replace('{{sentiment}}', sentiments)
    .replace('{{trending_tokens}}', tokens);

  const requiredFields = ['recommend_buy', 'reason', 'recommend_buy_address'];
  const response = await askLlmObject(
    runtime,
    { prompt, system: 'You are a buy signal analyzer.' },
    requiredFields
  );
  console.log('llm_strat trending response');

  if (!response) {
    return;
  }

  // verify address for this chain (plugin-solana)
  if (response.recommend_buy_chain.toLowerCase() !== 'solana') {
    console.log('llm_strat chain not solana', response.recommend_buy_chain);
    // abort
    return;
  }
  const solanaService = await acquireService(runtime, 'chain_solana', 'llm trading strategy');
  if (!solanaService.validateAddress(response.recommend_buy_address)) {
    console.log('no a valid address', response.recommend_buy_address)
    // handle failure
    // maybe just recall itself
  }

  // if looks good, get token(s) info (birdeye?) (infoService)
  const infoService = await acquireService(runtime, 'TRADER_DATAPROVIDER', 'llm trading info');
  //console.log('infoService', infoService)
  const token = await infoService.getTokenInfo(
    response.recommend_buy_chain,
    response.recommend_buy_address
  );
  console.log('got token info', token)

  // validateTokenForTrading (look at liquidity/volume/suspicious atts)

  // now it's a signal

  // phase 1 in parallel (fetch wallets/balance)
  // assess response, figure what wallet are buying based on balance
  // list of wallets WITH this strategy ODI
  const wallets = await getSpartanWallets(runtime, { strategy: STRATEGY_NAME })
  console.log('wallets', wallets)
  // for each pubkey get balances

  // individualize
  // get balance of each ODI
  // and scale amount for each wallet based on available balance
  function scaleAmount(walletKeypair, balance, signal) {
    // NEO write this
  }

  // phase 2 in parallel buy everything (eventually prioritize premium over non) NEO
  // create promise and that create tasks
  // execute buys on each of wallet
  // calculateOptimalBuyAmount
  // wallet.swap (wallet slippage cfg: 2.5%)
  // wallet.quote
  // calculateDynamicSlippage (require quote)
  // wallet.buy
  // we just need the outAmount
  // calc fee/slippage => position

  // open position ODI
  // set up exit conditions
  //await strategyService.open_position(hndl, pos)
}

// sell functions

async function onPriceDelta() {
  // per token
  // get all positions with this chain/token
  // filter positions, which position change about this price change
  // may trigger some exit/close position action (might not)
  // exit position: wallet.swap, strategyService.close_position(hndl, pos)
  // sell
  // swap/quote/sell
}

async function onSentimentDelta() {
  // get all positions with this chain/token
  // is this wallet/position sentiment delta trigger
}

async function onVol24hDelta() {
  // per token
  // get all positions with this chain/token
  // filter positions, which position change about this vol change
  // may trigger some exit/close position action (might not)
  // exit position: wallet.swap, strategyService.close_position(hndl, pos)
}

async function onLiquidDelta() {
  // per token
  // get all positions with this chain/token
  // filter positions, which position change about this liq change
  // may trigger some exit/close position action (might not)
  // exit position: wallet.swap, strategyService.close_position(hndl, pos)
}
