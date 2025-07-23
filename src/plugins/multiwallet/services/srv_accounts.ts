import { IAgentRuntime, getSalt, encryptStringValue, Service, logger } from '@elizaos/core';
import { acquireService } from '../utils';
import { interface_accounts_list, interface_accounts_ByIds, interface_account_update, interface_account_upsert } from '../interfaces/int_accounts'
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

  async interface_accounts_ByIds(accountIds) {
    return interface_accounts_ByIds(this.runtime, accountIds)
  }

  async interface_account_upsert(message, componentData) {
    return interface_account_upsert(this.runtime, message, componentData)
  }

  async interface_account_update(componentData) {
    return interface_account_update(this.runtime, componentData)
  }

  async notifyAccount(accountIds, msg) {

    const accountId2userIds = await getUseridsByAccountId(this.runtime, accountIds)
    const accountId2ComponentData = await interface_accounts_ByIds(this.runtime, accountIds)
    // a list of users to notify
    const userIds = []
    for(const acctId in accountId2userIds) {
      const accountComponentData = accountId2ComponentData[acctId]
      //console.log('notifyAccount account.notifications', accountComponentData.notifications)
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
      //console.log('no accounts had notifications on')
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
      if (source === 'telegram') {
        const sendRes = await this.runtime.sendMessageToTarget(target, content)
      } else {
/*
6|staging  | [2025-07-22 02:23:33] DEBUG: [Bootstrap] Message sent: 6WNLbwhaPyusZnV9ReLq6LURXGZXBDztGtMVzwDJHHiy $SOL balance change: 0.0484
6|staging  | [2025-07-22 02:23:33] INFO: [Telegram SendHandler] Message sent to chat ID: 418984751
6|staging  | 578 |    * @param method - The method of the request that erred
6|staging  | 579 |    * @param url - The url of the request that erred
6|staging  | 580 |    * @param bodyData - The unparsed data for the request that errored
6|staging  | 581 |    *
6|staging  | 582 |   constructor(rawError, code, status, method, url, bodyData) {
6|staging  | 583 |     super(_DiscordAPIError.getMessage(rawError));
6|staging  |           ^
6|staging  | error: Invalid Form Body
6|staging  | user_id[NUMBER_TYPE_COERCE]: Value "36ab9481-0939-0d2e-be06-f2ba5bf3a917" is not snowflake.
6|staging  |  requestBody: {
6|staging  |   files: undefined,
6|staging  |   json: undefined,
6|staging  | },
6|staging  |    rawError: {
6|staging  |   message: "Invalid Form Body",
6|staging  |   code: 50035,
6|staging  |   errors: [Object ...],
6|staging  | },
6|staging  |        code: 50035,
6|staging  |      status: 400,
6|staging  |      method: "GET",
6|staging  |         url: "https://discord.com/api/v10/users/36ab9481-0939-0d2e-be06-f2ba5bf3a917",
6|staging  |       at new DiscordAPIError (/root/spartan-06-11-staging/node_modules/@discordjs/rest/dist/index.js:583:5)
6|staging  | [2025-07-22 02:23:33] INFO: Starting graceful shutdown of PGlite client...
6|staging  | [2025-07-22 02:23:33.328 +0000] ERROR: [Discord SendHandler] Error sending message: Invalid Form Body
6|staging  | user_id[NUMBER_TYPE_COERCE]: Value "36ab9481-0939-0d2e-be06-f2ba5bf3a917" is not snowflake.
6|staging  |     agentName: "Spartan"
6|staging  |     target: {
6|staging  |       "source": "discord",
6|staging  |       "roomId": "183e4fe4-ccf1-09d9-8b24-e75553e3b1be",
6|staging  |       "entityId": "36ab9481-0939-0d2e-be06-f2ba5bf3a917"
6|staging  |     }
6|staging  |     content: {
6|staging  |       "text": "6WNLbwhaPyusZnV9ReLq6LURXGZXBDztGtMVzwDJHHiy $SOL balance change: 0.0484",
6|staging  |       "source": "discord",
6|staging  |       "channelType": "DM"
6|staging  |     }
6|staging  | [2025-07-22 02:23:33.332 +0000] ERROR: Error executing send handler for source discord:
6|staging  |     agentName: "Spartan"
6|staging  |     message: "(DiscordAPIError[50035]) Invalid Form Body\nuser_id[NUMBER_TYPE_COERCE]: Value \"36ab9481-0939-0d2e-be06-f2ba5bf3a917\" is not snowflake."
6|staging  |     stack: [
6|staging  |       "Error: Invalid Form Body",
6|staging  |       "user_id[NUMBER_TYPE_COERCE]: Value \"36ab9481-0939-0d2e-be06-f2ba5bf3a917\" is not snowflake.",
6|staging  |       "at new DiscordAPIError (/root/spartan-06-11-staging/node_modules/@discordjs/rest/dist/index.js:583:5)",
6|staging  |       "at handleErrors (/root/spartan-06-11-staging/node_modules/@discordjs/rest/dist/index.js:727:17)",
6|staging  |       "at processTicksAndRejections (native:7:39)"
6|staging  |     ]
6|staging  | [2025-07-22 02:23:34] INFO: PGlite client shutdown completed successfully
6|staging  |  Tasks:    2 successful, 2 total
6|staging  | Cached:    0 cached, 2 total
6|staging  |   Time:    3m12.28s
6|staging  | $ turbo run start --filter=./packages/spartan --log-prefix=none --force
6|staging  | turbo 2.5.4
6|staging  | • Packages in scope: @
*/
        console.log('cant notify discord rn', target)
      }
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
