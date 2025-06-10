import type { Plugin } from '@elizaos/core';

import { interface_users_ByIds, interface_users_list } from '../interfaces/int_users'

// look up by Ids

// list/search
export async function getSpartanWallets(runtime, options = {}) {
  const wallets = []

  //console.log('spartanData', spartanData.data.users)
  const users = await interface_users_list(runtime)
  //console.log('users', users)
  const emails = await interface_users_ByIds(runtime, users)
  console.log('emails', emails)

  for(const email of emails) {
    console.log(email.entityId, 'wallets', email.metawallets)
    if (email.metawallets) {
      for(const mw of email.metawallets) {
        // keypairs, strategy
        let toAdd = !options.strategy
        if (options.strategy && options.strategy === mw.strategy) {
          console.log(email.entityId, email.names, 'mw.strategy', mw.strategy)
          toAdd = true
        }
        // are we interested in looking at this metawallet?
        if (toAdd) {
          // for each chain in metawallet
          const addWallets = options.chain ? { [options.chain]: mw.keypairs[options.chain] } : mw.keypairs
          for(const chain in addWallets) {
            const w = addWallets[chain]
            wallets.push({...w, chain })
          }
        }
      }
    } else {
      console.warn('user', email.id, 'no metawallets in registration component', email)
    }
  }
  return wallets
}

// list metawallets by userId

export async function getWalletByUserEntityIds(runtime, userEntityIds: UUID[]) {
  // find these users metawallets
  // each id will have a list of wallets
  const userWallets = {}
  const emails = await interface_users_ByIds(runtime, userEntityIds)
  for(const email of emails) {
    console.log(email.entityId, 'wallets', email.metawallets)
    if (email.metawallets) {
      userWallets[email.entityId] = email.metawallets
    }
  }
  return userWallets
}

// add/update/delete

// look up wallet by Ids

// list wallet for metawallet

// add/update/delete wallet
