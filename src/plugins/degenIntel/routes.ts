import { type IAgentRuntime, type Route } from '@elizaos/core';
import type { Request, Response } from 'express';

export const routes: Route[] = [
  {
    type: 'GET',
    path: '/api/intel/sentiment',
    handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
      try {
        const sentiments = await runtime.getCache('sentiments');
        res.json({
          success: true,
          data: sentiments || [],
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch sentiment data',
        });
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
        res.json({
          success: true,
          data: {
            buy: buySignals || null,
            sell: sellSignals || null,
          },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch signals',
        });
      }
    },
  },
  {
    type: 'GET',
    path: '/api/intel/trending',
    handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
      try {
        const trendingSolana = await runtime.getCache('tokens_solana');
        const trendingBase = await runtime.getCache('tokens_base');
        const trendingEthereum = await runtime.getCache('tokens_ethereum');

        res.json({
          success: true,
          data: {
            solana: trendingSolana || [],
            base: trendingBase || [],
            ethereum: trendingEthereum || [],
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
        const tweets = await runtime.getCache('tweets');
        res.json({
          success: true,
          data: tweets || [],
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch tweets',
        });
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
        res.json({
          success: true,
          data: portfolioData,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch portfolio data',
        });
      }
    },
  },
  {
    type: 'GET',
    path: '/api/intel/market',
    handler: async (req: Request, res: Response, runtime: IAgentRuntime) => {
      try {
        const marketData = await runtime.getCache('cmc_market_data');
        res.json({
          success: true,
          data: marketData || null,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch market data',
        });
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
