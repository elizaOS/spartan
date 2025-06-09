import {
  type IAgentRuntime,
  ModelType,
  logger,
  parseJSONObjectFromText,
  createUniqueUuid,
} from '@elizaos/core';

import CONSTANTS from '../constants'

// get by id
export async function interface_spartan_get(runtime) {
  const agentEntityId = createUniqueUuid(runtime, runtime.agentId);
  const agentEntity = await runtime.getEntityById(agentEntityId);
  //console.log('agentEntity', agentEntity)
  let spartanData = agentEntity.components.find(c => c.type === CONSTANTS.SPARTAN_SERVICE_TYPE)
  //let spartanDataNew = false
  //let spartanDataDelta = false
  if (!spartanData) {
    // initialize
    //spartanDataNew = true
    spartanData.data = {
      users: [],
    }
  }
  return spartanData
}


// list/search N/A

// create/update