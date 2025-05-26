import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { IAgentRuntime, TestCase as CoreTestCase, Character } from '@elizaos/core';
import { JupiterService } from '../src/services/srv_jupiter';
import { Connection } from '@solana/web3.js';
import type { QuoteResponse, SwapResponse } from '@jup-ag/api';

// Define a more specific type for tests from SpartanTestSuite if available, or use a generic one
interface SpartanTest extends CoreTestCase { // Or use 'any' if CoreTestCase is not suitable
  name: string;
  fn: (runtime: IAgentRuntime) => Promise<any>; // Assuming fn returns a Promise
}

// Constants for Jupiter Plugin Tests
const TEST_TIMEOUT = 300000; // Copied from plugins.test.ts
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOL_MINT  = 'So11111111111111111111111111111111111111112';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

// Stub for defaultCharacter and agentRuntimes, needed by Jupiter tests
const defaultCharacter: Character = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'DefaultCharacter',
  plugins: ['@elizaos/plugin-jupiter'], // Ensure Jupiter plugin is listed if service relies on it
  settings: {},
  bio: 'Default Character',
};

const agentRuntimes = new Map<string, IAgentRuntime>();

describe('Jupiter Plugin Tests', () => {
  let mockScenarioService: any;
  let mockRuntime: IAgentRuntime;
  let jupiterServiceInstance: JupiterService;

  beforeEach(async () => {
    console.log('\n[Jupiter Plugin Tests] Running beforeEach...');
    // Reset mocks for each test to ensure clean state
    mockScenarioService = {
      createWorld: vi.fn().mockResolvedValue('world-id'),
      createRoom: vi.fn().mockResolvedValue('room-id'),
      addParticipant: vi.fn().mockResolvedValue(true),
      sendMessage: vi.fn().mockResolvedValue(true),
      waitForCompletion: vi.fn().mockResolvedValue(true), // Default to success
    };
    console.log('[Jupiter Plugin Tests] mockScenarioService created.');

    // Create a real runtime for Jupiter service with actual network calls
    const tempRuntimeForJupiter = {
        agentId: 'agent-id-jupiter',
        getService: vi.fn(),
        getSetting: (key: string) => {
            if (key === 'SOLANA_RPC_URL') {
              // Provide a default or get from process.env for integration tests
              return process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
            }
            if (key === 'JUPITER_FEE_ACCOUNT') {
              // Provide a default or get from process.env if your service uses it
              return process.env.JUPITER_FEE_ACCOUNT || undefined;
            }
            // Add any other required settings for Jupiter service
            return undefined;
        },
        fetch: global.fetch, // Use real fetch for Jupiter API calls
        // Ensure other IAgentRuntime properties are available if JupiterService constructor/start uses them
        character: defaultCharacter, // Assuming JupiterService might access runtime.character
        plugins: [], // Minimal plugins array
        logger: console, // Basic logger
        // Add other methods/properties of IAgentRuntime as needed by JupiterService
        registerAction: vi.fn(),
        registerProvider: vi.fn(),
        registerEvaluator: vi.fn(),
        registerEvent: vi.fn(),
        registerDatabaseAdapter: vi.fn(),
        ensureAgentExists: vi.fn().mockResolvedValue(undefined),
        ensureWorldExists: vi.fn().mockResolvedValue(undefined),
        ensureRoomExists: vi.fn().mockResolvedValue(undefined),
        getWorld: vi.fn().mockResolvedValue(undefined),
        getRoom: vi.fn().mockResolvedValue(undefined),
        getEntityById: vi.fn().mockResolvedValue(undefined),
        createEntity: vi.fn().mockResolvedValue(undefined),
        createMemory: vi.fn().mockResolvedValue(undefined),
        initialize: vi.fn().mockResolvedValue(undefined),
    } as unknown as IAgentRuntime;

    console.log('[Jupiter Plugin Tests] Creating JupiterService instance...');
    jupiterServiceInstance = new JupiterService(tempRuntimeForJupiter);
    console.log('[Jupiter Plugin Tests] Starting JupiterService instance...');
    await jupiterServiceInstance.start(); // Initialize the JupiterService
    console.log('[Jupiter Plugin Tests] JupiterService instance started.');
    
    mockRuntime = {
      getService: vi.fn((serviceName: string) => {
        // console.log(`[SpartanTestSuite] mockRuntime.getService called for: ${serviceName}`);
        if (serviceName === 'scenario') {
          // console.log('[SpartanTestSuite] mockRuntime returning mockScenarioService.');
          return mockScenarioService;
        }
        if (serviceName === 'JUPITER_SERVICE') {
          // console.log('[SpartanTestSuite] mockRuntime returning jupiterServiceInstance.');
          return jupiterServiceInstance; // Return real Jupiter service instance
        }
        // console.log(`[SpartanTestSuite] mockRuntime returning undefined for ${serviceName}.`);
        return undefined;
      }),
      agentId: 'agent-id-spartan',
      getSetting: vi.fn(),
      fetch: global.fetch, // Use real fetch for any runtime calls
    } as unknown as IAgentRuntime;

    // Populate agentRuntimes for Jupiter tests
    agentRuntimes.set(defaultCharacter.name, mockRuntime);
    console.log('[Jupiter Plugin Tests] beforeEach complete.');
  });

describe('Jupiter Plugin Tests', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    console.log('\n[Jupiter Plugin Tests] Running beforeEach to mock fetch...');
    originalFetch = global.fetch; 

    // @ts-ignore
    global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request, options?: RequestInit) => {
      const urlString = url.toString();
      console.log(`[Jupiter Plugin Tests] Mocked fetch called for URL: ${urlString}`);

      // Mock for getTokenPair
      if (urlString.includes(`https://public.jupiterapi.com/v1/pairs/${SOL_MINT}/${USDC_MINT}`)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: { // Assuming JupiterService.getTokenPair expects this nested structure
              [SOL_MINT]: { id: SOL_MINT, name: 'Solana', symbol: 'SOL', decimals: 9 },
              [USDC_MINT]: { id: USDC_MINT, name: 'USD Coin', symbol: 'USDC', decimals: 6 },
              liquidity: 1000000, // Ensure this is a number
              volume24h: 50000,   // Ensure this is a number
              price: "160.50"     // Price is often a string from APIs
            },
            timeTaken: 0.1
          }),
        });
      }

      // Mock for getHistoricalPrices
      if (urlString.includes(`https://public.jupiterapi.com/v1/prices/${SOL_MINT}/${USDC_MINT}`)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [ // Assuming JupiterService.getHistoricalPrices expects data.data to be an array
              { timestamp: Math.floor(Date.now() / 1000) - 3600, price: 159.0 },
              { timestamp: Math.floor(Date.now() / 1000), price: 160.5 },
            ],
            timeTaken: 0.1
          }),
        });
      }
      // Fallback to the original fetch for other URLs (e.g., those used by swapApi)
      return originalFetch(url, options);
    });
  });

  afterEach(() => {
    console.log('[Jupiter Plugin Tests] Running afterEach to restore fetch...');
    global.fetch = originalFetch; 
    vi.restoreAllMocks(); 
    console.log('[Jupiter Plugin Tests] afterEach complete.');
  });

  it('should initialize swapApi on start', async () => {
    console.log('\n[Jupiter Test] Starting: should initialize swapApi on start');
    const runtime = agentRuntimes.get(defaultCharacter.name);
    if (!runtime) throw new Error('Runtime not found');
    const jupiterService = runtime.getService('JUPITER_SERVICE') as JupiterService;

    try {
      const price = await jupiterService.getTokenPrice(SOL_MINT, USDC_MINT);
      expect(price).toBeDefined();
      expect(typeof price).toBe('number'); // getTokenPrice should return a number
      expect(price).toBeGreaterThan(0); // Assuming a positive price from the mock or live API
      console.log('[Jupiter Test Result] PASSED: should initialize swapApi on start (verified by getTokenPrice)');
    } catch (e: any) {
      console.error('[Jupiter Test Result] FAILED: should initialize swapApi on start with error:', e);
      throw e;
    }
  }, TEST_TIMEOUT);

  it('should get token price quote', async () => {
    console.log('\n[Jupiter Test] Starting: should get token price quote');
    const runtime = agentRuntimes.get(defaultCharacter.name);
    if (!runtime) {
      console.error('[Jupiter Test] Runtime not found for Default Character');
      throw new Error('Runtime not found for Default Character');
    }
    const jupiterService = runtime.getService('JUPITER_SERVICE') as JupiterService;
    expect(jupiterService).toBeDefined();
    if (!jupiterService) {
      console.error('[Jupiter Test] JupiterService not found on runtime');
      return;
    }
    try {
      const price = await jupiterService.getTokenPrice(SOL_MINT, USDC_MINT);
      console.log(`[Jupiter Test] getTokenPrice result: ${price}`);
      expect(price).toBeGreaterThan(0); 
      console.log('[Jupiter Test Result] PASSED: should get token price quote');
    } catch (e: any) {
      console.error('[Jupiter Test Result] FAILED: should get token price quote with error:', e);
      throw e;
    }
  }, TEST_TIMEOUT);

  it('should get best swap route', async () => {
    console.log('\n[Jupiter Test] Starting: should get best swap route');
    const runtime = agentRuntimes.get(defaultCharacter.name);
    if (!runtime) {
      console.error('[Jupiter Test] Runtime not found for Default Character');
      throw new Error('Runtime not found for Default Character');
    }
    const jupiterService = runtime.getService('JUPITER_SERVICE') as JupiterService;
    expect(jupiterService).toBeDefined();
    if (!jupiterService) {
      console.error('[Jupiter Test] JupiterService not found on runtime');
      return;
    }
    try {
      const route = await jupiterService.getBestRoute({
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        amount: 1_000_000_000, 
      });
      console.log('[Jupiter Test] getBestRoute result:', route);
      expect(route).toBeDefined();
      expect(route.outAmount).toBeDefined();
      expect(Number(route.outAmount)).toBeGreaterThan(0); 
      console.log('[Jupiter Test Result] PASSED: should get best swap route');
    } catch (e: any) {
      console.error('[Jupiter Test Result] FAILED: should get best swap route with error:', e);
      throw e;
    }
  }, TEST_TIMEOUT);

  it('should calculate price impact', async () => {
    console.log('\n[Jupiter Test] Starting: should calculate price impact');
    const runtime = agentRuntimes.get(defaultCharacter.name);
    if (!runtime) {
      console.error('[Jupiter Test] Runtime not found for Default Character');
      throw new Error('Runtime not found for Default Character');
    }
    const jupiterService = runtime.getService('JUPITER_SERVICE') as JupiterService;
    expect(jupiterService).toBeDefined();
    if (!jupiterService) {
      console.error('[Jupiter Test] JupiterService not found on runtime');
      return;
    }
    try {
      const priceImpact = await jupiterService.getPriceImpact({
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        amount: 1_000_000_000, 
      });
      console.log(`[Jupiter Test] getPriceImpact result: ${priceImpact}`);
      expect(priceImpact).toBeDefined();
      expect(typeof priceImpact).toBe('number');
      expect(priceImpact).toBeGreaterThanOrEqual(0); 
      console.log('[Jupiter Test Result] PASSED: should calculate price impact');
    } catch (e: any) {
      console.error('[Jupiter Test Result] FAILED: should calculate price impact with error:', e);
      throw e;
    }
  }, TEST_TIMEOUT);

  it('should find arbitrage paths', async () => {
    console.log('\n[Jupiter Test] Starting: should find arbitrage paths');
    const runtime = agentRuntimes.get(defaultCharacter.name);
    if (!runtime) {
      console.error('[Jupiter Test] Runtime not found for Default Character');
      throw new Error('Runtime not found for Default Character');
    }
    const jupiterService = runtime.getService('JUPITER_SERVICE') as JupiterService;
    expect(jupiterService).toBeDefined();
    if (!jupiterService) {
      console.error('[Jupiter Test] JupiterService not found on runtime');
      return;
    }
    try {
      const paths = await jupiterService.findArbitragePaths({
        startingMint: USDC_MINT,
        amount: 1_000_000, 
      });
      console.log('[Jupiter Test] findArbitragePaths result:', paths);
      expect(Array.isArray(paths)).toBe(true);
      console.log('[Jupiter Test Result] PASSED: should find arbitrage paths');
    } catch (e: any) {
      console.error('[Jupiter Test Result] FAILED: should find arbitrage paths with error:', e);
      throw e;
    }
  }, TEST_TIMEOUT);

  it('should get token pair information', async () => {
    console.log('\n[Jupiter Test] Starting: should get token pair information');
    const runtime = agentRuntimes.get(defaultCharacter.name);
    if (!runtime) throw new Error('Runtime not found');
    const jupiterService = runtime.getService('JUPITER_SERVICE') as JupiterService;
    expect(jupiterService).toBeDefined();
    if (!jupiterService) return;

    try {
      const pairInfo = await jupiterService.getTokenPair({
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
      });
      // console.log('[Jupiter Test] getTokenPair result:', JSON.stringify(pairInfo, null, 2)); // For detailed logging if needed
      expect(pairInfo).toBeDefined();
      expect(pairInfo).toHaveProperty('data'); // Expect the main data object

      const tokenPairData = JSON.parse(JSON.stringify(pairInfo)); // Correctly assign the nested 'data' object

      // Check for the input token data using its mint address as the key
      expect(tokenPairData).toHaveProperty(SOL_MINT);
      expect(tokenPairData[SOL_MINT]).toHaveProperty('id', SOL_MINT);
      expect(tokenPairData[SOL_MINT]).toHaveProperty('name', 'Solana'); // From mock

      // Check for the output token data using its mint address as the key
      expect(tokenPairData).toHaveProperty(USDC_MINT);
      expect(tokenPairData[USDC_MINT]).toHaveProperty('id', USDC_MINT);
      expect(tokenPairData[USDC_MINT]).toHaveProperty('name', 'USD Coin'); // From mock

      // Check for liquidity and volume within the data object
      expect(tokenPairData).toHaveProperty('liquidity');
      expect(typeof tokenPairData.liquidity).toBe('number');
      expect(tokenPairData.liquidity).toBe(1000000); // From mock

      expect(tokenPairData).toHaveProperty('volume24h');
      expect(typeof tokenPairData.volume24h).toBe('number');
      expect(tokenPairData.volume24h).toBe(50000); // From mock

      console.log('[Jupiter Test Result] PASSED: should get token pair information');
    } catch (e: any) {
      console.error('[Jupiter Test Result] FAILED: should get token pair information with error:', e);
      throw e;
    }
  }, TEST_TIMEOUT);

  it('should get historical prices', async () => {
    console.log('\n[Jupiter Test] Starting: should get historical prices');
    const runtime = agentRuntimes.get(defaultCharacter.name);
    if (!runtime) {
      console.error('[Jupiter Test] Runtime not found for Default Character');
      throw new Error('Runtime not found for Default Character');
    }
    const jupiterService = runtime.getService('JUPITER_SERVICE') as JupiterService;
    expect(jupiterService).toBeDefined();
    if (!jupiterService) {
      console.error('[Jupiter Test] JupiterService not found on runtime');
      return;
    }
    try {
      const pricesResponse = await jupiterService.getHistoricalPrices({
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        timeframe: '24h',
      });
      console.log('[Jupiter Test] getHistoricalPrices result:', pricesResponse);
      expect(pricesResponse).toHaveProperty('data'); // Expect the main data object
      const prices = pricesResponse; // The actual array of prices

      expect(Array.isArray(prices)).toBe(true);
      expect(prices.length).toBeGreaterThan(0);
      if (prices.length > 0) {
        expect(prices[0]).toHaveProperty('timestamp');
        expect(prices[0]).toHaveProperty('price');
      }
      console.log('[Jupiter Test Result] PASSED: should get historical prices');
    } catch (e: any) {
      console.error('[Jupiter Test Result] FAILED: should get historical prices with error:', e);
      throw e;
    }
  }, TEST_TIMEOUT);

  it('should execute a swap', async () => {
    console.log('\n[Jupiter Test] Starting: should execute a swap');
    const runtime = agentRuntimes.get(defaultCharacter.name);
    if (!runtime) throw new Error('Runtime not found');
    const jupiterService = runtime.getService('JUPITER_SERVICE') as JupiterService;
    expect(jupiterService).toBeDefined();
    if (!jupiterService) return;

    const mockSwapResponse: SwapResponse = {
      swapTransaction: 'mockTxSignature123',
      lastValidBlockHeight: 123456,
      prioritizationFeeLamports: 10000,
    };
    // @ts-ignore
    const swapPostMock = vi.spyOn(jupiterService.swapApi, 'swapPost').mockResolvedValue(mockSwapResponse);

    const mockQuoteResponse = {
      inputMint: SOL_MINT,
      inAmount: '1000000000',
      outputMint: USDC_MINT,
      outAmount: '160000000',
      priceImpactPct: '0.01',
      marketInfos: [],
      amount: '1000000000',
      slippageBps: 50,
      otherAmountThreshold: '159000000',
      swapMode: 'ExactIn',
      // Minimal QuoteResponse properties for the test
    } as unknown as QuoteResponse;

    const userPublicKey = 'UserPublicKeyString12345';

    try {
      const result = await jupiterService.executeSwap({
        quoteResponse: mockQuoteResponse,
        userPublicKey,
      });
      console.log('[Jupiter Test] executeSwap result:', result);
      expect(result).toEqual(mockSwapResponse);
      expect(swapPostMock).toHaveBeenCalledWith({
        swapRequest: {
          quoteResponse: mockQuoteResponse,
          userPublicKey,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          computeUnitPriceMicroLamports: 50000,
        },
      });
      console.log('[Jupiter Test Result] PASSED: should execute a swap');
    } catch (e: any) {
      console.error('[Jupiter Test Result] FAILED: should execute a swap with error:', e);
      throw e;
    } finally {
      swapPostMock.mockRestore();
    }
  }, TEST_TIMEOUT);

  it('should confirm a transaction successfully', async () => {
    console.log('\n[Jupiter Test] Starting: should confirm a transaction successfully');
    const runtime = agentRuntimes.get(defaultCharacter.name);
    if (!runtime) throw new Error('Runtime not found');
    const jupiterService = runtime.getService('JUPITER_SERVICE') as JupiterService;
    expect(jupiterService).toBeDefined();
    if (!jupiterService) return;

    const mockConnection = {
      getSignatureStatus: vi.fn()
        .mockResolvedValueOnce({ value: { confirmationStatus: 'processed' } })
        .mockResolvedValueOnce({ value: { confirmationStatus: 'confirmed' } }),
    } as unknown as Connection;
    const signature = 'testSignature123';

    try {
      const promise = jupiterService.confirmTransaction(mockConnection, signature);
      await vi.advanceTimersByTime(jupiterService['CONFIRMATION_CONFIG'].INITIAL_TIMEOUT);
      await vi.advanceTimersByTime(jupiterService['CONFIRMATION_CONFIG'].getDelayForAttempt(1));

      const result = await promise;
      expect(result).toBe(true);
      expect(mockConnection.getSignatureStatus).toHaveBeenCalledTimes(2);
      expect(mockConnection.getSignatureStatus).toHaveBeenCalledWith(signature);
      console.log('[Jupiter Test Result] PASSED: should confirm a transaction successfully');
    } catch (e: any) {
      console.error('[Jupiter Test Result] FAILED: should confirm a transaction successfully with error:', e);
      throw e;
    }
  }, TEST_TIMEOUT);

  it('should fail to confirm a transaction after max attempts', async () => {
    console.log('\n[Jupiter Test] Starting: should fail to confirm a transaction after max attempts');
    const runtime = agentRuntimes.get(defaultCharacter.name);
    if (!runtime) throw new Error('Runtime not found');
    const jupiterService = runtime.getService('JUPITER_SERVICE') as JupiterService;
    expect(jupiterService).toBeDefined();
    if (!jupiterService) return;

    const mockConnection = {
      getSignatureStatus: vi.fn().mockResolvedValue({ value: { confirmationStatus: 'processed' } }),
    } as unknown as Connection;
    const signature = 'testSignatureMaxAttempts';

    const maxAttempts = jupiterService['CONFIRMATION_CONFIG'].MAX_ATTEMPTS;

    try {
      const promise = jupiterService.confirmTransaction(mockConnection, signature);
      for (let i = 0; i < maxAttempts; i++) {
        await vi.advanceTimersByTime(jupiterService['CONFIRMATION_CONFIG'].getDelayForAttempt(i) + 10); // Advance time for each attempt
      }
      await expect(promise).rejects.toThrow('Could not confirm transaction status');
      expect(mockConnection.getSignatureStatus).toHaveBeenCalledTimes(maxAttempts);
      console.log('[Jupiter Test Result] PASSED: should fail to confirm a transaction after max attempts');
    } catch (e: any) {
      // This catch is for unexpected errors during test setup, not the expected rejection.
      console.error('[Jupiter Test Result] FAILED UNEXPECTEDLY: should fail to confirm a transaction after max attempts with error:', e);
      throw e;
    }
  }, TEST_TIMEOUT);

  it('should get minimum received amount', async () => {
    console.log('\n[Jupiter Test] Starting: should get minimum received amount');
    const runtime = agentRuntimes.get(defaultCharacter.name);
    if (!runtime) throw new Error('Runtime not found');
    const jupiterService = runtime.getService('JUPITER_SERVICE') as JupiterService;
    expect(jupiterService).toBeDefined();
    if (!jupiterService) return;

    try {
      const minReceived = await jupiterService.getMinimumReceived({
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        amount: 1_000_000_000, // 1 SOL
        slippageBps: 100, // 1%
      });
      console.log(`[Jupiter Test] getMinimumReceived result: ${minReceived}`);
      expect(typeof minReceived).toBe('number');
      expect(minReceived).toBeGreaterThan(0); // Assuming 1 SOL gives some USDC
      console.log('[Jupiter Test Result] PASSED: should get minimum received amount');
    } catch (e: any) {
      console.error('[Jupiter Test Result] FAILED: should get minimum received amount with error:', e);
      throw e;
    }
  }, TEST_TIMEOUT);

  it('should estimate gas fees', async () => {
    console.log('\n[Jupiter Test] Starting: should estimate gas fees');
    const runtime = agentRuntimes.get(defaultCharacter.name);
    if (!runtime) throw new Error('Runtime not found');
    const jupiterService = runtime.getService('JUPITER_SERVICE') as JupiterService;
    expect(jupiterService).toBeDefined();
    if (!jupiterService) return;

    try {
      const fees = await jupiterService.estimateGasFees({
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        amount: 1_000_000_000, // 1 SOL
      });
      console.log('[Jupiter Test] estimateGasFees result:', fees);
      expect(fees).toBeDefined();
      expect(typeof fees.lamports).toBe('number');
      expect(typeof fees.sol).toBe('number');
      expect(fees.lamports).toBeGreaterThanOrEqual(0);
      expect(fees.sol).toBeGreaterThanOrEqual(0);
      expect(fees.sol).toBeCloseTo(fees.lamports / 1e9);
      console.log('[Jupiter Test Result] PASSED: should estimate gas fees');
    } catch (e: any) {
      console.error('[Jupiter Test Result] FAILED: should estimate gas fees with error:', e);
      throw e;
    }
  }, TEST_TIMEOUT);

  it('should find best slippage', async () => {
    console.log('\n[Jupiter Test] Starting: should find best slippage');
    const runtime = agentRuntimes.get(defaultCharacter.name);
    if (!runtime) throw new Error('Runtime not found');
    const jupiterService = runtime.getService('JUPITER_SERVICE') as JupiterService;
    expect(jupiterService).toBeDefined();
    if (!jupiterService) return;

    try {
      const slippage = await jupiterService.findBestSlippage({
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        amount: 1_000_000_000, // 1 SOL
      });
      console.log(`[Jupiter Test] findBestSlippage result: ${slippage}`);
      expect(typeof slippage).toBe('number');
      // The result depends on live priceImpactPct, so we check if it's one of the valid values
      expect([50, 100, 200]).toContain(slippage);
      console.log('[Jupiter Test Result] PASSED: should find best slippage');
    } catch (e: any) {
      console.error('[Jupiter Test Result] FAILED: should find best slippage with error:', e);
      throw e;
    }
  }, TEST_TIMEOUT);
});

});
