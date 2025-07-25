import { IAgentRuntime, getSalt, encryptStringValue, Service, logger } from '@elizaos/core';
import { listPositions, createPosition, updatePosition } from '../interfaces/int_positions';
import { acquireService } from '../../autonomous-trader/utils';

export class InterfacePositionsService extends Service {
  private isRunning = false;
  private registry: Record<number, any> = {};

  static serviceType = 'AUTONOMOUS_TRADER_INTERFACE_POSITIONS';
  capabilityDescription = 'The agent serves multiple user trading positions';

  // config (key/string)

  intAccountService: any;

  constructor(public runtime: IAgentRuntime) {
    super(runtime); // sets this.runtime
    logger.log('AUTONOMOUS_TRADER_INTERFACE_POSITIONS constructor');
    const asking = 'Position service'

    acquireService(this.runtime, 'AUTONOMOUS_TRADER_INTERFACE_ACCOUNTS', asking).then(service => {
      this.intAccountService = service
    })
  }

  async list(options = {}) {
    return listPositions(this.runtime, options)
  }

  async open(pos) {
    //console.log('srv_pos:open - pos', pos)
    const pubkey = pos.publicKey
    // find which user owns this wallet
    const accountIds = await this.intAccountService.getAccountIdsByPubkeys([pubkey])
    //console.log('srv_pos:open - accountIds', accountIds, 'pubkey', pubkey)
    const accountId = accountIds[pubkey]
    if (!accountId) {
      console.log('srv_pos:open - opened a position for account we dont have', pubkey, 'userids', accountIds)
      return false
    }
    // returns t/f
    return createPosition(this.runtime, accountId, pos)
  }

  //const close = await this.positionIntService.close(publicKey, posHndl, closeInfo)
  async close(publicKey, posHndl, closeInfo) {
    const pubkey = publicKey
    const accountIds = await this.intAccountService.getAccountIdsByPubkeys([pubkey])
    //console.log('srv_pos:close - accountIds', accountIds, 'pubkey', pubkey)
    const accountId = accountIds[pubkey]
    if (!accountId) {
      console.log('srv_pos:close - closed a position for account we dont have', pubkey, 'userids', accountIds)
      return false
    }
    //console.log('updating account', accountId, 'posHndl', posHndl)
    return updatePosition(this.runtime, accountId, posHndl, { close: closeInfo })
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
