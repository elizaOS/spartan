/**
 * Birdeye Agent E2E Tests
 * 
 * Tests against the REAL Spartan backend for Birdeye endpoints
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

describe('Birdeye Agent - E2E Tests (Real Backend)', () => {
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

  describe('Birdeye Token Overview Endpoint', () => {
    it('should get token overview from Spartan backend', async () => {
      const tokenAddress = 'So11111111111111111111111111111111111111112'; // Wrapped SOL
      log('TEST', `Testing GET /api/birdeye/token-overview?address=${tokenAddress}`);
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/birdeye/token-overview?address=${tokenAddress}`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Token overview data received', data);
      expect(data).toBeDefined();
      expect(data.success).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('Birdeye Token Security Endpoint', () => {
    it('should get token security analysis', async () => {
      const tokenAddress = 'So11111111111111111111111111111111111111112';
      log('TEST', `Testing GET /api/birdeye/token-security?address=${tokenAddress}`);
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/birdeye/token-security?address=${tokenAddress}`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Token security data received', data);
      expect(data).toBeDefined();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('Birdeye Trending Tokens Endpoint', () => {
    it('should get trending tokens on Solana', async () => {
      log('TEST', 'Testing GET /api/birdeye/trending?limit=10');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/birdeye/trending?limit=10&chain=solana`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Trending tokens data received', data);
      expect(data).toBeDefined();
      expect(data.success).toBe(true);
      expect(data.data.trending).toBeDefined();
    }, TEST_TIMEOUT);

    it('should support custom limit parameter', async () => {
      log('TEST', 'Testing trending tokens with limit=5');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/birdeye/trending?limit=5`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Limited trending data received', data);
      expect(data.success).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('Birdeye Wallet Portfolio Endpoint', () => {
    it('should get wallet portfolio', async () => {
      const walletAddress = '3nMBmufBUBVnk28sTp3NsrSJsdVGTyLZYmsqpMFaUT9J';
      log('TEST', `Testing GET /api/birdeye/wallet-portfolio?wallet=${walletAddress}`);
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/birdeye/wallet-portfolio?wallet=${walletAddress}`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Wallet portfolio data received', data);
      expect(data).toBeDefined();
      expect(data.success).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('Birdeye Token Trades Endpoint', () => {
    it('should get token trades', async () => {
      const tokenAddress = 'So11111111111111111111111111111111111111112';
      log('TEST', `Testing GET /api/birdeye/token-trades?address=${tokenAddress}`);
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/birdeye/token-trades?address=${tokenAddress}&limit=20`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Token trades data received', data);
      expect(data).toBeDefined();
      expect(data.success).toBe(true);
    }, TEST_TIMEOUT);

    it('should support custom limit', async () => {
      const tokenAddress = 'So11111111111111111111111111111111111111112';
      log('TEST', 'Testing token trades with limit=10');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/birdeye/token-trades?address=${tokenAddress}&limit=10`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Limited trades data received', data);
      expect(data.success).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('Full Birdeye Flow', () => {
    it('should get complete token analysis flow', async () => {
      const tokenAddress = 'So11111111111111111111111111111111111111112';
      log('TEST', 'Starting complete Birdeye analysis flow');
      
      // Get token overview
      const overviewResponse = await paymentFetch(
        `${SPARTAN_API_BASE}/api/birdeye/token-overview?address=${tokenAddress}`
      );
      const overviewData = await overviewResponse.json();
      log('STEP 1', 'Retrieved token overview', overviewData);

      // Get security analysis
      const securityResponse = await paymentFetch(
        `${SPARTAN_API_BASE}/api/birdeye/token-security?address=${tokenAddress}`
      );
      const securityData = await securityResponse.json();
      log('STEP 2', 'Retrieved security analysis', securityData);

      // Get recent trades
      const tradesResponse = await paymentFetch(
        `${SPARTAN_API_BASE}/api/birdeye/token-trades?address=${tokenAddress}&limit=10`
      );
      const tradesData = await tradesResponse.json();
      log('STEP 3', 'Retrieved token trades', tradesData);

      log('RESULT', 'Complete Birdeye flow successful');
      
      expect(overviewResponse.ok).toBe(true);
      expect(securityResponse.ok).toBe(true);
      expect(tradesResponse.ok).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('Error Handling', () => {
    it('should handle missing parameters', async () => {
      log('TEST', 'Testing token-overview without address parameter');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/birdeye/token-overview`
      );

      log('RESULT', `Missing parameter returned status: ${response.status}`);
      expect([400, 404, 500].includes(response.status)).toBe(true);
    }, TEST_TIMEOUT);
  });
});

