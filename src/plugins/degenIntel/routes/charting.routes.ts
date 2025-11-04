/**
 * Charting API Routes  
 * OHLCV data, technical indicators, pattern detection, support/resistance, and volume profile
 */

import type { Route, IAgentRuntime } from '@elizaos/core';
import { BirdeyeProvider } from '../../analytics/providers/birdeyeProvider';

export const chartingRoutes: Route[] = [
  // OHLCV Candlestick Data
  {
    type: 'GET',
    path: '/api/charting/ohlcv',
    public: true,
    name: 'Get OHLCV Data',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { token_address, interval = '1h', from, to, limit = 500 } = req.query;

        if (!token_address) {
          return res.status(400).json({
            success: false,
            error: 'token_address is required'
          });
        }

        // Initialize Birdeye provider
        let birdeyeProvider: BirdeyeProvider;
        try {
          birdeyeProvider = new BirdeyeProvider(runtime);
        } catch (error) {
          return res.status(503).json({
            success: false,
            error: 'Data service not available'
          });
        }

        // Get OHLCV data from Birdeye
        const historicalData = await birdeyeProvider.getOHLCVData(token_address, 'solana', interval);

        // Format OHLCV data
        const candles = historicalData.map(item => ({
          timestamp: item.timestamp,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: item.volume
        }));

        const ohlcvData = {
          success: true,
          data: {
            token_address,
            interval,
            candles,
            timestamp: new Date().toISOString()
          }
        };

        res.json(ohlcvData);
      } catch (error) {
        console.error('Error in OHLCV data:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  // Technical Indicators (RSI, MACD, Bollinger Bands, etc.)
  {
    type: 'POST',
    path: '/api/charting/indicators',
    public: true,
    name: 'Calculate Technical Indicators',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { token_address, indicators = [], interval = '1h', period } = req.body;

        if (!token_address) {
          return res.status(400).json({
            success: false,
            error: 'token_address is required'
          });
        }

        // Use AnalyticsService.getTokenAnalytics() - same as the action does
        const analyticsService = runtime.getService('ANALYTICS_SERVICE');

        if (!analyticsService) {
          return res.status(503).json({
            success: false,
            error: 'Analytics service not available'
          });
        }

        // Get token analytics with technical indicators (same as the action)
        const request = {
          tokenAddress: token_address,
          chain: 'solana',
          timeframe: interval,
          includeHistorical: true,
          includeHolders: false,
          includeSnipers: false
        };

        const response = await (analyticsService as any).getTokenAnalytics(request);

        if (!response.success || !response.data || !response.data.technicalIndicators) {
          return res.status(500).json({
            success: false,
            error: 'Failed to calculate technical indicators'
          });
        }

        // Return just the technical indicators (matching the expected format)
        res.json({
          success: true,
          data: response.data.technicalIndicators
        });
      } catch (error) {
        console.error('Error calculating indicators:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  // Chart Pattern Detection
  {
    type: 'GET',
    path: '/api/charting/patterns',
    public: true,
    name: 'Detect Chart Patterns',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { token_address, interval = '1h', lookback_periods = 200 } = req.query;

        if (!token_address) {
          return res.status(400).json({
            success: false,
            error: 'token_address is required'
          });
        }

        // Pattern detection logic would go here
        const patterns = {
          success: true,
          data: {
            token_address,
            interval,
            lookback_periods: parseInt(lookback_periods as string),
            patterns: [],
            timestamp: new Date().toISOString()
          }
        };

        res.json(patterns);
      } catch (error) {
        console.error('Error in pattern detection:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  // Support and Resistance Levels
  {
    type: 'GET',
    path: '/api/charting/support-resistance',
    public: true,
    name: 'Calculate Support/Resistance',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { token_address, interval = '1h', sensitivity = 'medium' } = req.query;

        if (!token_address) {
          return res.status(400).json({
            success: false,
            error: 'token_address is required'
          });
        }

        // Support/resistance calculation would go here
        const levels = {
          success: true,
          data: {
            token_address,
            interval,
            sensitivity,
            support_levels: [],
            resistance_levels: [],
            timestamp: new Date().toISOString()
          }
        };

        res.json(levels);
      } catch (error) {
        console.error('Error calculating support/resistance:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  // Volume Profile
  {
    type: 'GET',
    path: '/api/charting/volume-profile',
    public: true,
    name: 'Get Volume Profile',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { token_address, interval = '1h', bins = 50 } = req.query;

        if (!token_address) {
          return res.status(400).json({
            success: false,
            error: 'token_address is required'
          });
        }

        // Volume profile calculation would go here
        const volumeProfile = {
          success: true,
          data: {
            token_address,
            interval,
            bins: parseInt(bins as string),
            volume_by_price: [],
            point_of_control: 0,
            value_area_high: 0,
            value_area_low: 0,
            timestamp: new Date().toISOString()
          }
        };

        res.json(volumeProfile);
      } catch (error) {
        console.error('Error in volume profile:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },
];

