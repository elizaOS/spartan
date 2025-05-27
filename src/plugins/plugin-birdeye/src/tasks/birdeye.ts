import {
  type Content,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type UUID,
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import type { IToken } from '../types';

/**
 * Interface representing a transaction history entry.
 * @property {string} txHash - The hash of the transaction.
 * @property {Date} blockTime - The time when the transaction occurred.
 * @property {any} data - Additional data related to the transaction.
 */
export interface TransactionHistory {
  txHash: string;
  blockTime: Date;
  data: any;
}

/**
 * Interface representing a Portfolio object.
 * @typedef {Object} Portfolio
 * @property {string} key - The key associated with the portfolio.
 * @property {any} data - The data contained in the portfolio.
 */
export interface Portfolio {
  key: string;
  data: any;
}

/**
 * Interface representing content with sentiment analysis data.
 * @extends Content
 * @interface
 */
export interface SentimentContent extends Content {
  text: string;
  source: 'sentiment-analysis';
  metadata: {
    timeslot: string;
    processed: boolean;
    occuringTokens?: Array<{
      token: string;
      sentiment: number;
      reason: string;
    }>;
  };
}

const rolePrompt = 'You are a sentiment analyzer for cryptocurrency and market data.';

/**
 * Template for analyzing tweets related to the cryptocurrency market.
 *
 * The template prompts the user to write a summary of the tweets and analyze the tokens present in the tweet.
 * It requests information on whether the sentiment towards the tokens is positive or negative.
 *
 * To analyze the given tweets, the user needs to strictly return a JSON object with the following structure:
 * {
 *     "text": "the summary of what has happened in those tweets, with a max length of 200 characters",
 *     "occuringTokens": [
 *         {
 *             "token": "the token symbol, like: ETH, SOL, BTC etc.",
 *             "sentiment": "positive is between 1 and 100 and negative is from -1 to -100",
 *             "reason": "a short sentence explaining the reason for this sentiment score"
 *         }
 *     ]
 * }
 */
const template = `Write a summary of what is happening in the tweets. The main topic is the cryptocurrency market.
You will also be analyzing the tokens that occur in the tweet and tell us whether their sentiment is positive or negative.

## Analyze the followings tweets:
{{tweets}}

Strictly return the following json:

{
   "text":"the summary of what has happened in those tweets, with a max length of 200 characters",
   "occuringTokens":[
      {
         "token":"the token symbol, like: ETH, SOL, BTC etc.",
         "sentiment":"positive is between 1 and 100 and negative is from -1 to -100",
         "reason":"a short sentence explaining the reason for this sentiment score"
      }
   ]
}`;

/**
 * Generates a bulletpoint list from an array of strings.
 *
 * @param {string[]} array - The array of strings to create the list from.
 * @returns {string} The bulletpoint list as a single string with new lines separating each item.
 */
function makeBulletpointList(array: string[]): string {
  return array.map((a) => ` - ${a}`).join('\n');
}

export default class Birdeye {
  apiKey: string;
  sentimentRoomId: UUID;
  twitterFeedRoomId: UUID;
  runtime: IAgentRuntime;

  constructor(runtime: IAgentRuntime) {
    const apiKey = runtime.getSetting('BIRDEYE_API_KEY');
    if (!apiKey) {
      throw new Error('Failed to initialize Birdeye provider due to missing API key.');
    }
    this.apiKey = apiKey;
    this.sentimentRoomId = createUniqueUuid(runtime, 'sentiment-analysis');
    this.twitterFeedRoomId = createUniqueUuid(runtime, 'twitter-feed');
    this.runtime = runtime;
  }

  private async syncWalletHistory() {
    try {
      const publicKey =
        this.runtime.getSetting('SOLANA_PUBLIC_KEY') ||
        'BzsJQeZ7cvk3pTHmKeuvdhNDkDxcZ6uCXxW2rjwC7RTq';

      // First get data from Birdeye
      const options = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': this.apiKey,
        },
      };

      const res = await fetch(
        `https://public-api.birdeye.so/v1/wallet/tx_list?wallet=${publicKey}&limit=100`,
        options
      );

      const resp = await res.json();

      //console.log('birdeyeData', resp)

      const birdeyeData = resp?.data?.solana || [];
      //console.log('birdeyeData', birdeyeData)

      //console.log('intel/be/syncWalletHistory - birdeyeData', birdeyeData)

      // Convert Birdeye data to our transaction format
      let transactions: TransactionHistory[] = birdeyeData.map((tx: any) => ({
        txHash: tx.txHash,
        blockTime: new Date(tx.blockTime),
        data: tx,
      }));

      //console.log('intel/be/syncWalletHistory - transactions', transactions)

      // Then try to get cached transactions
      try {
        // FIXME: scope to solana and wallet
        const cachedTxs = await this.runtime.getCache<TransactionHistory[]>('transaction_history');
        if (cachedTxs && Array.isArray(cachedTxs)) {
          // Add cached transactions that don't exist in Birdeye data
          for (const cachedTx of cachedTxs) {
            if (!transactions.some((tx) => tx.txHash === cachedTx.txHash)) {
              transactions.push(cachedTx);
            }
          }
        }
      } catch (error) {
        // If cache fails, continue with just Birdeye data
        logger.debug('Failed to get cached transactions, continuing with Birdeye data only');
      }

      // ensure all dates are of type Date for sort
      for (const tx of transactions) {
        if (typeof tx.blockTime === 'string') {
          tx.blockTime = new Date(tx.blockTime);
        }
      }

      // Sort transactions by blockTime descending (newest first)
      transactions.sort((a, b) => b.blockTime.getTime() - a.blockTime.getTime());

      // Try to update cache, but don't fail if it doesn't work
      try {
        await this.runtime.setCache<TransactionHistory[]>('transaction_history', transactions);
        logger.debug(`Updated transaction history with ${transactions.length} transactions`);
      } catch (error) {
        logger.debug('Failed to set transaction cache, continuing without caching', error);
      }

      return transactions;
    } catch (error) {
      logger.error('Failed to sync wallet history from Birdeye', error);
      // Return empty array if everything fails
      return [];
    }
  }

  private async syncWalletPortfolio() {
    /** Get entire portfolio */
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-chain': 'solana',
        'X-API-KEY': this.apiKey,
      },
    };

    const publicKey =
      this.runtime.getSetting('SOLANA_PUBLIC_KEY') ||
      'BzsJQeZ7cvk3pTHmKeuvdhNDkDxcZ6uCXxW2rjwC7RTq';

    const res = await fetch(
      `https://public-api.birdeye.so/v1/wallet/token_list?wallet=${publicKey}`,
      options
    );

    const resp = await res.json();
    const data = resp?.data;
    //console.log('portfolio data', data)

    await this.runtime.setCache<Portfolio>('portfolio', { key: 'PORTFOLIO', data });
  }

  async syncWallet() {
    await this.syncWalletHistory();
    // maybe let solana or birdeye plugin handle this
    await this.syncWalletPortfolio();

    return true;
  }

  async syncTrendingTokens(chain: 'solana' | 'base'): Promise<boolean> {
    try {
      const options = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-chain': chain,
          'X-API-KEY': this.apiKey,
        },
      };

      // Get existing tokens
      const cachedTokens = await this.runtime.getCache<IToken[]>(`tokens_${chain}`);
      const tokens: IToken[] = cachedTokens ? cachedTokens : [];

      /** Fetch top 100 in batches of 20 (which is the limit) */
      for (let batch = 0; batch < 5; batch++) {
        const currentOffset = batch * 20;
        const res = await fetch(
          `https://public-api.birdeye.so/defi/token_trending?sort_by=rank&sort_type=asc&offset=${currentOffset}&limit=20`,
          options
        );
        const resp = await res.json();
        //console.log('trending', resp)
        const data = resp?.data;
        const last_updated = new Date(data?.updateUnixTime * 1000);
        const newTokens = data?.tokens;

        if (!newTokens) {
          continue;
        }
        for (const token of newTokens) {
          const existingIndex = tokens.findIndex(
            (t) => t.provider === 'birdeye' && t.rank === token.rank && t.chain === chain
          );

          const tokenData: IToken = {
            address: token.address,
            chain: chain,
            provider: 'birdeye',
            decimals: token.decimals || 0,
            liquidity: token.liquidity || 0,
            logoURI: token.logoURI || '',
            name: token.name || token.symbol,
            symbol: token.symbol,
            marketcap: 0,
            volume24hUSD: token.volume24hUSD || 0,
            rank: token.rank || 0,
            price: token.price || 0,
            price24hChangePercent: token.price24hChangePercent || 0,
            last_updated,
          };

          if (existingIndex >= 0) {
            tokens[existingIndex] = tokenData;
          } else {
            tokens.push(tokenData);
          }
        }

        // Add extra delay
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      //console.log('trending tokens', tokens)
      await this.runtime.setCache<IToken[]>(`tokens_${chain}`, tokens);

      logger.debug(`Updated ${chain} tokens cache with ${tokens.length} tokens`);

      return true;
    } catch (error) {
      logger.error('Failed to sync trending tokens', error);
      throw error;
    }
  }
}
