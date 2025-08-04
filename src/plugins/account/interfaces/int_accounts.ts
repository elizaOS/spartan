import {
  type IAgentRuntime,
  type UUID,
  type Content,
  type Component,
  createUniqueUuid,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { interface_spartan_get } from './int_spartan'
import { interface_users_list, interface_users_listVerified, interface_users_ByIds } from './int_users'
import CONSTANTS from '../../autonomous-trader/constants'

// look up by Ids
export async function interface_accounts_ByIds(runtime: IAgentRuntime, ids: UUID[]): Promise<Record<UUID, any>> {
  //console.log('interface_accounts_ByIds', ids)
  const entities = await runtime.getEntitiesByIds(ids)

  // we should key this, each account can and should have only one COMPONENT_ACCOUNT_TYPE component
  const components = {}
  for(const i in entities) {
    const entity = entities[i]
    const entityId = entity.id // ids[i]
    components[entityId] = false // key has to be set for the result, so we can iterate
    if (entity) {
      // let's use the same
      const email = entity.components.find(c => c.type === CONSTANTS.COMPONENT_ACCOUNT_TYPE)
      if (email) {
        //components.push({...email.data, entityId: entity.id, names: entity.names })
        //entityId: entity.id,
        // entityId is what was passed in (emailEntityId)
        // componentId is off that entity
        // accountEntityId is what getAccountFromMessage
        // so it should match entityId

        // maybe instead of entityId, make it accountEntityId or emailEntityId
        components[entityId] = {...email.data, entityId, componentId: email.id }
      } else {
        // normal if they didn't sign up
        console.warn('interface_accounts_ByIds - user', entityId, 'no account component?', entity)
      }
    } else {
      console.warn('interface_accounts_ByIds - user', entityId, 'has no entity, skipping')
    }
  }
  return components
}

export async function interface_accounts_ByUserIds(runtime: IAgentRuntime, userIds: UUID[]): Promise<Record<UUID, any>> {
  //console.log('interface_accounts_ByIds', ids)
  const users = await interface_users_ByIds(runtime, userIds)
  // a unique list of users
  const accountIds = {} // and their single account
  for(const entityId in users) {
    const email = users[entityId]
    console.log(entityId, 'wallets', email.metawallets)
    if (email.verified && email.address) {
      const emailEntityId: UUID = createUniqueUuid(runtime, email.address);
      accountIds[entityId] = emailEntityId
      //userWallets[entityId] = email.metawallets
    }
  }
  const accounts = await interface_accounts_ByIds(runtime, Object.values(accountIds))
  return accounts
}

// list/search
export async function interface_accounts_list(runtime: IAgentRuntime, options = {}): Promise<UUID[]> {
  const spartanData = await interface_spartan_get(runtime)
  return spartanData.data.accounts
}

// list of IDs vs list of users?

// deprecated because we can import a pubkey into multiple accounts
export async function getAccountIdsByPubkeys(runtime: IAgentRuntime, pubkeys: string[]): Promise<Record<string, UUID>> {
  /*
  const mws = []
  const accountIds = await interface_accounts_list(runtime)
  console.log('getAccountIdsByPubkeys - accountIds', accountIds)
  const accounts = await interface_accounts_ByIds(runtime, accountIds)
  console.log('getAccountIdsByPubkeys - accounts', accounts)
  for(const entityId in accounts) {
    const account = accounts[entityId]
    if (!account) {
      console.warn('getAccountIdsByPubkeys - no component found for', entityId)
      // FIXME: remove from agent users if no component
      continue
    }
    //console.log('getMetaWallets - ', entityId, 'wallets', email.metawallets)
    //console.log('getAccountIdsByPubkeys - account', account)
    if (account.metawallets) {
      for(const mw of account.metawallets) {
        mws.push({...mw, entityId, names: account.names })
      }
    } else {
      console.warn('getUserIdsByPubkeys - user', entityId, 'no metawallets in registration component', account)
    }
  }
  //const metaWallets = await getMetaWallets(runtime)
  console.log('getAccountIdsByPubkeys - all metaWallets count', mws.length)
  const metaWallets = mws
  //console.log('getUserIdsByPubkeys - metaWallets', metaWallets)
  const list = {}
  for(const mw of metaWallets) {
    for(const chain in mw.keypairs) {
      const kp = mw.keypairs[chain]
      //console.log('kp', kp)
      if (pubkeys.includes(kp.publicKey)) {
        console.log('getAccountIdsByPubkeys - found', kp.publicKey, 'in', mw)
        if (list[kp.publicKey]) {
          console.log('getAccountIdsByPubkeys - stomping', kp.publicKey, 'was', list[kp.publicKey])
        }
        list[kp.publicKey] = mw.entityId
      } else {
        //console.log('target', pubkeys, 'pubkey', kp.publicKey)
      }
    }
  }
  */

  // seems less problem prone
  const users = await interface_users_list(runtime)
  const emails = await interface_users_ByIds(runtime, users)

  const accountIds = {}
  const userIds = {} // revmap
  for(const entityId in emails) {
    const email = emails[entityId]
    //console.log('getWalletByUserEntityIds_engine', entityId)
    if (email.verified && email.address) {
      const emailEntityId = createUniqueUuid(runtime, email.address);
      //console.log('getAccountIdsByPubkeys - verified email.address', entityId, email.address, '=>', emailEntityId)
      accountIds[entityId] = emailEntityId
      userIds[emailEntityId] = entityId
      //userWallets[entityId] = email.metawallets
    //} else {
      //console.log('getWalletByUserEntityIds_engine - waiting on verification', entityId, email)
    }
  }
  const accounts = await runtime.getEntitiesByIds(Object.values(accountIds))
  //const accountComponents = interface_accounts_ByIds(runtime, Object.values(accountIds))
  const list = {}
  // accountId is just 0, wtf...
  for(const idx in accounts) {
    const account = accounts[idx]
    if (account) {
      //console.log('getAccountIdsByPubkeys - account', account)
      const accountId = account.id // or is it entityId?
      const component = account.components.find(c => c.type === CONSTANTS.COMPONENT_ACCOUNT_TYPE)
      if (component) {
        // const mw = component.data.metawallets.find(mw => mw.keypairs[pos.chain]?.publicKey === pos.publicKey)
        for(const mw of component.data.metawallets) {
          for(const chain in mw.keypairs) {
            const kp = mw.keypairs[chain]
            //console.log('looking at', accountId, kp.publicKey)
            if (pubkeys.includes(kp.publicKey)) {
              // put userid in list for this pubkey
              if (list[kp.publicKey]) {
                console.log('getAccountIdsByPubkeys - stomping', kp.publicKey, 'was', list[kp.publicKey])
              }
              list[kp.publicKey] = accountId
            }
          }
        }
      } else {
        console.log('getAccountIdsByPubkeys - no component for', CONSTANTS.COMPONENT_ACCOUNT_TYPE, 'for', accountId)
      }
    } else {
      console.log('getAccountIdsByPubkeys - no account', account, '? weird')
    }
  }

  return list
}

export async function getAccountIdsByPubkey_engine(runtime: IAgentRuntime, pubkeys: string[]): Promise<{
    pubkey2accountId: Record<UUID, UUID[]>, accountId2Component: Record<UUID, unknown>,
    accountId2userIds: Record<UUID, UUID[]>, userId2Component: Record<UUID, unknown>,
    userId2accountId: Record<UUID, UUID>
  } | false> {
  if (!runtime) {
    console.trace('WHAT ARE YOU DOING?')
    return false
  }
  const map = await interface_users_listVerified(runtime)
  if (!map) {
    return false
  }

  const accounts = await runtime.getEntitiesByIds(Object.values(map.userId2accountId))
  const list = {}
  const account2Component = {}
  // accountId is just 0, wtf...
  for(const idx in accounts) {
    const account = accounts[idx]
    if (account) {
      //console.log('getAccountIdsByPubkey_engine - account', account)
      const accountId = account.id // or is it entityId?
      const component = account.components.find(c => c.type === CONSTANTS.COMPONENT_ACCOUNT_TYPE)
      if (component) {
        account2Component[accountId] = component.data
        // const mw = component.data.metawallets.find(mw => mw.keypairs[pos.chain]?.publicKey === pos.publicKey)
        for(const mw of component.data.metawallets) {
          for(const chain in mw.keypairs) {
            const kp = mw.keypairs[chain]
            //console.log('looking at', accountId, kp.publicKey)
            if (pubkeys.includes(kp.publicKey)) {
              // put userid in list for this pubkey
              if (list[kp.publicKey] === undefined) list[kp.publicKey] = []
              if (list[kp.publicKey].indexOf(accountId) === -1) {
                list[kp.publicKey].push(accountId)
              }
            }
          }
        }
      } else {
        console.log('getAccountIdsByPubkey_engine - no component for', CONSTANTS.COMPONENT_ACCOUNT_TYPE, 'for', accountId)
      }
    } else {
      console.log('getAccountIdsByPubkey_engine - no account', account, '? weird')
    }
  }
  return {
    pubkey2accountId: list, // map of PKs to accountIds
    accountId2Component: account2Component,
    accountId2userIds: map.accountId2userIds,
    // these aren't filtered
    userId2Component: map.emails, // usersObjects keyed by userId
    userId2accountId: map.userId2accountId,
  }
}

// new version
export async function getAccountIdsByPubkeys2(runtime: IAgentRuntime, pubkeys: string[]): Promise<Record<UUID, UUID[]> | undefined> {
  const map = await getAccountIdsByPubkey_engine(runtime, pubkeys)
  return map?.pubkey2accountId
}


// add/update/delete

export async function interface_account_upsert(runtime: IAgentRuntime, message: Content, account): Promise<void> {
  if (account.componentId) {
    console.debug('interface_account_upsert - detected a componentId, weird!', account)
  }
  if (account.id) {
    //console.debug('interface_account_upsert - updating', account.componentId)
    interface_account_update(runtime, account)
  } else {
    //console.debug('interface_account_upsert - creating', account)
    interface_account_create(runtime, message, account)
  }
}

export async function interface_account_create(runtime: IAgentRuntime, message: Content, account): Promise<void> {
  const roomDetails = await runtime.getRoom(message.roomId as UUID);
  const entityId: UUID = account.accountEntityId
  //console.log('entityId', entityId)
  // create the EMAILTYPE component
  await runtime.createComponent({
    id: uuidv4() as UUID,
    agentId: runtime.agentId as UUID,
    worldId: roomDetails.worldId as UUID,
    roomId: message.roomId as UUID,
    sourceEntityId: message.entityId,
    entityId,
    type: CONSTANTS.COMPONENT_ACCOUNT_TYPE,
    data: account,
  });
}

// we're not update the account, we're really updating the account one & only component
export async function interface_account_update(runtime: IAgentRuntime, component: Component): Promise<boolean> {
  const id = component.id
  if (!id) {
    console.warn('no componentId in account', component)
    return false
  }
  //const entityId = component.entityId
  //console.log('interface_account_update - entityId', entityId, 'componentId', id)
  // need to strip somethings...: componentId, names
  // doesn't look like we're injecting any crap into component.data
  /*
  delete component.componentId
  delete component.id
  delete component.names
  delete component.entityId
  delete component.agentId
  delete component.roomId
  delete component.worldId
  delete component.sourceEntityId
  delete component.type
  delete component.accountEntityId // utils injects this
  */

  // , 'componentData', component.data
  // is just too much
  console.log('interface_account_update - accountId', component.entityId, 'component', component.id)

  // const res =
  // missing: entityId, roomId, worldId, sourceEntityId, createdAt
  await runtime.updateComponent({
    id: component.id,
    //worldId: roomDetails.worldId,
    //roomId: message.roomId,
    //sourceEntityId: message.entityId,
    //entityId,
    type: CONSTANTS.COMPONENT_ACCOUNT_TYPE,
    data: component.data,
    agentId: runtime.agentId,
  });
  //console.log('interface_account_update - updateComponent result', res)
  return true
}
