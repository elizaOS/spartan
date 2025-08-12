import type { UUID, IAgentRuntime } from '@elizaos/core';
import { createUniqueUuid } from '@elizaos/core';
import { acquireService } from '../../autonomous-trader/utils'

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
  const intUserService = await acquireService(runtime, 'AUTONOMOUS_TRADER_INTERFACE_USERS', 'wallet interface')
  //console.log('Have intUserService')

  // shouldn't this be verified list?
  // getWalletByUserEntityIds_engine doesn't the verification call, it calls interface_users_listVerified infact
  const users = await intUserService.interface_users_list()
  //const map = await intUserService.interface_users_listVerified()
  //const users = map.
  console.log('getMetaWallets - users', users.length)
  const mws = []

  const res = await getWalletByUserEntityIds_engine(runtime, users)
  //console.log('getMetaWallets - res', res)

  // a list of accounts
  // accountIds Object.values(res.accountIds)
  // accountIds Object.keys(res.accountWallets)

  // there can be two users with the same account/wallet
  // accountId is the only unique id for MWs
  for(const accountId in res.accountWallets) {
    const accountMws = res.accountWallets[accountId]
    // ok what user is this?
    const userIds = res.accountId2userIds[accountId]
    //console.log(accountId, userIds, 'have', accountMws)
    const names = []
    for(const userEntityId of userIds) {
      const email = res.userEntityData[userEntityId]
      for(const n of email.names) {
        if (names.indexOf(n) === -1) {
          names.push(n)
        }
      }
    }
    for(const amw of accountMws) {
      mws.push({...amw, entitiesId: userIds, names })
    }
  }

  // this is really weird, because multiple users to an account and multiple wallets to an account
  /*
  // userWallets is weird
  for(const userEntityId in res.userWallets) {
    // no way to get accountID from res.userWallets
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
  */

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

// I don't think anything is using this
// deactivating because it looks unfinished
/*
export async function getWalletsByPubkey(runtime: IAgentRuntime, pubkeys: string[]): Promise<Record<string, any>> {
  const metaWallets = await getMetaWallets(runtime)
  const list = {}
  for(const mw of metaWallets) {
    // mw.keypairs.publicKey
    // WHAT? where's the chain
    console.log('getWalletsByPubkey', mw.keypairs.publicKey) // guessing this is always undefined
    if (pubkeys.includes(mw.keypairs.publicKey)) {
      if (list[mw.keypairs.publicKey]) {
        console.log('getWalletsByPubkey stomping key', mw.keypairs.publicKey, 'old value', list[mw.keypairs.publicKey], 'with', mw)
      }
      list[mw.keypairs.publicKey] = mw
    }
  }
  return list
}
*/

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
  //console.log('getting users')
  const intUserService = runtime.getService('AUTONOMOUS_TRADER_INTERFACE_USERS') as any;
  //console.log('Got users')
  const map = await intUserService.interface_users_listVerified()
  //console.log('Got verified list', map)
  // maybe rename to userId2accountId
  const accounts = map.userId2accountId
  const accountIds = map.userId2accountId // don't Object.value here for return
  //console.log('accountIds', accountIds)
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
    userWallets, accountIds, userEntityData: map.emails, accountWallets, accountId2userIds: map.accountId2userIds,
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
  const intAccountService = await acquireService(runtime, 'AUTONOMOUS_TRADER_INTERFACE_ACCOUNTS', 'wallet interface')
  //console.log('have accounts', emailEntityIds)
  const accounts = await intAccountService.interface_accounts_ByIds(emailEntityIds)
  //console.log('got interface_accounts_ByIds - accounts', accounts)
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
