import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  type ActionExample,
  type UUID,
  createUniqueUuid,
} from '@elizaos/core';
import { takeItPrivate, getDataFromMessage, getAccountFromMessage, HasEntityIdFromMessage, getEntityIdFromMessage } from '../utils'
import CONSTANTS from '../constants'
import { interface_user_update } from '../interfaces/int_users'
import { v4 as uuidv4 } from 'uuid';

function findGeneratedCode(message, length) {
  const pattern = new RegExp(`\\b[A-Za-z0-9]{${length}}\\b`);
  const match = message.match(pattern);
  return match ? match[0] : null;
}

export const checkRegistrationCode: Action = {
  name: 'VERIFY_REGISTRATION_CODE',
  similes: [
  ],
  description: 'Replies, allows a user set their email address' + CONSTANTS.DESCONLYCALLME,
  // can only enter this if we don't have an email
  validate: async (runtime: IAgentRuntime, message: Memory) => {


    // list checks in least cost to most cost
    const containsGeneratedCode = findGeneratedCode(message.content.text, CONSTANTS.useCodeLength)
    if (containsGeneratedCode !== null) {
      runtime.logger.log('VERIFY_REGISTRATION_CODE containsGeneratedCode', typeof(containsGeneratedCode), containsGeneratedCode)
    } else {
      // kinda normal
      //console.log('VERIFY_REGISTRATION_CODE validate - code not found', message.content.text, CONSTANTS.useCodeLength)
      return false
    }

    //console.log('VERIFY_REGISTRATION_CODE validate')
    if (!await HasEntityIdFromMessage(runtime, message)) {
      console.warn('VERIFY_REGISTRATION_CODE validate - author not found')
      return false
    }

    const hasEmail = await getDataFromMessage(runtime, message)
    if (!hasEmail) {
      console.warn('VERIFY_REGISTRATION_CODE validate - email not found')
      return false // if no email provided yet
    }

    const account = await getAccountFromMessage(runtime, message)
    if (account) {
      //console.warn('VERIFY_REGISTRATION_CODE validate - has account')
      return false // if already confirmed, bail
    }

    return true // can only check what's set and not verified
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback: HandlerCallback,
    responses: any[]
  ): Promise<boolean> => {
    console.log('VERIFY_REGISTRATION_CODE handler')

    // get room and it's components?
    const roomDetails = await runtime.getRoom(message.roomId);

    //const entityId = createUniqueUuid(runtime, message.metadata.fromId);

    const passedCode = findGeneratedCode(message.content.text, CONSTANTS.useCodeLength)
    if (passedCode === null) {
      console.log('shouldnt be here no code found of', CONSTANTS.useCodeLength, 'length in', message.content.text)
      return
    }
    const componentData = await getDataFromMessage(runtime, message)
    console.log('user component', componentData)
    if (!componentData) {
      console.log('shouldnt be here')
      return
    }
    if (componentData.verified) {
      console.log('already registered')
      return
    }

    const agentEntityId = createUniqueUuid(runtime, runtime.agentId);
    const agentEntity = await runtime.getEntityById(agentEntityId);
    //console.log('agentEntity', agentEntity)
    let spartanData = agentEntity.components.find(c => c.type === CONSTANTS.SPARTAN_SERVICE_TYPE)
    let spartanDataNew
    if (!spartanData) {
      // initialize
      spartanDataNew = true
      spartanData = {
        data: {
          users: [],
          accounts: [],
        }
      }
    }
    if (spartanData.data.accounts === undefined) spartanData.data.accounts = []

    /*
    const entity = await runtime.getEntityById(message.entityId)
    console.log('VERIFY_REGISTRATION_CODE entity', entity)
    const email = entity.components.find(c => c.type === CONSTANTS.COMPONENT_USER_TYPE)
    if (!email) {
      console.log('shouldnt be here')
      return
    }
    */
    console.log('VERIFY_REGISTRATION_CODE email', componentData, 'code', passedCode)
    if (componentData.tries === undefined) componentData.tries = 0
    //responses.length = 0 // just clear them all
    let output: Memory | boolean = false
    if (componentData.tries > 3) {
      console.log('hacker...')
      output = takeItPrivate(runtime, message, 'You can no longer validate, you must delete your registration and restart')
      callback(output)
      return
    }
    if (passedCode === componentData.code) {
      // verify account
      componentData.verified = true
      const emailAddr = componentData.address
      const emailEntityId = createUniqueUuid(runtime, emailAddr);
      const userEntityId = await getEntityIdFromMessage(runtime, message)
      console.log('user', userEntityId, 'account', emailEntityId)
      const accountEntity = await runtime.getEntityById(emailEntityId);
      //const isLinking = spartanData.data.users.includes(emailEntityId)
      if (accountEntity) {
        output = takeItPrivate(runtime, message, 'Looks good, I see your already registered before, linking to existing account')

        // self healing
        if (spartanData.data.accounts.indexOf(emailEntityId) === -1) {
          console.log('warning spartanData didnt have accountId', emailEntityId)
          spartanData.data.accounts.push(emailEntityId)
        }

      } else {
        output = takeItPrivate(runtime, message, 'Looks good, you are now registered and have access to my services')

        // need account entity too
        const entitySuccess = await runtime.createEntity({
          id: emailEntityId,
          names: [],
          metadata: {},
          agentId: runtime.agentId,
        });

        // attach to entity.id to components.entityId field
        await runtime.createComponent({
          id: uuidv4() as UUID,
          agentId: runtime.agentId,
          worldId: roomDetails.worldId,
          roomId: message.roomId,
          sourceEntityId: message.entityId,
          entityId: emailEntityId,
          type: CONSTANTS.COMPONENT_ACCOUNT_TYPE,
          data: {
            metawallets: [],
          },
        });
        // not sure how we'd already have accounts, but lets keep it clean
        if (spartanData.data.accounts.indexOf(emailEntityId) === -1) {
          spartanData.data.accounts.push(emailEntityId)
        } else {
          console.log('duplicate accountId in spartanData', emailEntityId)
        }
      }
      if (spartanData.data.users.indexOf(userEntityId) === -1) {
        spartanData.data.users.push(userEntityId)
      } else {
        console.log('duplicate userEntityId in spartanData', userEntityId)
      }
      updateSpartanData(agentEntityId, spartanData)
    } else {
      // fail
      // increase tries
      componentData.tries++
      console.log('got', passedCode, 'expected', componentData.code)
      output = takeItPrivate(runtime, message, 'That does not match my records, please double check, it is case sensitive')
    }
    callback(output)

    // is verified saving?
    console.log('saving', componentData)
    // seems to delete the component
    await interface_user_update(runtime, componentData)

    /*
    const id = componentData.componentId
    // need to strip somethings...: componentId, names
    delete componentData.componentId
    delete componentData.names
    await runtime.updateComponent({
      id,
      //worldId: roomDetails.worldId,
      //roomId: message.roomId,
      //sourceEntityId: message.entityId,
      //entityId: ,
      type: CONSTANTS.COMPONENT_USER_TYPE,
      data: componentData,
      agentId: runtime.agentId,
    });
    */

    // update spartanData
    async function updateSpartanData(agentEntityId, spartanData) {
      if (spartanDataNew) {
        // initial spartan set up
        await runtime.createComponent({
          id: uuidv4() as UUID,
          agentId: runtime.agentId,
          worldId: roomDetails.worldId,
          roomId: message.roomId,
          sourceEntityId: message.entityId,
          entityId: agentEntityId,
          type: CONSTANTS.SPARTAN_SERVICE_TYPE,
          data: spartanData.data,
        });
      } else {
        // 2nd+ sups
        await runtime.updateComponent({
          id: spartanData.id,
          // do we need all these fields?
          //agentId: runtime.agentId,
          //worldId: roomDetails.worldId,
          //roomId: message.roomId,
          //sourceEntityId: entityId,
          //entityId: entityId,
          //type: CONSTANTS.SPARTAN_SERVICE_TYPE,
          data: spartanData.data,
        });
      }
    }
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'This is my code you sent CODE',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll check it to see if it's correct",
          actions: ['VERIFY_REGISTRATION_CODE'],
          options: {
            code: 'CODE',
          },
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'The code you sent me is CODE',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll check it to see if it's correct",
          actions: ['VERIFY_REGISTRATION_CODE'],
          options: {
            code: 'CODE',
          },
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'CODE is the code I got',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll check it to see if it's correct",
          actions: ['VERIFY_REGISTRATION_CODE'],
          options: {
            code: 'CODE',
          },
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'CODE is my code',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll check it to see if it's correct",
          actions: ['VERIFY_REGISTRATION_CODE'],
          options: {
            code: 'CODE',
          },
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'I got code CODE',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll check it to see if it's correct",
          actions: ['VERIFY_REGISTRATION_CODE'],
          options: {
            code: 'CODE',
          },
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'what was the code you emailed me?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'I\'m not going to tell you',
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'CODE',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll check it to see if it's correct",
          actions: ['VERIFY_REGISTRATION_CODE'],
        },
      },
    ],
  ] as ActionExample[][],
}