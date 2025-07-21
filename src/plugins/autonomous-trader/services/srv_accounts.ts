import { IAgentRuntime, getSalt, encryptStringValue, Service, logger } from '@elizaos/core';
import { acquireService } from '../utils';
import { interface_accounts_list, interface_accounts_ByIds } from '../interfaces/int_accounts'
import { getUseridsByAccountId } from '../interfaces/int_users'

export class InterfaceAccountService extends Service {
  private isRunning = false;
  private registry: Record<number, any> = {};

  static serviceType = 'AUTONOMOUS_TRADER_INTERFACE_ACCOUNTS';
  capabilityDescription = 'The agent serves multiple accounts';

  // config (key/string)

  constructor(public runtime: IAgentRuntime) {
    super(runtime); // sets this.runtime
    logger.log(this.serviceType, 'constructor');
  }

  // get a list of accounts
  /*
  async list_all() {
    return interface_accounts_list()
  }
  */

  async notifyAccount(accountIds, msg) {

    const accountId2userIds = await getUseridsByAccountId(this.runtime, accountIds)
    const accountId2ComponentData = await interface_accounts_ByIds(this.runtime, accountIds)
    // a list of users to notify
    const userIds = []
    for(const acctId in accountId2userIds) {
      const accountComponentData = accountId2ComponentData[acctId]
      console.log('notifyAccount account.notifications', accountComponentData.notifications)
      if (accountComponentData.notifications) {
        for(const userId of accountId2userIds[acctId]) {
          if (userIds.indexOf(userId) === -1) {
            userIds.push(userId)
          }
        }
      //} else {
        //console.log('account not getting notified')
      }
    }
    if (!userIds.length) {
      console.log('no accounts had notifications on')
      return
    }
    /*
    for(const a of accounts) {
      const accountId = a.accountEntityId
      res.accountId2userIds[accountId].forEach(userId => {
        if (userIds.indexOf(userId) === -1) {
          userIds.push(userId)
        }
      })
      //const userComponents = res.accountId2userIds[accountId].map(userId => res.userId2Component[userId])
      //console.log('accountId', accountId, 'userComponents', userComponents)
    }
    */
    //const userComponents = userIds.map(userId => res.userId2Component[userId])
    //console.log('need to notify', userIds, userComponents)

    // reget it all again
    const entities = await this.runtime.getEntityByIds(userIds)
    console.log('sending', Object.keys(entities).length, 'notifications')
    //for(const userId of userIds) {
    for(const e of entities) {
      const userId = e.id
      //const componentData = res.userId2Component[userId]
      //console.log('need to notify', userId, e)
      const component = e.components.find(c => c.type === 'component_user_v0')
      //console.log('component', component)
      const source = e.metadata.telegram ? 'telegram' : 'discord'
      const worldId = component.worldId
      const roomId = component.roomId
      const target: TargetInfo = {
        source,
        roomId,
        // channelId
        // serverId
        entityId: userId,
        // threadId
      }
      const content: Memory = {
        // thought
        text: msg,
        // actions, providers
        source,
        // target
        // url, inReplyTo, attachments
        channelType: 'DM',
      }
      const sendRes = await this.runtime.sendMessageToTarget(target, content)
      // know the messageId so we could reply would be good
      //console.log('sendRes', sendRes) // undefined ;_;
    }
  }

  /**
   * Start the scenario service with the given runtime.
   * @param {IAgentRuntime} runtime - The agent runtime
   * @returns {Promise<ScenarioService>} - The started scenario service
   */
  static async start(runtime: IAgentRuntime) {
    const service = new InterfaceAccountService(runtime);
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
