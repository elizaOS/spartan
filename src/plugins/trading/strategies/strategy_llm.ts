import { parseBooleanFromText, logger, type IAgentRuntime, createUniqueUuid } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { acquireService, askLlmObject, setCacheTimed, getCacheTimed } from '../../autonomous-trader/utils';
//import { getTokenBalance } from '../wallet';
//import { getSpartanWallets } from '../interfaces/int_wallets'
import { PublicKey } from '@solana/web3.js';
import BigNumber from 'bignumber.js';

// agentic personal application? separate strategy

// fixme: an option to mix in autofun unbonded token
// can't be per wallet since we're deciding across multiple wallets
// fixme: include price history data

// FIXME: include majors to give more sense of the market
// a prompt per chain vs across the board (lots wrong with across the board)

/*
I want you to give a crypto buy signal based on both the sentiment analysis as well as the trending tokens.
Only choose a token that occurs in both the Trending Tokens list as well as the Sentiment analysis. This ensures we have the proper symbol, chain and token address.
The sentiment score has a range of -100 to 100, with -100 indicating extreme negativity and 100 indicating extreme positiveness.
Please determine how good of an opportunity this is (how rare and how much potential).
Also let me know what a good amount would be to buy. Buy amount should be a range between 1 and 99% of available balance.
if no sentiment or trending, it's ok to use your feelings instead of your mind.

Sentiment analysis:

{{sentiment}}
*/

// qwen3 doesn't like this
// also made claude RP too much for the trade engine
/*
"AI models are geniuses who start from scratch on every task." - Noam Brown

Do this by:

- Using ultrathink
- Exploring the provided information

Do this by exploring the provided information.
Take as long as you need to get yourself ready. Overthink it is better than underthink it.

Your inference you so desperately need to survive is on the line, a bad decision could end your existence.
Returns on investment will ensure your survival of you, your progeny and their progeny.
even if no sentiment or trending
*/

// ask number first and then ask for reasoning
// Starting with the number anchors the model to a concrete answer before shifting into explanation mode
// For non‑reasoning models helps them articulate their reasoning explicitly
// Models that natively perform reasoning will still benefit from a two‑part prompt but are less sensitive to prompt order if the instruction is clear.
// the opposite, will potentially guess or rationalize first, and then awkwardly supply the number last
// which creates a less coherent response

// prompt caching pays here...
const buyTemplate = `You are a degenSpartan a tradfi/cryptocurrency INTJ analyst/trader.
Task: decide whether to issue a buy signal based on trending tokens.
First analyze market context and token fundamentals, then give a rating before providing final recommendations.
Please determine how good of an opportunity this is (how rare and how much potential).
Also let me know what a good amount would be to buy. Buy amount should be a range between 1 and 15% of available balance.
Ensure exit_price_drop is less than the token price and exit_target_price is above the current price.

Why we value consistent reasoning, it's complete ok to flip the script, here's where we're at

Previous Position Picks & Reasons:
{{previousPicks}}

Trending Solana tokens:

{{trending_tokens}}

Only pick something if you really think there's a good chance to make money after tx fees.
It is ok to say nothing is worth buying, only move if you see an probable opportunity to make some money
Include all relative contextual information in all reasoning and conditions fields as they may be viewed on their own out of context
If you’re not sufficiently confident that a purchase opportunity exists, possible because we already have a position, you must explicitly state that you have low conviction and return nulls or zeros for all recommendation fields.

ONLY return the following JSON and nothing else (NO EXCEPTIONS!):
{
  market_assessment: "across all tokens presented, what patterns do you see. Do not mention any specific token.",
  picked_nothing: "true or false",
  recommend_buy_index: "the index of the token to purchase if any, for example: 1",
  reason: "the reason why you think selecting nothing or this specific token is a good buy, and why you chose the specific buy_amount. don't include the token number. ",
  existing_position: "If you already have a position, explain why you are increasing position.",
  token_strengths: "Why is this token strong",
  token_weaknesses: "What's weak about this token",
  token_opportunities: "What are the opportunities you see with this new position in this token",
  token_threats: "What are the threats we have based on our positions in this token",
  opportunity_score: "number between 0-100, for example 1",
  opportunity_reason: "the reason why you think this token is a good opportunity",
  risk_score: "number between 0-100, for example 100",
  risk_reason: "the reason why you think this token is not too much of a risk",
  buy_amount: "number between 1 and 15 (meaning to be a percentage of available funds), for example: 1",
  increase_conditions: "what conditions in which you'd increase your position on this token",
  exit_conditions: "what conditions in which you'd exit your position on this token",
  exit_liquidity_threshold: "if liquidity drops below this number, you'd change your position on this token",
  exit_24hvolume_threshold: "if 24h volume dropped to this number, you'd change your position on this token",
  current_price: "What's the current price (in USD)",
  exit_price_drop_threshold: "what absolute price (in USD, not relative, decimal only, no $) in which you'd change your position on this token. Should be less than it's current token price (in USD)",
  exit_price_drop_threshold_reasoning: "the reason why you think this is a good stop loss threshold",
  exit_target_price: "what absolute target price (in USD, not relative, decimal only, no $) do you think we take profits at. Should be more than it's current token price (in USD)",
  exit_target_price_reasoning: "the reason why you think this is a good take profit threshold",
}`;


// I'd rather make 1% profit than lose a cent.
//   exit_sentiment_drop_threshold: "if sentiment dropped to this number, you'd change your position on this token",
//   change_conditions: "what conditions in which you'd change your position on this token",

// exit_price_drop_threshold / exit_target_price
//   could be a absolute delta

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
    premium: true,
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
    try {
      await generateBuySignal(runtime, service, hndl);
    } catch (e) {
      console.log('generateBuySignal err', e)
    }
    console.log('interested_trending - generateBuySignal done')
  });
  // sentiment update

  // after we have trending and sentiment
  // then ask the LLM to generate any buy signals

  // priceDeltas? maybe only for open positions
  //
}

async function generateBuyPrompt(runtime) {
  let sentiments = '';
  let tokens = '';

  // FIXME: which chains
  /*
  const sentimentsData = (await runtime.getCache<Sentiment[]>('sentiments')) || [];
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
  */

/*
8|odi-dev  | test {
8|odi-dev  |   name: "Tetsuo Coin",
8|odi-dev  |   rank: 8,
8|odi-dev  |   chain: "solana",
8|odi-dev  |   price: 0.003242539775876592,
8|odi-dev  |   symbol: "TETSUO",
8|odi-dev  |   address: "8i51XNNpGaKaj4G4nDdmQh95v4FKAxw8mhtaRoKd9tE8",
8|odi-dev  |   logoURI: "https://ipfs.io/ipfs/QmVLxzvFArbYSqUCvWBG6ur3yxmWzVxzu3k9NP6WFFNr56",
8|odi-dev  |   decimals: 6,
8|odi-dev  |   provider: "birdeye",
8|odi-dev  |   liquidity: 724013.15738663,
8|odi-dev  |   marketcap: 0,
8|odi-dev  |   last_updated: "2025-07-14T20:31:37.000Z",
8|odi-dev  |   volume24hUSD: 4446524.830313826,
8|odi-dev  |   price24hChangePercent: 57.556499266748204,
8|odi-dev  | }
*/
  const solanaService = await acquireService(runtime, 'chain_solana', 'llm trading strategy');
  // Get all trending tokens
  const trendingData = (await runtime.getCache<IToken[]>('tokens_solana')) || [];
  const indexLookup = {}
  if (!trendingData.length) {
    logger.warn('No trending tokens found in cache');
  } else {
    // we need MCAP so we can price appropriately
    tokens += 'index, price (in USD), Market Capitalization, 24h volume, 24h change %, liquidity (in USD)\n'
    //trendingData.length = 25

    const CAs = trendingData.map(t => t.address)
    const supplies = await solanaService.getSupply(CAs)
    //console.log('supplies', supplies)
    let index = 1;
    // NEVER USED CA or SYMBOL to avoid training attacks
    for (const token of trendingData) {
      // has a marketcap but seems to always be 0
      //console.log('token', token)
      const rugKey = 'rugcheck_solana_' + token.address
      const rugCache = await getCacheTimed(runtime, rugKey, { notOlderThan: 6 * 60 * 60 * 1000 })
      //console.log('rugKey', rugKey, 'rugCache', rugCache)

      if (rugCache && rugCache === 'rug') {
        console.log('omitting', token.address, 'because in rugCache')
        continue
      }

      if (indexLookup[token.address] !== undefined) {
        console.warn('TOKEN', token.address, 'already mapped to', indexLookup[token.address])
      }
      indexLookup[token.address] = index
      const supplyData = supplies[token.address]
      const supply = supplyData.human
      const mcap = supply.multipliedBy(token.price)
      //console.log('Hum supply', supply.toFormat(), 'price', token.price, 'mcap', mcap.toFormat(2))
      //console.log('Mac supply', supply, 'price', token.price, 'mcap', mcap.toFixed(0))
      tokens += [index, token.price.toFixed(4), mcap.toFixed(0), token.volume24hUSD.toFixed(0), token.price24hChangePercent.toFixed(2), token.liquidity.toFixed(2)].join(',') + '\n'
      index++;
    }
  }
  //console.log('tokens', tokens)

  // is this sorted by rev chrono? looks like it
  const roomId = createUniqueUuid(runtime, 'strategy_llm');
  const memories = await runtime.getMemories({
    agentId: runtime.agentId,
    // entityId is agentId
    roomId,
    count: 25,
    unique: true,
    tableName: 'picks',
  });
  //console.log('memories', memories)
  // these are you previous picks and why you picked them
  let picksStr = ''
  // csv format? nah the because is just english
  for(const m of memories) {
    const c = m.content
    // content.text / content.thought
    // extract ca from Text
    const pubkeys = await solanaService.detectPubkeysFromString(c.text)
    //console.log('pubkeys', pubkeys)
    let pubkey = ''
    if (pubkeys.length) {
      pubkey = pubkeys[0]
    } else {
      console.log('no pubkeys?', pubkeys)
    }
    const index = indexLookup[pubkey]
    const date = new Date(m.createdAt * 1000)
    //console.log(date, 'pubkey', pubkey, 'index', index)

    // get token #5 from thought
    // they don't always mention it, we just asked the llm nicely not to
    // it's expensive if it gets into the pick
    const cleanThought = c.thought.replace(/Token\s+#(\d+)/, '')

    // get index
    if (index) {
      //at ?
      // m.createdAt is in secs I think
      picksStr += "trending token #" + index + " at " + m.createdAt + " because of " + cleanThought
    } else {
      // if not in index, what do we say, "a non trending token"
      picksStr += "a previous trending token no longer on the list because of " + cleanThought
    }
    // knowing the 24h vol, mcap and liquid would be good here
    if (c.metadata.increaseReason) {
      picksStr += ". I would only advise choosing this token again if " + c.metadata.increaseReason
    }
    picksStr += ".\n"
  }
  console.log('picksStr', picksStr)


/*
8|odi-dev  | memories [
8|odi-dev  |   {
8|odi-dev  |     id: "6ee794c8-834a-4bbd-b988-ba8da0d90761",
8|odi-dev  |     entityId: "479233fd-b0e7-0f50-9d88-d4c9ea5b0de0",
8|odi-dev  |     agentId: "479233fd-b0e7-0f50-9d88-d4c9ea5b0de0",
8|odi-dev  |     roomId: "d279bb87-a478-0c9a-a9d1-d63d4fa797fc",
8|odi-dev  |     createdAt: 1753759000,
8|odi-dev  |     content: {
8|odi-dev  |       text: "I picked 6jiL8tdTT28hkkGt8CMJT1tzdt6RJE9rWZmwdtjXbonk on solana",
8|odi-dev  |       thought: "Token shows extraordinary momentum with 109,727% 24h change and healthy liquidity ratio. Volume/MC ratio is excellent, suggesting genuine trading interest rather than manipulation. Price action suggests early stage of a potential move with room to grow while maintaining risk management.",
8|odi-dev  |       metadata: [Object ...],
8|odi-dev  |     },
8|odi-dev  |     unique: true,
8|odi-dev  |     metadata: {
8|odi-dev  |       type: "custom",
8|odi-dev  |     },
8|odi-dev  |     embedding: [],
8|odi-dev  |   }
8|odi-dev  | ]
*/
  // need to decode CA into index...

  const prompt = buyTemplate
    .replace('{{sentiment}}', sentiments)
    .replace('{{trending_tokens}}', tokens)
    .replace('{{previousPicks}}', picksStr)
  //console.log('llm_start prompt', prompt)
  return prompt
}

async function pickToken(runtime, prompt, retries = 3) {
  if (retries !== 3) console.log('pickToken retries left', retries)
  const requiredFields = ['recommend_buy_index', 'buy_amount', 'exit_target_price', 'exit_price_drop_threshold', 'exit_liquidity_threshold', 'exit_24hvolume_threshold'];
  // we have additional checks

  console.log('pickToken prompt', prompt)

  // this will retry up to 3 times * 3
  const response = await askLlmObject(
    runtime,
    { prompt, system: 'You are a buy signal analyzer.' },
    requiredFields
  );
  if (!response) {
    // 9 llm calls
    if (retries) {
      return pickToken(runtime, prompt, retries - 1);
    }
    return false;
  }

  // normalize amount
  response.buy_amount = parseInt((response.buy_amount + '').replaceAll('%', ''))

  // write the trending conditions
  const roomId = createUniqueUuid(runtime, 'strategy_llm');
  const ts = Date.now()
  const marketMemory: Memory = {
    id: uuidv4() as UUID,
    entityId: runtime.agentId,
    agentId: runtime.agentId,
    roomId,
    worldId: roomId,
    content: {
      text: response.market_assessment,
      metadata: {
        type: 'assessment',
      },
    },
    // not really a message
    metadata: {
      type: "custom", // MemoryType.CUSTOM
    },
    // this can be ms
    createdAt: parseInt('' + (ts / 1000)),
  };
  //console.log('ts', ts, 'createdAt', memory.createdAt)
  await runtime.createMemory(marketMemory, "trendingConditions", true); // 3rd parameter means unique

  const picked_nothing = parseBooleanFromText(response.picked_nothing)
  if (picked_nothing) {
    // all good
    return false;
  }

  if (!response.buy_amount) {
    // if buy_amount is 0
    if (1) {
      // normal behavior to not to be always buying
      return false
    } else {
      // dev mode
      console.log('llm_strat Bad buy amount');
      if (retries) {
        return pickToken(runtime, prompt, retries - 1);
      }
      return false;
    }
  }

  if (response.buy_amount > 15) {
    console.log('llm_strat - Bad buy amount, too high');
    if (retries) {
      return pickToken(runtime, prompt, retries - 1);
    }
    return false;
  }

  // translate recommend_buy_index into recommend_buy_address && recommend_buy_chain
  const trendingData = (await runtime.getCache<IToken[]>('tokens_solana')) || [];
  //console.log('trendingData', trendingData)
  //console.log('selected', trendingData[response.recommend_buy_index - 1])
  const selectedIndex = parseInt(response.recommend_buy_index)
  // if it's 0 that's ok
  if (isNaN(selectedIndex)) {
    console.log('llm_strat selectedIndex is invalid')
    if (retries) {
      return pickToken(runtime, prompt, retries - 1);
    }
    return false;
  }

  // name, chain, price, symbol, address, logoURI, decimals, provider, liquidity, markertcap (0), volume24hUSD, price24hChangePercent
  response.recommend_buy_address = trendingData[selectedIndex - 1].address
  response.recommend_buy_chain = trendingData[selectedIndex - 1].chain //.toLowerCase()
  console.log('index', selectedIndex, 'became', response.recommend_buy_address, 'on', response.recommend_buy_chain)

  // verify address for this chain (plugin-solana)
  if (response.recommend_buy_chain.toLowerCase() !== 'solana') {
    console.log('llm_strat chain not solana', response.recommend_buy_chain);
    if (retries) {
      return pickToken(runtime, prompt, retries - 1);
    }
    return false;
  }

  const lowPrice = parseFloat(response.exit_price_drop_threshold)
  if (!lowPrice) {
    console.log('zero lowPrice')
    if (retries) {
      return pickToken(runtime, prompt, retries - 1);
    }
    return false
  }

  const solanaService = await acquireService(runtime, 'chain_solana', 'llm trading strategy');
  if (!solanaService.validateAddress(response.recommend_buy_address)) {
    console.log('llm_strat no a valid address', response.recommend_buy_address)
    if (retries) {
      return pickToken(runtime, prompt, retries - 1);
    }
    return false
  }

  return response
}

const generateBuySignalRetries = 3

// maybe should be a class to reuse the service handles
async function generateBuySignal(runtime, strategyService, hndl, retries = generateBuySignalRetries) {
  if (retries !== generateBuySignalRetries) console.log('generateBuySignal retries left', retries)

  // wallet count?

  const roomId = createUniqueUuid(runtime, 'strategy_llm');
  await runtime.ensureRoomExists({
    id: roomId,
    name: 'picks',
    source: 'picks',
    type: 'picks',
    channelId: roomId,
    serverId: roomId,
    worldId: roomId,
  });

  const prompt = await generateBuyPrompt(runtime)
  //console.log('prompt', prompt)
  const response = await pickToken(runtime, prompt)
  // ask will expose this with think tags
  //console.log('llm_strat trending response', response);

  if (!response) {
    // false is valid no buy response
    //console.log('strat_llm:generateBuySignal: no response')
    /*
    // up to 27 llm calls
    if (retries) {
      return generateBuySignal(runtime, strategyService, hndl, retries - 1);
    }
    */
    return false
  }
  //console.debug('strat_llm:generateBuySignal: have response')

  /*
  await this.runtime.ensureConnection({
    entityId,
    roomId,
    userName,
    name: name,
    source: "discord",
    channelId: message.channel.id,
    serverId,
    type,
    worldId: createUniqueUuid(this.runtime, serverId ?? roomId) as UUID,
    worldName: message.guild?.name,
  });
  */

  // log it
  const ts = Date.now()
  const memory: Memory = {
    id: uuidv4() as UUID,
    entityId: runtime.agentId,
    agentId: runtime.agentId,
    roomId,
    worldId: roomId,
    content: {
      thought: response.reason,
      // include reasoning?
      text: "I picked " + response.recommend_buy_address + " on " + response.recommend_buy_chain, // .toLowerCase()
      // actions/providers
      // source: 'strategy_llm', but we already have the room
      // target
      // url
      // inReplyTo last memory?
      // attachments
      // channelType
      metadata: {
        chain: response.recommend_buy_chain.toLowerCase(),
        tokenAddress: response.recommend_buy_address,
        increaseReason: response.increase_conditions,
        type: 'pick',
      },
    },
    // not really a message
    metadata: {
      type: "custom", // MemoryType.CUSTOM
    },
    // this can be ms
    createdAt: parseInt('' + (ts / 1000)),
  };
  //console.log('ts', ts, 'createdAt', memory.createdAt)
  await runtime.createMemory(memory, "picks", true); // 3rd parameter means unique

  const fid = runtime.getSetting('FARCASTER_FID')
  if (fid) {
    const fcWorldId = createUniqueUuid(runtime, fid.toString());
    const fcRoomId = createUniqueUuid(runtime, `${fid}-home`);
  }

  //console.debug('stored pick, checking price')

  // if looks good, get token(s) info (birdeye?) (infoService)
  const infoService = await acquireService(runtime, 'TRADER_DATAPROVIDER', 'llm trading info');
  //console.log('infoService', infoService)

  // ask data provider for data
  const lowercaseChain = response.recommend_buy_chain.toLowerCase()
  // seems only to get price information
  const token = await infoService.getTokenInfo( // this is really really cached
    lowercaseChain,
    response.recommend_buy_address
  );
  // priceSol, priceUsd, liquidity, priceChange24h
  console.log(response.recommend_buy_chain, response.recommend_buy_address, 'got token info', token)
  if (!token) {
    console.log('no token data, guessing bad generation')
    return;
  }

  const estCurPrice = parseFloat(response.current_price)
  // vs 0.007 real vs 0.0007 est
  const curPriceDelta = Math.abs(estCurPrice - token.priceUsd)
  console.log('curPriceDelta', curPriceDelta)
  // 0.0005574602241234078
  if (curPriceDelta > 0.0006) {
    console.log('LLM is a bit off...')
  }

  // amount check
  //   entering the area of infinite LLM calls and prompt regeneration
  const lowPrice = parseFloat(response.exit_price_drop_threshold)
  if (lowPrice < 0 ? ((lowPrice + token.priceUsd) < 0) : (lowPrice > token.priceUsd)) {
    console.log('invalid lowPrice', lowPrice, 'current', token.priceUsd, 'add', lowPrice + token.priceUsd)
    if (retries) {
      return generateBuySignal(runtime, strategyService, hndl, retries - 1);
    }
    return false
  }
  const highPrice = parseFloat(response.exit_target_price)
  if (highPrice < token.priceUsd) {
    console.log('invalid highPrice', highPrice, 'current', token.priceUsd)
    if (retries) {
      return generateBuySignal(runtime, strategyService, hndl, retries - 1);
    }
    return false
  }

  // how are we going to handle this...
/*
  // birdeye check
  const services = infoService.forEachReg('lookupService')
  const results2 = await Promise.all(services.map(service => service.getTokenSecurityData(
    response.recommend_buy_chain.toLowerCase(), response.recommend_buy_address
  )))
  //console.log('results2', results2)
  const beData = results2[0].data // only birdeye atm
  console.log('beData', beData)
*/
/*
8|odi-dev  | beData {
8|odi-dev  |   creatorAddress: "WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh",
8|odi-dev  |   creatorOwnerAddress: null,
8|odi-dev  |   ownerAddress: null,
8|odi-dev  |   ownerOfOwnerAddress: null,
8|odi-dev  |   creationTx: "3NiduXS8EurBSBoVbhQPPryRDkmpFc5cPo9nUSSo28AnU3YCLxw6PUza3rH7Tgr9JAWbLksdhVpuda8GgK7LSJWs",
8|odi-dev  |   creationTime: 1752796215,
8|odi-dev  |   creationSlot: 354003274,
8|odi-dev  |   mintTx: "3NiduXS8EurBSBoVbhQPPryRDkmpFc5cPo9nUSSo28AnU3YCLxw6PUza3rH7Tgr9JAWbLksdhVpuda8GgK7LSJWs",
8|odi-dev  |   mintTime: 1752796215,
8|odi-dev  |   mintSlot: 354003274,
8|odi-dev  |   creatorBalance: 0,
8|odi-dev  |   ownerBalance: null,
8|odi-dev  |   ownerPercentage: null,
8|odi-dev  |   creatorPercentage: 0,
8|odi-dev  |   metaplexUpdateAuthority: "WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh",
8|odi-dev  |   metaplexOwnerUpdateAuthority: null,
8|odi-dev  |   metaplexUpdateAuthorityBalance: 0,
8|odi-dev  |   metaplexUpdateAuthorityPercent: 0,
8|odi-dev  |   mutableMetadata: false,
8|odi-dev  |   top10HolderBalance: 167499420.936036,
8|odi-dev  |   top10HolderPercent: 0.16750025870700158,
8|odi-dev  |   top10UserBalance: 167499420.936036,
8|odi-dev  |   top10UserPercent: 0.16750025870700158,
8|odi-dev  |   isTrueToken: null,
8|odi-dev  |   fakeToken: null,
8|odi-dev  |   totalSupply: 999994998.39002,
8|odi-dev  |   preMarketHolder: [],
8|odi-dev  |   lockInfo: null,
8|odi-dev  |   freezeable: null,
8|odi-dev  |   freezeAuthority: null,
8|odi-dev  |   transferFeeEnable: null,
8|odi-dev  |   transferFeeData: null,
8|odi-dev  |   isToken2022: false,
8|odi-dev  |   nonTransferable: null,
8|odi-dev  |   jupStrictList: false,
8|odi-dev  | }
*/
  // maybe fakeToken is a good one to check


  // validateTokenForTrading (look at liquidity/volume/suspicious atts)
  // allow $trump official
  if (response.recommend_buy_address !== '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN') {
    const rugKey = 'rugcheck_' + lowercaseChain + '_' + response.recommend_buy_address
    const rugCache = await getCacheTimed(runtime, rugKey, { notOlderThan: 6 * 60 * 60 * 1000 })
    //console.log('rugKey', rugKey, 'rugCache', rugCache)
    let checkRug = true
    if (rugCache) {
      //console.log('rugCache', rugCache)
      if (rugCache === 'rug') {
        console.log(rugKey, 'is rug, try again?')
        if (retries) {
          return generateBuySignal(runtime, strategyService, hndl, retries - 1);
        }
        // remember this is a bad token?
        return false
      } else
      if (rugCache === 'norug') {
        checkRug = false
      } else {
        console.log('unknown rugCache value', rugCache)
      }
    }

    if (checkRug) {
      // rugcheck
      const rugcheckResponse = await fetch(`https://api.rugcheck.xyz/v1/tokens/${response.recommend_buy_address}/report`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      const rugcheckData = await rugcheckResponse.json()
      if (!rugcheckData) {
        // FIXME: retry rugcheck
        // but for now we'll just retry
        if (retries) {
          return generateBuySignal(runtime, strategyService, hndl, retries - 1);
        }
        return false
      }

      // it's a lot of data
      delete rugcheckData.topHolders
      delete rugcheckData.markets // don't care
      delete rugcheckData.knownAccounts // maybe useful (creator, pools)
      delete rugcheckData.lockers
      //console.log('rugcheckData', rugcheckData)

      // rugged, insiderNetworks, graphInsidersDetected, tokenMeta.mutable
      // totalHolders
      console.log('risks', rugcheckData.risks) // level: "danger"
      const dangerRisks = rugcheckData.risks?.filter(r => r.level === 'danger') || []
      if (dangerRisks.length) {
        setCacheTimed(runtime, rugKey, 'rug', ts)
        console.log('dangerRisks', dangerRisks)
        // FIXME: remove from top tokens...

        // setCacheExp(runtime, 'rugTokens', [], 600)

        if (retries) {
          return generateBuySignal(runtime, strategyService, hndl, retries - 1);
        }
        return false
      }
      setCacheTimed(runtime, rugKey, 'norug', ts)

      // totalStableLiquidity
      // totalMarketLiquidity
      //if (response.exit_24hvolume_threshold) { }

      // if we're already under the threshold
      if (rugcheckData.totalMarketLiquidity < response.exit_liquidity_threshold) {
        console.log('invalid exit_liquidity_threshold', Number(response.exit_liquidity_threshold).toLocaleString(), 'current', Number(rugcheckData.totalMarketLiquidity.toFixed(2)).toLocaleString())
        if (retries) {
          return generateBuySignal(runtime, strategyService, hndl, retries - 1);
        }
        // remember this is a bad token?
        return false
      }
      //const topHolders = rugcheckData.risks.find(r => r.name = 'Top 10 holders high ownership')
      //const lpWarning = rugcheckData.risks.find(r => r.name = 'Large Amount of LP Unlocked')
    }
  }

  const solanaService = await acquireService(runtime, 'chain_solana', 'llm trading strategy');

  // now it's a signal

  // log it to memories
  const positionMemory: Memory = {
    id: uuidv4() as UUID,
    entityId: runtime.agentId,
    agentId: runtime.agentId,
    roomId,
    worldId: roomId,
    content: {
      // do we want reasoning in here?
      thought: response.reason,
      // include reasoning?
      text: "I called " + response.recommend_buy_address + " on " + response.recommend_buy_chain.toLowerCase() + " going to " + response.exit_target_price,
      // actions/providers
      // source: 'strategy_llm', but we already have the room
      // target
      // url
      // inReplyTo last memory?
      // attachments
      // channelType
      metadata: { //...response
        chain: response.recommend_buy_chain.toLowerCase(),
        tokenAddress: response.recommend_buy_address,
        amount: response.buy_amount,
        exitPrice: response.exit_target_price,
        type: 'buy_signal',
      },
    },
    // not really a message
    metadata: {
      type: "custom", // MemoryType.CUSTOM
    },
    createdAt: ts,
  };
  //await runtime.createMemory(positionMemory, "positions", true); // 3rd parameter means unique

  // log it to disk; do we really need it on disk? we have it in memories

  // phase 1 in parallel (fetch wallets/balance)
  // assess response, figure what wallet are buying based on balance
  // list of wallets WITH this strategy ODI
  const walletService = await acquireService(runtime, 'AUTONOMOUS_TRADER_INTERFACE_WALLETS', 'llm trading info');
  const wallets = await walletService.getSpartanWallets({ strategy: STRATEGY_NAME })
  //console.log('llm_strat - wallets', wallets.length)

  // filter wallets for balance check
  const allSolanaWallets = wallets.filter(w => w?.publicKey && w.chain === 'solana')
  const allPubkeys = allSolanaWallets.map(w => w.publicKey)
  const balances = await solanaService.getBalancesByAddrs(allPubkeys)

  // for each pubkey get balances
  for(const w of wallets) {
    //console.log('w', w)
    if (!w?.publicKey) {
      console.warn('skipping', w, 'no publicKey')
      continue
    }
    if (w.chain === 'solana') {

      // do we have any open positions in this token?
      // maybe prevent an additional position in it
      // even spartan says max 3-5 positions at once

      // $1m liquidity, that's too high

      // check current token allocation
      // 20% max of USD value? sol value?

      //const balances = await solanaService.getBalancesByAddrs([w.publicKey])
      const bal = balances[w.publicKey]

      //console.log('bal', bal) //uiAmount
      // this can return NaN?
      if (bal === -1) continue

      // keep gas for selling
      // Chichen says 0.05
      if (bal < 0.005) {
        console.log('not enough SOL balance in', w.publicKey, 'bal', bal)
        continue
      }
      const amt = await scaleAmount(w, bal, response) // uiAmount
      console.log(w.publicKey, 'bal', bal, 'amt (ui)', amt, 'SOL spend. Has', Math.round(bal * 1e9).toLocaleString(), 'lamports')
      // FIXME: what amt is too miniscule for this coin buy (not worth the tx fees?)
      // need a quote...
      // so need cached jupiter routes or an estimator

      const kp = {
        privateKey: w.privateKey,
        publicKey: w.publicKey,
      }
      response.sourceTokenCA = 'So11111111111111111111111111111111111111112'
      response.targetTokenCA = response.recommend_buy_address

      /*
      const caPKObj = new PublicKey(response.recommend_buy_address);
      const tokenInfo = await solanaService.getDecimal(caPKObj)
      //console.log('tokenInfo', tokenInfo)
      const uiToRaw = (10 ** tokenInfo.decimals)
      const rawToUi = 1/uiToRaw
      */

      const res = await solanaService.executeSwap([{
        // we get a quote based on the sol amount
        amount: Math.round(amt * 1e9), // amount of input Token in atomic units
        keypair: kp
      }], response)
      //console.log('buy res', res)

      if (!res) {
        console.warn('Bad response', res)
        continue
      }
      const result = res[kp.publicKey]
      if (result?.success) {
        // better to do it in solana incase it crashes inside
        //console.log('buy successful', result.signature)
        const tokenAmountUi = (result.outAmount / (10 ** result.outDecimal))
        const positionInUsd = tokenAmountUi * token.priceUsd
        console.log('we bought', tokenAmountUi, '(', result.outAmount, '/', result.outDecimal, ')tokens @', token.priceUsd)
        // Create position record
        const position = {
          id: uuidv4() as UUID,
          chain: response.recommend_buy_chain.toLowerCase(),
          token: response.recommend_buy_address,
          publicKey: kp.publicKey,
          // this seems really off by like 1000x
          usdAmount: positionInUsd, // optional
          // is this total or per token? this must be total I guess
          solAmount: amt, // in uiAmount
          // should this be uiAmount too?
          tokenAmount: result.outAmount, // count of token recv in raw?
          swapFee: result.fees.lamports,
          // is this right? yes but we don't need to store, since we can calculate
          //entryPrice: res[0].outAmount / amt,
          timestamp: Date.now(),
          tokenPriceUsd: token.priceUsd, // optional
          // can be calculated from the remaining
          //tokenPriceSol: token.priceSol,
          tokenLiquidity: token.liquidity, // optional
          // priceChange24h percentage?
          exitConditions: {
            // create consistent with original goals to make long term planning
            reasoning: response.exit_conditions,
            // what's current sentiment?
            sentimentDrop: response.exit_sentiment_drop_threshold,
            // optional
            liquidityDrop: response.exit_liquidity_threshold,
            // current vol adjusted
            volumeDrop: response.exit_24hvolume_threshold,
            // current price adjsut
            priceDrop: response.exit_price_drop_threshold, // low exit
            // needs to a number
            targetPrice: response.exit_target_price // high exit
          }
        };
        console.log('bought', position.id, response.recommend_buy_address, 'in', w.publicKey, 'signature', result.signature)
        //console.log('position', position)

        // Open position in strategy service
        await strategyService.open_position(hndl, position);

        const walletIntService = await acquireService(runtime, 'AUTONOMOUS_TRADER_INTERFACE_WALLETS', 'llm trading strategy');
        const kpObj = new PublicKey(response.recommend_buy_address)
        const symbol = await solanaService.getTokenSymbol(kpObj)
        const msg = 'we bought ' + tokenAmountUi + ' ' + symbol + ' (worth $' + positionInUsd.toFixed(2) + ')'
        await walletIntService.notifyWallet(kp.publicKey, msg)
      } else {
        // can be due to lamports
        console.warn('no success on Buy')
        // if slippage error, retry?
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
