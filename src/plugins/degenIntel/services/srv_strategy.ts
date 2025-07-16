import { Service, logger } from '@elizaos/core';

export class TradeStrategyService extends Service {
  private isRunning = false;

  static serviceType = 'TRADER_STRATEGY';
  capabilityDescription = 'The agent is able to use trade strategies';

  // config (key/string)

  constructor(public runtime: IAgentRuntime) {
    super(runtime); // sets this.runtime
    this.strategyRegistry = {};

    // bad smell
    // AUTONOMOUS_TRADER_INTERFACE_POSITIONS should register with me...
    const asking = 'Trader Strategy Service'
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


    })
  }

  /*
  - registry
  - what chain/tokens to listen on
  - open/close position (w/thinking)
  - update (reasoning/exit price) position
  */
  async register_strategy(strategy: any) {
    // add to registry
    const id = Object.values(this.strategyRegistry).length + 1;
    console.log('registered', strategy.name, 'as trading strategy #' + id);
    this.strategyRegistry[id] = strategy;
    return id;
  }

  getHndlByStratName(strat) {
    for(const hndl in this.strategyRegistry) {
      const strategy = this.strategyRegistry[hndl]
      if (strategy.name === strat) {
        return hndl
      }
    }
    return false
  }

  async listActiveStrategies(account) {
    let list = Object.values(this.strategyRegistry)
    //console.log('listActiveStrategies - list', list)
    // these are now context based on who the user is
    // pass message in? user EntityId might be better
    // still need to resolve to account, so maybe account is best...
    // determine holdings
    //console.log('listActiveStrategies - account', account)
    let includePremium = false
    if (account.holderCheck) {
      includePremium = await this.walletIntService.walletContainsMinimum(account.holderCheck, 'Gu3LDkn7Vx3bmCzLafYNKcDxv2mH7YN44NJZFXnypump', 1_000_000)
      if (!includePremium) {
        includePremium = await this.walletIntService.walletContainsMinimum(account.holderCheck, 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC', 10_000)
      }
    }
    //console.log('listActiveStrategies - includePremium', includePremium)
    if (!includePremium) {
      list = list.filter(s => !s.premium)
      //console.log('listActiveStrategies - filtered', list)
    }
    return list.map(s => s.name)
  }

  // why is there here, why even bother stopping here
  /*
  async interested(chain, token, callback) {
    // register for token price changes on this chain
    this.infoService
  }
  */

  // strategy, we manage listeners on data provider events
  async open_position(hndl, pos) {
    // the position is per wallet in a metawallet in a user
    // don't need stratHndl just which wallet opened this I think
    // need to communicate with service in autotrader?
    //console.log('intel::srv_strat:open_position -', pos)
    // it'll find and figure out where to store it
    const created = await this.positionIntService.open(pos)
    // should start a bunch of watchers on a token...

    // open a token monitor, trigger this strategy event handler
    // but like should I know what event handler strategy has? no
    // hndl will help bind events to events
  }

  async update_position(stratHndl, posHndl, pos) {}

  async close_position(stratHndl, publicKey, posHndl, closeInfo) {
    const close = await this.positionIntService.close(publicKey, posHndl, closeInfo)
  }

  /**
   * Start the scenario service with the given runtime.
   * @param {IAgentRuntime} runtime - The agent runtime
   * @returns {Promise<ScenarioService>} - The started scenario service
   */
  static async start(runtime: IAgentRuntime) {
    const service = new TradeStrategyService(runtime);
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
      logger.warn('Trading strategy service is already running');
      return;
    }

    this.chainService = this.runtime.getService('TRADER_CHAIN');
    while (!this.chainService) {
      console.log('waiting for Trading chain service...');
      this.chainService = this.runtime.getService('TRADER_CHAIN');
      if (!this.chainService) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        console.log('Acquired trading chain service...');
      }
    }

    this.infoService = this.runtime.getService('TRADER_DATAPROVIDER');
    while (!this.infoService) {
      console.log('waiting for Trading info service...');
      this.infoService = this.runtime.getService('TRADER_DATAPROVIDER');
      if (!this.infoService) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        console.log('Acquired trading info service...');
      }
    }

    try {
      logger.info('Starting strategy trading service...');

      this.isRunning = true;
      logger.info('Trading strategy service started successfully');
    } catch (error) {
      logger.error('Error starting trading strategy service:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Trading service is not running');
      return;
    }

    try {
      logger.info('Stopping strategy trading service...');

      this.isRunning = false;
      logger.info('Trading strategy service stopped successfully');
    } catch (error) {
      logger.error('Error stopping trading strategy service:', error);
      throw error;
    }
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }
}
