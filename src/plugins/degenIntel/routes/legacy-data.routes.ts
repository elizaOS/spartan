/**
 * Legacy Data Routes
 * Original routes for trending tokens, wallet data, tweets, sentiment, and signals
 */

import type { Route, IAgentRuntime, Memory } from '@elizaos/core';
import type { Portfolio, SentimentContent, TransactionHistory } from '../tasks/birdeye';
import type { IToken } from '../types';
import { SentimentArraySchema, TweetArraySchema } from '../schemas';

export const legacyDataRoutes: Route[] = [
  // Trending tokens
  {
    type: 'POST',
    path: '/trending',
    handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { createUniqueUuid } = await import('@elizaos/core');
        const cachedTokens = await runtime.getCache<IToken[]>('tokens_solana');
        const tokens: IToken[] = cachedTokens ? cachedTokens : [];
        const sortedTokens = tokens.sort((a, b) => (a.rank || 0) - (b.rank || 0));
        res.json(sortedTokens);
      } catch (_error) {
        console.log('error', _error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  },

  // Wallet portfolio and transaction history
  {
    type: 'POST',
    path: '/wallet',
    handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const cachedTxs = await runtime.getCache<TransactionHistory[]>('transaction_history');
        const transactions: TransactionHistory[] = cachedTxs ? cachedTxs : [];
        const history = transactions
          .filter((tx) => tx.data.mainAction === 'received')
          .sort((a, b) => new Date(b.blockTime).getTime() - new Date(a.blockTime).getTime())
          .slice(0, 100);

        const cachedPortfolio = await runtime.getCache<Portfolio>('portfolio');
        const portfolio: Portfolio = cachedPortfolio
          ? cachedPortfolio
          : { key: 'PORTFOLIO', data: null };

        res.json({ history, portfolio: portfolio.data });
      } catch (_error) {
        console.log('error', _error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  },

  // Twitter feed
  {
    type: 'GET',
    path: '/tweets',
    handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { createUniqueUuid } = await import('@elizaos/core');
        const memories = await runtime.getMemories({
          tableName: 'messages',
          roomId: createUniqueUuid(runtime, 'twitter-feed'),
          end: Date.now(),
          count: 50,
        });

        const tweets = memories
          .filter((m) => m.content.source === 'twitter')
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
          .map((m) => ({
            text: m.content.text,
            username: (m.content?.metadata as any)?.username,
            retweets: (m.content?.metadata as any)?.retweets,
            likes: (m.content?.metadata as any)?.likes,
            timestamp: (m.content?.metadata as any)?.timestamp || m.createdAt,
            metadata: (m.content as any).tweet || {},
          }));

        const validatedData = TweetArraySchema.parse(tweets);
        res.json(validatedData);
      } catch (_error) {
        console.log('error', _error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  },

  // Statistics (aggregated counts)
  {
    type: 'POST',
    path: '/statistics',
    handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { createUniqueUuid } = await import('@elizaos/core');
        const tweetMemories = await runtime.getMemories({
          tableName: 'messages',
          roomId: createUniqueUuid(runtime, 'twitter-feed'),
          end: Date.now(),
          count: 50,
        });

        const tweets = tweetMemories
          .filter((m) => m.content.source === 'twitter')
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
          .map((m) => ({
            text: m.content.text,
            timestamp: m.createdAt,
            metadata: (m.content as any).tweet || {},
          }));

        const sentimentMemories = await runtime.getMemories({
          tableName: 'messages',
          roomId: createUniqueUuid(runtime, 'sentiment-analysis'),
          end: Date.now(),
          count: 30,
        });

        const sentiments = sentimentMemories
          .filter(
            (m): m is Memory & { content: SentimentContent } =>
              m.content.source === 'sentiment-analysis' &&
              !!m.content.metadata &&
              typeof m.content.metadata === 'object' &&
              m.content.metadata !== null &&
              'processed' in m.content.metadata &&
              'occuringTokens' in m.content.metadata &&
              Array.isArray(m.content.metadata.occuringTokens) &&
              m.content.metadata.occuringTokens.length > 1
          )
          .sort((a, b) => {
            const aTime = new Date(a.content.metadata.timeslot).getTime();
            const bTime = new Date(b.content.metadata.timeslot).getTime();
            return bTime - aTime;
          })
          .map((m) => ({
            timeslot: m.content.metadata.timeslot,
            text: m.content.text,
            processed: m.content.metadata.processed,
            occuringTokens: m.content.metadata.occuringTokens || [],
          }));

        const cachedTokens = await runtime.getCache<IToken[]>('tokens_solana');
        const tokens: IToken[] = cachedTokens ? cachedTokens : [];

        const data = {
          tweets: tweets.length,
          sentiment: sentiments.length,
          tokens: tokens.length,
        };
        res.json(data);
      } catch (_error) {
        console.log('error', _error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  },

  // Sentiment analysis
  {
    type: 'GET',
    path: '/sentiment',
    handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { createUniqueUuid } = await import('@elizaos/core');
        const memories = await runtime.getMemories({
          tableName: 'messages',
          roomId: createUniqueUuid(runtime, 'sentiment-analysis'),
          end: Date.now(),
          count: 30,
        });

        const sentiments = memories
          .filter(
            (m): m is Memory & { content: SentimentContent } =>
              m.content.source === 'sentiment-analysis' &&
              !!m.content.metadata &&
              typeof m.content.metadata === 'object' &&
              m.content.metadata !== null &&
              'processed' in m.content.metadata &&
              'occuringTokens' in m.content.metadata &&
              Array.isArray(m.content.metadata.occuringTokens) &&
              m.content.metadata.occuringTokens.length > 1
          )
          .sort((a, b) => {
            const aTime = new Date(a.content.metadata.timeslot).getTime();
            const bTime = new Date(b.content.metadata.timeslot).getTime();
            return bTime - aTime;
          })
          .map((m) => ({
            timeslot: m.content.metadata.timeslot,
            text: m.content.text,
            processed: m.content.metadata.processed,
            occuringTokens: m.content.metadata.occuringTokens || [],
          }));

        const validatedData = SentimentArraySchema.parse(sentiments);
        res.json(validatedData);
      } catch (_error) {
        console.log('error', _error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  },

  // Buy signal
  {
    type: 'POST',
    path: '/signal',
    handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const cachedSignal = await runtime.getCache<any>('BUY_SIGNAL');
        const signal = cachedSignal ? cachedSignal : {};
        res.json(signal?.data || {});
      } catch (_error) {
        console.log('error', _error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  },
];

