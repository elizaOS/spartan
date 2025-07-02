import { logger, type IAgentRuntime, createUniqueUuid } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { acquireService, askLlmObject } from '../utils';
//import { getTokenBalance } from '../wallet';
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

Trending Solana tokens:

{{trending_tokens}}

It is ok to say nothing is worth buying, only move if you see an opportunity

Only return the following JSON and nothing else (even if no sentiment or trending):
{
  recommend_buy_chain: "which chain the token is on",
  recommend_buy_address: "the address of the token to purchase, for example: Gu3LDkn7Vx3bmCzLafYNKcDxv2mH7YN44NJZFXnypump",
  reason: "the reason why you think this is a good buy, and why you chose the specific amount",
  opportunity_score: "number, for example 50",
  buy_amount: "number between 1 and 100 (meaning to be a percentage of available funds), for example: 23",
  exit_conditions: "what conditions in which you'd change your position on this token",
  exit_sentiment_drop_threshold: "if sentiment dropped to this number, you'd change your position on this token",
  exit_24hvolume_threshold: "if 24h volume dropped to this number, you'd change your position on this token",
  exit_price_drop_threshold: "what absolute price (in USD, not relative, decimal only, no $) in which you'd change your position on this token. Should be less than it's current token price (in USD)",
  exit_target_price: "what absolute target price (in USD, not relative, decimal only, no $) do you think we take profits at. Should be more than it's current token price (in USD)",
}`;
//   exit_price_drop_threshold: "number between 1 and 15 percent loss in which you'd change your position on this token. ",
//   recommend_buy: "the symbol of the token for example DEGENAI. can use NULL if nothing strikes you",
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
    tokens += 'address, price (in USD), 24h change %, liquidity (in USD)\n'
    trendingData.length = 25
    for (const token of trendingData) {
      // FIXME: which chain
      tokens += [token.address, token.price.toFixed(4), token.price24hChangePercent.toFixed(2), token.liquidity.toFixed(2)].join(',') + '\n'
      index++;
    }
  }

  const prompt = buyTemplate
    .replace('{{sentiment}}', sentiments)
    .replace('{{trending_tokens}}', tokens);

  const requiredFields = ['recommend_buy_chain', 'reason', 'recommend_buy_address'];
  const response = await askLlmObject(
    runtime,
    { prompt, system: 'You are a buy signal analyzer.' },
    requiredFields
  );
  console.log('llm_strat trending response', response);

  if (!response) {
    return;
  }

  // normalize amount
  response.buy_amount = (response.buy_amount + '').replaceAll('%', '')

  if (!response.buy_amount) {
    console.log('llm_strat Bad buy amount', response);
    // FIXME: retry?
    return;
  }

  // verify address for this chain (plugin-solana)
  if (response.recommend_buy_chain.toLowerCase() !== 'solana') {
    console.log('llm_strat chain not solana', response.recommend_buy_chain);
    // abort
    return;
  }

  // if looks good, get token(s) info (birdeye?) (infoService)
  const infoService = await acquireService(runtime, 'TRADER_DATAPROVIDER', 'llm trading info');
  //console.log('infoService', infoService)

  // ask data provider for data
  const token = await infoService.getTokenInfo(
    response.recommend_buy_chain,
    response.recommend_buy_address
  );
  console.log(response.recommend_buy_chain, response.recommend_buy_address, 'got token info', token)
  if (!token) {
    console.log('no token data for', response, 'guessing bad generation')
    return;
  }

  // amount check
  const lowPrice = parseFloat(response.exit_price_drop_threshold)
  if (lowPrice < 0 ? ((lowPrice + token.priceUsd) < 0) : (lowPrice > token.priceUsd)) {
    console.log('invalid lowPrice', lowPrice, 'current', token.priceUsd, 'add', lowPrice + token.priceUsd)
    return;
  }
  const highPrice = parseFloat(response.exit_target_price)


  const solanaService = await acquireService(runtime, 'chain_solana', 'llm trading strategy');
  if (!solanaService.validateAddress(response.recommend_buy_address)) {
    console.log('llm_strat no a valid address', response.recommend_buy_address)
    // handle failure
    // maybe just recall itself
    return;
  }


  // validateTokenForTrading (look at liquidity/volume/suspicious atts)

  // now it's a signal

  // phase 1 in parallel (fetch wallets/balance)
  // assess response, figure what wallet are buying based on balance
  // list of wallets WITH this strategy ODI
  const wallets = await getSpartanWallets(runtime, { strategy: STRATEGY_NAME })
  console.log('llm_strat - wallets', wallets)
  // for each pubkey get balances
  for(const w of wallets) {
    //console.log('w', w)
    if (!w?.publicKey) {
      console.warn('skipping', w, 'no publicKey')
      continue
    }
    if (w.chain === 'solana') {
      const bal = await solanaService.getBalanceByAddr(w.publicKey)
      // this can return NaN?
      console.log('bal', bal) //uiAmount
      if (bal === -1) continue
      if (bal < 0.003) {
        console.log('not enough SOL balance in', w.publicKey)
        continue
      }
      const amt = await scaleAmount(w, bal, response)
      console.log('amt', amt) //uiAmount
      // FIXME: what amt is too miniscule for this coin buy (not worth the tx fees?)

      const kp = {
        privateKey: w.privateKey,
        publicKey: w.publicKey,
      }
      response.sourceTokenCA = 'So11111111111111111111111111111111111111112'
      response.targetTokenCA = response.recommend_buy_address
      const res = await solanaService.executeSwap([{
        amount: amt * 1e9,
        keypair: kp
      }], response)
      console.log('buy res', res)

      if (!res?.length) {
        console.warn('Bad response', res)
        continue
      }
      if (res[0].success) {
        // Create position record
        const position = {
          id: uuidv4() as UUID,
          chain: response.recommend_buy_chain.toLowerCase(),
          token: response.recommend_buy_address,
          publicKey: kp.publicKey,
          // is this total or per token? this must be total I guess
          solAmount: amt,
          tokenAmount: res[0].outAmount, // count of token recv
          swapFee: res[0].fees.lamports,
          // is this right? yes but we don't need to store, since we can calculate
          //entryPrice: res[0].outAmount / amt,
          timestamp: Date.now(),
          exitConditions: {
            // create consistent with original goals to make long term planning
            reasoning: response.exit_conditions,
            // what's current sentiment?
            sentimentDrop: response.exit_sentiment_drop_threshold,
            // current vol adjusted
            volumeDrop: response.exit_24hvolume_threshold,
            // current price adjsut
            priceDrop: response.exit_price_drop_threshold, // low exit
            // needs to a number
            targetPrice: response.exit_target_price // high exit
          }
        };
        //console.log('position', position)

        // Open position in strategy service
        await strategyService.open_position(hndl, position);
      } else {
        console.warn('no success on Buy')
      }
    }
  }
  console.log('llm_strat - buy cycle done')

  // individualize
  // get balance of each ODI
  // and scale amount for each wallet based on available balance
  async function scaleAmount(walletKeypair, availableBalance, signal) {
    // Ensure we have valid inputs
    if (!signal?.buy_amount) {
      return 0;
    }

    // Get the token balance for this specific wallet
    //const tokenBalance = await getTokenBalance(runtime, signal.recommend_buy_address);

    // If we can't get the token balance, fall back to the provided balance

    // Convert buy_amount to a decimal (e.g. 23 -> 0.23)
    const percentage = Math.min(Math.max(signal.buy_amount, 1), 99) / 100;

    // Calculate the amount to buy based on available balance
    const amountToBuy = availableBalance * percentage;

    // Round to 6 decimal places to avoid floating point issues
    return Math.floor(amountToBuy * 1000000) / 1000000;
  }

  /*
  // phase 2 in parallel buy everything (eventually prioritize premium over non) NEO
  async function executeParallelBuys(runtime: IAgentRuntime, wallets: any[], signal: any) {
    const buyPromises = wallets.map(async (wallet) => {
      try {
        // Calculate buy amount for this wallet
        const amountToBuy = await scaleAmount(wallet.keypair, wallet.balance, signal);
        if (amountToBuy <= 0) {
          logger.warn(`Skipping buy for wallet ${wallet.publicKey} - insufficient balance`);
          return null;
        }

        // Get quote for the trade
        const quote = await wallet.quote({
          inputMint: 'So11111111111111111111111111111111111111112', // SOL
          outputMint: signal.recommend_buy_address,
          amount: amountToBuy,
          slippage: 2.5 // Default slippage of 2.5%
        });

        if (!quote) {
          logger.warn(`No quote available for wallet ${wallet.publicKey}`);
          return null;
        }

        // Calculate dynamic slippage based on quote
        const dynamicSlippage = calculateDynamicSlippage(quote);

        // Execute the buy
        const swapResult = await wallet.swap({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: signal.recommend_buy_address,
          amount: amountToBuy,
          slippage: dynamicSlippage
        });

        if (!swapResult) {
          logger.error(`Swap failed for wallet ${wallet.publicKey}`);
          return null;
        }

        // Create position record
        const position = {
          chain: repsonse.recommend_buy_chain.toLowerCase(),
          publicKey: wallet.publicKey,
          token: signal.recommend_buy_address,
          amount: amountToBuy,
          // is this right?
          entryPrice: quote.outAmount / amountToBuy,
          timestamp: Date.now(),
          exitConditions: {
            // create consistent with original goals to make long term planning
            reaosning: signal.exit_conditions,
            sentimentDrop: signal.exit_sentiment_drop_threshold,
            volumeDrop: signal.exit_24hvolume_threshold,
            priceDrop: signal.exit_price_drop_threshold,
            targetPrice: signal.exit_target_price
          }
        };
        console.log('position', position)

        // Open position in strategy service
        await strategyService.open_position(hndl, position);

        return position;
      } catch (error) {
        logger.error(`Error executing buy for wallet ${wallet.publicKey}:`, error);
        return null;
      }
    });

    // Wait for all buys to complete
    const results = await Promise.all(buyPromises);
    return results.filter(result => result !== null);
  }

  function calculateDynamicSlippage(quote: any): number {
    // Base slippage of 2.5%
    let slippage = 2.5;

    // Adjust slippage based on quote characteristics
    if (quote.priceImpact > 1) {
      // Increase slippage for high price impact
      slippage += quote.priceImpact * 0.5;
    }

    if (quote.liquidity < 10000) {
      // Increase slippage for low liquidity
      slippage += 1;
    }

    // Cap maximum slippage at 5%
    return Math.min(slippage, 5);
  }
  */
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
