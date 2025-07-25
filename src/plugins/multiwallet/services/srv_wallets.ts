import { IAgentRuntime, getSalt, encryptStringValue, Service, logger } from '@elizaos/core';
import { getWalletByUserEntityIds, getWalletsByPubkey, getSpartanWallets, getMetaWallets } from '../interfaces/int_wallets';
import { acquireService, accountMockComponent, walletContainsMinimum } from '../../autonomous-trader/utils';

export class InterfaceWalletService extends Service {
  private isRunning = false;
  private registry: Record<number, any> = {};

  static serviceType = 'AUTONOMOUS_TRADER_INTERFACE_WALLETS';
  capabilityDescription = 'The agent serves multiple wallets';

  intAccountService: any;
  //intUserService: any;

  // config (key/string)

  constructor(public runtime: IAgentRuntime) {
    super(runtime); // sets this.runtime
    //runtime.logger.debug('AUTONOMOUS_TRADER_INTERFACE_WALLETS constructor');
    const asking = 'Multiwallet service'

    acquireService(this.runtime, 'AUTONOMOUS_TRADER_INTERFACE_ACCOUNTS', asking).then(service => {
      this.intAccountService = service
    })

    /*
    const getUserAcct = async (asking) => {
      const serviceType = 'AUTONOMOUS_TRADER_INTERFACE_USERS'
      this.intUserService = this.runtime.getService(serviceType) as any;
      while (!this.intUserService) {
        runtime.logger.debug(asking, 'waiting for', serviceType, 'service...');
        this.intUserService = this.runtime.getService(serviceType) as any;
        if (!this.intUserService) {
          await new Promise((waitResolve) => setTimeout(waitResolve, 1000));
        } else {
          runtime.logger.debug(asking, 'Acquired', serviceType, 'service...');
        }
      }
    }
    getUserAcct(asking) // no wait
    */
  }

  async getWalletByUserEntityIds(entities: UUID[]) {
    const metawallets = await getWalletByUserEntityIds(this.runtime, entities)
    return metawallets
  }

  async getMetaWallets(options = {}) {
    return getMetaWallets(this.runtime)
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
      meetsReq = await walletContainsMinimum(this.runtime, account.holderCheck, 'Gu3LDkn7Vx3bmCzLafYNKcDxv2mH7YN44NJZFXnypump', 1_000_000)
      if (!meetsReq) {
        meetsReq = await walletContainsMinimum(this.runtime, account.holderCheck, 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC', 10_000)
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
    await this.intAccountService.interface_account_update(this.runtime, component)
    return meetsReq
  }

  /*
  async getWalletByAccountIds(accounts: UUID[]) {
    const metawallets = await interface_accounts_ByIds(this.runtime, accounts)
    return metawallets
  }
  */

  async getWalletsByPubkey(pubKey: string) {
    const metawallets = await getWalletsByPubkey(this.runtime, pubKey)
    return metawallets
  }

  async getAccountsByPubkey(pubKey: string) {
    const res = await this.intAccountService.getAccountIdsByPubkey_engine([pubKey])
    const accountComponents = res.pubkey2accountId[pubKey].map(acctId => res.accountId2Component[acctId])
    return {...res, accountComponents }
  }

  // maybe support an array of msgs, so we don't have to redo the routing
  async notifyWallet(pubKey: string, msg: string) {
    // resolve pubkey to something
    const res = await this.intAccountService.getAccountIdsByPubkey_engine([pubKey])
    const accountComponents = res.pubkey2accountId[pubKey].map(acctId => res.accountId2Component[acctId])
    const accountIds = accountComponents.map(a => a.accountEntityId)
    await this.intAccountService.notifyAccount(accountIds, msg)
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
