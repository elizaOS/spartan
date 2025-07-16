import {
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { HasEntityIdFromMessage, getAccountFromMessage, getEntityIdFromMessage, takeItPrivate, generateRandomString, accountMockComponent, walletContainsMinimum } from '../utils'
import { interface_account_update } from '../interfaces/int_accounts'

function extractBase64Strings(input) {
    const base64Regex = /(?:[A-Za-z0-9+/]{4}){4,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g;
    const candidates = input.match(base64Regex) || [];

    return candidates.filter(str => {
        // Must contain at least one non-base58 character (like +, /, or =)
        if (!/[+/=]/.test(str)) return false;

        try {
            const decoded = Buffer.from(str, 'base64');
            const reEncoded = decoded.toString('base64').replace(/=+$/, '');
            return reEncoded === str.replace(/=+$/, '');
        } catch {
            return false;
        }
    });
}

// handle starting new form and collecting first field
// maybe combine with setstrategy, so the mode can help steer outcome
export const verifyHolder: Action = {
  name: 'VERIFY_SPARTAN_HOLDER',
  similes: [
  ],
  // 10k ai16z?
  description: 'Replies, and verifies wallet holds 1m $degenai tokens (hoplite)',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    //console.log('VERIFY_SPARTAN_HOLDER validate')
/*
sve:validate message {
  id: "1e574bcc-7d3d-04de-bb2e-a58ec153832f",
  entityId: "36ab9481-0939-0d2e-be06-f2ba5bf3a917",
  agentId: "479233fd-b0e7-0f50-9d88-d4c9ea5b0de0",
  roomId: "c8936fc3-f950-0a59-8b19-a2bd342c0cb8",
  content: {
    text: "x@y.cc",
    attachments: [],
    source: "discord",
    url: "https://discord.com/channels/@me/1366955975667482685/1372702486644916354",
    inReplyTo: undefined,
  },
  metadata: {
    entityName: "Odilitime",
    fromId: "580487826420793364",
  },
  createdAt: 1747348176395,
  embedding: [],
  callback: [AsyncFunction: callback],
  onComplete: undefined,
}
*/
    //console.log('sve:validate message', message)

    // they have to be registered
    if (!await HasEntityIdFromMessage(runtime, message)) {
      //console.log('VERIFY_SPARTAN_HOLDER validate - author not found')
      return false
    }

    const account = await getAccountFromMessage(runtime, message)
    if (!account) {
      //console.log('VERIFY_SPARTAN_HOLDER validate - account not found')
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
    console.log('VERIFY_SPARTAN_HOLDER handler')
    //console.log('message', message)

    const solanaService = runtime.getService('chain_solana') as any;

    // check state

    // task
    // room
    // component
    // memory?

    const userId = await getEntityIdFromMessage(runtime, message)
    const cacheKey = userId + '_verify_holder'

    async function generateNonce(pubkey) {
      // generate nonce
      const nonce = generateRandomString(32)

      const nonceSetup = {
        createdAt: Date.now(),
        pubkey: pubkey,
        nonce,
        retriesLeft: 3,
      }
      // save nonce
      await runtime.setCache<unknown>(cacheKey, nonceSetup);
      return nonceSetup
    }

    let nonceSetup = await runtime.getCache<unknown>(cacheKey);
    console.log('nonceSetup', nonceSetup)
    if (nonceSetup?.createdAt) {
      const diff = Date.now() - nonceSetup?.createdAt
      // 2 day expiration
      if (diff > 2 * 86400 * 1_000) {
        await runtime.deleteCache<unknown>(cacheKey);
        nonceSetup = false
      }
    }
    console.log('nonceSetup post expCheck', nonceSetup)

    if (nonceSetup) {
      const b64s = extractBase64Strings(message.content.text)
      console.log('b64s', b64s)

      if (b64s.length) {
        const sig = b64s[0]
        console.log('sig', sig)
        // get nonce / pubkey
        let isValid = false
        // what is a valid signature size?
        try {
          isValid = solanaService.verifySolanaSignature({
            message: nonceSetup.nonce,
            signatureBase64: sig,
            publicKeyBase58: nonceSetup.pubkey
          });
        } catch(e) {
          // usually bad sig size
          console.error('err', e)
          isValid = false
        }

        // retries?
        let retries = parseInt(nonceSetup.retriesLeft)
        if (isNaN(retries)) retries = 3 // reset it
        console.log('retries left', retries)
        await runtime.setCache<unknown>(cacheKey, {...nonceSetup, retriesLeft: retries - 1 });

        if (isValid) {
          // save it
          callback(takeItPrivate(runtime, message, `Sure dude`))
          const componentData = await getAccountFromMessage(runtime, message)
          componentData.holderCheck = nonceSetup.pubkey
          console.log('componentData', componentData)
          const component = accountMockComponent(componentData)
          await interface_account_update(runtime, component)
        } else {
          callback(takeItPrivate(runtime, message, `No way`))
        }
        return
      }
      // nonce set up
      if (nonceSetup.retriesLeft < 1) {
        await runtime.deleteCache<unknown>(cacheKey);
        callback(takeItPrivate(runtime, message, `I sense frustration, lets start over, what pubkey do you want to verify your degenai with?`))
      } else {
        callback(takeItPrivate(runtime, message, `You already gave ${nonceSetup.pubkey}, just waiting for you to sign ${nonceSetup.nonce}`))
      }
      return
    }

    const pubkeys = solanaService.detectPubkeysFromString(message.content.text, true)
    console.log('detected pubkeys', pubkeys)
    if (pubkeys.length) {
      const pubKey = pubkeys[0]
      // validate wallet (RPC calls)
      const meetsRequirement = (await walletContainsMinimum(runtime, pubKey, 'Gu3LDkn7Vx3bmCzLafYNKcDxv2mH7YN44NJZFXnypump', 1_000_000)) ||
                               (await walletContainsMinimum(runtime, pubKey, 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC',    10_000))
      if (meetsRequirement) {
        // generate nonce
        nonceSetup = await generateNonce(pubKey)

        // creating a task might be safer than messing with entity/components
        callback(takeItPrivate(runtime, message, `sign ${nonceSetup.nonce} at https://solana.sign.elizaos.ai and give me the signature`))
      } else {
        callback(takeItPrivate(runtime, message, `${pubKey} does not meet the requirements`))
      }
    } else {
      // start by asking about their pubkey
      callback(takeItPrivate(runtime, message, `Which solana wallet address contains your 1,000,000 $degenai (Gu3LDkn7Vx3bmCzLafYNKcDxv2mH7YN44NJZFXnypump) tokens?`))
    }
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'verify my wallet',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll help you get started",
          actions: ['VERIFY_SPARTAN_HOLDER'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'my solana wallet address is FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll help you get started",
          actions: ['VERIFY_SPARTAN_HOLDER'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'The signature I got was tIxMc1ADJF1ttmoOzB/6J5n2NdXct4iKcB7UV1hHtGtJP9nsj16oO3smZT41AtEW/dYbLlYtvZ+oYNAOWzB0Cg==',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll help you get started",
          actions: ['VERIFY_SPARTAN_HOLDER'],
        },
      },
    ],
  ] as ActionExample[][],
}