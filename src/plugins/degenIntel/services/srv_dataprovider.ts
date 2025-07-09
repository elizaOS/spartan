import { Service, logger } from '@elizaos/core';
import { PublicKey } from '@solana/web3.js';
//import { listPositions } from '../interfaces/int_positions'

export class TradeDataProviderService extends Service {
  private isRunning = false;

  static serviceType = 'TRADER_DATAPROVIDER';
  capabilityDescription = 'The agent is able to get information about blockchains';

  // config (key/string)

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
  async checkPositions() {
    console.log('checking positions');
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

      // don't need to care about closed positions atm
      if (p.position.close) continue
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
    console.log('positions', openPositions + '/' + positions.length, 'watching', tokens.length, 'CAs')
    console.log('wallets', Object.keys(solanaWallets))
    // get balances for all these wallets

    // take list of CA and get token information
    const services = this.forEachReg('lookupService')
    const results = await Promise.all(services.map(service => service.getTokensMarketData(tokens)))
    // an array of list of tokens (keyed by token)
    console.log('results', results)

    // could build a list of
    const closePosition = async (ud, type) => {
      const p = ud.position
      const publicKey = p.publicKey

      if (p.chain !== 'solana') {
        console.Warn('unsupported chain on position', p)
        return false
      }
      const solanaService = this.runtime.getService('chain_solana') as any;

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
      const walletTokens = await solanaService.getTokenAccountsByKeypair(pubKeyObj)
      //console.log('looking for', p.token)
      //console.log('walletTokens', walletTokens.map(t => t.pubkey.toString()))
      const tokenSolanaInfo = walletTokens.find(wt => wt.account.data.parsed.info.mint === p.token)
      if (!tokenSolanaInfo) {
        //console.log('looking for', p.token)
        //console.log('walletTokens', walletTokens.map(t => t.account.data.parsed.info.mint))
        console.log('We no longer hold', p.token, 'at all')
        await this.strategyService.close_position(hndl, kp.publicKey, p.id, {
          type: 'unknwon',
        });
        return false
      }
      //console.log('tokenSolanaInfo', tokenSolanaInfo)
      const decimals = tokenSolanaInfo.account.data.parsed.info.tokenAmount.decimals;
      const amountRaw = tokenSolanaInfo.account.data.parsed.info.tokenAmount.amount;
      const tokenToUi = 1 / (10 ** decimals);
      const tokenBalanceUi = Number(amountRaw) * tokenToUi;
      const positionTokenAmountUi = p.tokenAmount * tokenToUi
      console.log('position', positionTokenAmountUi, 'balance', tokenBalanceUi)

      let sellAmount = Math.round(p.tokenAmount || (p.entryPrice * p.amount))

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
        const res = await solanaService.executeSwap([wallet], signal)
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
            //sellRequestUi: sellAmount * tokenBalanceUi,
            outAmount: result.outAmount,
            signature: result.signature,
            fees: result.fees,
          });
        }
      } catch(e) {
        console.error('failure to close position', e)
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
          console.log('no results for', ca)
          continue
        }
        console.log(ca, 'current price', td.priceUsd, ca2Positions[ca]?.length, 'positions')
        for(const ud of ca2Positions[ca]) {
          //console.log('ud', ud)
          const p = ud.position

          // FIXME: double check actual amount we hold now...

          // sentiment? 24h volume?
          // we have: liquidity, priceChange24h, priceUsd

          //console.log('ud.position', p)
          console.log('p low', p.exitConditions.priceDrop, 'high', p.exitConditions.targetPrice, 'current', td.priceUsd, 'wallet', p.publicKey)
          if (td.priceUsd < p.exitConditions.priceDrop) {
            // sad exit
            console.log('I has a sad')
            await closePosition(ud, 'loss')
            await new Promise((waitResolve) => setTimeout(waitResolve, 1000));
          }
          if (td.priceUsd > p.exitConditions.targetPrice) {
            // win
            console.log('KICK ASS')
            await closePosition(ud, 'win')
            await new Promise((waitResolve) => setTimeout(waitResolve, 1000));
          }
        }
      }
    }
    console.log('done checking open positions')
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

    // this doesn't go here, just temp hack
    this.checkPositions();
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

  async getTokenInfo(chain, address) {
    let token = await this.runtime.getCache<IToken>(`token_${chain}_${address}`);
    console.log('dataProvider - getTokenInfo for token', token);
    if (!token) {
      // not cache, go fetch realtime

      const services = this.forEachReg('lookupService')
      const results = await Promise.all(services.map(service => service.lookupToken(chain, address)))
      //console.log('dataprovider - results', results)

      // how to convert results into token better?
      token = results[0] // reduce
      await this.runtime.setCache<IToken>(`token_${chain}_${address}`, token);
    }
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
    // immediate is actually too soon
    setTimeout(() => {
      this.updateTrending()
    }, 30 * 1000)

    try {
      logger.info('Starting info trading service...');

      this.isRunning = true;
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
