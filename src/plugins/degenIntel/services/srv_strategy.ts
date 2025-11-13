import { Service, logger, ServiceTypeName } from '@elizaos/core';
import type { IAgentRuntime } from '@elizaos/core';
import { acquireService, getCacheTimed } from '../../autonomous-trader/utils';
import type { Position } from '../../trading/types';
import type { IToken } from '../types';

interface Strategy {
  name: string;
  premium?: boolean;
  [key: string]: any;
}

interface Account {
  holderCheck?: string;
  [key: string]: any;
}

interface CloseInfo {
  [key: string]: any;
}

export class TradeStrategyService extends Service {
  private isRunning = false;

  static serviceType = 'TRADER_STRATEGY';
  capabilityDescription = 'The agent is able to use trade strategies';

  // config (key/string)
  private strategyRegistry: Record<number, Strategy> = {};
  private chainService: any;
  private infoService: any;

  private pIntPositions: Promise<void>;
  private pIntWallets: Promise<void>;
  positionIntService: any;
  walletIntService: any;

  constructor(public runtime: IAgentRuntime) {
    super(runtime); // sets this.runtime
    this.strategyRegistry = {};


    const asking = 'Strategy service'

    // bad smell
    // AUTONOMOUS_TRADER_INTERFACE_POSITIONS should register with me...
    this.pIntPositions = runtime.getServiceLoadPromise('AUTONOMOUS_TRADER_INTERFACE_POSITIONS' as ServiceTypeName).then(() => {
      // used to list positions
      this.positionIntService = this.runtime.getService('AUTONOMOUS_TRADER_INTERFACE_POSITIONS' as ServiceTypeName);
    })

    this.pIntWallets = runtime.getServiceLoadPromise('AUTONOMOUS_TRADER_INTERFACE_WALLETS' as ServiceTypeName).then(() => {
      // used for wallet notifications
      this.walletIntService = this.runtime.getService('AUTONOMOUS_TRADER_INTERFACE_WALLETS' as ServiceTypeName);
    })
  }

  /*
  - registry
  - what chain/tokens to listen on
  - open/close position (w/thinking)
  - update (reasoning/exit price) position
  */
  async register_strategy(strategy: Strategy): Promise<number> {
    // add to registry
    const id = Object.values(this.strategyRegistry).length + 1;
    console.log('registered', strategy.name, 'as trading strategy #' + id);
    this.strategyRegistry[id] = strategy;
    return id;
  }

  getHndlByStratName(strat: string): number | false {
    for (const hndl in this.strategyRegistry) {
      const strategy = this.strategyRegistry[Number(hndl)];
      if (strategy.name === strat) {
        return Number(hndl);
      }
    }
    return false
  }

  // FIXME: options to no wait, so we can get possible shapes for validation
  async listActiveStrategies(account: Account): Promise<string[]> {
    let list: Strategy[] = Object.values(this.strategyRegistry);
    //console.log('listActiveStrategies - list', list)
    // these are now context based on who the user is
    // pass message in? user EntityId might be better
    // still need to resolve to account, so maybe account is best...
    // determine holdings
    //console.log('listActiveStrategies - account', account)
    let includePremium = false;
    if (account.holderCheck) {
      await this.pIntWallets
      includePremium = await this.walletIntService.walletContainsMinimum(account.holderCheck, 'Gu3LDkn7Vx3bmCzLafYNKcDxv2mH7YN44NJZFXnypump', 1_000_000);
      if (!includePremium) {
        includePremium = await this.walletIntService.walletContainsMinimum(account.holderCheck, 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC', 10_000);
      }
    }
    //console.log('listActiveStrategies - includePremium', includePremium)
    if (!includePremium) {
      list = list.filter(s => !s.premium);
      //console.log('listActiveStrategies - filtered', list)
    }
    return list.map(s => s.name);
  }

  // why is there here, why even bother stopping here
  /*
  async interested(chain, token, callback) {
    // register for token price changes on this chain
    this.infoService
  }
  */

  // strategy, we manage listeners on data provider events
  async open_position(hndl: number, pos: Position): Promise<void> {
    // the position is per wallet in a metawallet in a user
    // don't need stratHndl just which wallet opened this I think
    // need to communicate with service in autotrader?
    //console.log('intel::srv_strat:open_position -', pos)
    // it'll find and figure out where to store it
    await this.pIntPositions
    const created = await this.positionIntService.open(pos);
    // should start a bunch of watchers on a token...

    // open a token monitor, trigger this strategy event handler
    // but like should I know what event handler strategy has? no
    // hndl will help bind events to events
  }

  async update_position(stratHndl: number, posHndl: string, pos: Position): Promise<void> { }

  async close_position(stratHndl: number, publicKey: string, posHndl: string, closeInfo: CloseInfo): Promise<void> {
    await this.pIntPositions
    const close = await this.positionIntService.close(publicKey, posHndl, closeInfo);
  }

  /**
   * Get the base pair (native token) address for each blockchain
   * This is used to determine which token to swap from on each chain
   */
  getBasePairForChain(chain: string): string {
    const basePairs: Record<string, string> = {
      'solana': 'So11111111111111111111111111111111111111112', // SOL
      'ethereum': '0x0000000000000000000000000000000000000000', // ETH (native)
      'base': '0x0000000000000000000000000000000000000000', // ETH on Base
      'arbitrum': '0x0000000000000000000000000000000000000000', // ETH on Arbitrum
      'optimism': '0x0000000000000000000000000000000000000000', // ETH on Optimism
      'polygon': '0x0000000000000000000000000000000000000001', // MATIC (note: different address)
      'avalanche': '0x0000000000000000000000000000000000000000', // AVAX
      'bsc': '0x0000000000000000000000000000000000000000', // BNB
      // Add more chains as needed
    }

    const normalizedChain = chain.toLowerCase()
    return basePairs[normalizedChain] || basePairs['solana']
  }

  /**
   * Get the native token symbol for each blockchain
   */
  getNativeTokenSymbol(chain: string): string {
    const nativeSymbols: Record<string, string> = {
      'solana': 'SOL',
      'ethereum': 'ETH',
      'base': 'ETH',
      'arbitrum': 'ETH',
      'optimism': 'ETH',
      'polygon': 'MATIC',
      'avalanche': 'AVAX',
      'bsc': 'BNB',
    }

    const normalizedChain = chain.toLowerCase()
    return nativeSymbols[normalizedChain] || 'NATIVE'
  }

  /**
   * Get the minimum balance required for transactions on each chain
   * This is to ensure wallets have enough for gas fees
   */
  getMinimumBalanceForChain(chain: string): number {
    const minimumBalances: Record<string, number> = {
      'solana': 0.005, // ~$1 worth at typical SOL prices
      'ethereum': 0.001, // ~$3-4 at typical ETH prices
      'base': 0.001,
      'arbitrum': 0.001,
      'optimism': 0.001,
      'polygon': 0.01, // MATIC is cheaper
      'avalanche': 0.01,
      'bsc': 0.001,
    }

    const normalizedChain = chain.toLowerCase()
    return minimumBalances[normalizedChain] || 0.005
  }

  /**
   * Get all trending tokens from all available chains
   * This collects and flattens trending tokens across all supported blockchains
   * @param filterRugged - Whether to filter out tokens marked as rugs (default: true)
   * @returns Array of tokens from all chains
   */
  async getAllTrendingTokens(filterRugged: boolean = true): Promise<IToken[]> {
    // Get all available chains
    const services = this.chainService.forEachRegWithReg('service')
    const chains = [...new Set(services.map((i: any) => i.registry.chainType).filter((s: any) => !!s))]
    logger.info(`Getting trending tokens from chains: ${chains.join(', ')}`)

    // Get trending tokens with supply info for all chains
    await this.infoService.getTrendingWSupply(chains)

    // Flatten all tokens from all chains into a single array
    const allTokens: IToken[] = []

    for (const chain of chains) {
      const chainStr = String(chain)
      const cacheKey = `tokens_v2_${chainStr}`
      const wrapper = await this.runtime.getCache(cacheKey) as any || null

      if (!wrapper || !wrapper.data) {
        logger.warn(`No trending tokens found for chain: ${chainStr}`)
        continue
      }

      const trendingData = wrapper.data as IToken[]
      logger.info(`Found ${trendingData.length} tokens on ${chainStr}`)

      // Add chain-specific tokens to our master list
      for (const token of trendingData) {
        // Optionally filter out rugged tokens
        if (filterRugged) {
          const rugKey = `rugcheck_${chainStr}_${token.address}`
          const rugCache = await getCacheTimed(this.runtime, rugKey, { notOlderThan: 6 * 60 * 60 * 1000 })

          if (rugCache && rugCache === 'rug') {
            logger.debug(`Omitting ${token.address} on ${chainStr} (marked as rug)`)
            continue
          }
        }

        allTokens.push({
          ...token,
          chain: chainStr // ensure chain is set
        })
      }
    }

    logger.info(`Total tokens available across all chains: ${allTokens.length}`)
    return allTokens
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
      this.runtime.logger.warn('Trading strategy service is already running');
      return;
    }
    this.runtime.logger.info('Starting strategy trading service...');
    this.isRunning = true;

    void (async () => {
      try {
        const [chainReady, infoReady] = await Promise.allSettled([
          this.runtime.getServiceLoadPromise('INTEL_CHAIN' as ServiceTypeName),
          this.runtime.getServiceLoadPromise('INTEL_DATAPROVIDER' as ServiceTypeName),
        ]);

        if (chainReady.status === 'fulfilled') {
          this.chainService = this.runtime.getService('INTEL_CHAIN');
        } else {
          this.runtime.logger.warn({
            error: chainReady.reason instanceof Error ? chainReady.reason.message : String(chainReady.reason),
            service: 'INTEL_CHAIN',
          }, 'Failed to resolve INTEL_CHAIN service for strategy runtime');
        }

        if (infoReady.status === 'fulfilled') {
          this.infoService = this.runtime.getService('INTEL_DATAPROVIDER');
        } else {
          this.runtime.logger.warn({
            error: infoReady.reason instanceof Error ? infoReady.reason.message : String(infoReady.reason),
            service: 'INTEL_DATAPROVIDER',
          }, 'Failed to resolve INTEL_DATAPROVIDER service for strategy runtime');
        }

        if (this.chainService && this.infoService) {
          this.runtime.logger.info('Trading strategy dependencies acquired');
        } else {
          this.runtime.logger.warn(
            'Trading strategy service is running without required dependencies; functionality will be limited'
          );
        }
      } catch (error) {
        this.runtime.logger.error(
          'Error starting trading strategy service:',
          error instanceof Error ? error.message : String(error)
        );
        this.isRunning = false;
      }
    })();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.runtime.logger.warn('Trading service is not running');
      return;
    }

    try {
      this.runtime.logger.info('Stopping strategy trading service...');

      this.isRunning = false;
      this.runtime.logger.info('Trading strategy service stopped successfully');
    } catch (error) {
      this.runtime.logger.error('Error stopping trading strategy service:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }
}
