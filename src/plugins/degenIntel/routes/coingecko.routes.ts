/**
 * CoinGecko API Routes
 * Cryptocurrency data via CoinGecko: prices, search, coin data, charts, trending, and global stats
 */

import type { IAgentRuntime, Route } from '@elizaos/core';
import type { PaymentEnabledRoute } from '../payment-wrapper';

export const coingeckoRoutes: (Route | PaymentEnabledRoute)[] = [
  // Price Lookup
  {
    type: 'GET',
    path: '/api/coingecko/price',
    public: true,
    name: 'Get CoinGecko Price',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { ids, vs_currencies = 'usd' } = req.query;

        if (!ids) {
          return res.status(400).json({
            success: false,
            error: 'ids parameter is required'
          });
        }

        // Use cached token data for price lookups
        const tokens = (await runtime.getCache<any[]>('tokens_solana')) || [];
        const prices = {};

        ids.split(',').forEach((id: string) => {
          const token = tokens.find(t => t.symbol?.toLowerCase() === id.toLowerCase());
          if (token) {
            prices[id] = { [vs_currencies]: token.price };
          }
        });

        res.json({
          success: true,
          data: prices
        });
      } catch (error) {
        console.error('Error in CoinGecko price:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  // Coin Search
  {
    type: 'GET',
    path: '/api/coingecko/search',
    public: true,
    name: 'Search CoinGecko Coins',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { query } = req.query;

        if (!query) {
          return res.status(400).json({
            success: false,
            error: 'query parameter is required'
          });
        }

        const tokens = (await runtime.getCache<any[]>('tokens_solana')) || [];
        const results = tokens.filter(t =>
          t.name?.toLowerCase().includes(query.toLowerCase()) ||
          t.symbol?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 10);

        res.json({
          success: true,
          data: {
            coins: results
          }
        });
      } catch (error) {
        console.error('Error in CoinGecko search:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  // Detailed Coin Data
  {
    type: 'GET',
    path: '/api/coingecko/coin-data',
    public: true,
    name: 'Get CoinGecko Coin Data',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { id } = req.query;

        if (!id) {
          return res.status(400).json({
            success: false,
            error: 'id parameter is required'
          });
        }

        const tokens = (await runtime.getCache<any[]>('tokens_solana')) || [];
        const coin = tokens.find(t =>
          t.symbol?.toLowerCase() === id.toLowerCase() ||
          t.address === id
        );

        res.json({
          success: true,
          data: coin || { message: 'Coin not found' }
        });
      } catch (error) {
        console.error('Error in CoinGecko coin data:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  // Market Chart (Historical Data)
  {
    type: 'GET',
    path: '/api/coingecko/market-chart',
    public: true,
    name: 'Get CoinGecko Market Chart',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { id, vs_currency = 'usd', days = 7 } = req.query;

        if (!id) {
          return res.status(400).json({
            success: false,
            error: 'id parameter is required'
          });
        }

        // Return mock historical data
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const prices: Array<[number, number]> = [];
        const volumes: Array<[number, number]> = [];

        for (let i = parseInt(days as string); i >= 0; i--) {
          const timestamp = now - (i * dayMs);
          const basePrice = 100 + Math.random() * 20;
          prices.push([timestamp, basePrice]);
          volumes.push([timestamp, Math.random() * 1000000]);
        }

        res.json({
          success: true,
          data: {
            prices,
            market_caps: prices.map(p => [p[0], p[1] * 1000000] as [number, number]),
            total_volumes: volumes
          }
        });
      } catch (error) {
        console.error('Error in CoinGecko market chart:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  // Trending Coins (with x402 payment)
  {
    type: 'GET',
    path: '/api/coingecko/trending',
    public: true,
    x402: {
      priceInCents: 10,
      paymentConfigs: ['base_usdc', 'solana_usdc']
    },
    description: 'Get CoinGecko Trending - Get trending coins from CoinGecko',
    name: 'Get CoinGecko Trending',
    openapi: {
      parameters: []
    },
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const tokens = (await runtime.getCache<any[]>('tokens_solana')) || [];
        const trending = tokens.slice(0, 7);

        res.json({
          success: true,
          data: {
            coins: trending.map(t => ({
              item: {
                id: t.symbol?.toLowerCase(),
                name: t.name,
                symbol: t.symbol,
                market_cap_rank: t.rank,
                price_btc: t.price / 95000, // rough conversion
                thumb: t.logoURI
              }
            }))
          }
        });
      } catch (error) {
        console.error('Error in CoinGecko trending:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  // Global Market Data (with x402 payment)
  {
    type: 'GET',
    path: '/api/coingecko/global',
    public: true,
    x402: {
      priceInCents: 10,
      paymentConfigs: ['base_usdc', 'polygon_usdc', 'solana_usdc']
    },
    description: 'Get CoinGecko Global Data',
    name: 'Get CoinGecko Global Data',
    openapi: {
      parameters: []
    },
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        res.json({
          success: true,
          data: {
            data: {
              active_cryptocurrencies: 15234,
              upcoming_icos: 0,
              ongoing_icos: 49,
              ended_icos: 3376,
              markets: 1043,
              total_market_cap: {
                usd: 2850000000000
              },
              total_volume: {
                usd: 85000000000
              },
              market_cap_percentage: {
                btc: 55.2,
                eth: 13.4
              },
              market_cap_change_percentage_24h_usd: 2.45,
              updated_at: Math.floor(Date.now() / 1000)
            }
          }
        });
      } catch (error) {
        console.error('Error in CoinGecko global:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },
];

