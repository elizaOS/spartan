import { type IAgentRuntime, type Route, createUniqueUuid, logger } from '@elizaos/core';
import type { Request, Response } from 'express';
import { TweetArraySchema, SentimentArraySchema, WalletSchema, BuySignalSchema, type Token } from './schemas';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Define the equivalent of __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// from the package.json, find frontend/dist and host it statically
const frontendDist = path.resolve(__dirname, './');

// Path to the plugin's frontend dist folder
// ASSUMING frontend build output is in 'src/plugins/degenIntel/dist'
const pluginFrontendDist = path.resolve(__dirname, './dist'); // Adjusted path

export const routes: Route[] = [
  // Frontend routes for serving the React app
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
  // Route to serve the plugin's main UI (index.html)
  {
    type: 'GET',
    path: '/ui', // This will be accessed via /api/:agentId/plugins/degen-intel/ui
    public: true, // Or false if it requires auth, but typically UI shells are public
    name: 'DegenIntelUI', // A name for the route, if used by the system
    handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
      const agentId = req.params.agentId; // The core server should populate this
      const indexPath = path.join(pluginFrontendDist, 'index.html');

      if (fs.existsSync(indexPath)) {
        try {
          let htmlContent = await fs.promises.readFile(indexPath, 'utf8');
          // Inject agentId into a global variable or a meta tag
          // Example: injecting as a global JS variable
          const injectionScript = `<script>window.__AGENT_ID__ = "${agentId}";</script>`;
          // Add the script before the closing </head> or </body> tag, or a placeholder
          // A common placeholder could be <!-- AGENT_ID_INJECTION_POINT -->
          if (htmlContent.includes('</body>')) {
            htmlContent = htmlContent.replace('</body>', `${injectionScript}</body>`);
          } else if (htmlContent.includes('</head>')) {
            htmlContent = htmlContent.replace('</head>', `${injectionScript}</head>`);
          } else {
            // Fallback: append if no clear injection point, though less ideal
            htmlContent += injectionScript;
          }
          
          res.setHeader('Content-Type', 'text/html');
          res.send(htmlContent);
        } catch (error) {
          logger.error(`[DegenIntelUI] Error reading/modifying index.html: ${error}`);
          res.status(500).send('Error serving plugin UI.');
        }
      } else {
        res.status(404).send('Plugin UI (index.html) not found. Ensure the plugin frontend is built.');
      }
    },
  },
  // Route to serve static assets for the plugin's UI (JS, CSS, images, etc.)
  {
    type: 'GET',
    path: '/assets/*', // This will be accessed via /api/:agentId/plugins/degen-intel/assets/...
    public: true, // Ensure assets are also public
    handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
      const assetName = req.params[0]; // Gets the content of '*', e.g., 'main.js' or 'styles/app.css'
      if (!assetName || assetName.includes('..')) { // Basic security check
        res.status(400).send('Invalid asset path');
        return;
      }
      const assetPath = path.join(pluginFrontendDist, 'assets', assetName);
      if (fs.existsSync(assetPath)) {
        res.sendFile(assetPath);
      } else {
        // Attempt to serve from root of dist if not in assets (e.g. vite.svg, index.html if not handled by /ui)
        const rootAssetPath = path.join(pluginFrontendDist, assetName);
        if (fs.existsSync(rootAssetPath)) {
          res.sendFile(rootAssetPath);
        } else {
          res.status(404).send('Asset not found');
        }
      }
    },
  },
  // API routes
  {
    type: 'GET',
    path: '/api/:agentId/intel/sentiment',
    handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
      try {
        const sentiments = await runtime.getCache('sentiments');
        console.log("[API /api/intel/sentiment HANDLER] Data from getCache('sentiments'):", JSON.stringify(sentiments, null, 2));
        // Ensure sentiments is an array before parsing. If cache returns null/undefined, default to empty array.
        const sentimentsToParse = Array.isArray(sentiments) ? sentiments : [];
        const validatedData = SentimentArraySchema.parse(sentimentsToParse);
        res.json({ success: true, data: validatedData });
      } catch (error) {
        if (error.name === 'ZodError') { // Check if it's a Zod validation error
          console.error('[API /api/intel/sentiment] Zod validation error:', error.errors);
          res.status(400).json({ success: false, error: 'Sentiment data validation failed', details: error.errors });
        } else {
          console.error('[API /api/intel/sentiment] Server error:', error);
          res.status(500).json({ success: false, error: 'Failed to fetch sentiment data', details: error.message });
        }
      }
    },
  },
  {
    type: 'GET',
    path: '/api/:agentId/intel/signals',
    handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
      try {
        const buySignals = await runtime.getCache('buy_signals');
        const sellSignals = await runtime.getCache('sell_signals');
        // Optional: Validate buy/sell signals if precise schemas exist and are critical
        // For now, assuming structure is as expected or handled by frontend
        res.json({
          success: true,
          data: {
            buy: buySignals ? BuySignalSchema.parse(buySignals) : null,
            sell: sellSignals ? BuySignalSchema.parse(sellSignals) : null,
          },
        });
      } catch (error) {
        if (error.name === 'ZodError') { // Check if it's a Zod validation error
          console.error('[API /api/intel/signals] Zod validation error:', error.errors);
          res.status(400).json({ success: false, error: 'Signal data validation failed', details: error.errors });
        } else {
          res.status(500).json({ success: false, error: 'Failed to fetch signals', details: error.message });
        }
      }
    },
  },
  {
    type: 'GET',
    path: '/api/:agentId/intel/trending',
    handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
      try {
        const trendingSolana = (await runtime.getCache('tokens_solana')) as Token[] | undefined || [];
        const trendingBase = (await runtime.getCache('tokens_base')) as Token[] | undefined || [];
        const trendingEthereum = (await runtime.getCache('tokens_ethereum')) as Token[] | undefined || [];

        res.json({
          success: true,
          data: {
            solana: trendingSolana,
            base: trendingBase,
            ethereum: trendingEthereum,
          },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch trending tokens',
        });
      }
    },
  },
  {
    type: 'GET',
    path: '/api/:agentId/intel/tweets',
    handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
      try {
        // Fetch from memories instead of a direct 'tweets' cache key
        const memories = await runtime.getMemories({
          tableName: 'messages',
          roomId: createUniqueUuid(runtime, 'twitter-feed'), // Consistent with twitter.ts
          end: Date.now(),
          count: 50, // Or a configurable limit
        });

        const tweets = memories
          .filter((m) => m.content.source === 'twitter')
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((m) => {
            const metadata = (m.content as any).metadata || {};
            return {
              _id: m.id,
              id: m.id,
              __v: 0, // Mock version if not available
              createdAt: new Date(m.createdAt).toISOString(),
              updatedAt: new Date((m as any).updatedAt || m.createdAt).toISOString(), // Mock updatedAt
              text: (m.content as any).text || '',
              timestamp: new Date(metadata.timestamp || m.createdAt).toISOString(),
              username: metadata.username || 'unknown',
              likes: metadata.likes || 0,
              retweets: metadata.retweets || 0,
            };
          });

        const validatedData = TweetArraySchema.parse(tweets);
        res.json({ success: true, data: validatedData });
      } catch (error) {
        if (error.name === 'ZodError') {
          console.error('[API /api/intel/tweets] Zod validation error:', error.errors);
          res.status(400).json({ success: false, error: 'Tweet data validation failed', details: error.errors });
        } else {
          res.status(500).json({ success: false, error: 'Failed to fetch tweets', details: error.message });
        }
      }
    },
  },
  {
    type: 'GET',
    path: '/api/:agentId/intel/portfolio',
    handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
      try {
        const portfolio = (await runtime.getCache('portfolio')) as any;
        // Handle the nested structure: { key: 'PORTFOLIO', data: {...} }
        const portfolioData = portfolio?.data || portfolio || null;
        if (portfolioData) {
          const validatedPortfolio = WalletSchema.parse(portfolioData);
          res.json({ success: true, data: validatedPortfolio });
        } else {
          res.json({ success: true, data: null });
        }
      } catch (error) {
        if (error.name === 'ZodError') {
          console.error('[API /api/intel/portfolio] Zod validation error:', error.errors);
          res.status(400).json({ success: false, error: 'Portfolio data validation failed', details: error.errors });
        } else {
          res.status(500).json({ success: false, error: 'Failed to fetch portfolio data', details: error.message });
        }
      }
    },
  },
  {
    type: 'GET',
    path: '/api/:agentId/intel/market',
    handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
      try {
        const marketData = (await runtime.getCache('cmc_market_data')) as Token[] | undefined || [];
        // If marketData is an array of Tokens, it should align with TokenArraySchema
        // const validatedData = TokenArraySchema.parse(marketData);
        // For now, sending as is, assuming frontend can handle it or it's simple enough
        res.json({ success: true, data: marketData }); // Assuming already valid or frontend handles
      } catch (error) {
        // Add specific Zod error handling if schema validation is added here
        // if (error.name === 'ZodError') { ... }
        res.status(500).json({ success: false, error: 'Failed to fetch market data', details: error.message });
      }
    },
  },
  {
    type: 'GET',
    path: '/api/:agentId/intel/summary',
    handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
      try {
        // Fetch all relevant data
        const [sentiments, buySignals, sellSignals, trendingSolana, tweets, portfolio, marketData] =
          await Promise.all([
            runtime.getCache('sentiments'),
            runtime.getCache('buy_signals'),
            runtime.getCache('sell_signals'),
            runtime.getCache('tokens_solana'),
            runtime.getCache('tweets'), // Ensure this uses correct cache key if changed from direct cache to memories
            runtime.getCache('portfolio'),
            runtime.getCache('cmc_market_data'),
          ]);

        // Handle portfolio nested structure
        const portfolioData = (portfolio as any)?.data || portfolio;

        // Calculate summary statistics
        const recentSentiments = ((sentiments as any[]) || []).slice(0, 10);
        const avgSentiment =
          recentSentiments.reduce((acc: number, s: any) => {
            const tokens = s.occuringTokens || [];
            const sentimentSum = tokens.reduce(
              (sum: number, t: any) => sum + (t.sentiment || 0),
              0
            );
            return acc + (tokens.length > 0 ? sentimentSum / tokens.length : 0);
          }, 0) / Math.max(recentSentiments.length, 1);

        res.json({
          success: true,
          data: {
            summary: {
              averageSentiment: avgSentiment,
              totalTweets: ((tweets as any[]) || []).length, // Consider if 'tweets' cache is still primary source
              trendingTokensCount: ((trendingSolana as any[]) || []).length,
              hasActiveBuySignal: !!buySignals,
              hasActiveSellSignal: !!sellSignals,
              portfolioValue: portfolioData?.totalUsd || '0',
            },
            latestSignals: {
              buy: buySignals || null,
              sell: sellSignals || null,
            },
            marketOverview: marketData || null,
            recentActivity: {
              sentiments: recentSentiments,
              tweets: ((tweets as any[]) || []).slice(0, 5), // Consider if 'tweets' cache is still primary source
            },
          },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch intel summary',
        });
      }
    },
  },
];

export default routes;
