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
];

// Import the new routes
import { routes as apiRoutes } from './routes';

// Combine the existing frontend routes with the new API routes
export default [...routes, ...apiRoutes];
