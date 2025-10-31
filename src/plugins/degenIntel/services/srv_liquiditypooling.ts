import { Service, logger } from '@elizaos/core';
import type { IAgentRuntime } from '@elizaos/core';

import { acquireService } from '../utils';

export class TradeLpService extends Service {
  private isRunning = false;
  private registry: Record<number, any> = {};

  static serviceType = 'TRADER_LIQUIDITYPOOL';
  capabilityDescription = 'The agent is able to interact with liquidity pools';

  // config (key/string)

  constructor(public runtime: IAgentRuntime) {
    super(runtime); // sets this.runtime
    this.registry = {};
    logger.log('TRADER_LIQUIDITYPOOL constructor');
  }

  /**
   * Registers a trading provider with the service.
   * @param {any} provider - The provider to register
   * @returns {Promise<number>} The ID assigned to the registered provider
   */
  async registerLp(provider: any): Promise<number> {
    const id = Object.values(this.registry).length + 1;
    logger.log('Registered', provider.name, 'as Trading LP provider #' + id);
    this.registry[id] = provider;
    return id;
  }

  async listActiveLp() {
    return Object.values(this.registry).map(s => s.name)
  }

  /**
   * Start the scenario service with the given runtime.
   * @param {IAgentRuntime} runtime - The agent runtime
   * @returns {Promise<ScenarioService>} - The started scenario service
   */
  static async start(runtime: IAgentRuntime) {
    const service = new TradeLpService(runtime);
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
      logger.warn('Trading LP service is already running');
      return;
    }

    try {
      logger.info('Starting LP trading service...');

      this.isRunning = true;
      logger.info('Trading LP service started successfully');
    } catch (error) {
      logger.error('Error starting trading LP service:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Trading LP service is not running');
      return;
    }

    try {
      logger.info('Stopping LP trading service...');

      this.isRunning = false;
      logger.info('Trading service stopped successfully');
    } catch (error) {
      logger.error('Error stopping trading service:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }
}
