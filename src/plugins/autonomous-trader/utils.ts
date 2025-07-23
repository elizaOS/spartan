import {
  type IAgentRuntime,
  type Content,
  ModelType,
  logger,
  parseJSONObjectFromText,
  createUniqueUuid,
} from '@elizaos/core';
//import { interface_users_ByIds } from './interfaces/int_users'
//import { interface_accounts_ByIds } from './interfaces/int_accounts'
import { PublicKey, } from '@solana/web3.js';


// we used to use message.entityId
// this is the user entity id
export async function getEntityIdFromMessage(runtime, message) {
  //return createUniqueUuid(runtime, message.metadata.fromId);
  //console.log('getEntityIdFromMessage message', message)

  // ensureEntity because I don't think the clients are going to build it
  if (message?.metadata?.sourceId) {
    const entityId = message.metadata.sourceId
    const entity = await runtime.getEntityById(entityId);
    if (!entity) {
      const success = await runtime.createEntity({
        id: entityId,
        //names: [message.names],
        //metadata: entityMetadata,
        agentId: runtime.agentId,
      });
    }
  }
  return message?.metadata?.sourceId
}

export async function HasEntityIdFromMessage(runtime, message) {
  /*
  if (!message?.metadata?.fromId) {
    console.log('WALLET_IMPORT validate - author not found')
    return false
  }
  */
  //console.log('HasEntityIdFromMessage message', message)
  return !!await getEntityIdFromMessage(runtime, message)
}

// they've started the registered process by providing an email
export async function getDataFromMessage(runtime, message) {
  //return createUniqueUuid(runtime, message.metadata.fromId);
  const entityId = await getEntityIdFromMessage(runtime, message)
  //console.debug('autotrade::getDataFromMessage - entityId', entityId)
  if (!entityId) {
    console.error('autotrade::getDataFromMessage - no entityId found')
    return false // avoid database look up
  }
  const intUserService = runtime.getService('AUTONOMOUS_TRADER_INTERFACE_USER') as any;
  const components = await intUserService.interface_users_ByIds([entityId])
  //console.debug('autotrade::getDataFromMessage - user components', components)
  // .componentId
  return components[entityId]
}

// they have a verified email
// returns componentData
export async function getAccountFromMessage(runtime, message) {
  const componentData = await getDataFromMessage(runtime, message)
  if (componentData?.verified) {
    const emailAddr = componentData.address
    const emailEntityId = createUniqueUuid(runtime, emailAddr);
    const intAcountService = runtime.getService('AUTONOMOUS_TRADER_INTERFACE_ACCOUNTS') as any;
    const accounts = await intAcountService.interface_accounts_ByIds([emailEntityId])
    if (accounts[emailEntityId]) {
      // accounts[emailEntityId] is componentData
      // .componentId
      // not really a concern
      /*
      if (emailEntityId !== accounts[emailEntityId].entityId) {
        console.warn('entityId mismatch', emailEntityId, accounts[emailEntityId])
      }
      */
      // probably don't need to include accountEntityId because it will contain entityId
      return { ...accounts[emailEntityId], accountEntityId: emailEntityId }
    } else {
      // verified just no component yet
      // should we just ensure it here?
      return { accountEntityId: emailEntityId }
    }
  }
  // not verified
  return false
}

/*
const sourceAddressTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Recent Messages:
{{recentMessages}}

Extract the following information about the requested swap:
- Source wallet address to use for the swap

Example response:
\`\`\`json
{
"sourceWalletAddress": "FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1"
}
\`\`\`

Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the JSON response format without any preamble or explanation.

IMPORTANT: Your response must ONLY contain the json block above. Do not include any text, thinking, or reasoning before or after this JSON block. Start your response immediately with { and end with }.`;

const sourcePrompt = composePromptFromState({
    state: state,
    template: sourceAddressTemplate,
});
const sourceResult = await runtime.useModel(ModelType.OBJECT_LARGE, {
    prompt: sourcePrompt,
});
console.log('MULTIWALLET_SWAP sourceResult', sourceResult);
*/

/// wallet vs pubkey address?
// is a wallet required? , required = 0
// max wallets? 1, 2 for transfer
// we return an array of what?
export async function getWalletsFromText(runtime, message) {
  // what about partial?
  // only works in the source context...
  const solanaService = runtime.getService('chain_solana') as any;
  if (!solanaService) {
    console.error('getWalletsFromText - CANT FIND chain_solana service')
    return []
  }
  const sources = solanaService.detectPubkeysFromString(message.content.text)
  // get by wallet name
  return sources
}

export async function acquireService(
  runtime: IAgentRuntime,
  serviceType,
  asking = '',
  retries = 10
) {
  let service = runtime.getService(serviceType) as any;
  while (!service) {
    console.log(asking, 'waiting for', serviceType, 'service...');
    service = runtime.getService(serviceType) as any;
    if (!service) {
      await new Promise((waitResolve) => setTimeout(waitResolve, 1000));
    } else {
      console.log(asking, 'Acquired', serviceType, 'service...');
    }
  }
  return service;
}

export async function askLlmObject(
  runtime: IAgentRuntime,
  ask: Object,
  requiredFields: string[],
  maxRetries = 3
) {
  //console.log('using askLlmObject')
  let responseContent: any | null = null;
  // Retry if missing required fields
  let retries = 0;

  function checkRequired(resp) {
    if (!resp) {
      console.log('No response')
      return false;
    }
    let hasAll = true;
    for (const f of requiredFields) {
      // allow nulls
      if (resp[f] === undefined) {
        console.log('resp is missing', f, resp[f], resp)
        hasAll = false;
        break;
      }
    }
    return hasAll;
  }
  if (!ask.system) {
    console.log('trader::utils:askLlmObject - Omitting system prompt')
  }

  let good = false;
  while (retries < maxRetries && !good) {
    const response = await runtime.useModel(ModelType.TEXT_LARGE, {
      ...ask, // prompt, system
      /*
      temperature: 0.2,
      maxTokens: 4096,
      object: true,
      */
    });

    // too coarse but the only place to see <think>
    console.log('trader::utils:askLlmObject - response', response);

    // we do not need the backtic stuff .replace('```json', '').replace('```', '')
    let cleanResponse = response.replace(/<think>[\s\S]*?<\/think>/g, '')
    responseContent = parseJSONObjectFromText(cleanResponse) as any;

    retries++;
    good = checkRequired(responseContent);
    if (!good) {
      logger.warn(
        '*** Missing required fields',
        responseContent,
        'needs',
        requiredFields,
        ', retrying... ***'
      );
    }
  }
  // can run null
  return responseContent;
}

export async function messageReply(runtime, message, reply) {
  const responseContent = {
    text: reply,
    attachments: [],
    source: message.source,
    // keep channelType the same
    channelType: message.channelType,
    inReplyTo: createUniqueUuid(runtime, message.id)
    // for the web UI
    //actions: ['REPLY'],
  };
  // embedding
  // metadata: entityName, type, authorId
  return responseContent
}

export function takeItPrivate(runtime, message, reply): Content {
  const responseContent = {
    text: reply,
    channelType: 'DM',
    inReplyTo: createUniqueUuid(runtime, message.id)
    // for the web UI
    //actions: ['REPLY'],
  };
  return responseContent
}

function splitTextBySentence(text, maxLength = 4096) {
  if (!text) return [];

  const sentenceRegex = /[^.!?]+[.!?]+[\])'"`’”]*|[^.!?]+$/g;
  const sentences = text.match(sentenceRegex) || [];

  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence;
    } else {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      if (sentence.length > maxLength) {
        // Split long sentence if it alone exceeds the limit
        for (let i = 0; i < sentence.length; i += maxLength) {
          chunks.push(sentence.slice(i, i + maxLength).trim());
        }
        currentChunk = '';
      } else {
        currentChunk = sentence;
      }
    }
  }

  if (currentChunk.trim()) chunks.push(currentChunk.trim());

  return chunks;
}

export function takeItPrivate2(runtime, message, reply, callback): Content {
  console.log('takeItPrivate2 input', reply.length)
  //console.log('source', message)
  if (message.content.source === 'discord') {
    // content[BASE_TYPE_MAX_LENGTH]: Must be 2000 or fewer in length
    //console.log('discord input', reply.length)
    const chunks = splitTextBySentence(reply, 2000)
    for (const c of chunks) {
      console.log('discord split chunk', c.length)
      if (c) {
        const responseContent = {
          text: c,
          channelType: 'DM',
          inReplyTo: createUniqueUuid(runtime, message.id)
          // for the web UI
          //actions: ['REPLY'],
        };
        callback(responseContent)
      }
    }
  } else if (message.content.source === 'telegram') {
    // what's telegram limit? 4k
    const chunks = splitTextBySentence(reply, 4096)
    for (const c of chunks) {
      console.log('telegram split chunk', c.length)
      const responseContent = {
        text: c,
        channelType: 'DM',
        inReplyTo: createUniqueUuid(runtime, message.id)
        // for the web UI
        //actions: ['REPLY'],
      };
      callback(responseContent)
    }
  } else {
    const responseContent = {
      text: reply,
      channelType: 'DM',
      inReplyTo: createUniqueUuid(runtime, message.id)
      // for the web UI
      //actions: ['REPLY'],
    };
    callback(responseContent)
  }
}

// also in solana service
export async function parseTokenAccounts(heldTokens) {
  const out = {}
  for (const t of heldTokens) {
    const ca = t.account.data.parsed.info.mint
    const mintKey = new PublicKey(ca);
    const symbol = await solanaService.getTokenSymbol(mintKey)
    const amountRaw = t.account.data.parsed.info.tokenAmount.amount;
    const decimals = t.account.data.parsed.info.tokenAmount.decimals;
    const balance = Number(amountRaw) / (10 ** decimals);
    out[ca] = {
      symbol,
      decimals,
      balanceUi: balance, // how many tokens we have
    }
  }
  return out
}

export async function walletContainsMinimum(runtime, pubKey, ca, amount) {
  console.log('walletContainsMinimum')
  try {
    const solanaService = runtime.getService('chain_solana') as any;
    const pubKeyObj = new PublicKey(pubKey)
    const heldTokens = await solanaService.getTokenAccountsByKeypair(pubKeyObj)
    const tokens = await solanaService.parseTokenAccounts(heldTokens)
    //if (!tokens.length) return false
    const t = tokens[ca]
    if (!t) {
      console.warn('no', ca, 'held in', pubKey, tokens)
      return false
    }
    const bal = parseFloat(t.balanceUi)
    if (bal < amount) {
      console.log('wallet only has', bal)
      return false
    }
    return true
  } catch (e) {
    console.error('err', e)
    return null
  }
}

export function accountMockComponent(account) {
  const id = account.componentId
  const entityId = account.entityId
  delete account.componentId
  delete account.entityId

  return {
    id,
    entityId, // has to be set for upsert/create (there is no default)
    data: account
  }
}

export function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charsLength = chars.length;

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * charsLength));
  }

  return result;
}

export function findGeneratedCode(message, length) {
  const pattern = new RegExp(`\\b[A-Za-z0-9]{${length}}\\b`);
  const match = message.match(pattern);
  return match ? match[0] : null;
}

export function extractEmails(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex);
  return matches || [];
}

//

export async function getCacheExp(runtime, key) {
  const wrapper = await runtime.getCache<any>(key);
  // if exp is in the past
  if (wrapper.exp < Date.now()) {
    // no data
    return false
  }
  return wrapper.data
}

export async function setCacheExp(runtime, key, val, ttlInSecs) {
  const exp = Date.now() + ttlInSecs * 1_000
  return runtime.setCache<any>(key, {
    // sys call waste atm
    // fetchedAt: Date.now(),
    exp,
    data: val,
  });
}

/**
 * Changes all wallet strategies to "none" across all accounts
 * @param runtime - The agent runtime
 * @returns Promise<{ success: boolean, updatedAccounts: number, updatedWallets: number }> - Result of the operation
 */
export async function changeAllWalletStrategiesToNone(runtime: IAgentRuntime): Promise<{ success: boolean, updatedAccounts: number, updatedWallets: number }> {
  try {
    console.log('changeAllWalletStrategiesToNone - starting operation')

    // Get all meta wallets to see what we're working with
    const { getMetaWallets } = await import('./interfaces/int_wallets')
    const { interface_accounts_ByIds, interface_account_update } = await import('./interfaces/int_accounts')
    const { interface_accounts_list } = await import('./interfaces/int_accounts')

    const allMetaWallets = await getMetaWallets(runtime)
    console.log('changeAllWalletStrategiesToNone - found', allMetaWallets.length, 'meta wallets')

    // Get all account IDs
    const accountIds = await interface_accounts_list(runtime)
    console.log('changeAllWalletStrategiesToNone - found', accountIds.length, 'accounts')

    // Get all account components
    const accounts = await interface_accounts_ByIds(runtime, accountIds)

    let updatedAccounts = 0
    let updatedWallets = 0

    // Iterate through each account
    for (const entityId in accounts) {
      const account = accounts[entityId]
      if (!account || !account.metawallets || account.metawallets.length === 0) {
        continue
      }

      let accountModified = false

      // Check each metawallet in this account
      for (const metawallet of account.metawallets) {
        if (metawallet.strategy && metawallet.strategy !== 'none') {
          console.log('changeAllWalletStrategiesToNone - changing strategy from', metawallet.strategy, 'to none for wallet in account', entityId)
          metawallet.strategy = 'none'
          accountModified = true
          updatedWallets++
        }
      }

      // If this account had changes, update it
      if (accountModified) {
        console.log('changeAllWalletStrategiesToNone - updating account', entityId)
        const component = accountMockComponent(account)
        await interface_account_update(runtime, component)
        updatedAccounts++
      }
    }

    console.log('changeAllWalletStrategiesToNone - completed. Updated', updatedAccounts, 'accounts and', updatedWallets, 'wallets')

    return {
      success: true,
      updatedAccounts,
      updatedWallets
    }

  } catch (error) {
    console.error('changeAllWalletStrategiesToNone - error:', error)
    return {
      success: false,
      updatedAccounts: 0,
      updatedWallets: 0
    }
  }
}

/**
 * Closes rent on tokens with zero balance across all wallets
 * @param runtime - The agent runtime
 * @returns Promise<{ success: boolean, closedAccounts: number, totalWallets: number, signatures: string[] }> - Result of the operation
 */
export async function closeZeroBalanceTokenAccounts(runtime: IAgentRuntime): Promise<{ success: boolean, closedAccounts: number, totalWallets: number, signatures: string[] }> {
  try {
    console.log('closeZeroBalanceTokenAccounts - starting operation')

    // Import required dependencies
    const { createCloseAccountInstruction } = await import('@solana/spl-token')
    const { Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction } = await import('@solana/web3.js')
    const bs58 = await import('bs58')

    // Get all meta wallets
    const { getMetaWallets } = await import('./interfaces/int_wallets')
    const allMetaWallets = await getMetaWallets(runtime)
    console.log('closeZeroBalanceTokenAccounts - found', allMetaWallets.length, 'meta wallets')

    let totalClosedAccounts = 0
    let totalWallets = 0
    const allSignatures: string[] = []

    // Create Solana connection
    const connection = new Connection(
      runtime.getSetting('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com'
    )

    // Process each wallet
    for (const metawallet of allMetaWallets) {
      if (!metawallet.keypairs?.solana?.privateKey) {
        console.log('closeZeroBalanceTokenAccounts - skipping wallet without private key')
        continue
      }

      totalWallets++
      const walletAddress = metawallet.keypairs.solana.publicKey
      console.log('closeZeroBalanceTokenAccounts - processing wallet:', walletAddress)

      try {
        // Create keypair from private key
        const secretKey = bs58.default.decode(metawallet.keypairs.solana.privateKey)
        const keypair = Keypair.fromSecretKey(secretKey)

        // Get all token accounts for this wallet
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(keypair.publicKey, {
          programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        })

        console.log(`closeZeroBalanceTokenAccounts - found ${tokenAccounts.value.length} token accounts for wallet ${walletAddress}`)

        // Filter accounts with zero balance
        const zeroBalanceAccounts = tokenAccounts.value.filter(account => {
          const amount = BigInt(account.account.data.parsed.info.tokenAmount.amount)
          return amount === 0n
        })

        if (zeroBalanceAccounts.length === 0) {
          console.log(`closeZeroBalanceTokenAccounts - no zero balance accounts found for wallet ${walletAddress}`)
          continue
        }

        console.log(`closeZeroBalanceTokenAccounts - found ${zeroBalanceAccounts.length} zero balance accounts for wallet ${walletAddress}`)

        // Create close instructions for all zero balance accounts
        const instructions = zeroBalanceAccounts.map(account =>
          createCloseAccountInstruction(
            account.pubkey,
            keypair.publicKey, // Rent refunded to wallet owner
            keypair.publicKey
          )
        )

        // Execute the transaction
        if (instructions.length > 0) {
          console.log(`closeZeroBalanceTokenAccounts - closing ${instructions.length} accounts for wallet ${walletAddress}`)

          const messageV0 = new TransactionMessage({
            payerKey: keypair.publicKey,
            recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
            instructions,
          }).compileToV0Message()

          const transaction = new VersionedTransaction(messageV0)
          transaction.sign([keypair])

          const signature = await connection.sendTransaction(transaction, {
            skipPreflight: false,
            maxRetries: 3,
            preflightCommitment: 'confirmed',
          })

          // Wait for confirmation
          await connection.confirmTransaction(signature, 'confirmed')

          console.log(`closeZeroBalanceTokenAccounts - successfully closed ${instructions.length} accounts for wallet ${walletAddress}. Signature: ${signature}`)

          totalClosedAccounts += instructions.length
          allSignatures.push(signature)

          // Add a small delay between wallets to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

      } catch (error) {
        console.error(`closeZeroBalanceTokenAccounts - error processing wallet ${walletAddress}:`, error)
        // Continue with other wallets even if one fails
      }
    }

    console.log(`closeZeroBalanceTokenAccounts - completed. Processed ${totalWallets} wallets, closed ${totalClosedAccounts} accounts`)

    return {
      success: true,
      closedAccounts: totalClosedAccounts,
      totalWallets,
      signatures: allSignatures
    }

  } catch (error) {
    console.error('closeZeroBalanceTokenAccounts - error:', error)
    return {
      success: false,
      closedAccounts: 0,
      totalWallets: 0,
      signatures: []
    }
  }
}