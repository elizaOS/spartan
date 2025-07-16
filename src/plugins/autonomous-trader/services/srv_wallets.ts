import { IAgentRuntime, getSalt, encryptStringValue, Service, logger } from '@elizaos/core';
import { acquireService, accountMockComponent, walletContainsMinimum } from '../utils';

import { getWalletByUserEntityIds, getWalletsByPubkey, getSpartanWallets } from '../interfaces/int_wallets';
import { getUserIdsByPubkeys } from '../interfaces/int_users';
import { createPosition } from '../interfaces/int_positions';

export class InterfaceWalletService extends Service {
  private isRunning = false;
  private registry: Record<number, any> = {};

  static serviceType = 'AUTONOMOUS_TRADER_INTERFACE_WALLETS';
  capabilityDescription = 'The agent serves multiple wallets';

  // config (key/string)

  constructor(public runtime: IAgentRuntime) {
    super(runtime); // sets this.runtime
    logger.log('AUTONOMOUS_TRADER_INTERFACE_WALLETS constructor');
  }

  async getWalletByUserEntityIds(entities: UUID[]) {
    const metawallets = await getWalletByUserEntityIds(this.runtime, entities)
    return metawallets
  }

  async getSpartanWallets(options = {}) {
    return getSpartanWallets(this.runtime, options)
  }

  async walletContainsMinimum(pubKey, ca, amount) {
    return walletContainsMinimum(this.runtime, pubKey, ca, amount)
  }

  async accountMeetsRequirement(account) {
    // read last cache check
    const lastCheck = account.lastRequiresCheckAt
    console.log('lastCheck', lastCheck)
    const ts = Math.round(Date.now() / 1e3)
    if (account.lastRequiresCheckAt && account.lastRequiresCheck !== undefined) {
      const sinceLast = ts - lastCheck
      // if we had it give longer
      const waitAmtInMins = account.lastRequiresCheck ? 30 : 1
      if (sinceLast < waitAmtInMins * 60) {
        console.log('accountMeetsRequirement using cache of', sinceLast.toLocaleString() + 's')
        return account.lastRequiresCheck
      }
    }

    let meetsReq = false
    if (account.holderCheck) {
      meetsReq = await this.walletIntService.walletContainsMinimum(account.holderCheck, 'Gu3LDkn7Vx3bmCzLafYNKcDxv2mH7YN44NJZFXnypump', 1_000_000)
      if (!meetsReq) {
        meetsReq = await this.walletIntService.walletContainsMinimum(account.holderCheck, 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC', 10_000)
      }
    }
    // did it change from store
    if (meetsReq !== account.lastRequiresCheck) {
      // trigger edges
      if (meetsReq) {
        // just bought
        console.log('just bought')
      } else {
        // just sold
        console.log('just sold')
      }
    }
    // update store
    account.lastRequiresCheckAt = ts
    account.lastRequiresCheck = meetsReq
    const component = accountMockComponent(account)
    await interface_account_update(this.runtime, component)
    return meetsReq
  }

  /*
  async getWalletByAccountIds(accounts: UUID[]) {
    const metawallets = await interface_accounts_ByIds(this.runtime, accounts)
    return metawallets
  }
  */

  async getWalletsByPubkey(pubKey: string) {
    const metawallets = await getWalletsByPubkey(pubKey)
    return metawallets
  }

  /**
   * Start the scenario service with the given runtime.
   * @param {IAgentRuntime} runtime - The agent runtime
   * @returns {Promise<ScenarioService>} - The started scenario service
   */
  static async start(runtime: IAgentRuntime) {
    const service = new InterfaceWalletService(runtime);
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
