import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type IAgentRuntime, ModelType } from '@elizaos/core';
import BuySignal from '../tasks/buySignal';
import SellSignal from '../tasks/sellSignal';
import TwitterParser from '../tasks/twitterParser';
import type { Sentiment, IToken } from '../types';

// Mock Solana service
const createMockSolanaService = () => ({
  getConnection: vi.fn().mockReturnValue({
    getBalance: vi.fn().mockResolvedValue(1_000_000_000), // 1 SOL
  }),
  getPublicKey: vi.fn().mockReturnValue({
    toBase58: () => 'BzsJQeZ7cvk3pTHmKeuvdhNDkDxcZ6uCXxW2rjwC7RTq',
  }),
  forceUpdate: vi.fn(),
});

// Mock runtime factory
const createMockRuntime = () => ({
  getSetting: vi.fn(),
  getCache: vi.fn(),
  setCache: vi.fn(),
  emitEvent: vi.fn(),
  useModel: vi.fn(),
  getService: vi.fn(),
  getMemories: vi.fn(),
});

describe('BuySignal', () => {
  let buySignal: BuySignal;
  let mockRuntime: any;
  let mockSolanaService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRuntime = createMockRuntime();
    mockSolanaService = createMockSolanaService();
    
    // Set up default mocks
    mockRuntime.getService.mockReturnValue(mockSolanaService);
    mockRuntime.getSetting.mockReturnValue('test-api-key');
    
    buySignal = new BuySignal(mockRuntime);
  });

  it('should initialize correctly', () => {
    expect(buySignal).toBeDefined();
    expect(buySignal.runtime).toBe(mockRuntime);
  });

  it('should generate buy signal when conditions are met', async () => {
    // Mock sentiment data
    const mockSentiments: Sentiment[] = [
      {
        timeslot: '2024-01-01T00:00:00Z',
        processed: true,
        occuringTokens: [
          { token: 'DEGENAI', sentiment: 80, reason: 'Positive community sentiment' },
        ],
      },
    ];

    // Mock trending tokens
    const mockTokens: IToken[] = [
      {
        provider: 'birdeye',
        chain: 'solana',
        address: '2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump',
        decimals: 9,
        liquidity: 1000000,
        marketcap: 5000000,
        logoURI: 'https://example.com/logo.png',
        name: 'DEGENAI',
        symbol: 'DEGENAI',
        volume24hUSD: 500000,
        rank: 1,
        price: 0.05,
        price24hChangePercent: 15.5,
        last_updated: new Date(),
      },
    ];

    // Set up cache responses in order
    mockRuntime.getCache
      .mockResolvedValueOnce(mockSentiments) // First call for sentiments
      .mockResolvedValueOnce(mockTokens); // Second call for tokens

    // Mock AI response
    mockRuntime.useModel.mockResolvedValue(
      JSON.stringify({
        recommended_buy: 'DEGENAI',
        recommend_buy_address: '2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump',
        reason: 'Strong positive sentiment and increasing volume',
        buy_amount: '0.1',
      })
    );

    // Mock Birdeye API response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { marketCap: 5000000 } }),
    });

    const result = await buySignal.generateSignal();

    expect(result).toBe(true);
    expect(mockRuntime.emitEvent).toHaveBeenCalledWith(
      'DEGEN_INTEL_BUY_SIGNAL',
      expect.objectContaining({
        recommended_buy: 'DEGENAI',
        recommend_buy_address: '2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump',
        reason: 'Strong positive sentiment and increasing volume',
        buy_amount: '0.1',
        marketcap: 5000000,
      })
    );
    expect(mockRuntime.setCache).toHaveBeenCalled();
  });

  it('should return false when no Solana service is available', async () => {
    mockRuntime.getService.mockReturnValue(null);

    const result = await buySignal.generateSignal();

    expect(result).toBe(false);
  });

  it('should return false when no buy recommendation is generated', async () => {
    // Mock empty sentiment and token data
    mockRuntime.getCache
      .mockResolvedValueOnce([]) // Empty sentiments
      .mockResolvedValueOnce([]); // Empty tokens
    
    mockRuntime.useModel.mockResolvedValue(JSON.stringify({}));

    const result = await buySignal.generateSignal();

    expect(result).toBe(false);
  });

  it('should validate Solana addresses correctly', async () => {
    // Mock minimal data to get to address validation
    mockRuntime.getCache
      .mockResolvedValueOnce([{ timeslot: '2024-01-01', processed: true, occuringTokens: [{ token: 'TEST', sentiment: 80, reason: 'Test' }] }])
      .mockResolvedValueOnce([{ name: 'TEST', address: 'invalid-address', symbol: 'TEST' }]);
    
    mockRuntime.useModel.mockResolvedValue(
      JSON.stringify({
        recommended_buy: 'TEST',
        recommend_buy_address: 'invalid-address',
        reason: 'Test',
        buy_amount: '0.1',
      })
    );

    const result = await buySignal.generateSignal();
    expect(result).toBe(false);
  });
});

describe('SellSignal', () => {
  let sellSignal: SellSignal;
  let mockRuntime: any;
  let mockSolanaService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRuntime = createMockRuntime();
    mockSolanaService = createMockSolanaService();
    
    // Set up default mocks
    mockRuntime.getService.mockReturnValue(mockSolanaService);
    mockRuntime.getSetting.mockReturnValue('test-api-key');
    
    sellSignal = new SellSignal(mockRuntime);
  });

  it('should initialize correctly', () => {
    expect(sellSignal).toBeDefined();
    expect(sellSignal.runtime).toBe(mockRuntime);
  });

  it('should generate sell signal when conditions are met', async () => {
    // Mock wallet data with significant tokens
    const mockWalletData = {
      totalUsd: '1000',
      totalSol: '20',
      items: [
        {
          name: 'Test Token',
          address: '2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump',
          symbol: 'TEST',
          decimals: 9,
          balance: '1000000000',
          uiAmount: '1000',
          priceUsd: '0.5',
          valueUsd: '500', // Above $1 threshold
          valueSol: '10',
        },
      ],
    };

    mockSolanaService.forceUpdate.mockResolvedValue(mockWalletData);

    // Mock sentiment data
    const mockSentiments: Sentiment[] = [
      {
        timeslot: '2024-01-01T00:00:00Z',
        processed: true,
        occuringTokens: [{ token: 'TEST', sentiment: -60, reason: 'Negative market sentiment' }],
      },
    ];

    mockRuntime.getCache.mockResolvedValue(mockSentiments);

    // Mock AI response
    mockRuntime.useModel.mockResolvedValue(
      JSON.stringify({
        recommended_sell: 'TEST',
        recommend_sell_address: '2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump',
        reason: 'Negative sentiment and declining volume',
        sell_amount: '500',
      })
    );

    // Mock Birdeye API response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { marketCap: 3000000 } }),
    });

    const result = await sellSignal.generateSignal();

    expect(result).toBe(true);
    expect(mockRuntime.emitEvent).toHaveBeenCalledWith(
      'DEGEN_INTEL_SELL_SIGNAL',
      expect.objectContaining({
        recommended_sell: 'TEST',
        recommend_sell_address: '2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump',
        reason: 'Negative sentiment and declining volume',
        sell_amount: '500',
        marketcap: 3000000,
      })
    );
    expect(mockRuntime.setCache).toHaveBeenCalled();
  });

  it('should return false when no wallet tokens are found', async () => {
    mockSolanaService.forceUpdate.mockResolvedValue({ items: [] });

    const result = await sellSignal.generateSignal();

    expect(result).toBe(false);
  });

  it('should filter out SOL and small value tokens', async () => {
    const mockWalletData = {
      items: [
        { symbol: 'SOL', valueUsd: '1000' }, // Should be filtered out
        { symbol: 'TINY', valueUsd: '0.5' }, // Should be filtered out (< $1)
        { symbol: 'VALID', valueUsd: '100', uiAmount: '100', address: 'valid-address' }, // Should be kept
      ],
    };

    mockSolanaService.forceUpdate.mockResolvedValue(mockWalletData);
    mockRuntime.getCache.mockResolvedValue([]); // No sentiment data

    const result = await sellSignal.generateSignal();

    // Should return false because no sentiment data, but the filtering should work
    expect(result).toBe(false);
  });
});

describe('TwitterParser', () => {
  let twitterParser: TwitterParser;
  let mockRuntime: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRuntime = createMockRuntime();
    twitterParser = new TwitterParser(mockRuntime);
  });

  it('should initialize correctly', () => {
    expect(twitterParser).toBeDefined();
    expect(twitterParser.runtime).toBe(mockRuntime);
  });

  it('should parse tweets and extract sentiment', async () => {
    // Mock unprocessed sentiment slot
    const mockSentiments = [
      {
        timeslot: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        processed: false,
      },
    ];

    // Mock tweets from memory
    const mockMemories = [
      {
        content: {
          source: 'twitter',
          text: 'DEGENAI is looking bullish! Great project with strong fundamentals.',
          tweet: { username: 'cryptotrader', likes: 100, retweets: 50 },
        },
        createdAt: Date.now() - 90 * 60 * 1000, // 90 minutes ago
      },
    ];

    mockRuntime.getCache.mockResolvedValue(mockSentiments);
    mockRuntime.getMemories.mockResolvedValue(mockMemories);
    mockRuntime.useModel.mockResolvedValue(
      JSON.stringify({
        text: 'Bullish sentiment on DEGENAI',
        occuringTokens: [
          { token: 'DEGENAI', sentiment: 75, reason: 'Bullish sentiment expressed' },
        ],
      })
    );

    const result = await twitterParser.parseTweets();

    expect(result).toBe(true);
    expect(mockRuntime.setCache).toHaveBeenCalledWith('sentiments', expect.any(Array));
    expect(mockRuntime.useModel).toHaveBeenCalled();
  });

  it('should handle empty tweet data gracefully', async () => {
    // Mock unprocessed sentiment but no tweets
    const mockSentiments = [
      {
        timeslot: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        processed: false,
      },
    ];

    mockRuntime.getCache.mockResolvedValue(mockSentiments);
    mockRuntime.getMemories.mockResolvedValue([]); // No tweets

    const result = await twitterParser.parseTweets();

    expect(result).toBe(true);
    // Should mark as processed even with no tweets
    expect(mockRuntime.setCache).toHaveBeenCalledWith('sentiments', expect.arrayContaining([
      expect.objectContaining({ processed: true })
    ]));
  });

  it('should process tweets with sentiment analysis', async () => {
    // Mock unprocessed sentiment slot
    const mockSentiments = [
      {
        timeslot: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        processed: false,
      },
    ];

    // Mock tweets from memory
    const mockMemories = [
      {
        content: {
          source: 'twitter',
          text: 'Test tweet about crypto markets looking volatile',
          tweet: { username: 'user', likes: 10, retweets: 5 },
        },
        createdAt: Date.now() - 90 * 60 * 1000,
      },
    ];

    mockRuntime.getCache.mockResolvedValue(mockSentiments);
    mockRuntime.getMemories.mockResolvedValue(mockMemories);
    mockRuntime.useModel.mockResolvedValue(
      JSON.stringify({
        text: 'Markets showing volatility with mixed sentiment',
        occuringTokens: [{ token: 'BTC', sentiment: 50, reason: 'Neutral market conditions' }],
      })
    );

    const result = await twitterParser.parseTweets();

    expect(result).toBe(true);
    expect(mockRuntime.useModel).toHaveBeenCalledTimes(1);
    expect(mockRuntime.setCache).toHaveBeenCalledWith('sentiments', expect.arrayContaining([
      expect.objectContaining({ 
        processed: true,
        text: 'Markets showing volatility with mixed sentiment',
        occuringTokens: expect.arrayContaining([
          expect.objectContaining({ token: 'BTC', sentiment: 50 })
        ])
      })
    ]));
  });
});

describe('DegenIntel Plugin Integration', () => {
  let mockRuntime: any;
  let mockSolanaService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRuntime = createMockRuntime();
    mockSolanaService = createMockSolanaService();
    
    mockRuntime.getService.mockReturnValue(mockSolanaService);
    mockRuntime.getSetting.mockReturnValue('test-api-key');
  });

  it('should handle buy signal flow end-to-end', async () => {
    const buySignal = new BuySignal(mockRuntime);

    // Setup complete mock data with proper structure
    const mockSentiments = [
      {
        timeslot: '2024-01-01T00:00:00Z',
        processed: true,
        occuringTokens: [{ token: 'TEST', sentiment: 90, reason: 'Very bullish sentiment' }],
      },
    ];

    const mockTokens = [
      {
        provider: 'birdeye',
        chain: 'solana',
        name: 'TEST',
        symbol: 'TEST',
        address: '2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump',
        price: 0.1,
        price24hChangePercent: 20,
        liquidity: 100000,
        marketcap: 1000000,
        volume24hUSD: 50000,
        rank: 1,
        decimals: 9,
        logoURI: 'https://example.com/logo.png',
        last_updated: new Date(),
      },
    ];

    mockRuntime.getCache
      .mockResolvedValueOnce(mockSentiments)
      .mockResolvedValueOnce(mockTokens);

    mockRuntime.useModel.mockResolvedValue(
      JSON.stringify({
        recommended_buy: 'TEST',
        recommend_buy_address: '2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump',
        reason: 'Strong buy signal based on sentiment and technical analysis',
        buy_amount: '0.15',
      })
    );

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { marketCap: 1000000 } }),
    });

    const result = await buySignal.generateSignal();

    expect(result).toBe(true);
    expect(mockRuntime.emitEvent).toHaveBeenCalledWith(
      'DEGEN_INTEL_BUY_SIGNAL',
      expect.objectContaining({
        recommended_buy: 'TEST',
        recommend_buy_address: '2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump',
        reason: 'Strong buy signal based on sentiment and technical analysis',
        buy_amount: '0.15',
        marketcap: 1000000,
      })
    );
  });

  it('should handle sell signal flow end-to-end', async () => {
    const sellSignal = new SellSignal(mockRuntime);

    const mockWalletData = {
      items: [
        {
          name: 'Test Token',
          address: '2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump',
          symbol: 'TEST',
          uiAmount: '1000',
          valueUsd: '100',
        },
      ],
    };

    mockSolanaService.forceUpdate.mockResolvedValue(mockWalletData);

    const mockSentiments = [
      {
        timeslot: '2024-01-01T00:00:00Z',
        processed: true,
        occuringTokens: [{ token: 'TEST', sentiment: -70, reason: 'Bearish market outlook' }],
      },
    ];

    mockRuntime.getCache.mockResolvedValue(mockSentiments);

    mockRuntime.useModel.mockResolvedValue(
      JSON.stringify({
        recommended_sell: 'TEST',
        recommend_sell_address: '2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump',
        reason: 'Negative sentiment indicates potential downtrend',
        sell_amount: '500',
      })
    );

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { marketCap: 800000 } }),
    });

    const result = await sellSignal.generateSignal();

    expect(result).toBe(true);
    expect(mockRuntime.emitEvent).toHaveBeenCalledWith(
      'DEGEN_INTEL_SELL_SIGNAL',
      expect.objectContaining({
        recommended_sell: 'TEST',
        recommend_sell_address: '2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump',
        reason: 'Negative sentiment indicates potential downtrend',
        sell_amount: '500',
        marketcap: 800000,
      })
    );
  });
});
