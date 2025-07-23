import type { UUID, IAgentRuntime } from '@elizaos/core';
import { createUniqueUuid } from '@elizaos/core';

import { interface_users_list, interface_users_listVerified } from '../interfaces/int_users'
import { interface_accounts_ByIds } from '../interfaces/int_accounts'

// look up by Ids

// list/search

// return strategy, keypairs[chain] = { privateKey, publicKey }, entityId, names
export async function getMetaWallets(runtime: IAgentRuntime): Promise<any[] | false> {
  if (!runtime) {
    console.trace('WHAT ARE YOU DOING?')
    return false
  }
  //console.log('getMetaWallets')
  //interface_accounts_list is available
  const users = await interface_users_list(runtime)
  //console.log('getMetaWallets - users', users.length)
  const mws = []

  const res = await getWalletByUserEntityIds_engine(runtime, users)
  //console.log('getMetaWallets - res', res)

  // this is really weird, because multiple users to an account and multiple wallets to an account

  // userWallets is weird
  for(const userEntityId in res.userWallets) {
    const userMws = res.userWallets[userEntityId]
    //console.log('getMetaWallets - userEntityId', userEntityId, 'userMws', userMws.length)
    if (userMws) {
      // code/address/verified etc
      const email = res.userEntityData[userEntityId]
      //console.log('getMetaWallets - email.names', email.names)
      for(const mw of userMws) {
        mws.push({...mw, entityId: userEntityId, names: email.names })
      }
    }
  }
  /*
  const emails = await interface_users_ByIds(runtime, users)
  for(const entityId in emails) {
    const email = emails[entityId]
    if (!email) {
      console.warn('getMetaWallets - no component found for', entityId)
      // FIXME: remove from agent users if no component
      continue
    }
    //console.log('getMetaWallets - ', entityId, 'wallets', email.metawallets)
    if (email.metawallets) {
      for(const mw of email.metawallets) {
        mws.push({...mw, entityId, names: email.names })
      }
    } else {
      console.warn('getMetaWallets - user', entityId, 'no metawallets in registration component', email)
    }
  }
  */
  //console.log('getMetaWallets - out', mws)
  return mws
}

export async function getWalletsByPubkey(runtime: IAgentRuntime, pubkeys: string[]): Promise<Record<string, any>> {
  const metaWallets = await getMetaWallets(runtime)
  const list = {}
  for(const mw of metaWallets) {
    if (pubkeys.includes(mw.keypairs.publicKey)) {
      if (list[mw.keypairs.publicKey]) {
        console.log('getWalletsByPubkey stomping key', mw.keypairs.publicKey, 'old value', list[mw.keypairs.publicKey], 'with', mw)
      }
      list[mw.keypairs.publicKey] = mw
    }
  }
  return list
}

// filter by chain or strategy
export async function getSpartanWallets(runtime: IAgentRuntime, options = {}): Promise<any[]> {
  const wallets = []

  const metaWallets = await getMetaWallets(runtime)
  //console.log('getSpartanWallets - metaWallets', metaWallets)
  for(const mw of metaWallets) {
    // keypairs, strategy, positions
    let toAdd = !options.strategy
    if (options.strategy && options.strategy === mw.strategy) {
      //console.log('getSpartanWallets -', mw.entityId, mw.names, 'mw.strategy', mw.strategy)
      toAdd = true
    }
    // are we interested in looking at this metawallet?
    if (toAdd) {
      // for each chain in metawallet
      const addWallets = options.chain ? { [options.chain]: mw.keypairs[options.chain] } : mw.keypairs
      //console.log('getSpartanWallets - adding', addWallets)
      for(const chain in addWallets) {
        const w = addWallets[chain]
        wallets.push({...w, chain })
      }
    }
  }
  //console.log('getSpartanWallets - out', wallets)
  return wallets
}

// list metawallets by userId
export async function getWalletByUserEntityIds_engine(
  runtime: IAgentRuntime, userEntityIds: UUID[]
): Promise<{ userWallets: Record<UUID, any>, accountIds: Record<UUID, UUID>, userEntityData: Record<UUID, any> }> {
  if (!runtime) {
    console.trace('WHAT ARE YOU DOING?')
    return false
  }
  const map = await interface_users_listVerified(runtime)
  const accounts = map.userId2accountId
  const accountIds = map.userId2accountId
  const accountWallets = await getMetaWalletsByEmailEntityIds(runtime, Object.values(accountIds))
  //console.log('getWalletByUserEntityIds_engine - accountWallets', accountWallets)

  // translate it to being keyed by userEntityId
  const userWallets = {}
  for(const userEntityId in accounts) {
    const accountEntityId = accounts[userEntityId]
    const metawallets = accountWallets[accountEntityId]
    //console.log('getWalletByUserEntityIds_engine - userEntityId', userEntityId, '=>', accountEntityId)
    if (metawallets) {
      //console.log('getWalletByUserEntityIds_engine - metawallets', metawallets.length)
      // if found

      // probably should tuck in the accountId into this but it's an array
      userWallets[userEntityId] = metawallets
    }
  }
  // userEntityData is wrong
  return {
    userWallets, accountIds, userEntityData: map.emails
  }
}

export async function getWalletByUserEntityIds(runtime: IAgentRuntime, userEntityIds: UUID[]): Promise<Record<UUID, any>> {
  const res = await getWalletByUserEntityIds_engine(runtime, userEntityIds)
  return res.userWallets
}

// you mean by account?
export async function getMetaWalletsByEmailEntityIds(runtime: IAgentRuntime, emailEntityIds: UUID[]): Promise<Record<UUID, any>> {
  // find these users metawallets
  // each id will have a list of wallets
  const userWallets = {}
  const accounts = await interface_accounts_ByIds(runtime, emailEntityIds)
  for(const entityId in accounts) {
    const account = accounts[entityId]
    //console.log('getMetaWalletsByEmailEntityIds', entityId, 'wallets', account.metawallets)
    //console.log('getMetaWalletsByEmailEntityIds', entityId, 'account', account)
    if (account.metawallets) {
      userWallets[entityId] = account.metawallets
    }
  }
  return userWallets
}


// linking wallets

// add/update/delete

// look up wallet by Ids

// list wallet for metawallet

// add/update/delete wallet
