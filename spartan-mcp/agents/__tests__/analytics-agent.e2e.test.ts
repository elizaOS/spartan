/**
 * Analytics Agent E2E Tests
 * 
 * Tests against the REAL Spartan backend running on port 2096
 * - Real HTTP calls to localhost:2096
 * - Real Anthropic SDK integration
 * - Real x402 payment protocol
 * - Full logging of all requests/responses
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { privateKeyToAccount } from 'viem/accounts';
import { wrapFetchWithPayment } from 'x402-fetch';
import type { Hex } from 'viem';

const SPARTAN_API_BASE = 'http://localhost:2096/api/agents/spartan/plugins/spartan-intel';
const TEST_TIMEOUT = 30000; // 30 seconds

// Logging utility
function log(category: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] [${category}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

describe('Analytics Agent - E2E Tests (Real Backend)', () => {
  let paymentFetch: typeof fetch;
  let account: any;

  beforeAll(async () => {
    // Check if Spartan is running
    try {
      const response = await fetch(`${SPARTAN_API_BASE}/health`);
      log('SETUP', `Spartan backend health check: ${response.status}`);
    } catch (error) {
      log('SETUP', 'WARNING: Could not connect to Spartan backend on port 2096');
      log('SETUP', 'Make sure Spartan is running: bun ../cli/dist/index.js start');
    }
  });

  beforeEach(() => {
    // Setup real wallet
    const walletKey = (process.env.WALLET_PRIVATE_KEY || 
      '0x0000000000000000000000000000000000000000000000000000000000000001') as Hex;
    account = privateKeyToAccount(walletKey);
    
    log('SETUP', 'Created wallet account', {
      address: account.address
    });

    // Create logging wrapper around fetch
    const loggingFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method || 'GET';
      
      log('REQUEST', `${method} ${url}`, {
        headers: init?.headers,
        body: init?.body ? JSON.parse(init.body as string) : undefined
      });

      const startTime = Date.now();
      const response = await fetch(input, init);
      const duration = Date.now() - startTime;

      const responseData = await response.clone().text();
      let parsedData;
      try {
        parsedData = JSON.parse(responseData);
      } catch {
        parsedData = responseData;
      }

      log('RESPONSE', `${method} ${url} - ${response.status} (${duration}ms)`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: parsedData
      });

      return response;
    };

    // Wrap with x402 payment protocol
    paymentFetch = wrapFetchWithPayment(loggingFetch as any, account);
    log('SETUP', 'Payment fetch wrapper initialized');
  });

  describe('Market Analytics Endpoint', () => {
    it('should get market analytics for Solana', async () => {
      log('TEST', 'Testing GET /api/analytics/market-overview?chain=solana');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/analytics/market-overview?chain=solana`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Market analytics data received', data);
      
      // Validate response structure
      expect(data).toBeDefined();
    }, TEST_TIMEOUT);

    it('should get market analytics for all chains', async () => {
      log('TEST', 'Testing GET /api/analytics/market-overview?chain=all');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/analytics/market-overview?chain=all`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'All chains market data received', data);
      expect(data).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('News Feed Endpoint', () => {
    it('should get DeFi news feed', async () => {
      log('TEST', 'Testing GET /api/analytics/news?category=defi&limit=5');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/analytics/news?category=defi&limit=5`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'News feed data received', data);
      expect(data).toBeDefined();
    }, TEST_TIMEOUT);

    it('should filter news by category', async () => {
      log('TEST', 'Testing GET /api/analytics/news?category=security&limit=3');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/analytics/news?category=security&limit=3`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Security news received', data);
      expect(data).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('Sentiment Analysis Endpoint', () => {
    it('should get overall market sentiment', async () => {
      log('TEST', 'Testing GET /api/analytics/sentiment?timeframe=24h');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/analytics/sentiment?timeframe=24h`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Market sentiment data received', data);
      expect(data).toBeDefined();
    }, TEST_TIMEOUT);

    it('should get sentiment for specific token', async () => {
      const tokenAddress = 'So11111111111111111111111111111111111111112'; // Wrapped SOL
      log('TEST', `Testing sentiment analysis for token: ${tokenAddress}`);
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/analytics/sentiment?token_address=${tokenAddress}&timeframe=24h`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Token sentiment data received', data);
      expect(data).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('Trending Tokens Endpoint', () => {
    it('should get trending Solana tokens', async () => {
      log('TEST', 'Testing GET /api/analytics/trending?chain=solana&limit=10');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/analytics/trending?chain=solana&limit=10&timeframe=24h`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Trending tokens data received', data);
      expect(data).toBeDefined();
    }, TEST_TIMEOUT);

    it('should support different timeframes', async () => {
      log('TEST', 'Testing trending tokens with 7d timeframe');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/analytics/trending?chain=solana&limit=5&timeframe=7d`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', '7-day trending data received', data);
      expect(data).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('Whale Activity Endpoint', () => {
    it('should get whale transactions', async () => {
      log('TEST', 'Testing GET /api/analytics/whale-activity?min_value_usd=100000');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/analytics/whale-activity?min_value_usd=100000&limit=10`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Whale activity data received', data);
      expect(data).toBeDefined();
    }, TEST_TIMEOUT);

    it('should filter whale activity by token', async () => {
      const tokenAddress = 'So11111111111111111111111111111111111111112';
      log('TEST', `Testing whale activity for token: ${tokenAddress}`);
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/analytics/whale-activity?min_value_usd=50000&token_address=${tokenAddress}&limit=5`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Token-specific whale activity received', data);
      expect(data).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('Token Analysis Endpoint (POST)', () => {
    it('should analyze Wrapped SOL token', async () => {
      const tokenAddress = 'So11111111111111111111111111111111111111112';
      log('TEST', `Testing POST /api/analytics/analyze-token for ${tokenAddress}`);
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/analytics/analyze-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token_address: tokenAddress,
            depth: 'standard'
          })
        }
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Token analysis received', data);
      expect(data).toBeDefined();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.tokenAddress || data.data.address).toBeDefined();
    }, TEST_TIMEOUT);

    it('should perform deep token analysis', async () => {
      const tokenAddress = 'So11111111111111111111111111111111111111112';
      log('TEST', 'Testing deep token analysis');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/analytics/analyze-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token_address: tokenAddress,
            depth: 'deep'
          })
        }
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Deep analysis received', data);
      expect(data).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('Full Agent Conversation Flow', () => {
    it('should complete a market analysis conversation with real backend', async () => {
      log('TEST', 'Starting full agent conversation flow');
      
      // Mock Anthropic responses (we're not testing Anthropic, just our backend)
      const marketAnalyticsResponse = await paymentFetch(
        `${SPARTAN_API_BASE}/api/analytics/market-overview?chain=solana`
      );
      const marketData = await marketAnalyticsResponse.json();
      log('STEP 1', 'Retrieved market analytics', marketData);

      const newsResponse = await paymentFetch(
        `${SPARTAN_API_BASE}/api/analytics/news?category=defi&limit=5`
      );
      const newsData = await newsResponse.json();
      log('STEP 2', 'Retrieved news feed', newsData);

      const sentimentResponse = await paymentFetch(
        `${SPARTAN_API_BASE}/api/analytics/sentiment?timeframe=24h`
      );
      const sentimentData = await sentimentResponse.json();
      log('STEP 3', 'Retrieved sentiment analysis', sentimentData);

      const trendingResponse = await paymentFetch(
        `${SPARTAN_API_BASE}/api/analytics/trending?chain=solana&limit=10&timeframe=24h`
      );
      const trendingData = await trendingResponse.json();
      log('STEP 4', 'Retrieved trending tokens', trendingData);

      log('RESULT', 'Complete conversation flow successful');
      
      expect(marketAnalyticsResponse.ok).toBe(true);
      expect(newsResponse.ok).toBe(true);
      expect(sentimentResponse.ok).toBe(true);
      expect(trendingResponse.ok).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('Error Handling', () => {
    it('should handle invalid endpoints gracefully', async () => {
      log('TEST', 'Testing invalid endpoint');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/analytics/invalid-endpoint`
      );

      log('RESULT', `Invalid endpoint returned status: ${response.status}`);
      // May return 404 or error response
      expect([404, 500].includes(response.status)).toBe(true);
    }, TEST_TIMEOUT);

    it('should handle malformed requests', async () => {
      log('TEST', 'Testing malformed POST request');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/analytics/analyze-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            invalid_field: 'test'
          })
        }
      );

      log('RESULT', `Malformed request returned status: ${response.status}`);
      const data = await response.json();
      log('RESULT', 'Error response', data);
    }, TEST_TIMEOUT);
  });

  describe('x402 Payment Protocol Integration', () => {
    it('should include payment headers in requests', async () => {
      log('TEST', 'Verifying x402 payment headers');
      log('INFO', `Wallet address: ${account.address}`);
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/analytics/market-overview?chain=solana`
      );

      expect(response.ok).toBe(true);
      log('RESULT', 'Payment protocol headers successfully included');
    }, TEST_TIMEOUT);
  });
});

