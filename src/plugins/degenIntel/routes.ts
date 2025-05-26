import { type IAgentRuntime, type Route, createUniqueUuid } from '@elizaos/core';
import type { Request, Response } from 'express';
import { TweetArraySchema, SentimentArraySchema, WalletSchema, BuySignalSchema, type Token } from './schemas';

export const routes: Route[] = [
  {
    type: 'GET',
    path: '/api/intel/sentiment',
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
    path: '/api/intel/signals',
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
    path: '/api/intel/trending',
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
    path: '/api/intel/tweets',
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
    path: '/api/intel/portfolio',
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
    path: '/api/intel/market',
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
    path: '/api/intel/summary',
    handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
      try {
        // Fetch all relevant data
        const [sentiments, buySignals, sellSignals, trendingSolana, tweets, portfolio, marketData] =
          await Promise.all([
            runtime.getCache('sentiments'),
            runtime.getCache('buy_signals'),
            runtime.getCache('sell_signals'),
            runtime.getCache('tokens_solana'),
            runtime.getCache('tweets'),
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
              totalTweets: ((tweets as any[]) || []).length,
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
              tweets: ((tweets as any[]) || []).slice(0, 5),
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
