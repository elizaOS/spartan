import {
  type IAgentRuntime,
  ModelType,
  logger,
  parseJSONObjectFromText,
  createUniqueUuid,
} from '@elizaos/core';

import CONSTANTS from '../constants'
import { interface_spartan_get } from './int_spartan'

// look up by Ids
export async function interface_users_ByIds(runtime, ids) {
  const entities = await runtime.getEntityByIds(ids)
  //console.log('entities', entities)
  const components = []
  for(const i in entities) {
    const entity = entities[i]
    if (entity) {
      const email = entity.components.find(c => c.type === CONSTANTS.EMAIL_TYPE)
      if (email) {
        components.push({...email.data, entityId: entity.id, names: entity.names })
      } else {
        console.warn('user', entity.id, 'no registration component?', entity)
        // FIXME: remove from agent users....
      }
    } else {
      console.warn('user', ids[i], 'has no entity, skipping')
    }
  }
  return components
}

// list/search
// list of IDs vs list of users?
export async function interface_users_list(runtime, options = {}) {
  const spartanData = await interface_spartan_get(runtime)
  return spartanData.data.users
}

// add/update/delete
