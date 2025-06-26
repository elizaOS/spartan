import type { Plugin } from '@elizaos/core';
import { COMPONENT_ACCOUNT_TYPE } from '../constants'
import { interface_users_ByIds  } from './int_users'
import { interface_accounts_ByIds, interface_account_update } from './int_accounts'
import { getMetaWallets } from './int_wallets'

// look up by Ids
export async function interface_positions_ByUserIdPosIds(runtime, userId, positionIds) {

  // one db read
  const emails = await interface_users_ByIds(runtime, [userId])
  const email = emails[userId]
  if (!email) {
    return false
  }

  // find pos
  let list = {}
  for(const mw of email.metawallets) {
    for(const kp of tmw.keypairs) {
      if (kp.positions) {
        for(const posId in positionIds) {
          const pos = kp.positions.find(p => p.id === posId)
          if (pos) {
            list[posId] = { mw, pos, }
          }
        }
      }
    }
  }
  return { email, list }
}

// used by updatePosition
export async function interface_positions_ByAccountIdPosIds(runtime, accountId, positionIds) {

  // one db read
  const account = await runtime.getEntityById(accountId)
  //const accounts = await interface_accounts_ByIds(runtime, [accountId])
  //const account = accounts[accountId]
  if (!account) {
    return false
  }
  console.log('interface_positions_ByAccountIdPosIds account', account)
  const component = account.components.find(c => c.type === COMPONENT_ACCOUNT_TYPE)

  // find pos in metaWallets (no more db calls)
  let list = {}
  for(const mw of component.data.metawallets) {
    for(const chain in mw.keypairs) {
      const kp = mw.keypairs[chain]
      if (kp.positions) {
        for(const posId in positionIds) {
          const pos = kp.positions.find(p => p.id === posId)
          if (pos) {
            list[posId] = { mw, pos, }
          }
        }
      }
    }
  }
  return { account, component, list }
}

// does these positions exist?

// list
// open position filter? chain filter?
export async function listPositions(runtime, options = {}) {
  //const userIds = awiat interface_users_list(runtime)
  //const emails = await interface_users_ByIds(runtime, users)
  console.log('listPositions - options', options)
  const metaWallets = await getMetaWallets(runtime)
  console.log('listPositions - metaWallets', metaWallets)
  const positions = []
  for(const mw of metaWallets) {
    console.log('mw', mw)
    if (mw.keypairs.solana.positions?.length) {
      console.log('solana positions', mw.keypairs.solana.positions)
      // filter open positions?
      for(const p of mw.keypairs.solana.positions) {
        positions.push({ position: p, entityId: mw.entityId, mw })
      }
    }
  }
  return positions
}

// add/update/delete
// createPositions?
export async function createPosition(runtime, accountId, pos) {
  //console.log('createPosition - userId', userId, 'pos', pos)
  //console.log('createPosition - chain', pos.chain, pos.publicKey)

  const accounts = await interface_accounts_ByIds([accountid])
  const account = accounts[accountid]

  // because we need to save, it's missing the
  //const mws = await getWalletsByPubkey(runtime, [pos.publicKey])
  //const mw = mws[pos.publicKey]

  //console.log('createPosition - account', account)
  // get component data
  // find specific wallet
  const mw = account.metawallets.find(mw => mw.keypairs[pos.chain]?.publicKey === pos.publicKey)
  //console.log('createPosition - mw', mw)
  // maybe inside the solana object is better
  /*
  if (mw.positions === undefined) mw.positions = []

  const hasPos = mw.positions.find(p => p.chain === pos.chain && p.token === pos.token)
  if (hasPos) {
    console.log(pos, userId, 'already has - write me!')
    return false
  }

  mw.positions.push(pos)
  */
  const wallet = mw.keypairs[pos.chain]
  if (wallet.positions === undefined) wallet.positions = []

  const hasPos = wallet.positions.find(p => p.chain === pos.chain && p.token === pos.token)
  if (hasPos) {
    console.log(pos, userId, 'already has - write me!')
    return false
  }
  wallet.positions.push(pos)
  await interface_account_update(runtime, account)
  /*
  await runtime.updateComponent({
    id: email.componentId,
    //worldId: roomDetails.worldId,
    //roomId: message.roomId,
    //sourceEntityId: message.entityId,
    entityId: userId,
    type: COMPONENT_ACCOUNT_TYPE,
    data: email,
    agentId: runtime.agentId,
  });
  */
  console.log('created position', account)
  return true
}

export async function updatePosition(runtime, accountId, posId, delta) {
  // userId, publicKey, positionId
  //const mw = email.metawallets.find(mw => mw.keypairs[pos.chain]?.positions.find(p => p.id === posId))

  const res = await interface_positions_ByAccountIdPosIds(runtime, accountId, [posId])
  //const res = interface_positions_ByUserIdPosIds(runtime, userId, [posId])
  if (!res) {
    console.warn('updatePosition - cant find account', accountId)
    return false
  }
  if (!res.list.length) {
    console.warn('updatePosition - cant find position', posId)
    return false
  }
  //const account = res.account
  const componentData = res.component
  const posRes = res.list[posId]
  const mw = posRes.mw
  const pos = posRes.pos
  const wallet = mw.keypairs[pos.chain]
  if (wallet.positions === undefined) wallet.positions = []
  // another fucking search!! but localized to a single user
  const idx = wallet.positions.indexOf(pos)
  if (idx === -1) {
    console.warn('updatePosition - cant find pos', pos, 'in', wallet.positions)
    return false
  }
  // integrate changed data
  wallet.positions[idx] = {...wallet.positions[idx], delta }

  // is this right?
  console.log('mw', mw)
  console.log('componentData', componentData)
  await interface_account_update(runtime, componentData)
  /*
  await runtime.updateComponent({
    id: email.componentId,
    //worldId: roomDetails.worldId,
    //roomId: message.roomId,
    //sourceEntityId: message.entityId,
    entityId: userId,
    type: COMPONENT_ACCOUNT_TYPE,
    data: email,
    agentId: runtime.agentId,
  });
  */
  console.log('closed position', account)
  return true
}