import {
  type IAgentRuntime,
  ModelType,
  logger,
  parseJSONObjectFromText,
  createUniqueUuid,
} from '@elizaos/core';

import CONSTANTS from '../constants'
import { interface_spartan_get } from './int_spartan'
//import { getMetaWallets } from './int_wallets'

// look up by Ids
export async function interface_users_ByIds(runtime, ids) {
  //console.log('interface_users_ByIds', ids)
  const entities = await runtime.getEntityByIds(ids)
  //console.log('interface_users_ByIds - entities', entities, 'asked for', ids)

  // we should key this, each user can and should have only one COMPONENT_USER_TYPE component
  const components = {}
  for(const i in entities) {
    const entity = entities[i]
    //console.log('interface_users_ByIds - entity', entity)
    const entityId = entity.id // ids[i]
    components[entityId] = false // key has to be set for the result, so we can iterate
    if (entity) {
      const email = entity.components.find(c => c.type === CONSTANTS.COMPONENT_USER_TYPE)
      if (email) {
        //components.push({...email.data, entityId: entity.id, names: entity.names })
        //entityId: entity.id,
        components[entityId] = {...email.data, componentId: email.id, names: entity.names }
      } else {
        // normal if they didn't sign up
        // wow gets spammed a lot
        //console.warn('interface_users_ByIds - user', entityId, 'no registration component?', entity)
      }
    } else {
      console.warn('interface_users_ByIds - user', entityId, 'has no entity, skipping')
    }
  }
  return components
}

// who owns what
// chain?
export async function getUserIdsByPubkeys(runtime, pubkeys) {
  const users = await interface_users_list(runtime)
  const emails = await interface_users_ByIds(runtime, users)

  const accountIds = {}
  const userIds = {} // revmap
  for(const entityId in emails) {
    const email = emails[entityId]
    //console.log('getWalletByUserEntityIds_engine', entityId)
    if (email.verified && email.address) {
      const emailEntityId = createUniqueUuid(runtime, email.address);
      //console.log('verified email.address', email.address, '=>', emailEntityId)
      accountIds[entityId] = emailEntityId
      userIds[emailEntityId] = entityId
      //userWallets[entityId] = email.metawallets
    } else {
      console.log('getWalletByUserEntityIds_engine - waiting on verification', entityId, email)
    }
  }

  const accounts = await runtime.getEntityByIds(Object.values(accountIds))
  const list = {}
  for(const accountId in accounts) {
    const account = accounts[accountId]
    if (account) {
      const component = account.components.find(c => c.type === CONSTANTS.COMPONENT_ACCOUNT_TYPE)
      if (component) {
        // const mw = component.data.metawallets.find(mw => mw.keypairs[pos.chain]?.publicKey === pos.publicKey)
        for(const mw of component.data.metawallets) {
          for(const chain in mw.keypairs) {
            const kp = mw.keypairs[chain]
            if (pubkeys.includes(kp.publicKey)) {
              // put userid in list for this pubkey
              list[kp.publicKey] = userIds[mw.entityId]
            }
          }
        }
      }
    }
  }

  /*
  const mws = []
  for(const entityId in emails) {
    const email = emails[entityId]
    if (!email) {
      console.warn('getUserIdsByPubkeys - no component found for', entityId)
      // FIXME: remove from agent users if no component
      continue
    }
    //console.log('getMetaWallets - ', entityId, 'wallets', email.metawallets)
    if (email.metawallets) {
      for(const mw of email.metawallets) {
        mws.push({...mw, entityId, names: email.names })
      }
    } else {
      console.warn('getUserIdsByPubkeys - user', entityId, 'no metawallets in registration component', email)
    }
  }
  //const metaWallets = await getMetaWallets(runtime)
  const metaWallets = mws
  //console.log('getUserIdsByPubkeys - metaWallets', metaWallets)
  const list = {}
  for(const mw of metaWallets) {
    for(const chain in mw.keypairs) {
      const kp = mw.keypairs[chain]
      if (pubkeys.includes(kp.publicKey)) {
        list[kp.publicKey] = mw.entityId
      //} else {
        //console.log('target', pubkeys, 'pubkey', kp.publicKey)
      }
    }
  }
  */
  return list
}

// list/search
// list of IDs vs list of users?
// it's a list of accounts now right?
export async function interface_users_list(runtime, options = {}) {
  const spartanData = await interface_spartan_get(runtime)
  return spartanData.data.users
}

// add/update/delete

export async function interface_user_update(runtime, componentData) {
  const id = componentData.componentId
  if (!id) {
    console.warn('interface_user_update - no componentId in componentData', componentData)
    return false
  }
  const entityId = componentData.accountEntityId
  // need to strip somethings...: componentId, names
  delete componentData.componentId
  delete componentData.names
  delete componentData.entityId
  delete componentData.accountEntityId // utils injects this
  console.log('interface_user_update - componentData', componentData)

  const res = await runtime.updateComponent({
    id,
    //worldId: roomDetails.worldId,
    //roomId: message.roomId,
    //sourceEntityId: message.entityId,
    //entityId,
    type: CONSTANTS.COMPONENT_USER_TYPE,
    data: componentData,
    agentId: runtime.agentId,
  });
  // seems to be undefined
  //console.log('interface_user_update - updateComponent result', res)
  return true
}
