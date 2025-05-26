import {
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { takeItPrivate } from '../utils'
import { EMAIL_TYPE, SPARTAN_SERVICE_TYPE } from '../constants'

// hack for data to fix data issues
export const devFix: Action = {
  name: 'DEV_FIX',
  similes: [
  ],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    return true
  },
  description: 'Allows developer to fix their shit',
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback,
    responses: any[]
  ): Promise<boolean> => {
    console.log('DEV_FIX handler')
    //console.log('message', message)

    // ok we need to change a state on this author

    // get room and it's components?
    const roomDetails = await runtime.getRoom(message.roomId);
    // doesn't have components
    //console.log('roomDetails', roomDetails)
    const roomEntity = await runtime.getEntityById(message.roomId)
    //console.log('roomEntity', roomEntity)

    const agentEntityId = createUniqueUuid(runtime, runtime.agentId);
    const agentEntity = await runtime.getEntityById(agentEntityId);
    //console.log('agentEntity', agentEntity)
    let spartanData = agentEntity.components.find(c => c.type === SPARTAN_SERVICE_TYPE)
    console.log('spartanData', spartanData)
    let spartanDataNew = false
    let spartanDataDelta = false
    if (!spartanData) {
      // initialize
      spartanDataNew = true
      spartanDataDelta = true
      spartanData = {
        users: [],
      }
    }


    // using the service to get this/components might be good way
    const entityId = createUniqueUuid(runtime, message.metadata.authorId);
    /*
    const entity = await runtime.getEntityById(entityId)
    console.log('entity', entity)
    const email = entity.components.find(c => c.type === EMAIL_TYPE)
    console.log('email', email)
    */


    console.log('would have responded', responses)
    return

    // update spartanData
    async function updateSpartanData(agentEntityId, spartanData) {
      if (spartanDataNew) {
        await runtime.createComponent({
          id: uuidv4() as UUID,
          agentId: runtime.agentId,
          worldId: roomDetails.worldId,
          roomId: message.roomId,
          sourceEntityId: entityId,
          entityId: agentEntityId,
          type: SPARTAN_SERVICE_TYPE,
          data: spartanData,
        });
      } else {
        await runtime.updateComponent({
          id: spartanData.id,
          // do we need all these fields?
          //agentId: runtime.agentId,
          //worldId: roomDetails.worldId,
          //roomId: message.roomId,
          //sourceEntityId: entityId,
          //entityId: entityId,
          //type: SPARTAN_SERVICE_TYPE,
          data: agentEntity.components,
        });
      }
    }
    // if we need to update it
    if (spartanDataDelta) {
      updateSpartanData(agentEntityId, spartanData)
    }

    takeItPrivate(runtime, message, 'What you want me to fix boss')
    responses.length = 0 // just clear them all
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'please run dev fix',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll fix your data",
          actions: ['DEV_FIX'],
        },
      },
    ],
  ] as ActionExample[][],
}