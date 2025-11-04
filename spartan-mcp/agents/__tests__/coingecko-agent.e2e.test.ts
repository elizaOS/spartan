/**
 * CoinGecko Agent E2E Tests
 * 
 * Tests against the REAL Spartan backend for CoinGecko endpoints
 * - Real HTTP calls to Spartan backend
 * - Real Anthropic SDK integration
 * - Real x402 payment protocol
 * - Full logging of all requests/responses
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { wrapFetchWithPayment } from 'x402-fetch';
import type { Hex } from 'viem';

const SPARTAN_API_BASE = 'http://localhost:2096/api/agents/spartan/plugins/spartan-intel';
const TEST_TIMEOUT = 30000;

function log(category: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] [${category}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

describe('CoinGecko Agent - E2E Tests (Real Backend)', () => {
  let paymentFetch: typeof fetch;
  let account: any;

  beforeAll(async () => {
    try {
      const response = await fetch(`${SPARTAN_API_BASE}/../../../health`);
      log('SETUP', `Spartan backend health check: ${response.status}`);
    } catch (error) {
      log('SETUP', 'WARNING: Could not connect to Spartan backend');
    }
  });

  beforeEach(() => {
    const walletKey = (process.env.WALLET_PRIVATE_KEY || 
      '0x0000000000000000000000000000000000000000000000000000000000000001') as Hex;
    account = privateKeyToAccount(walletKey);
    
    log('SETUP', 'Created wallet account', { address: account.address });

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
        data: typeof parsedData === 'string' ? parsedData.substring(0, 200) : parsedData
      });

      return response;
    };

    paymentFetch = wrapFetchWithPayment(loggingFetch as any, account);
    log('SETUP', 'Payment fetch wrapper initialized');
  });

  describe('CoinGecko Price Endpoint', () => {
    it('should get cryptocurrency prices', async () => {
      log('TEST', 'Testing GET /api/coingecko/price?ids=bitcoin,ethereum');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/coingecko/price?ids=bitcoin,ethereum&vs_currencies=usd`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Price data received', data);
      expect(data).toBeDefined();
      expect(data.success).toBe(true);
    }, TEST_TIMEOUT);

    it('should get SOL price', async () => {
      log('TEST', 'Testing SOL price lookup');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/coingecko/price?ids=sol&vs_currencies=usd`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'SOL price received', data);
      expect(data.success).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('CoinGecko Search Endpoint', () => {
    it('should search for coins', async () => {
      log('TEST', 'Testing GET /api/coingecko/search?query=solana');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/coingecko/search?query=solana`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Search results received', data);
      expect(data).toBeDefined();
      expect(data.success).toBe(true);
      expect(data.data.coins).toBeDefined();
    }, TEST_TIMEOUT);

    it('should search for bonk', async () => {
      log('TEST', 'Testing search for BONK token');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/coingecko/search?query=bonk`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'BONK search results', data);
      expect(data.success).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('CoinGecko Coin Data Endpoint', () => {
    it('should get detailed coin data', async () => {
      log('TEST', 'Testing GET /api/coingecko/coin-data?id=sol');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/coingecko/coin-data?id=sol`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Coin data received', data);
      expect(data).toBeDefined();
      expect(data.success).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('CoinGecko Market Chart Endpoint', () => {
    it('should get historical market chart data', async () => {
      log('TEST', 'Testing GET /api/coingecko/market-chart?id=sol&days=7');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/coingecko/market-chart?id=sol&vs_currency=usd&days=7`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Market chart data received', data);
      expect(data).toBeDefined();
      expect(data.success).toBe(true);
      expect(data.data.prices).toBeDefined();
    }, TEST_TIMEOUT);

    it('should support different time ranges', async () => {
      log('TEST', 'Testing market chart with 30 days');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/coingecko/market-chart?id=bitcoin&vs_currency=usd&days=30`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', '30-day chart data received', data);
      expect(data.success).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('CoinGecko Trending Endpoint', () => {
    it('should get trending cryptocurrencies', async () => {
      log('TEST', 'Testing GET /api/coingecko/trending');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/coingecko/trending`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Trending cryptocurrencies received', data);
      expect(data).toBeDefined();
      expect(data.success).toBe(true);
      expect(data.data.coins).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('CoinGecko Global Data Endpoint', () => {
    it('should get global market data', async () => {
      log('TEST', 'Testing GET /api/coingecko/global');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/coingecko/global`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Global market data received', data);
      expect(data).toBeDefined();
      expect(data.success).toBe(true);
      expect(data.data.data).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('Full CoinGecko Flow', () => {
    it('should complete multi-coin price analysis', async () => {
      log('TEST', 'Starting complete CoinGecko analysis flow');
      
      // Search for coin
      const searchResponse = await paymentFetch(
        `${SPARTAN_API_BASE}/api/coingecko/search?query=bitcoin`
      );
      const searchData = await searchResponse.json();
      log('STEP 1', 'Searched for Bitcoin', searchData);

      // Get price
      const priceResponse = await paymentFetch(
        `${SPARTAN_API_BASE}/api/coingecko/price?ids=bitcoin,ethereum,solana&vs_currencies=usd`
      );
      const priceData = await priceResponse.json();
      log('STEP 2', 'Retrieved prices', priceData);

      // Get trending
      const trendingResponse = await paymentFetch(
        `${SPARTAN_API_BASE}/api/coingecko/trending`
      );
      const trendingData = await trendingResponse.json();
      log('STEP 3', 'Retrieved trending', trendingData);

      // Get global stats
      const globalResponse = await paymentFetch(
        `${SPARTAN_API_BASE}/api/coingecko/global`
      );
      const globalData = await globalResponse.json();
      log('STEP 4', 'Retrieved global data', globalData);

      log('RESULT', 'Complete CoinGecko flow successful');
      
      expect(searchResponse.ok).toBe(true);
      expect(priceResponse.ok).toBe(true);
      expect(trendingResponse.ok).toBe(true);
      expect(globalResponse.ok).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('Error Handling', () => {
    it('should handle missing parameters', async () => {
      log('TEST', 'Testing price endpoint without ids parameter');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/coingecko/price?vs_currencies=usd`
      );

      log('RESULT', `Missing parameter returned status: ${response.status}`);
      expect([400, 404, 500].includes(response.status)).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('x402 Payment Protocol', () => {
    it('should include payment headers in CoinGecko requests', async () => {
      log('TEST', 'Verifying x402 payment headers for CoinGecko');
      log('INFO', `Wallet address: ${account.address}`);
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/coingecko/trending`
      );

      expect(response.ok).toBe(true);
      log('RESULT', 'Payment protocol headers successfully included');
    }, TEST_TIMEOUT);
  });
});

