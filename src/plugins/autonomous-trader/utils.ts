import {
  type IAgentRuntime,
  type Content,
  type Memory,
  type ChannelType,
  type UUID,
  ModelType,
  logger,
  parseJSONObjectFromText,
  createUniqueUuid,
} from '@elizaos/core';
//import { interface_users_ByIds } from './interfaces/int_users'
//import { interface_accounts_ByIds } from './interfaces/int_accounts'
import { PublicKey } from '@solana/web3.js';
import { type Metawallet } from '../multiwallet/types';

// Type definitions for better type safety
interface AskObject {
  prompt?: string;
  system?: string;
  [key: string]: any;
}

interface CacheWrapper<T> {
  exp?: number;
  setAt?: number;
  data: T;
}

interface CacheOptions {
  notOlderThan?: number;
}

interface TokenAccount {
  account: {
    data: {
      parsed: {
        info: {
          mint: string;
          tokenAmount: {
            amount: string;
            decimals: number;
          };
        };
      };
    };
  };
  pubkey: PublicKey;
}

interface ParsedTokenAccount {
  symbol: string;
  decimals: number;
  balanceUi: number;
}


// we used to use message.entityId
// this is the user entity id
export async function getEntityIdFromMessage(runtime: IAgentRuntime, message: Memory): Promise<string | undefined> {
  //return createUniqueUuid(runtime, message.metadata.fromId);
  //console.log('getEntityIdFromMessage message', message)

  // ensureEntity because I don't think the clients are going to build it
  if (message?.metadata?.sourceId) {
    const entityId: UUID = message.metadata.sourceId
    const entity = await runtime.getEntityById(entityId);
    if (!entity) {
      const success = await runtime.createEntity({
        id: entityId,
        names: [],
        //names: [message.names],
        //metadata: entityMetadata,
        metadata: {}, // Empty metadata for now
        agentId: runtime.agentId,
      });
    }
  }
  return message?.metadata?.sourceId
}

export async function HasEntityIdFromMessage(runtime: IAgentRuntime, message: Memory): Promise<boolean> {
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
export async function getDataFromMessage(runtime: IAgentRuntime, message: Memory): Promise<any> {
  //console.log('getDataFromMessage', message)
  //return createUniqueUuid(runtime, message.metadata.fromId);
  const entityId = await getEntityIdFromMessage(runtime, message)
  //console.debug('autotrade::getDataFromMessage - entityId', entityId)
  if (!entityId) {
    console.error('autotrade::getDataFromMessage - no entityId found')
    return false // avoid database look up
  }
  const intUserService = runtime.getService('AUTONOMOUS_TRADER_INTERFACE_USERS') as any;
  const components = await intUserService.interface_users_ByIds([entityId])
  const component = components[entityId]
  //console.debug('autotrade::getDataFromMessage - user components', components)
  // .componentId

  // fix update user record to include discord information if we don't already have it
  if (message.content.source === 'discord') {
    //console.log('discord')
    if (component && !component.discordUserId) {
      //console.log('component', component)
      // find the id
      const discordUserId = (message.metadata as any)?.fromId
      if (discordUserId) {
        component.discordUserId = discordUserId
        // save update it
        //const mockComponent = accountMockComponent(component)
        //const intAcountService = runtime.getService('AUTONOMOUS_TRADER_INTERFACE_ACCOUNTS') as any;
        //await intAcountService.interface_account_upsert(message, component)
        const intUserService = runtime.getService('AUTONOMOUS_TRADER_INTERFACE_USERS') as any;
        // we need componentId
        if (intUserService) {
          // don't need to await it
          // we should because it seems to lead to like 8 writes
          await intUserService.interface_user_update(component)
        }
      }
    }
  }
  return component
}

// they have a verified email
// returns componentData
export async function getAccountFromMessage(runtime: IAgentRuntime, message: Memory): Promise<any> {
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
// RENAME: to getAddressFromText
export async function getWalletsFromText(runtime: IAgentRuntime, message: Memory): Promise<string[]> {
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
  serviceType: string,
  asking = '',
  retries = 10
): Promise<any> {
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
  ask: AskObject,
  requiredFields: string[],
  maxRetries = 3
): Promise<any> {
  //console.log('using askLlmObject')
  let responseContent: any | null = null;
  // Retry if missing required fields
  let retries = 0;

  function checkRequired(resp: any): boolean {
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

export function messageReply(runtime: IAgentRuntime, message: Memory, reply: string): Content {
  const responseContent: Content = {
    text: reply,
    attachments: [],
    source: (message as any).source || 'unknown',
    // keep channelType the same
    channelType: (message as any).channelType as ChannelType | undefined,
    inReplyTo: createUniqueUuid(runtime, message.id || '')
    // for the web UI
    //actions: ['REPLY'],
  };
  // embedding
  // metadata: entityName, type, authorId
  return responseContent
}

export function takeItPrivate(runtime: IAgentRuntime, message: Memory, reply: string): Content {
  const responseContent: Content = {
    text: reply,
    channelType: 'DM' as ChannelType,
    inReplyTo: createUniqueUuid(runtime, message.id || '')
    // for the web UI
    //actions: ['REPLY'],
  };
  return responseContent
}

function splitTextBySentence(text: string, maxLength = 4096): string[] {
  if (!text) return [];

  const sentenceRegex = /[^.!?]+[.!?]+[\])'"`’”]*|[^.!?]+$/g;
  const sentences = text.match(sentenceRegex) || [];

  const chunks: string[] = [];
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

export function takeItPrivate2(runtime: IAgentRuntime, message: Memory, reply: string, callback: (content: Content) => void): void {
  console.log('takeItPrivate2 input', reply.length)
  //console.log('source', message)
  if (message.content.source === 'discord') {
    // content[BASE_TYPE_MAX_LENGTH]: Must be 2000 or fewer in length
    //console.log('discord input', reply.length)
    const chunks = splitTextBySentence(reply, 2000)
    for (const c of chunks) {
      console.log('discord split chunk', c.length)
      if (c) {
        console.log('sending', c)
        const responseContent: Content = {
          text: c,
          channelType: 'DM' as ChannelType,
          inReplyTo: createUniqueUuid(runtime, message.id || '')
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
      const responseContent: Content = {
        text: c,
        channelType: 'DM' as ChannelType,
        inReplyTo: createUniqueUuid(runtime, message.id || '')
        // for the web UI
        //actions: ['REPLY'],
      };
      callback(responseContent)
    }
  } else {
    const responseContent: Content = {
      text: reply,
      channelType: 'DM' as ChannelType,
      inReplyTo: createUniqueUuid(runtime, message.id || '')
      // for the web UI
      //actions: ['REPLY'],
    };
    callback(responseContent)
  }
}

// also in solana service
export async function parseTokenAccounts(heldTokens: TokenAccount[]): Promise<Record<string, ParsedTokenAccount>> {
  const out: Record<string, ParsedTokenAccount> = {}
  for (const t of heldTokens) {
    const ca = t.account.data.parsed.info.mint
    const mintKey = new PublicKey(ca);
    // Note: solanaService should be passed as parameter or obtained from runtime
    // const symbol = await solanaService.getTokenSymbol(mintKey)
    const symbol = 'UNKNOWN'; // Placeholder - needs proper service reference
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

export function extractBase64Strings(input: string): string[] {
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

export async function walletContainsMinimum(runtime: IAgentRuntime, pubKey: string, ca: string, amount: number): Promise<boolean | null> {
  // usually validate on getting shapes for setstrategy
  //console.trace('walletContainsMinimum')
  console.log('walletContainsMinimum', pubKey)
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

export function accountMockComponent(account: any): any {
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

export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charsLength = chars.length;

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * charsLength));
  }

  return result;
}

export function findGeneratedCode(message: string, length: number): string | null {
  if (!message?.match) return null;
  const pattern = new RegExp(`\\b[A-Za-z0-9]{${length}}\\b`);
  const match = message.match(pattern);
  return match ? match[0] : null;
}

export function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex);
  return matches || [];
}

//

export async function getCacheExp<T>(runtime: IAgentRuntime, key: string): Promise<T | false> {
  const wrapper = await runtime.getCache<CacheWrapper<T>>(key);
  if (!wrapper) return false
  // if exp is in the past
  if (wrapper.exp && wrapper.exp < Date.now()) {
    // no data
    return false
  }
  return wrapper.data
}

export async function setCacheExp<T>(runtime: IAgentRuntime, key: string, val: T, ttlInSecs: number): Promise<void> {
  const exp = Date.now() + ttlInSecs * 1_000
  await runtime.setCache<CacheWrapper<T>>(key, {
    // sys call waste atm
    // fetchedAt: Date.now(),
    exp,
    data: val,
  });
}

export async function getCacheTimed<T>(runtime: IAgentRuntime, key: string, options: CacheOptions = {}): Promise<T | false> {
  const wrapper = await runtime.getCache<CacheWrapper<T>>(key);
  if (!wrapper) return false
  if (options.notOlderThan && wrapper.setAt) {
    const diff = Date.now() - wrapper.setAt
    //console.log('checking notOlderThan', diff + 'ms', 'setAt', wrapper.setAt, 'asking', options.notOlderThan)
    if (diff > options.notOlderThan) {
      // no data
      return false
    }
  }
  // return data
  return wrapper.data
}

export async function setCacheTimed<T>(runtime: IAgentRuntime, key: string, val: T, tsInMs = 0): Promise<void> {
  if (tsInMs === 0) tsInMs = Date.now()
  await runtime.setCache<CacheWrapper<T>>(key, {
    // sys call waste atm
    setAt: tsInMs,
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
    const { getMetaWallets } = await import('../multiwallet/interfaces/int_wallets')
    const { interface_accounts_ByIds, interface_account_update } = await import('../account/interfaces/int_accounts')
    const { interface_accounts_list } = await import('../account/interfaces/int_accounts')

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
    const { getMetaWallets } = await import('../multiwallet/interfaces/int_wallets')
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
      if (!metawallet.keypairs?.solana) {
        console.log('closeZeroBalanceTokenAccounts - skipping wallet without solana keypair')
        continue
      }

      totalWallets++
      const walletAddress = metawallet.keypairs.solana.publicKey
      console.log('closeZeroBalanceTokenAccounts - processing wallet:', walletAddress)

      try {
        // Create keypair from private key
        const secretKey = bs58.default.decode((metawallet.keypairs.solana as any).privateKey)
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