import { type Memory, type TargetInfo, Service, logger } from '@elizaos/core';
import { PublicKey } from '@solana/web3.js';
//import { listPositions } from '../interfaces/int_positions'

export class TradeDataProviderService extends Service {
  private isRunning = false;

  static serviceType = 'TRADER_DATAPROVIDER';
  capabilityDescription = 'The agent is able to get information about blockchains';

  // config (key/string)

  positionIntService: any;
  walletIntService: any;
  accountIntService: any;
  solanaService: any;

  constructor(public runtime: IAgentRuntime) {
    super(runtime); // sets this.runtime
    this.registry = {};
    console.log('TRADER_DATAPROVIDER cstr');

    // bad smell
    // AUTONOMOUS_TRADER_INTERFACE_POSITIONS should register with me...
    const asking = 'Trader information Service'
    const serviceType = 'AUTONOMOUS_TRADER_INTERFACE_POSITIONS'
    this.positionIntService = this.runtime.getService(serviceType) as any;
    new Promise(async resolve => {
      while (!this.positionIntService) {
        console.log(asking, 'waiting for', serviceType, 'service...');
        this.positionIntService = this.runtime.getService(serviceType) as any;
        if (!this.positionIntService) {
          await new Promise((waitResolve) => setTimeout(waitResolve, 1000));
        } else {
          console.log(asking, 'Acquired', serviceType, 'service...');
        }
      }
    })

    const serviceType2 = 'AUTONOMOUS_TRADER_INTERFACE_WALLETS'
    this.walletIntService = this.runtime.getService(serviceType2) as any;
    new Promise(async resolve => {
      while (!this.walletIntService) {
        console.log(asking, 'waiting for', serviceType2, 'service...');
        this.walletIntService = this.runtime.getService(serviceType2) as any;
        if (!this.walletIntService) {
          await new Promise((waitResolve) => setTimeout(waitResolve, 1000));
        } else {
          console.log(asking, 'Acquired', serviceType2, 'service...');
        }
      }
    })

    // not really used
    const serviceType5 = 'AUTONOMOUS_TRADER_INTERFACE_ACCOUNTS'
    this.accountIntService = this.runtime.getService(serviceType5) as any;
    new Promise(async resolve => {
      while (!this.accountIntService) {
        console.log(asking, 'waiting for', serviceType5, 'service...');
        this.accountIntService = this.runtime.getService(serviceType5) as any;
        if (!this.accountIntService) {
          await new Promise((waitResolve) => setTimeout(waitResolve, 1000));
        } else {
          console.log(asking, 'Acquired', serviceType5, 'service...');
        }
      }
    })

    // should be available by now, since it's in the same plugin
    // but it's not?
    const serviceType3 = 'TRADER_STRATEGY'
    this.strategyService = this.runtime.getService(serviceType3) as any;
    new Promise(async resolve => {
      while (!this.strategyService) {
        console.log(asking, 'waiting for', serviceType3, 'service...');
        this.strategyService = this.runtime.getService(serviceType3) as any;
        if (!this.strategyService) {
          await new Promise((waitResolve) => setTimeout(waitResolve, 1000));
        } else {
          console.log(asking, 'Acquired', serviceType3, 'service...');
        }
      }
    })

    // const solanaService = this.runtime.getService('chain_solana') as any;
    const serviceType4 = 'chain_solana'
    this.solanaService = this.runtime.getService(serviceType4) as any;
    new Promise(async resolve => {
      while (!this.solanaService) {
        console.log(asking, 'waiting for', serviceType4, 'service...');
        this.solanaService = this.runtime.getService(serviceType4) as any;
        if (!this.solanaService) {
          await new Promise((waitResolve) => setTimeout(waitResolve, 1000));
        } else {
          console.log(asking, 'Acquired', serviceType4, 'service...');
        }
      }
    })

    this.events = new Map();
  }

  // return DataProvider handle
  async registerDataProvder(dataProvider: any) {
    // add to registry
    const id = Object.values(this.registry).length + 1;
    console.log('registered', dataProvider.name, 'as trading data provider #' + id);
    this.registry[id] = dataProvider;
    return id;
  }

  // interested in trending updates
  async interested_trending(handler) {
    const event = 'trending';
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    // add to our local eventHandlers
    this.events.get(event).push(handler);
  }

  // should be a task and not here
  // so many failure codes, we should be more specific

  // what's the cost of a cycle
  // 1+ db calls?
  // sol getBalancesByAddrs
  // sol getTokenBalanceForWallets per ca
  // dp getTokensMarketData
  // dp getTokenTradeData per ca (per dp) (30m cachable)
  async checkPositions() {
    const start = Date.now()
    console.log('DP:checkPositions - checking positions');
    // get a list of positions (chains -> wallets -> positions)

    // need to get autotrader service

    const positions = await this.positionIntService.list()
    // filter thru, what token do we need to get information on?
    const tokens = []
    const ca2Positions = []
    const solanaWallets = {}
    let openPositions = 0
    for(const p of positions) {
      const ca = p.position.token

      // COULD_NOT_FIND_ANY_ROUTE
      if (ca === '84ea5vxsJuf98CRNuVuZYDPjoY4HNjTTCcYY65urxW4V'
          || ca === '6P8EmVEfAicPdyFLpS5GHBeh87EMCk6pRHDDcQFjJXNS'
          || ca === 'METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m'
          || ca === '9ETrUMXSoVUXzATaBEyg5P6jX4jv69m76pC8B6uFzE1R'
      ) {
        continue
      }

      // don't need to care about closed positions atm
      if (p.position.close) continue

      const amt = Math.round(p.position.tokenAmount || (p.position.entryPrice * p.position.amount))
      if (!amt) {
        // might as well be a closed position
        // ud is p
        //console.log('p', p)
        const kp = p.mw.keypairs[p.position.chain]
        //console.log('kp', kp)
        const hndl = this.strategyService.getHndlByStratName(p.mw.strategy)
        //console.log('hndl', hndl)
        //console.log('publicKey', kp.publicKey)
        //console.log('id', p.position.id)
        await this.strategyService.close_position(hndl, kp.publicKey, p.position.id, {
          type: 'zeroamount', // "unknwon" is a backwards compatible value
        });
        continue
      }
      openPositions++

      //console.log('p', p, 'ca', ca)
      if (!tokens.includes(ca)) {
        tokens.push(ca)
      }
      if (ca2Positions[ca] === undefined) ca2Positions[ca] = []
      // how do we get pubkey? p.mw and p.position.publicKey
      //console.log('p', p)
      solanaWallets[p.position.publicKey] = true
      ca2Positions[ca].push(p)
      // is this wallet still holding this?
      //
    }
    console.log('DP:checkPositions - positions', openPositions + '/' + positions.length, 'watching', tokens.length, 'CAs')
    console.log('DP:checkPositions - wallets', Object.keys(solanaWallets))
    // get balances for all these wallets
    const solBalances = await this.solanaService.getBalancesByAddrs(Object.keys(solanaWallets))
    console.log('DP:checkPositions - solBalances', solBalances) // wSOL balance
    // we could cull wallets below a threshold
    // what does cull here mean, remove their positions from monitoring?

    // more importants we need to verify they hold this position still
    //const ca = Object.keys(ca2Positions)[0]
    //const CAs = Object.keys(ca2Positions)
    console.log('DP:checkPositions - looking at', tokens.length, 'CAs')

    if (!tokens.length) {
      const diff = Date.now() - start
      console.log('DP:checkPositions - done checking open positions, took', diff.toLocaleString() + 'ms')
      return
    }

    // we're going to be tracking less tokens than the number of wallets we have
    for(const ca of tokens) {
      const mintObj = new PublicKey(ca)
      const decimals = await this.solanaService.getDecimal(mintObj)
      const tokenBalances = await this.solanaService.getTokenBalanceForWallets(mintObj, Object.keys(solanaWallets))
      //console.log(ca, 'tokenBalances', tokenBalances)
      // adjust positions accordingly to balances
      const positions = ca2Positions[ca]
      for(const idx in positions) {
        const p = positions[idx]
        // find wallet
        const wa = p.position.publicKey
        // how much are we supposed to be holding...
        // tokenBalances is going to be in UI scale
        //console.log(wa, 'p', p.position)

        const actualUi = tokenBalances[wa]
        const claimUi = p.position.tokenAmount / (10 ** decimals)
        if (claimUi > actualUi) {
          console.log('Oh', wa, 'is supposed to have at least', claimUi, 'but we have', actualUi, 'closing position')
          const kp = p.mw.keypairs.solana
          const hndl = this.strategyService.getHndlByStratName(p.mw.strategy)
          await this.strategyService.close_position(hndl, kp.publicKey, p.position.id, {
            type: 'unknown', // "unknwon" is a backwards compatible value
          });
          delete ca2Positions[ca][idx]
        }
      }
    }
    // could clean up more, but it'll be better from this point on

    // take list of CA and get token information
    const services = this.forEachReg('lookupService')
    // seems to be always fresh
    const results = await Promise.all(services.map(service => service.getTokensMarketData('solana', tokens)))
    // an array of list of tokens (keyed by token)
    console.log('results', results)

    // get volume for these tokens (500s rn)
    //const results2 = await Promise.all(services.map(service => service.getTokensPriceVolume(tokens)))
    //console.log('results2', results2)

    // could build a list of
    const closePosition = async (ud, type) => {
      const p = ud.position
      const publicKey = p.publicKey

      if (p.chain !== 'solana') {
        console.warn('closePosition - unsupported chain on position', p)
        return false
      }
      if (p.close) {
        console.warn('closePosition - already closed', p)
        return false
      }
      //const solanaService = this.runtime.getService('chain_solana') as any;

      // make sure we have enough gas
      // check solana balance

      // moved this into swap for now
      /*
      const bal = await solanaService.getBalanceByAddr(publicKey)
      //console.log('bal', bal)
      if (bal < 0.003) {
        console.warn('broke ass wallet', publicKey, 'only has', bal)
        // pretty serious, we can't sell if we don't have enough
        return false
      }
      */

      // set up somethings so we can close positions
      const mw = ud.mw
      const kp = mw.keypairs[p.chain]
      const strat = mw.strategy
      const hndl = this.strategyService.getHndlByStratName(mw.strategy)
      if (!hndl) {
        console.error('Cant find hndl for strategy', mw.streatgy)
        return false
      }

      // verify amount?

      // need to know decimals
      //console.log('publicKey', publicKey)
      const pubKeyObj = new PublicKey(publicKey)
      const walletTokens = await this.solanaService.getTokenAccountsByKeypair(pubKeyObj)
      //console.log('looking for', p.token)
      //console.log('walletTokens', walletTokens.map(t => t.pubkey.toString()))
      const tokenSolanaInfo = walletTokens.find(wt => wt.account.data.parsed.info.mint === p.token)
      if (!tokenSolanaInfo) {
        //console.log('looking for', p.token)
        //console.log('walletTokens', walletTokens.map(t => t.account.data.parsed.info.mint))
        console.log('We no longer hold', p.token, 'at all')
        await this.strategyService.close_position(hndl, kp.publicKey, p.id, {
          type: 'unknown', // "unknwon" is a backwards compatible value
        });
        return false
      }
      //console.log('tokenSolanaInfo', tokenSolanaInfo)
      const decimals = tokenSolanaInfo.account.data.parsed.info.tokenAmount.decimals;
      const amountRaw = tokenSolanaInfo.account.data.parsed.info.tokenAmount.amount;
      const tokenToUi = 1 / (10 ** decimals);
      const tokenBalanceUi = Number(amountRaw) * tokenToUi; // how much they're holding
      console.log('tokenAmount', p.tokenAmount)
      const positionTokenAmountUi = p.tokenAmount * tokenToUi
      const exitUsd = positionTokenAmountUi * ud.price
      console.log('position', positionTokenAmountUi, 'balance', tokenBalanceUi, 'value', exitUsd.toFixed(2))

      let sellAmount = Math.round(p.tokenAmount || (p.entryPrice * p.amount)) // in raw (like lamports)
      console.log('sellAmount', sellAmount, 'from', p.tokenAmount, 'or', p.entryPrice * p.amount, p.entryPrice, p.amount)

      if (positionTokenAmountUi > tokenBalanceUi) {
        console.log('We no longer hold', positionTokenAmountUi, 'of', p.token, 'adjusting to', tokenBalanceUi)
        sellAmount = amountRaw
        // close position as is?
        //return false
        // let's adjust for current amount, and close as it
      }

      // sell back to base
      const signal = {
        sourceTokenCA: p.token,
        targetTokenCA: 'So11111111111111111111111111111111111111112',
        //targetTokenCA: 'Gu3LDkn7Vx3bmCzLafYNKcDxv2mH7YN44NJZFXnypump',
      }

      /*
      const wallets = await this.walletIntService.getWalletsByPubkey(p.publicKey)
      const mw = wallets[p.publicKey]
      if (!mw) {
        console.log('cant find position wallet for', p.publicKey)
        return false
      }
      */
      //console.log('closePosition - ud', ud)

      // amount?
      const wallet = {
        amount: sellAmount, // in raw (atomic units of token)
        // there's other junk in there, so lets just clean it up
        keypair: {
          publicKey: kp.publicKey,
          privateKey: kp.privateKey,
        }
      }
      console.log('closePosition - Selling', p.token, 'wallet', wallet.keypair.publicKey)
      //console.log('closePosition - hndl', hndl, 'pubkey', kp.publicKey, 'p.id', p.id)

      // execute sell
      try {
        // fresh right before the sell
        const timestampMs = Date.now()
        const res = await this.solanaService.executeSwap([wallet], signal)
        const result = res[kp.publicKey]
        // close position
        if (result?.success) {
          console.log('sold', p.id, p.token, 'in', p.publicKey, 'signature', result.signature)
          // going to be hard to get a strategy handle...
          // get strategy hndl and close position
          // which position...
          //console.log('strategyService.close_position hndl', hndl, 'pubkey', kp.publicKey, 'p.id', p.id)
          await this.strategyService.close_position(hndl, kp.publicKey, p.id, {
            type,
            sellRequest: sellAmount,
            timestamp: timestampMs,
            //sellRequestUi: sellAmount * tokenBalanceUi,
            outAmount: result.outAmount,
            signature: result.signature,
            fees: result.fees,
          });

          const pubKey = wallet.keypair.publicKey
          // entered at p.usdAmount (amount usd we invested)
          // exitUsd: exited at ud.price (td.priceUsd) * positionTokenAmountUi
          //if (type === 'win' || type === 'win_vol' || type === 'win_liq') {
          if (exitUsd > p.usdAmount) {
            const diff = exitUsd - p.usdAmount
            const msg = 'you made money because I was right. dont get used to it. Made $' + diff.toFixed(2)
            await this.walletIntService.notifyWallet(pubKey, msg)
          } else {
            const diff = p.usdAmount - exitUsd
            const msg = 'i moved, you followed, we paid $' + diff.toFixed(2)
            await this.walletIntService.notifyWallet(pubKey, msg)
          }
          // p.token is the CA
          const kpObj = new PublicKey(p.token)
          const symbol = await this.solanaService.getTokenSymbol(kpObj)
          const msg = 'sold ' + symbol + ' position in ' + pubKey + ' signature:'
          await this.walletIntService.notifyWallet(pubKey, msg)
          // can we link this
          await this.walletIntService.notifyWallet(pubKey, result.signature)

        }
      } catch(e) {
        console.error('failure to close position', e)
        // is it because of balance?!?
        // retry?
      }
      console.log('done trying to close position', p.id, p.token, 'in', p.publicKey)
    }

    // this type of monitoring should be refactored out
    for(const r of results) { // for each look up service (rn just BE)
      //console.log('r', r)
      for(const ca of tokens) {
        //console.log('ca', ca)
        const td = r[ca]
        if (!td) {
          // this data provider didn't have any info on this token
          console.log('DP:checkPositions - no results for', ca)
          continue
        }

        // get volume
        const results2 = await Promise.all(services.map(service => service.getTokenTradeData('solana', ca)))
        //console.log('results2', results2)
        const beData = results2[0].data // only birdeye atm
        //console.log('beData', beData)
        // volume_24h is in native token I think
        // volume_24h_usd which is what the llm strategy uses
        const curVol24h = beData.volume_24h_usd

        const curLiq = parseInt(td.liquidity)
        console.log('DP:checkPositions -', ca, 'current', '$' + td.priceUsd, 'curLiq', '$' + curLiq.toLocaleString(), 'curVol24h', '$' + Number(curVol24h.toFixed(0)).toLocaleString(), ca2Positions[ca]?.length, 'positions')

        // do these checks in the background
        new Promise(async (resolve) => {
          for(const ud of ca2Positions[ca]) {
            //console.log('ud', ud)
            if (!ud) continue
            const p = ud.position

            // FIXME: need to call the strategy's onPriceDelta

            // sentiment? 24h volume?
            // we have: liquidity, priceChange24h, priceUsd

            //console.log('ud.position', p)
            const minPrice = parseFloat(p.exitConditions.priceDrop)
            const maxPrice = parseFloat(p.exitConditions.targetPrice)
            const per = (parseFloat(td.priceUsd) - minPrice) / (maxPrice - minPrice)
            // solAmount or tokenAMount but neither are in usd
            //const entryPer = parseFloat(td.priceUsd) / (maxPrice - minPrice)
            // 'tAmount', Math.round(p.tokenAmount),  need to be in human terms
            // calculate current worth would be cool
            const minLiq = parseInt(p.exitConditions.liquidityDrop)
            const minVol = parseInt(p.exitConditions.volumeDrop)
            console.log('p low', minPrice, 'high', maxPrice, 'current', td.priceUsd, 'wallet', p.publicKey, 'per', (per * 100).toFixed(0) + '%', 'entry', p.tokenPriceUsd, 'entryAmount', '$' + p.usdAmount, 'minLiq', '$' + minLiq.toLocaleString(), 'minVol', '$' + minVol.toLocaleString())
            ud.price = td.priceUsd // upload current price

            // not awaiting close position
            // should we tho?
            // it's so slow
            // seqential logs help
            //

            if (td.priceUsd <= p.exitConditions.priceDrop) {
              // sad exit
              console.log('I has a sad')
              await closePosition(ud, 'loss')
              continue
            } else
            if (td.priceUsd >= p.exitConditions.targetPrice) {
              // win
              console.log('KICK ASS')
              await closePosition(ud, 'win')
              continue
            }

            //console.log('pLiq min', minLiq.toLocaleString(), 'cur', curLiq.toLocaleString())
            if (curLiq < minLiq) {
              console.log('liqiduity too low')
              // if purchase price is greater than current price
              const type = p.tokenPriceUsd > td.priceUsd ? 'loss_liq' : 'win_liq'
              if (type === 'loss') {
                console.log('I has a sad')
              } else {
                console.log('Win!')
              }
              await closePosition(ud, type)
              continue
            }

            if (curVol24h < minVol) {
              console.log('24h volume too low')
              // if purchase price is greater than current price
              const type = p.tokenPriceUsd > td.priceUsd ? 'loss_vol' : 'win_vol'
              if (type === 'loss') {
                console.log('I has a sad')
              } else {
                console.log('Win!')
              }
              await closePosition(ud, type)
              continue
            }

          }
          resolve()
        })
      }
    }
    const diff = Date.now() - start
    console.log('DP:checkPositions - done checking open positions, took', diff.toLocaleString() + 'ms')
  }

  forEachReg(key) {
    const results = [];
    // foreach provider
    for (const dp of Object.values(this.registry)) {
      // do they have this type of service
      if (dp[key]) {
        // if so get service handle
        const infoService = this.runtime.getService(dp[key]);
        if (infoService) {
          //console.log('updateTrending - result', result)
          results.push(infoService);
        } else {
          console.warn('Registered data provider service not found', key, dp[key]);
        }
      } else {
        console.warn('registered service does not support', key, ':', dp)
      }
    }
    return results
  }

  // should this be a task?
  async updateTrending() {
    console.log('checking trending');
    // collect all
    const services = this.forEachReg('trendingService')
    // birdeye just reads the cache built from the task
    const results = await Promise.all(services.map(service => service.getTrending()))

    // process results
    //console.log('srv_dataprov::updateTrending - results', results);

    // emit event
    const event = 'trending';
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    console.log('trending registered handlers', this.events.get(event));
    const eventHandlers = this.events.get(event);
    for (const handler of eventHandlers) {
      handler(results);
    }
  }

  // interested in price delta events
  async interested_priceDelta(chain, token, handler) {
    const event = 'price_delta';
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }

    // for each provider in register
    for (const dp of Object.values(this.registry)) {
      // do they have this type of service
      if (dp.hasPriceDelta) {
        // if so register handler with event
        // add to our local eventHandlers
        this.events.get(event).push(handler);
      }
    }
  }

  /*
  async getTokenValueUSD(chain, address) {
    // utilitze this cache somehow?
    let token = await this.runtime.getCache<IToken>(`token_${chain}_${address}`);
    let tokenPrice = await this.runtime.getCache<IToken>(`token_${chain}_${address}_price`);
    console.log('dataProvider - getTokenValueUSD for token', chain, address);
    if (!token) {
      // not cache, go fetch realtime

      const services = this.forEachReg('priceService')
      const results = await Promise.all(services.map(service => service.valueToken(chain, address)))
      //console.log('dataprovider - results', results)

      // how to convert results into token better?
      tokenPrice = results[0] // reduce
      await this.runtime.setCache<IToken>(`token_${chain}_${address}`, token);
    }
    // needs to include liquidity, 24h volume, suspicous atts
    return tokenPrice;
  }
  */

  async getTokenInfo(chain, address) {
    // don't need to cache the cached
    let token
    /*
    token = await this.runtime.getCache<IToken>(`token_${chain}_${address}`);
    //console.log('dataProvider - getTokenInfo for token', chain, address);
    if (!token) {
    */
      // not cache, go fetch realtime
      //console.log('dataProvider::getTokenInfo - MISS')
      const services = this.forEachReg('lookupService')
      // this is also heavily cached
      const results = await Promise.all(services.map(service => service.lookupToken(chain.toLowerCase(), address)))
      //console.log('dataprovider - results', results)

      // how to convert results into token better?
      token = results[0] // reduce
      //await this.runtime.setCache<IToken>(`token_${chain}_${address}`, token);
    //}
    // needs to include liquidity, 24h volume, suspicous atts
    return token;
  }

  /**
   * Start the scenario service with the given runtime.
   * @param {IAgentRuntime} runtime - The agent runtime
   * @returns {Promise<ScenarioService>} - The started scenario service
   */
  static async start(runtime: IAgentRuntime) {
    console.log('TRADER_DATAPROVIDER trying to start');
    const service = new TradeDataProviderService(runtime);
    service.start();
    return service;
  }
  /**
   * Stops the Scenario service associated with the given runtime.
   *
   * @param {IAgentRuntime} runtime The runtime to stop the service for.
   * @throws {Error} When the Scenario service is not found.
   */
  static async stop(runtime: IAgentRuntime) {
    const service = runtime.getService(this.serviceType);
    if (!service) {
      throw new Error(this.serviceType + ' service not found');
    }
    service.stop();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Trading info service is already running');
      return;
    }
    console.log('TRADER_DATAPROVIDER starting');

    // maybe we don't need to do this under the first registers
    this.timer = setInterval(
      () => {
        console.log('TRADER_DATAPROVIDER Updating Trending')
        this.updateTrending();
      },
      10 * 60 * 1000
    );

    // separate timer for sell signal
    this.checkPosTimer = setInterval(
      () => {
        console.log('TRADER_DATAPROVIDER Checking positions')
        this.checkPositions();
      },
      10 * 60 * 1000
    );

    // immediate is actually too soon
    setTimeout(async () => {
      await this.updateTrending()
      this.checkPositions();
    }, 15 * 1000) //was 30s

    try {
      logger.info('Starting info trading service...');
      this.isRunning = true;

      /*
      const accountIds = await this.accountIntService.list_all()
      console.log('boot accountIds', accountIds)
      // now get all the wallets from these accountIds
      const mws = await this.walletIntService.getWalletByAccountIds(accountIds)
      console.log('boot mws', mws.length, mws)
      */

      // gather all pubkeys
      const wallets = await this.walletIntService.getSpartanWallets({})
      // not account here...
      //console.log('wallet0', wallets[0])
      console.log('intel:DPsrv - boot wallets', wallets.length)
      const pubKeys = Array.from(new Set(wallets.filter(w => w.chain === 'solana').map(w => w.publicKey)))
      console.log('intel:DPsrv - pubKeys', pubKeys)

      // we're looking for initial funding event mainly here...
      pubKeys.forEach(async pk => {
        // need to pass a handler
        await this.solanaService.subscribeToAccount(pk, async (accountAddress, accountInfo, context) => {
          // where's the pubkey
          //console.log('sub', accountAddress, 'Account updated:', accountInfo);
          /*
            sub HZoGUehwBuXkFhTkkov7VkKDo2uhUKqdoijVb9vByE9B Account updated: {
              lamports: 48199189,
              data: <Buffer >,
              owner: PublicKey {
                _bn: <BN: 0>,
                equals: [Function: equals],
                toBase58: [Function: toBase58],
                toJSON: [Function: toJSON],
                toBytes: [Function: toBytes],
                toBuffer: [Function: toBuffer],
                toString: [Function: toString],
                encode: [Function: encode],
              },
              executable: false,
              rentEpoch: 18446744073709552000,
              space: 0,
            }
          */
          //console.log('sub', accountAddress, 'Slot:', context.slot); // like block

          const msg = accountAddress + ' $SOL balance change: ' + (accountInfo.lamports / 1e9).toFixed(4)

          // resolve pubkey to something
          await this.walletIntService.notifyWallet(accountAddress, msg)
        })
      })

      logger.info('Trading info service started successfully');
    } catch (error) {
      logger.error('Error starting trading info service:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Trading info service is not running');
      return;
    }

    try {
      logger.info('Stopping info trading info service...');

      this.isRunning = false;
      logger.info('Trading info service stopped successfully');
    } catch (error) {
      logger.error('Error stopping trading info service:', error);
      throw error;
    }
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }
}
