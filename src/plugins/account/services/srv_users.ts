import { IAgentRuntime, Service, logger, type UUID } from '@elizaos/core';
import { interface_users_list, interface_users_listVerified, interface_users_ByIds, interface_user_update } from '../interfaces/int_users';

export class InterfaceUserService extends Service {
  private isRunning = false;
  private registry: Record<number, any> = {};

  // was USER
  static serviceType = 'AUTONOMOUS_TRADER_INTERFACE_USERS';
  capabilityDescription = 'The agent serves multiple users';

  // config (key/string)

  constructor(public runtime: IAgentRuntime) {
    super(runtime); // sets this.runtime
  }

  async interface_users_list() {
    return interface_users_list(this.runtime)
  }

  async interface_users_listVerified() {
    return interface_users_listVerified(this.runtime)
  }

  async interface_users_ByIds(entities: UUID[]) {
    return interface_users_ByIds(this.runtime, entities)
  }

  async interface_user_update(componentData: any) {
    return interface_user_update(this.runtime, componentData)
  }

  /**
   * Start the scenario service with the given runtime.
   * @param {IAgentRuntime} runtime - The agent runtime
   * @returns {Promise<ScenarioService>} - The started scenario service
   */
  static async start(runtime: IAgentRuntime) {
    const service = new InterfaceUserService(runtime);
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
      logger.error('Error starting trading chain service:', error instanceof Error ? error.message : String(error));
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
      logger.error('Error stopping trading service:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }
}
