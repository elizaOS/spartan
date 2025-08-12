import {
  type IAgentRuntime,
  type UUID,
  //type Component,
  createUniqueUuid,
} from '@elizaos/core';

import CONSTANTS from '../../autonomous-trader/constants'
import { interface_spartan_get } from './int_spartan'

/*
Component data: {
  [key: string]: any;
};
*/

// look up by Ids
export async function interface_users_ByIds(runtime: IAgentRuntime, ids: UUID[]): Promise<Record<UUID, any>> {
  //console.log('interface_users_ByIds', ids)
  const entities = await runtime.getEntitiesByIds(ids)
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
  //console.log('components', components)
  return components
}

// who owns what
// chain?

// keyed Object = UUID
export async function getUserIdsByPubkeys(runtime: IAgentRuntime, pubkeys): Promise<Record<string, UUID>> {
  const users = await interface_users_list(runtime)
  const emails = await interface_users_ByIds(runtime, users)

  const accountIds = {}
  const userIds = {} // revmap
  for(const entityId in emails) {
    const email = emails[entityId]
    //console.log('getUserIdsByPubkeys', entityId)
    if (email.verified && email.address) {
      const emailEntityId = createUniqueUuid(runtime, email.address);
      //console.log('verified email.address', email.address, '=>', emailEntityId)
      accountIds[entityId] = emailEntityId
      // FIXME: this can be multiple (discord/telegram linked to one account)
      if (userIds[emailEntityId]) {
        console.log('getUserIdsByPubkeys - stomping', userIds[emailEntityId], 'with', entityId)
      }
      userIds[emailEntityId] = entityId
      //userWallets[entityId] = email.metawallets
    } else {
      console.log('getUserIdsByPubkeys - waiting on verification', entityId, email)
    }
  }

  const accounts = await runtime.getEntitiesByIds(Object.values(accountIds))
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
    //console.log('getUserIdsByPubkeys - ', entityId, 'wallets', email.metawallets)
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

export async function getUseridsByAccountId(runtime: IAgentRuntime, accountIds: UUID[]) {
  const res = await interface_users_listVerified(runtime)
  const out = {}
  for(const acctId of accountIds) {
    const userIds = res.accountId2userIds[acctId]
    out[acctId] = userIds
  }
  return out
}

// list/search
// list of IDs vs list of users?
// it's a list of accounts now right?
export async function interface_users_list(runtime: IAgentRuntime, options = {}): Promise<UUID[]> {
  const spartanData = await interface_spartan_get(runtime)
  //console.log('interface_users_list - got spartanData')
  return spartanData.data.users
}

// really good for accounts
export async function interface_users_listVerified(runtime: IAgentRuntime, options = {}): Promise<{
  userId2accountId: Record<UUID, UUID>, accountId2userIds: Record<UUID, UUID[]>, emails: Record<UUID, unknown>
} | false> {
  if (!runtime) {
    console.trace('WHAT ARE YOU DOING?')
    return false
  }
  // we don't just use interface_users_list because overhead
  const spartanData = await interface_spartan_get(runtime) // get list of userIds
  const emails = await interface_users_ByIds(runtime, spartanData.data.users) // get entities

  const userId2accountId = {}
  const accountId2userIds = {} // revmap
  for(const entityId in emails) {
    const email = emails[entityId]
    //console.log('interface_users_listVerified', entityId)
    if (email.verified && email.address) {
      const emailEntityId = createUniqueUuid(runtime, email.address);
      //console.log('interface_users_listVerified - verified email.address', entityId, email.address, '=>', emailEntityId)
      userId2accountId[entityId] = emailEntityId // each user can only have one account
      // but an account can have multiple users
      if (accountId2userIds[emailEntityId] === undefined) accountId2userIds[emailEntityId] = []
      accountId2userIds[emailEntityId].push(entityId)
      //userWallets[entityId] = email.metawallets
    //} else {
      //console.log('interface_users_listVerified - waiting on verification', entityId, email)
    }
  }
  // NOTE: emails is NOT filtered (verified)
  return { userId2accountId, accountId2userIds, emails }
}

// add/update/delete

export async function interface_user_update(runtime: IAgentRuntime, componentData): Promise<boolean> {
  const id = componentData.componentId
  if (!id) {
    console.warn('interface_user_update - no componentId in componentData', componentData)
    return false
  }
  //const entityId = componentData.accountEntityId
  // need to strip somethings...: componentId, names
  delete componentData.componentId
  delete componentData.names
  delete componentData.entityId
  delete componentData.accountEntityId // utils injects this
  console.log('interface_user_update - componentData', componentData)

  // const res =
  await runtime.updateComponent({
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
