/**
 * Analytics API Routes
 * Market analytics, sentiment analysis, trending tokens, whale activity, and token analysis
 */

import type { IAgentRuntime, Memory, Route } from '@elizaos/core';
import type { PaymentEnabledRoute } from '../payment-wrapper';
import type { ValidationResult } from '../payment-wrapper';
import type { IToken } from '../types';
import type { TransactionHistory } from '../tasks/birdeye';
import { validateRequiredQueryParams } from '../route-validators';

export const analyticsRoutes: (Route | PaymentEnabledRoute)[] = [
  // Market Overview
  {
    type: 'GET',
    path: '/api/analytics/market-overview',
    public: true,
    name: 'Get Market Analytics',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { chain = 'solana' } = req.query;
        const analyticsService = runtime.getService('ANALYTICS_SERVICE');

        if (!analyticsService) {
          return res.status(503).json({
            success: false,
            error: 'Analytics service not available'
          });
        }

        const result = await (analyticsService as any).getMarketAnalytics({ chain });
        res.json(result);
      } catch (error) {
        console.error('Error in market analytics:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  // DeFi News Feed
  {
    type: 'GET',
    path: '/api/analytics/news',
    public: true,
    name: 'Get DeFi News',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { category = 'defi', limit = 10, since } = req.query;

        // For now, return mock news data until news service is implemented
        const news = {
          success: true,
          data: {
            category,
            articles: [
              {
                title: 'DeFi Market Overview',
                source: 'Spartan Analytics',
                url: '#',
                publishedAt: new Date().toISOString(),
                summary: 'Market analysis and trends'
              }
            ]
          }
        };

        res.json(news);
      } catch (error) {
        console.error('Error in news feed:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  // Sentiment Analysis
  {
    type: 'GET',
    path: '/api/analytics/sentiment',
    public: true,
    name: 'Get Sentiment Analysis',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { token_address, timeframe = '24h' } = req.query;
        const { createUniqueUuid } = await import('@elizaos/core');

        const sentimentMemories = await runtime.getMemories({
          tableName: 'messages',
          roomId: createUniqueUuid(runtime, 'sentiment-analysis'),
          end: Date.now(),
          count: 30,
        });

        const sentiments = sentimentMemories
          .filter((m) => m.content.source === 'sentiment-analysis')
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
          .slice(0, 1);

        const result = {
          success: true,
          data: {
            timeframe,
            token_address: token_address || 'overall',
            sentiment: sentiments.length > 0 ? sentiments[0].content : { bullish: 0.5, bearish: 0.3, neutral: 0.2 },
            timestamp: new Date().toISOString()
          }
        };

        res.json(result);
      } catch (error) {
        console.error('Error in sentiment analysis:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  // Trending Tokens (with x402 payment)
  {
    type: 'GET',
    path: '/api/analytics/trending',
    public: true,
    x402: {
      priceInCents: 10,
      paymentConfigs: ['base_usdc', 'solana_usdc']
    },
    description: 'Get Trending Tokens - Get currently trending tokens with timeframe and chain filters',
    name: 'Get Trending Tokens',
    openapi: {
      parameters: [
        {
          name: 'timeframe',
          in: 'query',
          required: false,
          description: 'Time period for trending analysis',
          schema: {
            type: 'string',
            enum: ['1h', '6h', '24h', '7d', '30d']
          }
        },
        {
          name: 'chain',
          in: 'query',
          required: false,
          description: 'Blockchain network to query',
          schema: {
            type: 'string',
            enum: ['solana', 'ethereum', 'base', 'polygon']
          }
        },
        {
          name: 'limit',
          in: 'query',
          required: false,
          description: 'Maximum number of tokens to return',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100
          }
        }
      ]
    },
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { timeframe = '24h', chain = 'solana', limit = 20 } = req.query;

        const cachedTokens = await runtime.getCache<IToken[]>('tokens_solana');
        const tokens: IToken[] = cachedTokens ? cachedTokens : [];
        const sortedTokens = tokens
          .sort((a, b) => (a.rank || 0) - (b.rank || 0))
          .slice(0, parseInt(limit as string));

        res.json({
          success: true,
          data: {
            timeframe,
            chain,
            tokens: sortedTokens
          }
        });
      } catch (error) {
        console.error('Error in trending tokens:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  // Whale Activity
  {
    type: 'GET',
    path: '/api/analytics/whale-activity',
    public: true,
    name: 'Get Whale Activity',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { min_value_usd = 100000, token_address, limit = 20 } = req.query;

        const cachedTxs = await runtime.getCache<TransactionHistory[]>('transaction_history');
        const transactions: TransactionHistory[] = cachedTxs ? cachedTxs : [];

        const whaleTransactions = transactions
          .filter((tx) => {
            // Filter by minimum value if available in transaction data
            return true; // Simplified for now
          })
          .sort((a, b) => new Date(b.blockTime).getTime() - new Date(a.blockTime).getTime())
          .slice(0, parseInt(limit as string));

        res.json({
          success: true,
          data: {
            min_value_usd: parseInt(min_value_usd as string),
            token_address: token_address || 'all',
            transactions: whaleTransactions
          }
        });
      } catch (error) {
        console.error('Error in whale activity:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  // Token Analysis (POST, with x402 payment)
  {
    type: 'POST',
    path: '/api/analytics/analyze-token',
    public: true,
    x402: {
      priceInCents: 10,
      paymentConfigs: ['base_usdc', 'solana_usdc']
    },
    description: 'Analyze Token - Get comprehensive token analysis including price, volume, holders, snipers, and CoinGecko market data',
    name: 'Analyze Token',
    openapi: {
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token_address'],
              properties: {
                token_address: {
                  type: 'string',
                  description: 'Token contract address or mint address to analyze'
                },
                depth: {
                  type: 'string',
                  enum: ['quick', 'standard', 'deep'],
                  description: 'Analysis depth: quick (basic), standard (default), or deep (comprehensive with historical data)'
                }
              }
            }
          }
        }
      }
    },
    validator: (req): ValidationResult => {
      const { token_address } = req.body || {};

      if (!token_address) {
        return {
          valid: false,
          error: {
            status: 400,
            message: 'token_address is required'
          }
        };
      }

      return { valid: true };
    },
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { token_address, depth = 'standard' } = req.body;

        const analyticsService = runtime.getService('ANALYTICS_SERVICE');

        if (!analyticsService) {
          return res.status(503).json({
            success: false,
            error: 'Analytics service not available'
          });
        }

        const result = await (analyticsService as any).getTokenAnalytics({
          tokenAddress: token_address,
          chain: 'solana',
          timeframe: '1d',
          includeHistorical: depth === 'deep',
          includeHolders: depth !== 'quick',
          includeSnipers: depth === 'deep'
        });

        res.json(result);
      } catch (error) {
        console.error('Error in token analysis:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  // Token Analysis (GET, with x402 payment)
  {
    type: 'GET',
    path: '/api/analytics/analyze-token',
    public: true,
    x402: {
      priceInCents: 10,
      paymentConfigs: ['base_usdc', 'solana_usdc']
    },
    description: 'Analyze Token - Get comprehensive token analysis including price, volume, holders, snipers, and CoinGecko market data',
    name: 'Analyze Token',
    openapi: {
      parameters: [
        {
          name: 'token_address',
          in: 'query',
          required: true,
          description: 'Token contract address or mint address to analyze',
          schema: {
            type: 'string'
          }
        },
        {
          name: 'depth',
          in: 'query',
          required: false,
          description: 'Analysis depth: quick, standard (default), or deep',
          schema: {
            type: 'string',
            enum: ['quick', 'standard', 'deep']
          }
        }
      ]
    },
    validator: (req): ValidationResult => {
      return validateRequiredQueryParams(req, ['token_address']);
    },
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { token_address, depth = 'standard' } = req.query;

        const analyticsService = runtime.getService('ANALYTICS_SERVICE');

        if (!analyticsService) {
          return res.status(503).json({
            success: false,
            error: 'Analytics service not available'
          });
        }

        const result = await (analyticsService as any).getTokenAnalytics({
          tokenAddress: token_address,
          chain: 'solana',
          timeframe: '1d',
          includeHistorical: depth === 'deep',
          includeHolders: depth !== 'quick',
          includeSnipers: depth === 'deep'
        });

        res.json(result);
      } catch (error) {
        console.error('Error in token analysis:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },
];

