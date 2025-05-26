// TODO: Replace with cache adapter

import { type IAgentRuntime, type Memory, type Route, createUniqueUuid } from '@elizaos/core';
import * as core from '@elizaos/core';
import { logger } from '@elizaos/core';

import { SentimentArraySchema, TweetArraySchema } from './schemas';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Portfolio, TransactionHistory } from './tasks/birdeye';

// Define SentimentContent type locally
interface SentimentContent {
  source: string;
  text?: string;
  metadata: {
    timeslot: string;
    processed: boolean;
    occuringTokens: Array<{
      token: string;
      sentiment: number;
      reason: string;
    }>;
  };
}
import type { IToken } from './types';

// Define the equivalent of __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// from the package.json, find frontend/dist and host it statically
const frontendDist = path.resolve(__dirname, './');

/**
 * Definition of routes with type, path, and handler for each route.
 * Routes include fetching trending tokens, wallet information, tweets, sentiment analysis, and signals.
 */

export const routes: Route[] = [
  {
    type: 'GET',
    path: '/degen-intel',
    public: true,
    name: 'Intel',
    handler: async (_req: any, res: any) => {
      const route = _req.url;
      res.sendFile(path.resolve(frontendDist, 'index.html'));
    },
  },
  {
    type: 'GET',
    path: '/degen-intel/assets/*',
    handler: async (req: any, res: any) => {
      const assetPath = `/dist/assets/${req.path.split('/assets/')[1]}`;
      console.log('assetPath', assetPath);
      const cwd = process.cwd();
      const filePath = cwd + path.resolve(cwd, assetPath);
      if (fs.existsSync(path.resolve(filePath))) {
        res.sendFile(filePath);
      } else {
        res.status(404).send('File not found');
      }
    },
  },
  {
    type: 'POST',
    path: '/trending',
    handler: async (_req: any, res: any, runtime) => {
      try {
        const cachedTokens = await runtime.getCache<IToken[]>('tokens_solana');
        const tokens: IToken[] = cachedTokens ? cachedTokens : [];
        const sortedTokens = tokens.sort((a, b) => (a.rank || 0) - (b.rank || 0));
        res.json(sortedTokens);
      } catch (_error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  },
  {
    type: 'POST',
    path: '/wallet',
    handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
      try {
        // Get transaction history
        const cachedTxs = await runtime.getCache<TransactionHistory[]>('transaction_history');
        const transactions: TransactionHistory[] = cachedTxs ? cachedTxs : [];
        const history = transactions
          .filter((tx) => tx.data.mainAction === 'received')
          .sort((a, b) => new Date(b.blockTime).getTime() - new Date(a.blockTime).getTime())
          .slice(0, 100);

        // Get portfolio
        const cachedPortfolio = await runtime.getCache<Portfolio>('portfolio');
        const portfolio: Portfolio = cachedPortfolio
          ? cachedPortfolio
          : { key: 'PORTFOLIO', data: null };

        res.json({ history, portfolio: portfolio.data });
      } catch (_error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  },
  {
    type: 'GET',
    path: '/tweets',
    handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const memories = await runtime.getMemories({
          tableName: 'messages',
          roomId: core.createUniqueUuid(runtime, 'twitter-feed'),
          end: Date.now(),
          count: 50,
        });

        const tweets = memories
          .filter((m) => m.content.source === 'twitter')
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((m) => {
            const tweetContent = m.content as any; // Cast for easier access
            return {
              // Required by TweetSchema
              _id: m.id || 'mock_id', // Provide a mock or ensure m.id exists
              id: m.id || 'mock_id',    // Provide a mock or ensure m.id exists
              __v: 0, // Mock version
              createdAt: new Date(m.createdAt).toISOString(),
              updatedAt: new Date(m.createdAt).toISOString(), // Mock updatedAt
              text: tweetContent.text,
              timestamp: new Date(m.createdAt).toISOString(), // Map from memory's createdAt
              // Fields from m.content.tweet (flattened)
              username: tweetContent.tweet?.username || 'unknown',
              likes: tweetContent.tweet?.likes || 0,
              retweets: tweetContent.tweet?.retweets || 0,
              // Add any other fields required by TweetSchema, possibly with defaults
            };
          });

        const validatedData = TweetArraySchema.parse(tweets);
        res.json(validatedData);
      } catch (_error) {
        logger.error('Error in /tweets handler:', _error); // Log the actual error
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  },
  {
    type: 'GET',
    path: '/sentiment',
    handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const memories = await runtime.getMemories({
          tableName: 'messages',
          roomId: core.createUniqueUuid(runtime, 'sentiment-analysis'),
          end: Date.now(),
          count: 30, 
        });

        logger.debug(`[GET /sentiment] Fetched ${memories.length} raw memories for room ID: ${core.createUniqueUuid(runtime, 'sentiment-analysis')}`);

        const sentiments = memories
          .filter((m): m is Memory & { content: SentimentContent } => {
            const isSentiment = m.content.source === 'sentiment-analysis';
            if (!isSentiment) return false;
            const metadata = (m.content as any).metadata;
            if (!metadata || typeof metadata !== 'object') {
              logger.warn(`[GET /sentiment] Memory ${m.id} is sentiment but missing or invalid metadata.`);
              return false;
            }
            // Ensure essential fields for mapping exist, even if an empty array for occuringTokens
            return typeof metadata.timeslot === 'string' && typeof metadata.processed === 'boolean';
          })
          .map((m) => {
            const content = m.content as SentimentContent; // Now correctly typed after filter
            const metadata = content.metadata; // metadata is guaranteed by the filter
            
            const mappedSentiment = {
              // Fields from SentimentContent / metadata
              timeslot: metadata.timeslot,
              text: content.text || '',
              processed: metadata.processed,
              occuringTokens: metadata.occuringTokens || [], // Default to empty array if undefined
              
              // Fields required by SentimentSchema (from schemas.ts) that might not be on SentimentContent
              // createdAt and updatedAt are part of the Zod schema, so they must be included.
              // Memories should have `createdAt`. `updatedAt` might be the same or from DB.
              createdAt: new Date(m.createdAt).toISOString(),
              updatedAt: new Date((m as any).updatedAt || m.createdAt).toISOString(), // Use memory's updatedAt or fallback to createdAt
              // __v is not in SentimentContent, but might be in some DB schemas; not in our SentimentSchema.
            };
            // logger.debug(`[GET /sentiment] Mapped memory ${m.id} to sentiment: ${JSON.stringify(mappedSentiment)}`);
            return mappedSentiment;
          })
          // Apply the specific business logic filter for this endpoint *after* ensuring objects are well-formed
          .filter(s => Array.isArray(s.occuringTokens) && s.occuringTokens.length > 1)
          .sort((a, b) => {
            // Sort by timeslot descending
            const aTime = new Date(a.timeslot).getTime();
            const bTime = new Date(b.timeslot).getTime();
            return bTime - aTime;
          });

        logger.debug(`[GET /sentiment] Filtered and sorted ${sentiments.length} sentiments to return.`);

        // This parse step implies that the `sentiments` array must match `SentimentArraySchema`
        const validatedData = SentimentArraySchema.parse(sentiments);
        logger.debug('[GET /sentiment] Data validated successfully by SentimentArraySchema.');
        res.json(validatedData);
      } catch (_error) {
        logger.error('[GET /sentiment] Error in handler:', _error.message, _error.stack, _error.errors); // Log Zod errors too
        res.status(500).json({ error: 'Internal server error', details: _error.message });
      }
    },
  },
  {
    type: 'POST',
    path: '/signal',
    handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const cachedSignal = await runtime.getCache<any>('BUY_SIGNAL');
        const signal = cachedSignal ? cachedSignal : {};
        res.json(signal?.data || {});
      } catch (_error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  },
];

// Import the new routes
import { routes as apiRoutes } from './routes';

// Combine the existing frontend routes with the new API routes
export default [...routes, ...apiRoutes];
