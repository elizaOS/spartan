import {
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { HasEntityIdFromMessage, getAccountFromMessage, takeItPrivate, walletContainsMinimum } from '../utils'

// handle starting new form and collecting first field
// maybe combine with setstrategy, so the mode can help steer outcome
export const actHolderQuery: Action = {
  name: 'HOLDER_QUERY',
  similes: [
  ],
  // 10k ai16z?
  description: 'Replies, and answers if we know if they\'re a verified holder or not',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    //console.log('HOLDER_QUERY validate')

    // they have to be registered
    if (!await HasEntityIdFromMessage(runtime, message)) {
      //console.log('HOLDER_QUERY validate - author not found')
      return false
    }

    const account = await getAccountFromMessage(runtime, message)
    if (!account) {
      //console.log('HOLDER_QUERY validate - account not found')
      return false;
    }

    return true
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback,
    responses: any[]
  ): Promise<boolean> => {
    console.log('HOLDER_QUERY handler')
    //console.log('message', message)

    const solanaService = runtime.getService('chain_solana') as any;

    const componentData = await getAccountFromMessage(runtime, message)
    //console.log('componentData', componentData)
    if (!componentData) {
      callback(takeItPrivate(runtime, message, `Could not read your account`))
      return
    }

    let isVerified = !!componentData.holderCheck
    if (isVerified) {
      // double check?
      const pubKey = componentData.holderCheck
      const isHoplite = (await walletContainsMinimum(runtime, pubKey, 'Gu3LDkn7Vx3bmCzLafYNKcDxv2mH7YN44NJZFXnypump', 1_000_000))
      if (isHoplite) {
        callback(takeItPrivate(runtime, message, `You currently hold a valid balance of $degenai`))
        return
      }
      const isPartner = (await walletContainsMinimum(runtime, pubKey, 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC',    10_000))
      if (isPartner) {
        callback(takeItPrivate(runtime, message, `You currently hold a valid balance of $ai16z`))
        return
      }
    }
    callback(takeItPrivate(runtime, message, `You do not currently hold a valid balance of $degenai or $ai16z`))
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'am I a verified holder?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll check",
          actions: ['HOLDER_QUERY'],
        },
      },
    ],
  ] as ActionExample[][],
}