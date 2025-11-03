import {
  type IAgentRuntime,
  type Entity,
  type Component,
  createUniqueUuid,
} from '@elizaos/core';

import CONSTANTS from '../../autonomous-trader/constants'

// get by id
export async function interface_spartan_get(runtime: IAgentRuntime): Promise<Component | null> {
  const agentEntityId = createUniqueUuid(runtime, runtime.agentId);
  const agentEntity = await runtime.getEntityById(agentEntityId) as Entity;
  //console.log('agentEntity', agentEntity)

  // Check if components exist and find spartan data
  let spartanData = agentEntity.components?.find(c => c.type === CONSTANTS.SPARTAN_SERVICE_TYPE);

  if (!spartanData) {
    // Initialize with proper Component structure
    const currentTime = Date.now();
    spartanData = {
      id: createUniqueUuid(runtime, 'spartan-component'),
      entityId: agentEntityId,
      agentId: runtime.agentId,
      roomId: createUniqueUuid(runtime, 'default-room'),
      worldId: createUniqueUuid(runtime, 'default-world'),
      sourceEntityId: agentEntityId,
      type: CONSTANTS.SPARTAN_SERVICE_TYPE,
      createdAt: currentTime,
      data: {
        users: [],
        accounts: [],
      }
    };
  }

  return spartanData;
}

// list/search N/A

// create/update