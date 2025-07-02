import {
  type IAgentRuntime,
  ModelType,
  logger,
  parseJSONObjectFromText,
  type UUID,
  createUniqueUuid,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { interface_spartan_get } from './int_spartan'
import { interface_users_ByIds } from './int_users'
import CONSTANTS from '../constants'

// look up by Ids
export async function interface_accounts_ByIds(runtime, ids) {
  //console.log('interface_accounts_ByIds', ids)
  const entities = await runtime.getEntityByIds(ids)

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

export async function interface_accounts_ByUserIds(runtime, userIds) {
  //console.log('interface_accounts_ByIds', ids)
  const users = await interface_users_ByIds(runtime, userIds)
  const accountIds = {}
  for(const entityId in users) {
    const email = users[entityId]
    console.log(entityId, 'wallets', email.metawallets)
    if (email.verified && email.address) {
      const emailEntityId = createUniqueUuid(runtime, email.address);
      accountIds[entityId] = emailEntityId
      //userWallets[entityId] = email.metawallets
    }
  }
  const accounts = await interface_accounts_ByIds(runtime, accountIds)
  return accounts
}

// list/search
export async function interface_accounts_list(runtime, options = {}) {
  const spartanData = await interface_spartan_get(runtime)
  return spartanData.data.accounts
}

// list of IDs vs list of users?
export async function getAccountIdsByPubkeys(runtime, pubkeys) {
  const accountIds = await interface_accounts_list(runtime)
  console.log('getAccountIdsByPubkeys - accountIds', accountIds)
  const accounts = await interface_accounts_ByIds(runtime, accountIds)
  console.log('getAccountIdsByPubkeys - accounts', accounts)
  const mws = []
  for(const entityId in accounts) {
    const account = accounts[entityId]
    if (!account) {
      console.warn('getAccountIdsByPubkeys - no component found for', entityId)
      // FIXME: remove from agent users if no component
      continue
    }
    //console.log('getMetaWallets - ', entityId, 'wallets', email.metawallets)
    console.log('getAccountIdsByPubkeys - account', account)
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
      console.log('kp', kp)
      if (pubkeys.includes(kp.publicKey)) {
        list[kp.publicKey] = mw.entityId
      } else {
        console.log('target', pubkeys, 'pubkey', kp.publicKey)
      }
    }
  }
  return list
}

// add/update/delete

export async function interface_account_upsert(runtime, message, account) {
  if (account.componentId) {
    //console.debug('interface_account_upsert - updating', account.componentId)
    interface_account_update(runtime, account)
  } else {
    //console.debug('interface_account_upsert - creating', account)
    interface_account_create(runtime, message, account)
  }
}

export async function interface_account_create(runtime, message, account) {
  const roomDetails = await runtime.getRoom(message.roomId);
  const entityId = account.accountEntityId
  //console.log('entityId', entityId)
  // create the EMAILTYPE component
  await runtime.createComponent({
    id: uuidv4() as UUID,
    agentId: runtime.agentId,
    worldId: roomDetails.worldId,
    roomId: message.roomId,
    sourceEntityId: message.entityId,
    entityId,
    type: CONSTANTS.COMPONENT_ACCOUNT_TYPE,
    data: account,
  });
}

export async function interface_account_update(runtime, account) {
  const id = account.componentId
  if (!id) {
    console.warn('no componentId in account', account)
    return false
  }
  const entityId = account.accountEntityId
  // need to strip somethings...: componentId, names
  delete account.componentId
  delete account.names
  delete account.entityId
  delete account.accountEntityId // utils injects this
  //console.log('interface_account_update - componentData', account)

  const res = await runtime.updateComponent({
    id,
    //worldId: roomDetails.worldId,
    //roomId: message.roomId,
    //sourceEntityId: message.entityId,
    //entityId,
    type: CONSTANTS.COMPONENT_ACCOUNT_TYPE,
    data: account,
    agentId: runtime.agentId,
  });
  //console.log('interface_account_update - updateComponent result', res)
  return true
}
