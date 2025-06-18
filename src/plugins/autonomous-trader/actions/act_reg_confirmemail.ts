import {
  type IAgentRuntime,
  type Memory,
  type State,
  type ActionExample,
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { takeItPrivate } from '../utils'
import { EMAIL_TYPE } from '../constants'

function findGeneratedCode(message, length) {
  const pattern = new RegExp(`\\b[A-Za-z0-9]{${length}}\\b`);
  const match = message.match(pattern);
  return match ? match[0] : null;
}

export const checkRegistrationCode: Action = {
  name: 'VERIFY_REGISTRATION_CODE',
  similes: [
  ],
  // can only enter this if we don't have an email
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    //console.log('VERIFY_REGISTRATION_CODE validate')

    // if not a discord/telegram message, we can ignore it
    if (!message.metadata.fromId) return false

    // using the service to get this/components might be good way
    //const entityId = createUniqueUuid(runtime, message.metadata.fromId);
    const entity = await runtime.getEntityById(message.entityId)
    if (!entity) {
      logger.warn('VERIFY_REGISTRATION_CODE client did not set entity')
      return false;
    }
    const email = entity.components.find(c => c.type === EMAIL_TYPE)
    const containsGeneratedCode = findGeneratedCode(message.content.text, 16)
    if (containsGeneratedCode !== null) {
      runtime.logger.log('VERIFY_REGISTRATION_CODE containsGeneratedCode', typeof(containsGeneratedCode), containsGeneratedCode)
    }
    return email && containsGeneratedCode !== null && !email.data?.verified // can only check what's set and not verified
  },
  description: 'Replies, allows a user set their email address',
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback,
    responses: any[]
  ): Promise<boolean> => {
    console.log('VERIFY_REGISTRATION_CODE handler')

    // get room and it's components?
    const roomDetails = await runtime.getRoom(message.roomId);

    //const entityId = createUniqueUuid(runtime, message.metadata.fromId);
    const entity = await runtime.getEntityById(message.entityId)
    console.log('VERIFY_REGISTRATION_CODE entity', entity)
    const email = entity.components.find(c => c.type === EMAIL_TYPE)
    if (!email) {
      console.log('shouldnt be here')
      return
    }
    const passedCode = findGeneratedCode(message.content.text, 16)
    if (passedCode === null) {
      console.log('shouldnt be here')
      return
    }
    console.log('VERIFY_REGISTRATION_CODE email', email, 'code', passedCode)
    if (email.data.tries === undefined) email.data.tries = 0
    responses.length = 0 // just clear them all
    if (email.data.tries > 3) {
      console.log('hacker...')
      takeItPrivate(runtime, message, 'You can no longer validate, you must delete your registration and restart', responses)
      return
    }
    if (passedCode === email.data.code) {
      // verify account
      email.data.verified = true
      takeItPrivate(runtime, message, 'Looks good, you are now registered and have access to my services', responses)
    } else {
      // fail
      // increase tries
      email.data.tries++
      takeItPrivate(runtime, message, 'That does not match my records, please double check, it is case sensitive', responses)
    }
    await runtime.updateComponent({
      id: email.id,
      worldId: roomDetails.worldId,
      roomId: message.roomId,
      sourceEntityId: message.entityId,
      entityId: message.entityId,
      type: EMAIL_TYPE,
      data: email.data,
      agentId: runtime.agentId,
    });
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

  ] as ActionExample[][],
}