import { IAgentRuntime, getSalt, encryptStringValue, Service, logger } from '@elizaos/core';
import { acquireService } from '../utils';

import { listPositions, createPosition, updatePosition } from '../interfaces/int_positions';
import { getUserIdsByPubkeys } from '../interfaces/int_users'

export class InterfacePositionsService extends Service {
  private isRunning = false;
  private registry: Record<number, any> = {};

  static serviceType = 'AUTONOMOUS_TRADER_INTERFACE_POSITIONS';
  capabilityDescription = 'The agent serves multiple user trading positions';

  // config (key/string)

  constructor(public runtime: IAgentRuntime) {
    super(runtime); // sets this.runtime
    logger.log('AUTONOMOUS_TRADER_INTERFACE_POSITIONS constructor');
  }

  async open(pos) {
    //console.log('srv_pos:open - pos', pos)
    const pubkey = pos.publicKey
    // find which user owns this wallet
    const userids = await getUserIdsByPubkeys(this.runtime, [pubkey])
    //console.log('srv_pos:open - userids', userids, 'pubkey', pubkey)
    const userId = userids[pubkey]
    if (!userId) {
      console.log('srv_pos:open - opened a position for user we dont have', pubkey, 'userids', userids)
      return false
    }
    // returns t/f
    return createPosition(this.runtime, userId, pos)
  }

  //const close = await this.positionIntService.close(publicKey, posHndl, closeInfo)
  async close(publicKey, posHndl, closeInfo) {
    const userids = await getUserIdsByPubkeys(this.runtime, [publicKey])
    //console.log('srv_pos:open - userids', userids, 'pubkey', publicKey)
    const userId = userids[publicKey]
    if (!userId) {
      console.log('srv_pos:open - opened a position for user we dont have', pubkey, 'userids', userids)
      return false
    }
    return updatePosition(this.runtime, userId, posHndl, { close: closeInfo })
  }

  async list(options = {}) {
    return listPositions(this.runtime, options)
  }

  /**
   * Start the scenario service with the given runtime.
   * @param {IAgentRuntime} runtime - The agent runtime
   * @returns {Promise<ScenarioService>} - The started scenario service
   */
  static async start(runtime: IAgentRuntime) {
    const service = new InterfacePositionsService(runtime);
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
      logger.warn('AUTONOMOUS_TRADER_INTERFACE_POSITIONS service is already running');
      return;
    }

    try {
      logger.info('AUTONOMOUS_TRADER_INTERFACE_POSITIONS trading service...');

      this.isRunning = true;
      logger.info('AUTONOMOUS_TRADER_INTERFACE_POSITIONS service started successfully');
    } catch (error) {
      logger.error('Error starting AUTONOMOUS_TRADER_INTERFACE_POSITIONS service:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('AUTONOMOUS_TRADER_INTERFACE_POSITIONS service is not running');
      return;
    }

    try {
      logger.info('Stopping AUTONOMOUS_TRADER_INTERFACE_POSITIONS service...');

      this.isRunning = false;
      logger.info('AUTONOMOUS_TRADER_INTERFACE_POSITIONS stopped successfully');
    } catch (error) {
      logger.error('Error stopping AUTONOMOUS_TRADER_INTERFACE_POSITIONS service:', error);
      throw error;
    }
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }
}
