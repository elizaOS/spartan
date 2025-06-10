import { IAgentRuntime, getSalt, encryptStringValue, Service, logger } from '@elizaos/core';
import { acquireService } from '../utils';

export class TradeChainService extends Service {
  private isRunning = false;
  private registry: Record<number, any> = {};

  static serviceType = 'TRADER_CHAIN';
  capabilityDescription = 'The agent is able to trade with blockchains';

  // config (key/string)

  constructor(public runtime: IAgentRuntime) {
    super(runtime); // sets this.runtime
    this.registry = {};
    logger.log('TRADER_CHAIN_SERVICE constructor');
  }

  /**
   * Registers a trading provider with the service.
   * @param {any} provider - The provider to register
   * @returns {Promise<number>} The ID assigned to the registered provider
   */
  async registerChain(provider: any): Promise<number> {
    const id = Object.values(this.registry).length + 1;
    logger.log('Registered', provider.name, 'as Trading Chain provider #' + id);
    this.registry[id] = provider;
    return id;
  }

  async listActiveChains() {
    return Object.values(this.registry).map(s => s.name)
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

  forEachRegWithReg(key) {
    const results = [];
    // foreach provider
    for (const dp of Object.values(this.registry)) {
      // do they have this type of service
      if (dp[key]) {
        // if so get service handle
        const infoService = this.runtime.getService(dp[key]);
        if (infoService) {
          //console.log('updateTrending - result', result)
          results.push({
            registry: dp,
            service: infoService,
          });
        } else {
          console.warn('Registered data provider service not found', key, dp[key]);
        }
      } else {
        console.warn('registered service does not support', key, ':', dp)
      }
    }
    return results
  }

  async makeKeypairs() {
    const services = this.forEachRegWithReg('service')
    const salt = await getSalt()
    const wallets = await Promise.all(services.map(async i => {
      // maybe we should encrypt
      // so service isn't the registration but the plugin service itself...
      console.log('makeKeypairs has service', i.registry.name, i.registry.chain)
      // get key from sparty
      return { chain: i.registry.chain, keypair: await i.service.createWallet() }
    }))
    // should be keyed by chain
    const walletsByChain = {}
    for(const w of wallets) {
      walletsByChain[w.chain] = w.keypair
    }
    console.log('made', walletsByChain)
    return walletsByChain
  }

  async makeKeypair(regName) {
    const reg = Object.values(this.registry).find(r => r.name === regName)
    console.log('reg', reg)
    // maybe we should do this in registerChain
    if (!reg.service) {
      console.log('cannot make keypair, chain', regName, 'not registered right')
      return false
    }
    const chainService = await acquireService(this.runtime, reg.service, 'TRADER_CHAIN')
    const ky = await chainService.createWallet()
    //console.log('ky', ky)
    return ky
  }

  /**
   * Start the scenario service with the given runtime.
   * @param {IAgentRuntime} runtime - The agent runtime
   * @returns {Promise<ScenarioService>} - The started scenario service
   */
  static async start(runtime: IAgentRuntime) {
    const service = new TradeChainService(runtime);
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
      logger.warn('Trading chain service is already running');
      return;
    }

    try {
      logger.info('Starting chain trading service...');

      this.isRunning = true;
      logger.info('Trading chain service started successfully');
    } catch (error) {
      logger.error('Error starting trading chain service:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Trading service is not running');
      return;
    }

    try {
      logger.info('Stopping chain trading service...');

      this.isRunning = false;
      logger.info('Trading service stopped successfully');
    } catch (error) {
      logger.error('Error stopping trading service:', error);
      throw error;
    }
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }
}
