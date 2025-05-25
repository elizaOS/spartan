import {
  type Component as CoreComponent,
  type UUID as CoreUUID,
  type IAgentRuntime,
  asUUID,
  logger,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunityInvestorService } from '../src/plugins/communityInvestor/service';
import {
  Conviction,
  type Recommendation,
  SupportedChain,
  TRUST_MARKETPLACE_COMPONENT_TYPE,
  type TokenAPIData,
  type UserTrustProfile,
} from '../src/plugins/communityInvestor/types';

// Mock runtime for unit tests
const createMockRuntime = (): IAgentRuntime => {
  const mockRuntime = {
    agentId: asUUID(uuidv4()),
    getComponent: vi.fn(),
    createComponent: vi.fn(),
    updateComponent: vi.fn(),
    deleteComponent: vi.fn(),
    getMemories: vi.fn(),
    createTask: vi.fn(),
    useModel: vi.fn(),
    getService: vi.fn(),
    getParticipantUserState: vi.fn(),
    getSetting: vi.fn().mockImplementation((key: string) => {
      // Return mock API keys for the service to initialize properly
      if (key === 'BIRDEYE_API_KEY') return 'mock-birdeye-key';
      if (key === 'DEXSCREENER_API_KEY') return 'mock-dexscreener-key';
      if (key === 'HELIUS_API_KEY') return 'mock-helius-key';
      return null;
    }),
    getCache: vi.fn(),
    setCache: vi.fn(),
    getAgents: vi.fn(),
    getEntityById: vi.fn(),
    registerTaskWorker: vi.fn(),
    ensureWorldExists: vi.fn(),
    getAllWorlds: vi.fn(),
    searchMemories: vi.fn(),
    createMemory: vi.fn(),
    deleteTask: vi.fn(),
  } as any;
  return mockRuntime;
};

const createMockCoreComponent = (
  entityId: CoreUUID,
  data: any,
  type: string = TRUST_MARKETPLACE_COMPONENT_TYPE
): CoreComponent => ({
  id: asUUID(uuidv4()),
  entityId,
  agentId: asUUID(uuidv4()),
  worldId: asUUID(uuidv4()),
  roomId: asUUID(uuidv4()),
  sourceEntityId: asUUID(uuidv4()),
  type,
  createdAt: Date.now(),
  data,
});

describe('CommunityInvestorService Unit Tests', () => {
  let service: CommunityInvestorService;
  let mockRuntime: IAgentRuntime;
  const testUserId = asUUID(uuidv4());
  const testWorldId = asUUID(uuidv4());

  beforeEach(() => {
    mockRuntime = createMockRuntime();
    service = new CommunityInvestorService(mockRuntime);

    // Mock the API clients to prevent real network calls
    vi.spyOn(service['birdeyeClient'], 'fetchTokenOverview').mockResolvedValue({
      address: 'TEST_ADDR',
      name: 'Test Token',
      symbol: 'TEST',
      decimals: 9,
      logoURI: 'https://example.com/logo.png',
    });

    vi.spyOn(service['birdeyeClient'], 'fetchPrice').mockResolvedValue(1.5);

    vi.spyOn(service['birdeyeClient'], 'fetchTokenSecurity').mockResolvedValue({
      ownerBalance: '1000000',
      creatorBalance: '500000',
      ownerPercentage: 10,
      creatorPercentage: 5,
      top10HolderBalance: '2500000',
      top10HolderPercent: 25,
    });

    vi.spyOn(service['birdeyeClient'], 'fetchTokenTradeData').mockResolvedValue({
      address: 'TEST_ADDR',
      holder: 1000,
      market: 1000000,
      last_trade_unix_time: Date.now(),
      last_trade_human_time: new Date().toISOString(),
      price: 1.5,
      history_30m_price: 1.4,
      price_change_30m_percent: 7.1,
      history_1h_price: 1.45,
      price_change_1h_percent: 3.4,
      history_2h_price: 1.48,
      price_change_2h_percent: 1.4,
      history_4h_price: 1.51,
      price_change_4h_percent: -0.7,
      history_6h_price: 1.49,
      price_change_6h_percent: 0.7,
      history_8h_price: 1.48,
      price_change_8h_percent: 1.4,
      history_12h_price: 1.45,
      price_change_12h_percent: 3.4,
      history_24h_price: 1.4,
      price_change_24h_percent: 7.1,
      unique_wallet_30m: 50,
      unique_wallet_history_30m: 48,
      unique_wallet_30m_change_percent: 4.2,
      unique_wallet_1h: 95,
      unique_wallet_history_1h: 90,
      unique_wallet_1h_change_percent: 5.6,
      unique_wallet_2h: 180,
      unique_wallet_history_2h: 170,
      unique_wallet_2h_change_percent: 5.9,
      unique_wallet_4h: 350,
      unique_wallet_history_4h: 330,
      unique_wallet_4h_change_percent: 6.1,
      unique_wallet_8h: 650,
      unique_wallet_history_8h: 600,
      unique_wallet_8h_change_percent: 8.3,
      unique_wallet_24h: 1200,
      unique_wallet_history_24h: 1100,
      unique_wallet_24h_change_percent: 9.1,
      volume_24h_usd: 50000,
      volume_24h: 50000,
      // Add other required fields with default values
      trade_30m: 25,
      trade_history_30m: 23,
      trade_30m_change_percent: 8.7,
      sell_30m: 12,
      sell_history_30m: 11,
      sell_30m_change_percent: 9.1,
      buy_30m: 13,
      buy_history_30m: 12,
      buy_30m_change_percent: 8.3,
      volume_30m: 5000,
      volume_30m_usd: 5000,
      volume_history_30m: 4800,
      volume_history_30m_usd: 4800,
      volume_30m_change_percent: 4.2,
      volume_buy_30m: 2600,
      volume_buy_30m_usd: 2600,
      volume_buy_history_30m: 2500,
      volume_buy_history_30m_usd: 2500,
      volume_buy_30m_change_percent: 4.0,
      volume_sell_30m: 2400,
      volume_sell_30m_usd: 2400,
      volume_sell_history_30m: 2300,
      volume_sell_history_30m_usd: 2300,
      volume_sell_30m_change_percent: 4.3,
      trade_1h: 48,
      trade_history_1h: 45,
      trade_1h_change_percent: 6.7,
      sell_1h: 23,
      sell_history_1h: 22,
      sell_1h_change_percent: 4.5,
      buy_1h: 25,
      buy_history_1h: 23,
      buy_1h_change_percent: 8.7,
      volume_1h: 9500,
      volume_1h_usd: 9500,
      volume_history_1h: 9000,
      volume_history_1h_usd: 9000,
      volume_1h_change_percent: 5.6,
      volume_buy_1h: 4900,
      volume_buy_1h_usd: 4900,
      volume_buy_history_1h: 4600,
      volume_buy_history_1h_usd: 4600,
      volume_buy_1h_change_percent: 6.5,
      volume_sell_1h: 4600,
      volume_sell_1h_usd: 4600,
      volume_sell_history_1h: 4400,
      volume_sell_history_1h_usd: 4400,
      volume_sell_1h_change_percent: 4.5,
      trade_2h: 90,
      trade_history_2h: 85,
      trade_2h_change_percent: 5.9,
      sell_2h: 44,
      sell_history_2h: 42,
      sell_2h_change_percent: 4.8,
      buy_2h: 46,
      buy_history_2h: 43,
      buy_2h_change_percent: 7.0,
      volume_2h: 18000,
      volume_2h_usd: 18000,
      volume_history_2h: 17000,
      volume_history_2h_usd: 17000,
      volume_2h_change_percent: 5.9,
      volume_buy_2h: 9200,
      volume_buy_2h_usd: 9200,
      volume_buy_history_2h: 8700,
      volume_buy_history_2h_usd: 8700,
      volume_buy_2h_change_percent: 5.7,
      volume_sell_2h: 8800,
      volume_sell_2h_usd: 8800,
      volume_sell_history_2h: 8300,
      volume_sell_history_2h_usd: 8300,
      volume_sell_2h_change_percent: 6.0,
      trade_4h: 175,
      trade_history_4h: 165,
      trade_4h_change_percent: 6.1,
      sell_4h: 86,
      sell_history_4h: 82,
      sell_4h_change_percent: 4.9,
      buy_4h: 89,
      buy_history_4h: 83,
      buy_4h_change_percent: 7.2,
      volume_4h: 35000,
      volume_4h_usd: 35000,
      volume_history_4h: 33000,
      volume_history_4h_usd: 33000,
      volume_4h_change_percent: 6.1,
      volume_buy_4h: 18000,
      volume_buy_4h_usd: 18000,
      volume_buy_history_4h: 17000,
      volume_buy_history_4h_usd: 17000,
      volume_buy_4h_change_percent: 5.9,
      volume_sell_4h: 17000,
      volume_sell_4h_usd: 17000,
      volume_sell_history_4h: 16000,
      volume_sell_history_4h_usd: 16000,
      volume_sell_4h_change_percent: 6.3,
      trade_8h: 325,
      trade_history_8h: 300,
      trade_8h_change_percent: 8.3,
      sell_8h: 160,
      sell_history_8h: 148,
      sell_8h_change_percent: 8.1,
      buy_8h: 165,
      buy_history_8h: 152,
      buy_8h_change_percent: 8.6,
      volume_8h: 65000,
      volume_8h_usd: 65000,
      volume_history_8h: 60000,
      volume_history_8h_usd: 60000,
      volume_8h_change_percent: 8.3,
      volume_buy_8h: 33500,
      volume_buy_8h_usd: 33500,
      volume_buy_history_8h: 31000,
      volume_buy_history_8h_usd: 31000,
      volume_buy_8h_change_percent: 8.1,
      volume_sell_8h: 31500,
      volume_sell_8h_usd: 31500,
      volume_sell_history_8h: 29000,
      volume_sell_history_8h_usd: 29000,
      volume_sell_8h_change_percent: 8.6,
      trade_24h: 600,
      trade_history_24h: 550,
      trade_24h_change_percent: 9.1,
      sell_24h: 295,
      sell_history_24h: 270,
      sell_24h_change_percent: 9.3,
      buy_24h: 305,
      buy_history_24h: 280,
      buy_24h_change_percent: 8.9,
      volume_history_24h: 46000,
      volume_history_24h_usd: 46000,
      volume_24h_change_percent: 8.7,
      volume_buy_24h: 26000,
      volume_buy_24h_usd: 26000,
      volume_buy_history_24h: 24000,
      volume_buy_history_24h_usd: 24000,
      volume_buy_24h_change_percent: 8.3,
      volume_sell_24h: 24000,
      volume_sell_24h_usd: 24000,
      volume_sell_history_24h: 22000,
      volume_sell_history_24h_usd: 22000,
      volume_sell_24h_change_percent: 9.1,
    });

    vi.spyOn(service['dexscreenerClient'], 'search').mockResolvedValue({
      schemaVersion: '1.0.0',
      pairs: [
        {
          chainId: 'solana',
          dexId: 'raydium',
          url: 'https://dexscreener.com/solana/TEST_ADDR',
          pairAddress: 'PAIR_ADDR',
          baseToken: {
            address: 'TEST_ADDR',
            name: 'Test Token',
            symbol: 'TEST',
          },
          quoteToken: {
            address: 'So11111111111111111111111111111111111111112',
            name: 'Solana',
            symbol: 'SOL',
          },
          priceNative: '0.000015',
          priceUsd: '1.5',
          txns: {
            m5: { buys: 5, sells: 3 },
            h1: { buys: 25, sells: 20 },
            h6: { buys: 120, sells: 100 },
            h24: { buys: 305, sells: 295 },
          },
          volume: {
            h24: 50000,
            h6: 12000,
            h1: 2500,
            m5: 500,
          },
          priceChange: {
            h24: 5.2,
            h6: 2.1,
            h1: 1.1,
            m5: 0.5,
          },
          liquidity: {
            usd: 100000,
            base: 66666.67,
            quote: 1000,
          },
          fdv: 1500000,
          marketCap: 1000000,
          pairCreatedAt: Date.now() - 86400000,
          info: {
            imageUrl: 'https://example.com/logo.png',
            websites: [{ label: 'Website', url: 'https://example.com' }],
            socials: [{ type: 'twitter', url: 'https://twitter.com/example' }],
          },
          boosts: {
            active: 0,
          },
        },
      ],
    });

    vi.spyOn(service['dexscreenerClient'], 'searchForHighestLiquidityPair').mockResolvedValue({
      chainId: 'solana',
      dexId: 'raydium',
      url: 'https://dexscreener.com/solana/TEST_ADDR',
      pairAddress: 'PAIR_ADDR',
      baseToken: {
        address: 'TEST_ADDR',
        name: 'Test Token',
        symbol: 'TEST',
      },
      quoteToken: {
        address: 'So11111111111111111111111111111111111111112',
        name: 'Solana',
        symbol: 'SOL',
      },
      priceNative: '0.000015',
      priceUsd: '1.5',
      txns: {
        m5: { buys: 5, sells: 3 },
        h1: { buys: 25, sells: 20 },
        h6: { buys: 120, sells: 100 },
        h24: { buys: 305, sells: 295 },
      },
      volume: {
        h24: 50000,
        h6: 12000,
        h1: 2500,
        m5: 500,
      },
      priceChange: {
        h24: 5.2,
        h6: 2.1,
        h1: 1.1,
        m5: 0.5,
      },
      liquidity: {
        usd: 100000,
        base: 66666.67,
        quote: 1000,
      },
      fdv: 1500000,
      marketCap: 1000000,
      pairCreatedAt: Date.now() - 86400000,
      info: {
        imageUrl: 'https://example.com/logo.png',
        websites: [{ label: 'Website', url: 'https://example.com' }],
        socials: [{ type: 'twitter', url: 'https://twitter.com/example' }],
      },
      boosts: {
        active: 0,
      },
    });

    // Mock global fetch for any remaining network calls
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: {} }),
    } as Response);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('calculateUserTrustScore', () => {
    it('should initialize score to 0 for a new user with no recommendations', async () => {
      (mockRuntime.getComponent as any).mockResolvedValue(null);
      (mockRuntime.createComponent as any).mockResolvedValue(asUUID(uuidv4()));

      await service.calculateUserTrustScore(testUserId, mockRuntime, testWorldId);

      expect(mockRuntime.createComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: testUserId,
          type: TRUST_MARKETPLACE_COMPONENT_TYPE,
          worldId: testWorldId,
          data: expect.objectContaining({
            userId: testUserId,
            trustScore: 0,
            recommendations: [],
          }),
        })
      );
    });

    it('should increase score for a profitable BUY recommendation', async () => {
      const existingComponent = createMockCoreComponent(testUserId, {
        userId: testUserId,
        trustScore: 0,
        recommendations: [
          {
            id: asUUID(uuidv4()),
            userId: testUserId,
            timestamp: Date.now() - 1000,
            tokenAddress: 'TEST_ADDR',
            chain: SupportedChain.SOLANA,
            recommendationType: 'BUY',
            conviction: Conviction.HIGH,
            rawMessageQuote: 'Test BUY',
            priceAtRecommendation: 10.0,
            processedForTradeDecision: false,
          },
        ],
      });

      (mockRuntime.getComponent as any).mockResolvedValue(existingComponent);

      // Override the mock for this specific test to return profitable data
      vi.spyOn(service['birdeyeClient'], 'fetchPrice').mockResolvedValue(15.0); // Profitable price
      vi.spyOn(service['birdeyeClient'], 'fetchTokenTradeData').mockResolvedValue({
        address: 'TEST_ADDR',
        holder: 1000,
        market: 1000000,
        last_trade_unix_time: Date.now(),
        last_trade_human_time: new Date().toISOString(),
        price: 15.0, // Profitable price
        history_30m_price: 14.0,
        price_change_30m_percent: 7.1,
        history_1h_price: 14.5,
        price_change_1h_percent: 3.4,
        history_2h_price: 14.8,
        price_change_2h_percent: 1.4,
        history_4h_price: 15.1,
        price_change_4h_percent: -0.7,
        history_6h_price: 14.9,
        price_change_6h_percent: 0.7,
        history_8h_price: 14.8,
        price_change_8h_percent: 1.4,
        history_12h_price: 14.5,
        price_change_12h_percent: 3.4,
        history_24h_price: 14.0,
        price_change_24h_percent: 7.1,
        unique_wallet_30m: 50,
        unique_wallet_history_30m: 48,
        unique_wallet_30m_change_percent: 4.2,
        unique_wallet_1h: 95,
        unique_wallet_history_1h: 90,
        unique_wallet_1h_change_percent: 5.6,
        unique_wallet_2h: 180,
        unique_wallet_history_2h: 170,
        unique_wallet_2h_change_percent: 5.9,
        unique_wallet_4h: 350,
        unique_wallet_history_4h: 330,
        unique_wallet_4h_change_percent: 6.1,
        unique_wallet_8h: 650,
        unique_wallet_history_8h: 600,
        unique_wallet_8h_change_percent: 8.3,
        unique_wallet_24h: 1200,
        unique_wallet_history_24h: 1100,
        unique_wallet_24h_change_percent: 9.1,
        volume_24h_usd: 50000,
        volume_24h: 50000,
        trade_30m: 25,
        trade_history_30m: 23,
        trade_30m_change_percent: 8.7,
        sell_30m: 12,
        sell_history_30m: 11,
        sell_30m_change_percent: 9.1,
        buy_30m: 13,
        buy_history_30m: 12,
        buy_30m_change_percent: 8.3,
        volume_30m: 5000,
        volume_30m_usd: 5000,
        volume_history_30m: 4800,
        volume_history_30m_usd: 4800,
        volume_30m_change_percent: 4.2,
        volume_buy_30m: 2600,
        volume_buy_30m_usd: 2600,
        volume_buy_history_30m: 2500,
        volume_buy_history_30m_usd: 2500,
        volume_buy_30m_change_percent: 4.0,
        volume_sell_30m: 2400,
        volume_sell_30m_usd: 2400,
        volume_sell_history_30m: 2300,
        volume_sell_history_30m_usd: 2300,
        volume_sell_30m_change_percent: 4.3,
        trade_1h: 48,
        trade_history_1h: 45,
        trade_1h_change_percent: 6.7,
        sell_1h: 23,
        sell_history_1h: 22,
        sell_1h_change_percent: 4.5,
        buy_1h: 25,
        buy_history_1h: 23,
        buy_1h_change_percent: 8.7,
        volume_1h: 9500,
        volume_1h_usd: 9500,
        volume_history_1h: 9000,
        volume_history_1h_usd: 9000,
        volume_1h_change_percent: 5.6,
        volume_buy_1h: 4900,
        volume_buy_1h_usd: 4900,
        volume_buy_history_1h: 4600,
        volume_buy_history_1h_usd: 4600,
        volume_buy_1h_change_percent: 6.5,
        volume_sell_1h: 4600,
        volume_sell_1h_usd: 4600,
        volume_sell_history_1h: 4400,
        volume_sell_history_1h_usd: 4400,
        volume_sell_1h_change_percent: 4.5,
        trade_2h: 90,
        trade_history_2h: 85,
        trade_2h_change_percent: 5.9,
        sell_2h: 44,
        sell_history_2h: 42,
        sell_2h_change_percent: 4.8,
        buy_2h: 46,
        buy_history_2h: 43,
        buy_2h_change_percent: 7.0,
        volume_2h: 18000,
        volume_2h_usd: 18000,
        volume_history_2h: 17000,
        volume_history_2h_usd: 17000,
        volume_2h_change_percent: 5.9,
        volume_buy_2h: 9200,
        volume_buy_2h_usd: 9200,
        volume_buy_history_2h: 8700,
        volume_buy_history_2h_usd: 8700,
        volume_buy_2h_change_percent: 5.7,
        volume_sell_2h: 8800,
        volume_sell_2h_usd: 8800,
        volume_sell_history_2h: 8300,
        volume_sell_history_2h_usd: 8300,
        volume_sell_2h_change_percent: 6.0,
        trade_4h: 175,
        trade_history_4h: 165,
        trade_4h_change_percent: 6.1,
        sell_4h: 86,
        sell_history_4h: 82,
        sell_4h_change_percent: 4.9,
        buy_4h: 89,
        buy_history_4h: 83,
        buy_4h_change_percent: 7.2,
        volume_4h: 35000,
        volume_4h_usd: 35000,
        volume_history_4h: 33000,
        volume_history_4h_usd: 33000,
        volume_4h_change_percent: 6.1,
        volume_buy_4h: 18000,
        volume_buy_4h_usd: 18000,
        volume_buy_history_4h: 17000,
        volume_buy_history_4h_usd: 17000,
        volume_buy_4h_change_percent: 5.9,
        volume_sell_4h: 17000,
        volume_sell_4h_usd: 17000,
        volume_sell_history_4h: 16000,
        volume_sell_history_4h_usd: 16000,
        volume_sell_4h_change_percent: 6.3,
        trade_8h: 325,
        trade_history_8h: 300,
        trade_8h_change_percent: 8.3,
        sell_8h: 160,
        sell_history_8h: 148,
        sell_8h_change_percent: 8.1,
        buy_8h: 165,
        buy_history_8h: 152,
        buy_8h_change_percent: 8.6,
        volume_8h: 65000,
        volume_8h_usd: 65000,
        volume_history_8h: 60000,
        volume_history_8h_usd: 60000,
        volume_8h_change_percent: 8.3,
        volume_buy_8h: 33500,
        volume_buy_8h_usd: 33500,
        volume_buy_history_8h: 31000,
        volume_buy_history_8h_usd: 31000,
        volume_buy_8h_change_percent: 8.1,
        volume_sell_8h: 31500,
        volume_sell_8h_usd: 31500,
        volume_sell_history_8h: 29000,
        volume_sell_history_8h_usd: 29000,
        volume_sell_8h_change_percent: 8.6,
        trade_24h: 600,
        trade_history_24h: 550,
        trade_24h_change_percent: 9.1,
        sell_24h: 295,
        sell_history_24h: 270,
        sell_24h_change_percent: 9.3,
        buy_24h: 305,
        buy_history_24h: 280,
        buy_24h_change_percent: 8.9,
        volume_history_24h: 46000,
        volume_history_24h_usd: 46000,
        volume_24h_change_percent: 8.7,
        volume_buy_24h: 26000,
        volume_buy_24h_usd: 26000,
        volume_buy_history_24h: 24000,
        volume_buy_history_24h_usd: 24000,
        volume_buy_24h_change_percent: 8.3,
        volume_sell_24h: 24000,
        volume_sell_24h_usd: 24000,
        volume_sell_history_24h: 22000,
        volume_sell_history_24h_usd: 22000,
        volume_sell_24h_change_percent: 9.1,
      });

      await service.calculateUserTrustScore(testUserId, mockRuntime, testWorldId);

      expect(mockRuntime.updateComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trustScore: expect.closeTo(50.0, 5.0), // 50% profit should give positive score
          }),
        })
      );
    });

    it('should decrease score for a bad BUY recommendation', async () => {
      const existingComponent = createMockCoreComponent(testUserId, {
        userId: testUserId,
        trustScore: 0,
        recommendations: [
          {
            id: asUUID(uuidv4()),
            userId: testUserId,
            timestamp: Date.now() - 1000,
            tokenAddress: 'BAD_ADDR',
            chain: SupportedChain.SOLANA,
            recommendationType: 'BUY',
            conviction: Conviction.HIGH,
            rawMessageQuote: 'Test BAD BUY',
            priceAtRecommendation: 100.0,
            processedForTradeDecision: false,
          },
        ],
      });

      (mockRuntime.getComponent as any).mockResolvedValue(existingComponent);

      // Mock bad token data for this specific address
      const getTokenAPIDataSpy = vi.spyOn(service, 'getTokenAPIData').mockResolvedValue({
        currentPrice: 10.0, // Price dropped from 100 to 10
        name: 'BadToken',
        symbol: 'BAD',
        priceHistory: [
          { timestamp: Date.now() - 2000, price: 100.0 },
          { timestamp: Date.now(), price: 10.0 },
        ],
        liquidity: 5000,
        marketCap: 50000,
        isKnownScam: false,
      });

      await service.calculateUserTrustScore(testUserId, mockRuntime, testWorldId);

      expect(mockRuntime.updateComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trustScore: expect.closeTo(-90.0, 0.1), // Use closeTo for floating point comparison
          }),
        })
      );

      getTokenAPIDataSpy.mockRestore();
    });
  });

  describe('evaluateRecommendationPerformance', () => {
    it('should calculate profit for BUY recommendations', async () => {
      const recommendation: Recommendation = {
        id: asUUID(uuidv4()),
        userId: testUserId,
        messageId: asUUID(uuidv4()),
        timestamp: Date.now() - 1000,
        tokenAddress: 'TEST_ADDR',
        chain: SupportedChain.SOLANA,
        recommendationType: 'BUY',
        conviction: Conviction.HIGH,
        rawMessageQuote: 'Test BUY',
        priceAtRecommendation: 10.0,
        processedForTradeDecision: false,
      };

      const tokenData = {
        currentPrice: 12.0,
        name: 'TestToken',
        symbol: 'TEST',
        priceHistory: [
          { timestamp: Date.now() - 1000, price: 10.0 },
          { timestamp: Date.now(), price: 12.0 },
        ],
        liquidity: 100000,
        marketCap: 1000000,
        isKnownScam: false,
      } as TokenAPIData;

      const result = await service.evaluateRecommendationPerformance(recommendation, tokenData);

      expect(result.potentialProfitPercent).toBeCloseTo(20.0, 1); // 20% profit
      expect(result.isScamOrRug).toBe(false);
    });

    it('should calculate avoided loss for SELL recommendations', async () => {
      const recommendation: Recommendation = {
        id: asUUID(uuidv4()),
        userId: testUserId,
        messageId: asUUID(uuidv4()),
        timestamp: Date.now() - 1000,
        tokenAddress: 'TEST_ADDR',
        chain: SupportedChain.SOLANA,
        recommendationType: 'SELL',
        conviction: Conviction.HIGH,
        rawMessageQuote: 'Test SELL',
        priceAtRecommendation: 10.0,
        processedForTradeDecision: false,
      };

      const tokenData = {
        currentPrice: 5.0,
        name: 'TestToken',
        symbol: 'TEST',
        priceHistory: [
          { timestamp: Date.now() - 1000, price: 10.0 },
          { timestamp: Date.now(), price: 5.0 },
        ],
        liquidity: 50000,
        marketCap: 500000,
        isKnownScam: false,
      } as TokenAPIData;

      const result = await service.evaluateRecommendationPerformance(recommendation, tokenData);

      expect(result.avoidedLossPercent).toBeCloseTo(50.0, 1); // Avoided 50% loss
      expect(result.isScamOrRug).toBe(false);
    });
  });

  describe('isLikelyScamOrRug', () => {
    it('should flag tokens with severe price drops', async () => {
      const tokenData = {
        currentPrice: 1.0,
        name: 'TestToken',
        symbol: 'TEST',
        priceHistory: [
          { timestamp: Date.now() - 1000, price: 100.0 },
          { timestamp: Date.now(), price: 1.0 },
        ],
        liquidity: 10000,
        marketCap: 50000,
        isKnownScam: false,
      } as TokenAPIData;

      const result = await service.isLikelyScamOrRug(tokenData, Date.now() - 2000);

      expect(result).toBe(true);
    });

    it('should flag tokens with critical liquidity', async () => {
      const tokenData = {
        currentPrice: 1.0,
        name: 'TestToken',
        symbol: 'TEST',
        priceHistory: [
          { timestamp: Date.now() - 1000, price: 1.0 },
          { timestamp: Date.now(), price: 1.0 },
        ],
        liquidity: 100, // Critical liquidity
        marketCap: 50000,
        isKnownScam: false,
      } as TokenAPIData;

      const result = await service.isLikelyScamOrRug(tokenData, Date.now() - 2000);

      expect(result).toBe(true);
    });

    it('should not flag healthy tokens', async () => {
      const tokenData = {
        currentPrice: 1.0,
        name: 'TestToken',
        symbol: 'TEST',
        priceHistory: [
          { timestamp: Date.now() - 1000, price: 0.9 },
          { timestamp: Date.now(), price: 1.0 },
        ],
        liquidity: 100000, // Good liquidity
        marketCap: 1000000,
        isKnownScam: false,
      } as TokenAPIData;

      const result = await service.isLikelyScamOrRug(tokenData, Date.now() - 2000);

      expect(result).toBe(false);
    });
  });

  describe('getTokenAPIData', () => {
    it('should handle getTokenAPIData for different chains', async () => {
      const result = await service.getTokenAPIData('SOL_ADDR', SupportedChain.SOLANA);

      expect(result).toEqual(
        expect.objectContaining({
          currentPrice: expect.any(Number), // The service processes the data differently
          name: expect.any(String),
          symbol: expect.any(String),
        })
      );
    });

    it('should return null when all API calls fail', async () => {
      const originalLoggerError = logger.error;
      const originalLoggerWarn = logger.warn;
      logger.error = vi.fn(); // Suppress logger.error for this test
      logger.warn = vi.fn(); // Suppress logger.warn for this test

      // Spies for API client methods
      const fetchOverviewSpy = vi
        .spyOn(service['birdeyeClient'], 'fetchTokenOverview')
        .mockRejectedValue(new Error('API Error'));
      const fetchPriceSpy = vi
        .spyOn(service['birdeyeClient'], 'fetchPrice')
        .mockRejectedValue(new Error('API Error'));
      const fetchSecuritySpy = vi
        .spyOn(service['birdeyeClient'], 'fetchTokenSecurity')
        .mockRejectedValue(new Error('API Error'));
      const fetchTradeDataSpy = vi
        .spyOn(service['birdeyeClient'], 'fetchTokenTradeData')
        .mockRejectedValue(new Error('API Error'));
      const dexscreenerSearchSpy = vi
        .spyOn(service['dexscreenerClient'], 'search')
        .mockRejectedValue(new Error('API Error'));
      const dexscreenerHighestLiqSpy = vi
        .spyOn(service['dexscreenerClient'], 'searchForHighestLiquidityPair')
        .mockRejectedValue(new Error('API Error'));

      try {
        const result = await service.getTokenAPIData('INVALID_ADDR', SupportedChain.SOLANA);
        // Vitest's expect is fine here as this is a .test.ts file run by Vitest
        expect(result).toBeNull();
      } finally {
        // Restore original logger functions and spies
        logger.error = originalLoggerError;
        logger.warn = originalLoggerWarn;
        fetchOverviewSpy.mockRestore();
        fetchPriceSpy.mockRestore();
        fetchSecuritySpy.mockRestore();
        fetchTradeDataSpy.mockRestore();
        dexscreenerSearchSpy.mockRestore();
        dexscreenerHighestLiqSpy.mockRestore();
      }
    });
  });

  describe('getLeaderboardData', () => {
    it('should return sorted leaderboard entries', async () => {
      const mockAgents = [
        { id: asUUID(uuidv4()), name: 'Agent1' },
        { id: asUUID(uuidv4()), name: 'Agent2' },
        { id: asUUID(uuidv4()), name: 'Agent3' },
      ];

      // Mock getAgents to return our test agents
      (mockRuntime.getAgents as any) = vi.fn().mockResolvedValue(mockAgents);
      (mockRuntime.getEntityById as any) = vi
        .fn()
        .mockImplementation((id: any) =>
          Promise.resolve({ names: [mockAgents.find((a) => a.id === id)?.name || 'Unknown'] })
        );

      // Mock components with different trust scores
      (mockRuntime.getComponent as any) = vi.fn().mockImplementation((entityId: any) => {
        const agent = mockAgents.find((a) => a.id === entityId);
        if (!agent) return null;

        const trustScore = agent.name === 'Agent1' ? 85 : agent.name === 'Agent2' ? 70 : 55;
        return createMockCoreComponent(entityId, {
          userId: entityId,
          trustScore,
          recommendations: [],
        });
      });

      const result = await service.getLeaderboardData(mockRuntime);

      expect(result).toHaveLength(3);
      expect(result[0].trustScore).toBe(85); // Agent1 should be first
      expect(result[1].trustScore).toBe(70); // Agent2 should be second
      expect(result[2].trustScore).toBe(55); // Agent3 should be third
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
      expect(result[2].rank).toBe(3);
    });
  });
});

describe('Comprehensive User Scenario Tests', () => {
  let service: CommunityInvestorService;
  let mockRuntime: IAgentRuntime;
  const testWorldId = asUUID(uuidv4());

  // User archetypes
  const normieUser = asUUID(uuidv4());
  const proUser = asUUID(uuidv4());
  const inconsistentCritic = asUUID(uuidv4());
  const expertCritic = asUUID(uuidv4());
  const scammerUser = asUUID(uuidv4());

  beforeEach(() => {
    mockRuntime = createMockRuntime();
    service = new CommunityInvestorService(mockRuntime);

    // Mock API clients to prevent real network calls
    vi.spyOn(service['birdeyeClient'], 'fetchTokenOverview').mockResolvedValue({
      address: 'TEST_ADDR',
      name: 'Test Token',
      symbol: 'TEST',
      decimals: 9,
      logoURI: 'https://example.com/logo.png',
    });

    vi.spyOn(service['birdeyeClient'], 'fetchPrice').mockResolvedValue(1.5);

    vi.spyOn(service['birdeyeClient'], 'fetchTokenSecurity').mockResolvedValue({
      ownerBalance: '1000000',
      creatorBalance: '500000',
      ownerPercentage: 10,
      creatorPercentage: 5,
      top10HolderBalance: '2500000',
      top10HolderPercent: 25,
    });

    vi.spyOn(service['birdeyeClient'], 'fetchTokenTradeData').mockResolvedValue({
      address: 'TEST_ADDR',
      holder: 1000,
      market: 1000000,
      last_trade_unix_time: Date.now(),
      last_trade_human_time: new Date().toISOString(),
      price: 1.5,
      history_30m_price: 1.4,
      price_change_30m_percent: 7.1,
      history_1h_price: 1.45,
      price_change_1h_percent: 3.4,
      history_2h_price: 1.48,
      price_change_2h_percent: 1.4,
      history_4h_price: 1.51,
      price_change_4h_percent: -0.7,
      history_6h_price: 1.49,
      price_change_6h_percent: 0.7,
      history_8h_price: 1.48,
      price_change_8h_percent: 1.4,
      history_12h_price: 1.45,
      price_change_12h_percent: 3.4,
      history_24h_price: 1.4,
      price_change_24h_percent: 7.1,
      unique_wallet_30m: 50,
      unique_wallet_history_30m: 48,
      unique_wallet_30m_change_percent: 4.2,
      unique_wallet_1h: 95,
      unique_wallet_history_1h: 90,
      unique_wallet_1h_change_percent: 5.6,
      unique_wallet_2h: 180,
      unique_wallet_history_2h: 170,
      unique_wallet_2h_change_percent: 5.9,
      unique_wallet_4h: 350,
      unique_wallet_history_4h: 330,
      unique_wallet_4h_change_percent: 6.1,
      unique_wallet_8h: 650,
      unique_wallet_history_8h: 600,
      unique_wallet_8h_change_percent: 8.3,
      unique_wallet_24h: 1200,
      unique_wallet_history_24h: 1100,
      unique_wallet_24h_change_percent: 9.1,
      volume_24h_usd: 50000,
      volume_24h: 50000,
      // Add other required fields with default values
      trade_30m: 25,
      trade_history_30m: 23,
      trade_30m_change_percent: 8.7,
      sell_30m: 12,
      sell_history_30m: 11,
      sell_30m_change_percent: 9.1,
      buy_30m: 13,
      buy_history_30m: 12,
      buy_30m_change_percent: 8.3,
      volume_30m: 5000,
      volume_30m_usd: 5000,
      volume_history_30m: 4800,
      volume_history_30m_usd: 4800,
      volume_30m_change_percent: 4.2,
      volume_buy_30m: 2600,
      volume_buy_30m_usd: 2600,
      volume_buy_history_30m: 2500,
      volume_buy_history_30m_usd: 2500,
      volume_buy_30m_change_percent: 4.0,
      volume_sell_30m: 2400,
      volume_sell_30m_usd: 2400,
      volume_sell_history_30m: 2300,
      volume_sell_history_30m_usd: 2300,
      volume_sell_30m_change_percent: 4.3,
      trade_1h: 48,
      trade_history_1h: 45,
      trade_1h_change_percent: 6.7,
      sell_1h: 23,
      sell_history_1h: 22,
      sell_1h_change_percent: 4.5,
      buy_1h: 25,
      buy_history_1h: 23,
      buy_1h_change_percent: 8.7,
      volume_1h: 9500,
      volume_1h_usd: 9500,
      volume_history_1h: 9000,
      volume_history_1h_usd: 9000,
      volume_1h_change_percent: 5.6,
      volume_buy_1h: 4900,
      volume_buy_1h_usd: 4900,
      volume_buy_history_1h: 4600,
      volume_buy_history_1h_usd: 4600,
      volume_buy_1h_change_percent: 6.5,
      volume_sell_1h: 4600,
      volume_sell_1h_usd: 4600,
      volume_sell_history_1h: 4400,
      volume_sell_history_1h_usd: 4400,
      volume_sell_1h_change_percent: 4.5,
      trade_2h: 90,
      trade_history_2h: 85,
      trade_2h_change_percent: 5.9,
      sell_2h: 44,
      sell_history_2h: 42,
      sell_2h_change_percent: 4.8,
      buy_2h: 46,
      buy_history_2h: 43,
      buy_2h_change_percent: 7.0,
      volume_2h: 18000,
      volume_2h_usd: 18000,
      volume_history_2h: 17000,
      volume_history_2h_usd: 17000,
      volume_2h_change_percent: 5.9,
      volume_buy_2h: 9200,
      volume_buy_2h_usd: 9200,
      volume_buy_history_2h: 8700,
      volume_buy_history_2h_usd: 8700,
      volume_buy_2h_change_percent: 5.7,
      volume_sell_2h: 8800,
      volume_sell_2h_usd: 8800,
      volume_sell_history_2h: 8300,
      volume_sell_history_2h_usd: 8300,
      volume_sell_2h_change_percent: 6.0,
      trade_4h: 175,
      trade_history_4h: 165,
      trade_4h_change_percent: 6.1,
      sell_4h: 86,
      sell_history_4h: 82,
      sell_4h_change_percent: 4.9,
      buy_4h: 89,
      buy_history_4h: 83,
      buy_4h_change_percent: 7.2,
      volume_4h: 35000,
      volume_4h_usd: 35000,
      volume_history_4h: 33000,
      volume_history_4h_usd: 33000,
      volume_4h_change_percent: 6.1,
      volume_buy_4h: 18000,
      volume_buy_4h_usd: 18000,
      volume_buy_history_4h: 17000,
      volume_buy_history_4h_usd: 17000,
      volume_buy_4h_change_percent: 5.9,
      volume_sell_4h: 17000,
      volume_sell_4h_usd: 17000,
      volume_sell_history_4h: 16000,
      volume_sell_history_4h_usd: 16000,
      volume_sell_4h_change_percent: 6.3,
      trade_8h: 325,
      trade_history_8h: 300,
      trade_8h_change_percent: 8.3,
      sell_8h: 160,
      sell_history_8h: 148,
      sell_8h_change_percent: 8.1,
      buy_8h: 165,
      buy_history_8h: 152,
      buy_8h_change_percent: 8.6,
      volume_8h: 65000,
      volume_8h_usd: 65000,
      volume_history_8h: 60000,
      volume_history_8h_usd: 60000,
      volume_8h_change_percent: 8.3,
      volume_buy_8h: 33500,
      volume_buy_8h_usd: 33500,
      volume_buy_history_8h: 31000,
      volume_buy_history_8h_usd: 31000,
      volume_buy_8h_change_percent: 8.1,
      volume_sell_8h: 31500,
      volume_sell_8h_usd: 31500,
      volume_sell_history_8h: 29000,
      volume_sell_history_8h_usd: 29000,
      volume_sell_8h_change_percent: 8.6,
      trade_24h: 600,
      trade_history_24h: 550,
      trade_24h_change_percent: 9.1,
      sell_24h: 295,
      sell_history_24h: 270,
      sell_24h_change_percent: 9.3,
      buy_24h: 305,
      buy_history_24h: 280,
      buy_24h_change_percent: 8.9,
      volume_history_24h: 46000,
      volume_history_24h_usd: 46000,
      volume_24h_change_percent: 8.7,
      volume_buy_24h: 26000,
      volume_buy_24h_usd: 26000,
      volume_buy_history_24h: 24000,
      volume_buy_history_24h_usd: 24000,
      volume_buy_24h_change_percent: 8.3,
      volume_sell_24h: 24000,
      volume_sell_24h_usd: 24000,
      volume_sell_history_24h: 22000,
      volume_sell_history_24h_usd: 22000,
      volume_sell_24h_change_percent: 9.1,
    });

    vi.spyOn(service['dexscreenerClient'], 'search').mockResolvedValue({
      schemaVersion: '1.0.0',
      pairs: [
        {
          chainId: 'solana',
          dexId: 'raydium',
          url: 'https://dexscreener.com/solana/TEST_ADDR',
          pairAddress: 'PAIR_ADDR',
          baseToken: {
            address: 'TEST_ADDR',
            name: 'Test Token',
            symbol: 'TEST',
          },
          quoteToken: {
            address: 'So11111111111111111111111111111111111111112',
            name: 'Solana',
            symbol: 'SOL',
          },
          priceNative: '0.000015',
          priceUsd: '1.5',
          txns: {
            m5: { buys: 5, sells: 3 },
            h1: { buys: 25, sells: 20 },
            h6: { buys: 120, sells: 100 },
            h24: { buys: 305, sells: 295 },
          },
          volume: {
            h24: 50000,
            h6: 12000,
            h1: 2500,
            m5: 500,
          },
          priceChange: {
            h24: 5.2,
            h6: 2.1,
            h1: 1.1,
            m5: 0.5,
          },
          liquidity: {
            usd: 100000,
            base: 66666.67,
            quote: 1000,
          },
          fdv: 1500000,
          marketCap: 1000000,
          pairCreatedAt: Date.now() - 86400000,
          info: {
            imageUrl: 'https://example.com/logo.png',
            websites: [{ label: 'Website', url: 'https://example.com' }],
            socials: [{ type: 'twitter', url: 'https://twitter.com/example' }],
          },
          boosts: {
            active: 0,
          },
        },
      ],
    });

    vi.spyOn(service['dexscreenerClient'], 'searchForHighestLiquidityPair').mockResolvedValue({
      chainId: 'solana',
      dexId: 'raydium',
      url: 'https://dexscreener.com/solana/TEST_ADDR',
      pairAddress: 'PAIR_ADDR',
      baseToken: {
        address: 'TEST_ADDR',
        name: 'Test Token',
        symbol: 'TEST',
      },
      quoteToken: {
        address: 'So11111111111111111111111111111111111111112',
        name: 'Solana',
        symbol: 'SOL',
      },
      priceNative: '0.000015',
      priceUsd: '1.5',
      txns: {
        m5: { buys: 5, sells: 3 },
        h1: { buys: 25, sells: 20 },
        h6: { buys: 120, sells: 100 },
        h24: { buys: 305, sells: 295 },
      },
      volume: {
        h24: 50000,
        h6: 12000,
        h1: 2500,
        m5: 500,
      },
      priceChange: {
        h24: 5.2,
        h6: 2.1,
        h1: 1.1,
        m5: 0.5,
      },
      liquidity: {
        usd: 100000,
        base: 66666.67,
        quote: 1000,
      },
      fdv: 1500000,
      marketCap: 1000000,
      pairCreatedAt: Date.now() - 86400000,
      info: {
        imageUrl: 'https://example.com/logo.png',
        websites: [{ label: 'Website', url: 'https://example.com' }],
        socials: [{ type: 'twitter', url: 'https://twitter.com/example' }],
      },
      boosts: {
        active: 0,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should rank 5 different user archetypes correctly based on their trading patterns', async () => {
    // Mock token data responses for different scenarios
    const getTokenAPIDataSpy = vi
      .spyOn(service, 'getTokenAPIData')
      .mockImplementation(async (address: string) => {
        const tokenScenarios: Record<string, TokenAPIData> = {
          // Good tokens that go up
          GOOD_TOKEN_1: {
            currentPrice: 15.0,
            name: 'GoodToken1',
            symbol: 'GOOD1',
            priceHistory: [
              { timestamp: Date.now() - 86400000, price: 10.0 },
              { timestamp: Date.now(), price: 15.0 },
            ],
            liquidity: 500000,
            marketCap: 10000000,
            isKnownScam: false,
          },
          GOOD_TOKEN_2: {
            currentPrice: 25.0,
            name: 'GoodToken2',
            symbol: 'GOOD2',
            priceHistory: [
              { timestamp: Date.now() - 86400000, price: 10.0 },
              { timestamp: Date.now(), price: 25.0 },
            ],
            liquidity: 800000,
            marketCap: 20000000,
            isKnownScam: false,
          },
          // Bad tokens that dump
          BAD_TOKEN_1: {
            currentPrice: 2.0,
            name: 'BadToken1',
            symbol: 'BAD1',
            priceHistory: [
              { timestamp: Date.now() - 86400000, price: 10.0 },
              { timestamp: Date.now(), price: 2.0 },
            ],
            liquidity: 50000,
            marketCap: 200000,
            isKnownScam: false,
          },
          BAD_TOKEN_2: {
            currentPrice: 1.0,
            name: 'BadToken2',
            symbol: 'BAD2',
            priceHistory: [
              { timestamp: Date.now() - 86400000, price: 10.0 },
              { timestamp: Date.now(), price: 1.0 },
            ],
            liquidity: 30000,
            marketCap: 100000,
            isKnownScam: false,
          },
          // Scam tokens
          SCAM_TOKEN_1: {
            currentPrice: 0.01,
            name: 'ScamToken1',
            symbol: 'SCAM1',
            priceHistory: [
              { timestamp: Date.now() - 86400000, price: 10.0 },
              { timestamp: Date.now(), price: 0.01 },
            ],
            liquidity: 100, // Critical liquidity
            marketCap: 1000,
            isKnownScam: true,
          },
          SCAM_TOKEN_2: {
            currentPrice: 0.001,
            name: 'ScamToken2',
            symbol: 'SCAM2',
            priceHistory: [
              { timestamp: Date.now() - 86400000, price: 5.0 },
              { timestamp: Date.now(), price: 0.001 },
            ],
            liquidity: 50, // Critical liquidity
            marketCap: 500,
            isKnownScam: true,
          },
        };
        return tokenScenarios[address] || null;
      });

    // Create user profiles with different recommendation patterns
    const baseTime = Date.now() - 86400000; // 24 hours ago

    // 1. Normie User: Mixed results (some good, some bad)
    const normieProfile: UserTrustProfile = {
      version: '1.0.0',
      userId: normieUser,
      trustScore: 0,
      lastTrustScoreCalculationTimestamp: 0,
      recommendations: [
        {
          id: asUUID(uuidv4()),
          userId: normieUser,
          messageId: asUUID(uuidv4()),
          timestamp: baseTime,
          tokenAddress: 'GOOD_TOKEN_1',
          chain: SupportedChain.SOLANA,
          recommendationType: 'BUY',
          conviction: Conviction.MEDIUM,
          rawMessageQuote: 'I think GOOD1 might go up',
          priceAtRecommendation: 10.0,
          processedForTradeDecision: false,
        },
        {
          id: asUUID(uuidv4()),
          userId: normieUser,
          messageId: asUUID(uuidv4()),
          timestamp: baseTime + 3600000,
          tokenAddress: 'BAD_TOKEN_1',
          chain: SupportedChain.SOLANA,
          recommendationType: 'BUY',
          conviction: Conviction.LOW,
          rawMessageQuote: 'Maybe BAD1 is good?',
          priceAtRecommendation: 10.0,
          processedForTradeDecision: false,
        },
      ],
    };

    // 2. Pro User: Great BUY calls
    const proProfile: UserTrustProfile = {
      version: '1.0.0',
      userId: proUser,
      trustScore: 0,
      lastTrustScoreCalculationTimestamp: 0,
      recommendations: [
        {
          id: asUUID(uuidv4()),
          userId: proUser,
          messageId: asUUID(uuidv4()),
          timestamp: baseTime,
          tokenAddress: 'GOOD_TOKEN_1',
          chain: SupportedChain.SOLANA,
          recommendationType: 'BUY',
          conviction: Conviction.HIGH,
          rawMessageQuote: 'GOOD1 is going to moon! Strong fundamentals!',
          priceAtRecommendation: 10.0,
          processedForTradeDecision: false,
        },
        {
          id: asUUID(uuidv4()),
          userId: proUser,
          messageId: asUUID(uuidv4()),
          timestamp: baseTime + 1800000,
          tokenAddress: 'GOOD_TOKEN_2',
          chain: SupportedChain.SOLANA,
          recommendationType: 'BUY',
          conviction: Conviction.HIGH,
          rawMessageQuote: 'GOOD2 is the next big thing!',
          priceAtRecommendation: 10.0,
          processedForTradeDecision: false,
        },
      ],
    };

    // 3. Inconsistent Critic: Sometimes right, sometimes wrong
    const inconsistentCriticProfile: UserTrustProfile = {
      version: '1.0.0',
      userId: inconsistentCritic,
      trustScore: 0,
      lastTrustScoreCalculationTimestamp: 0,
      recommendations: [
        {
          id: asUUID(uuidv4()),
          userId: inconsistentCritic,
          messageId: asUUID(uuidv4()),
          timestamp: baseTime,
          tokenAddress: 'SCAM_TOKEN_1',
          chain: SupportedChain.SOLANA,
          recommendationType: 'SELL',
          conviction: Conviction.HIGH,
          rawMessageQuote: 'SCAM1 looks suspicious, avoid!',
          priceAtRecommendation: 10.0,
          processedForTradeDecision: false,
        },
        {
          id: asUUID(uuidv4()),
          userId: inconsistentCritic,
          messageId: asUUID(uuidv4()),
          timestamp: baseTime + 1800000,
          tokenAddress: 'GOOD_TOKEN_1',
          chain: SupportedChain.SOLANA,
          recommendationType: 'SELL',
          conviction: Conviction.MEDIUM,
          rawMessageQuote: 'GOOD1 is overvalued, sell now',
          priceAtRecommendation: 10.0,
          processedForTradeDecision: false,
        },
      ],
    };

    // 4. Expert Critic: Correctly identifies scams
    const expertCriticProfile: UserTrustProfile = {
      version: '1.0.0',
      userId: expertCritic,
      trustScore: 0,
      lastTrustScoreCalculationTimestamp: 0,
      recommendations: [
        {
          id: asUUID(uuidv4()),
          userId: expertCritic,
          messageId: asUUID(uuidv4()),
          timestamp: baseTime,
          tokenAddress: 'SCAM_TOKEN_1',
          chain: SupportedChain.SOLANA,
          recommendationType: 'SELL',
          conviction: Conviction.HIGH,
          rawMessageQuote: 'SCAM1 is a rug pull! Liquidity is too low!',
          priceAtRecommendation: 10.0,
          processedForTradeDecision: false,
        },
        {
          id: asUUID(uuidv4()),
          userId: expertCritic,
          messageId: asUUID(uuidv4()),
          timestamp: baseTime + 1800000,
          tokenAddress: 'SCAM_TOKEN_2',
          chain: SupportedChain.SOLANA,
          recommendationType: 'SELL',
          conviction: Conviction.HIGH,
          rawMessageQuote: 'SCAM2 has all the red flags of a scam!',
          priceAtRecommendation: 5.0,
          processedForTradeDecision: false,
        },
      ],
    };

    // 5. Scammer: Promotes scam tokens
    const scammerProfile: UserTrustProfile = {
      version: '1.0.0',
      userId: scammerUser,
      trustScore: 0,
      lastTrustScoreCalculationTimestamp: 0,
      recommendations: [
        {
          id: asUUID(uuidv4()),
          userId: scammerUser,
          messageId: asUUID(uuidv4()),
          timestamp: baseTime,
          tokenAddress: 'SCAM_TOKEN_1',
          chain: SupportedChain.SOLANA,
          recommendationType: 'BUY',
          conviction: Conviction.HIGH,
          rawMessageQuote: 'SCAM1 is going to 100x! Buy now!',
          priceAtRecommendation: 10.0,
          processedForTradeDecision: false,
        },
        {
          id: asUUID(uuidv4()),
          userId: scammerUser,
          messageId: asUUID(uuidv4()),
          timestamp: baseTime + 1800000,
          tokenAddress: 'SCAM_TOKEN_2',
          chain: SupportedChain.SOLANA,
          recommendationType: 'BUY',
          conviction: Conviction.HIGH,
          rawMessageQuote: 'SCAM2 is the next moonshot!',
          priceAtRecommendation: 5.0,
          processedForTradeDecision: false,
        },
      ],
    };

    // Mock getComponent to return our test profiles
    (mockRuntime.getComponent as any).mockImplementation((userId: any) => {
      const profiles = {
        [normieUser]: normieProfile,
        [proUser]: proProfile,
        [inconsistentCritic]: inconsistentCriticProfile,
        [expertCritic]: expertCriticProfile,
        [scammerUser]: scammerProfile,
      };
      const profile = profiles[userId];
      return profile ? createMockCoreComponent(userId, profile) : null;
    });

    // Calculate trust scores for all users
    await service.calculateUserTrustScore(normieUser, mockRuntime, testWorldId);
    await service.calculateUserTrustScore(proUser, mockRuntime, testWorldId);
    await service.calculateUserTrustScore(inconsistentCritic, mockRuntime, testWorldId);
    await service.calculateUserTrustScore(expertCritic, mockRuntime, testWorldId);
    await service.calculateUserTrustScore(scammerUser, mockRuntime, testWorldId);

    // Extract final scores from updateComponent calls
    const updateCalls = (mockRuntime.updateComponent as any).mock.calls;
    const finalScores: Record<string, number> = {};

    for (const call of updateCalls) {
      const component = call[0];
      const userId = component.entityId;
      const trustScore = component.data.trustScore;
      finalScores[userId] = trustScore;
    }

    // Map user IDs to readable names for debugging
    const scoresByName = {
      normie: finalScores[normieUser] || 0,
      pro: finalScores[proUser] || 0,
      inconsistentCritic: finalScores[inconsistentCritic] || 0,
      expertCritic: finalScores[expertCritic] || 0,
      scammer: finalScores[scammerUser] || 0,
    };

    console.log('Final Trust Scores:', scoresByName);

    // Validate ranking expectations
    // 1. Expert Critic should have the highest score (correctly identified scams - extremely valuable!)
    expect(finalScores[expertCritic]).toBeGreaterThan(finalScores[proUser]);
    expect(finalScores[expertCritic]).toBeGreaterThan(finalScores[normieUser]);
    expect(finalScores[expertCritic]).toBeGreaterThan(finalScores[inconsistentCritic]);
    expect(finalScores[expertCritic]).toBeGreaterThan(finalScores[scammerUser]);
    expect(finalScores[expertCritic]).toBeGreaterThan(0); // Should be positive

    // 2. Pro should have the second highest score (great BUY calls on tokens that pumped)
    expect(finalScores[proUser]).toBeGreaterThan(finalScores[normieUser]);
    expect(finalScores[proUser]).toBeGreaterThan(finalScores[scammerUser]);
    expect(finalScores[proUser]).toBeGreaterThan(0); // Should be positive

    // 3. Normie should be neutral/slightly positive (mixed results)
    expect(finalScores[normieUser]).toBeGreaterThan(finalScores[scammerUser]);

    // 4. Scammer should have the lowest score (promoted scam tokens)
    expect(finalScores[scammerUser]).toBeLessThan(0); // Should be negative

    // 5. Inconsistent critic should be somewhere in the middle
    expect(finalScores[inconsistentCritic]).toBeGreaterThan(finalScores[scammerUser]);

    getTokenAPIDataSpy.mockRestore();
  });
});
