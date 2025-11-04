/**
 * Charting Agent E2E Tests
 * 
 * Tests against the REAL Spartan backend for charting endpoints
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

describe('Charting Agent - E2E Tests (Real Backend)', () => {
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

  describe('OHLCV Endpoint', () => {
    it('should get OHLCV data for token', async () => {
      const tokenAddress = 'So11111111111111111111111111111111111111112';
      log('TEST', `Testing GET /api/charting/ohlcv for ${tokenAddress}`);
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/charting/ohlcv?token_address=${tokenAddress}&interval=1h&limit=100`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'OHLCV data received', data);
      expect(data).toBeDefined();
      expect(data.success).toBe(true);
    }, TEST_TIMEOUT);

    it('should support different intervals', async () => {
      const tokenAddress = 'So11111111111111111111111111111111111111112';
      log('TEST', 'Testing OHLCV with 4h interval');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/charting/ohlcv?token_address=${tokenAddress}&interval=4h&limit=50`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', '4h interval OHLCV received', data);
      expect(data.success).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('Technical Indicators Endpoint', () => {
    it('should calculate technical indicators', async () => {
      const tokenAddress = 'So11111111111111111111111111111111111111112';
      log('TEST', `Testing POST /api/charting/indicators for ${tokenAddress}`);
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/charting/indicators`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token_address: tokenAddress,
            indicators: ['rsi', 'macd', 'ema20', 'sma50'],
            interval: '1h'
          })
        }
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Technical indicators received', data);
      expect(data).toBeDefined();
      expect(data.success).toBe(true);
    }, TEST_TIMEOUT);

    it('should calculate Bollinger Bands', async () => {
      const tokenAddress = 'So11111111111111111111111111111111111111112';
      log('TEST', 'Testing Bollinger Bands calculation');
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/charting/indicators`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token_address: tokenAddress,
            indicators: ['bb', 'rsi'],
            interval: '1h'
          })
        }
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Bollinger Bands data received', data);
      expect(data.success).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('Pattern Detection Endpoint', () => {
    it('should detect chart patterns', async () => {
      const tokenAddress = 'So11111111111111111111111111111111111111112';
      log('TEST', `Testing GET /api/charting/patterns for ${tokenAddress}`);
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/charting/patterns?token_address=${tokenAddress}&interval=1h&lookback_periods=200`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Pattern detection data received', data);
      expect(data).toBeDefined();
      expect(data.success).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('Support & Resistance Endpoint', () => {
    it('should calculate support and resistance levels', async () => {
      const tokenAddress = 'So11111111111111111111111111111111111111112';
      log('TEST', `Testing GET /api/charting/support-resistance for ${tokenAddress}`);
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/charting/support-resistance?token_address=${tokenAddress}&interval=1h&sensitivity=medium`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Support/resistance data received', data);
      expect(data).toBeDefined();
      expect(data.success).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('Volume Profile Endpoint', () => {
    it('should get volume profile analysis', async () => {
      const tokenAddress = 'So11111111111111111111111111111111111111112';
      log('TEST', `Testing GET /api/charting/volume-profile for ${tokenAddress}`);
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/charting/volume-profile?token_address=${tokenAddress}&interval=1h&bins=50`
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      log('RESULT', 'Volume profile data received', data);
      expect(data).toBeDefined();
      expect(data.success).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('Full Charting Flow', () => {
    it('should complete comprehensive technical analysis', async () => {
      const tokenAddress = 'So11111111111111111111111111111111111111112';
      log('TEST', 'Starting complete charting analysis flow');
      
      // Get OHLCV data
      const ohlcvResponse = await paymentFetch(
        `${SPARTAN_API_BASE}/api/charting/ohlcv?token_address=${tokenAddress}&interval=1h&limit=500`
      );
      const ohlcvData = await ohlcvResponse.json();
      log('STEP 1', 'Retrieved OHLCV data', ohlcvData);

      // Get technical indicators
      const indicatorsResponse = await paymentFetch(
        `${SPARTAN_API_BASE}/api/charting/indicators`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token_address: tokenAddress,
            indicators: ['rsi', 'macd', 'ema20', 'sma50', 'bb'],
            interval: '1h'
          })
        }
      );
      const indicatorsData = await indicatorsResponse.json();
      log('STEP 2', 'Retrieved technical indicators', indicatorsData);

      // Get patterns
      const patternsResponse = await paymentFetch(
        `${SPARTAN_API_BASE}/api/charting/patterns?token_address=${tokenAddress}&interval=1h`
      );
      const patternsData = await patternsResponse.json();
      log('STEP 3', 'Retrieved patterns', patternsData);

      // Get support/resistance
      const srResponse = await paymentFetch(
        `${SPARTAN_API_BASE}/api/charting/support-resistance?token_address=${tokenAddress}&interval=1h`
      );
      const srData = await srResponse.json();
      log('STEP 4', 'Retrieved support/resistance', srData);

      // Get volume profile
      const volumeResponse = await paymentFetch(
        `${SPARTAN_API_BASE}/api/charting/volume-profile?token_address=${tokenAddress}&interval=1h`
      );
      const volumeData = await volumeResponse.json();
      log('STEP 5', 'Retrieved volume profile', volumeData);

      log('RESULT', 'Complete charting flow successful');
      
      expect(ohlcvResponse.ok).toBe(true);
      expect(indicatorsResponse.ok).toBe(true);
      expect(patternsResponse.ok).toBe(true);
      expect(srResponse.ok).toBe(true);
      expect(volumeResponse.ok).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('x402 Payment Protocol', () => {
    it('should include payment headers in charting requests', async () => {
      log('TEST', 'Verifying x402 payment headers for charting');
      log('INFO', `Wallet address: ${account.address}`);
      
      const response = await paymentFetch(
        `${SPARTAN_API_BASE}/api/charting/ohlcv?token_address=So11111111111111111111111111111111111111112&interval=1h&limit=10`
      );

      expect(response.ok).toBe(true);
      log('RESULT', 'Payment protocol headers successfully included');
    }, TEST_TIMEOUT);
  });
});

