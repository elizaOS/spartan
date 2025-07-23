import {
  type IAgentRuntime,
  type Entity,
  //type Component,
  createUniqueUuid,
} from '@elizaos/core';

import CONSTANTS from '../../autonomous-trader/constants'

// get by id
export async function interface_spartan_get(runtime: IAgentRuntime): Promise<any> {
  const agentEntityId = createUniqueUuid(runtime, runtime.agentId);
  const agentEntity = await runtime.getEntityById(agentEntityId) as Entity;
  //console.log('agentEntity', agentEntity)
  let spartanData = agentEntity.components.find(c => c.type === CONSTANTS.SPARTAN_SERVICE_TYPE)
  //let spartanDataNew = false
  //let spartanDataDelta = false
  if (!spartanData) {
    // initialize
    //spartanDataNew = true
    // id, entityId, agentId, roomId
    spartanData = {
      data: {
        users: [],
        accounts: [],
      }
    }
  }
  return spartanData
}

// list/search N/A

// create/update