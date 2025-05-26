import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { type IAgentRuntime, type Plugin, type Memory, type UUID, logger, Service, ChannelType, ModelType } from '@elizaos/core';
import * as core from '@elizaos/core';
import { degenIntelPlugin } from '../index';
import type { Sentiment, Token } from '../schemas';
import type { Portfolio, TransactionHistory } from '../tasks/birdeye';
import Birdeye from '../tasks/birdeye';
import Twitter from '../tasks/twitter';
import TwitterParser from '../tasks/twitterParser';

const createMockSolanaService = () => ({
  name: 'solana' as const,
  getConnection: vi.fn().mockReturnValue({ getBalance: vi.fn().mockResolvedValue(1_000_000_000) }),
  getPublicKey: vi.fn().mockReturnValue({ toBase58: () => 'BzsJQeZ7cvk3pTHmKeuvdhNDkDxcZ6uCXxW2rjwC7RTq' }),
  forceUpdate: vi.fn().mockResolvedValue({ items: [] }),
});

// Reverted to a more standard vi.fn() based mock with a final cast.
const createMockRuntime = (): IAgentRuntime => {
  const services = new Map<string, Service>();
  const providers: any[] = [];
  const cache = new Map<string, any>();
  const eventHandlers = new Map<string, Function[]>();
  let memories: Memory[] = [];
  let tasks: any[] = [];

  const mockSolana = createMockSolanaService();
  const mockTwitter = {
    name: 'twitter',
    getClient: vi.fn().mockReturnValue({
      client: {
        twitterClient: {
          getTweets: vi.fn().mockImplementation(async function* (username?: string, count?: number) {
            yield { 
              id: 'mocktweet_id_123', 
              text: `Mock tweet for ${username || 'default'}`,
              isRetweet: false, 
              username: username || 'mockuser', 
              timestamp: Date.now() / 1000, 
              likes: 1, 
              retweets: 0 
            };
          }),
          fetchFollowingTimeline: vi.fn().mockImplementation(async function* () {}),
        },
      },
    }),
    clients: new Map(), 
  } as unknown as Service;
  services.set('solana', mockSolana as any);
  services.set('twitter', mockTwitter);

  return {
    getSetting: vi.fn((key: string) => {
      const settings: Record<string, string | null> = {
        BIRDEYE_API_KEY: 'test-birdeye-key', COINMARKETCAP_API_KEY: 'test-cmc-key',
        SOLANA_PUBLIC_KEY: 'BzsJQeZ7cvk3pTHmKeuvdhNDkDxcZ6uCXxW2rjwC7RTq', SOLANA_PRIVATE_KEY: 'test-private-key',
        TWITTER_USERNAME: 'testuser',
      };
      return settings[key] || null;
    }),
    setSetting: vi.fn(),
    getService: vi.fn((name: string) => services.get(name)),
    getAllServices: vi.fn(() => services), // Adjusted to return Map for compatibility if needed
    registerService: vi.fn(async (service: Service & { name: string }) => { services.set(service.name, service); }),
    registerProvider: vi.fn((provider: any) => { providers.push(provider); }),
    getCache: vi.fn(async (key: string) => cache.get(key)),
    setCache: vi.fn(async (key: string, value: any) => { cache.set(key, value); return true; }), // Return boolean
    emitEvent: vi.fn(async (event: string, data: any) => {}),
    useModel: vi.fn(async (modelType: string, params: any) => JSON.stringify({})),
    plugins: [{ name: 'twitter' } as Plugin],
    providers,
    actions: [],
    evaluators: [],
    services,
    events: eventHandlers,
    routes: [],
    agentId: 'test-agent-id' as UUID,
    character: { name: 'Test Agent', bio: ['Test bio'], knowledge: [] },
    fetch: global.fetch as any,
    init: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    initialize: vi.fn(async () => {}),
    getConnection: vi.fn(),
    ensureConnection: vi.fn(async () => {}),
    registerDatabaseAdapter: vi.fn(),
    getMemories: vi.fn(async (params: any) => memories.filter(m => !params.roomId || m.roomId === params.roomId).slice(0, params.count || 50)),
    createMemory: vi.fn(async (memory: Memory) => { const id = memory.id || `mem-${memories.length + 1}` as UUID; memories.push({...memory, id}); return id; }),
    getMemoryById: vi.fn(async (id: UUID) => memories.find(m => m.id === id) || null),
    updateMemory: vi.fn(async (memory: Memory) => {}),
    removeMemory: vi.fn(async (id: UUID) => {}),
    removeAllMemories: vi.fn(async () => { memories = []; }),
    searchMemories: vi.fn(async () => []),
    countMemories: vi.fn(async () => memories.length),
    getAgent: vi.fn(), createAgent: vi.fn(), updateAgent: vi.fn(), deleteAgent: vi.fn(), ensureAgentExists: vi.fn(),
    getRoom: vi.fn(), createRoom: vi.fn(), ensureRoomExists: vi.fn().mockImplementation(async (room: any) => room.id as UUID), removeRoom: vi.fn(),
    getRoomsForParticipant: vi.fn(async () => []), getRoomsForParticipants: vi.fn(async () => []),
    addParticipant: vi.fn(), removeParticipant: vi.fn(), getParticipantsForAccount: vi.fn(async () => []), getParticipantsForRoom: vi.fn(async () => []),
    getParticipantUserState: vi.fn(), setParticipantUserState: vi.fn(),
    getAccountById: vi.fn(), createAccount: vi.fn(), getActorDetails: vi.fn(),
    getRelationship: vi.fn(), getRelationships: vi.fn(async () => []), createRelationship: vi.fn(),
    getGoals: vi.fn(async () => []), updateGoal: vi.fn(), createGoal: vi.fn(), removeGoal: vi.fn(), removeAllGoals: vi.fn(),
    createComponent: vi.fn(),
    getKnowledge: vi.fn(async () => []), addKnowledge: vi.fn(),
    getTasks: vi.fn(async () => tasks), getTask: vi.fn(),
    createTask: vi.fn(async (task: any) => { const id = task.id || (`task-${tasks.length + 1}` as UUID); tasks.push({...task, id}); return id; }),
    updateTask: vi.fn(), deleteTask: vi.fn(async (taskId: UUID) => { tasks = tasks.filter(t => t.id !== taskId); }),
    getTasksByName: vi.fn(async (name: string) => tasks.filter(t => t.name === name)),
    registerTaskWorker: vi.fn((worker: any) => {}),
    registerPlugin: vi.fn(),
    composeState: vi.fn(async () => ({ values:{}, data:{}, text:''})), // Return a valid State object
    processActions: vi.fn(async () => {}),
    evaluate: vi.fn(async () => ({ highestScoringAction: null, evaluationTime: 0, error: undefined })),
    getConversationLength: vi.fn(() => 32),
  } as unknown as IAgentRuntime;
};

describe('DegenIntel Plugin E2E Tests', () => {
  let runtime: IAgentRuntime;

  beforeEach(async () => {
    runtime = createMockRuntime();
    // Initialize the plugin
    if (degenIntelPlugin.init) {
      await degenIntelPlugin.init(null as any, runtime);
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Plugin Initialization', () => {
    it('should have correct plugin metadata', () => {
      expect(degenIntelPlugin.name).toBe('degen-intel');
      expect(degenIntelPlugin.description).toBe('Degen Intel plugin');
    });

    it('should register providers when API keys are available', async () => {
      expect(runtime.registerProvider).toHaveBeenCalled();
      // Should register CMC provider
      expect(runtime.registerProvider).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'COINMARKETCAP_CURRENCY_LATEST' })
      );
      // Should register Birdeye providers
      expect(runtime.registerProvider).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'BIRDEYE_TRENDING_CRYPTOCURRENCY' })
      );
      expect(runtime.registerProvider).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'INTEL_TRADE_PORTFOLIO' })
      );
      // Should register sentiment provider when twitter plugin is present
      expect(runtime.registerProvider).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'CRYPTOTWITTER_MARKET_SENTIMENT' })
      );
    });

    it('should have routes defined', () => {
      expect(degenIntelPlugin.routes).toBeDefined();
      expect(Array.isArray(degenIntelPlugin.routes)).toBe(true);
    });

    it('should register tasks during initialization', () => {
      expect(runtime.registerTaskWorker).toHaveBeenCalled();
    });
  });

  describe('Provider Functionality', () => {
    it('should provide sentiment data correctly', async () => {
      const sentimentData: Sentiment[] = [
        {
          timeslot: new Date().toISOString(),
          processed: true,
          text: 'Bullish sentiment on TEST',
          occuringTokens: [{ token: 'TEST', sentiment: 75, reason: 'Bullish' }],
        },
      ];
      await runtime.setCache('sentiments', sentimentData);

      const sentimentProvider = (runtime.providers as any[]).find((p: any) => p.name === 'CRYPTOTWITTER_MARKET_SENTIMENT');
      expect(sentimentProvider).toBeDefined();
      expect(sentimentProvider.get).toBeTypeOf('function');

      if (sentimentProvider?.get) {
        const result = await sentimentProvider.get(runtime, {} as Memory, {} as any);
        expect(result).toBeTruthy();
        expect(result?.text).toContain('Current cryptocurrency market data:');
        expect(result?.text).toContain('ENTRY 1');
        expect(result?.text).toContain(`TIME: ${sentimentData[0].timeslot}`);
        expect(result?.text).toContain('TOKEN ANALYSIS:');
        expect(result?.text).toContain('TEST - Sentiment: 75');
        expect(result?.text).toContain('Bullish');
        expect(result?.data?.sentimentData).toEqual(sentimentData);
      }
    });

    it('should provide market data correctly', async () => {
      const marketData: Token[] = [
        {
          provider: 'coinmarketcap',
          chain: 'L1',
          address: 'bitcoin',
          decimals: null,
          liquidity: null,
          logoURI: 'https://s2.coinmarketcap.com/static/img/coins/128x128/1.png',
          name: 'Bitcoin',
          symbol: 'BTC',
          volume24hUSD: 1000000,
          rank: 1,
          marketcap: 1000000000,
          price: 50000,
          price24hChangePercent: 5.2,
          last_updated: new Date() as any,
        },
      ];
      await runtime.setCache('coinmarketcap_sync', marketData);

      const marketProvider = (runtime.providers as any[]).find((p: any) => p.name === 'COINMARKETCAP_CURRENCY_LATEST');
      expect(marketProvider).toBeDefined();
      expect(marketProvider.get).toBeTypeOf('function');

      if (marketProvider?.get) {
        const result = await marketProvider.get(runtime, {} as Memory, {} as any);
        expect(result).toBeTruthy();
        expect(result?.text).toContain('Bitcoin');
        expect(result?.text).toContain('50000');
        expect(result?.data?.tokens).toEqual(marketData);
      }
    });

    it('should provide trending tokens data correctly', async () => {
      const trendingTokens: Token[] = [
        {
          provider: 'birdeye',
          chain: 'solana',
          address: '2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump',
          decimals: 9,
          liquidity: 100000,
          marketcap: 1000000,
          logoURI: 'https://example.com/logo.png',
          name: 'TEST',
          symbol: 'TEST',
          volume24hUSD: 50000,
          rank: 1,
          price: 0.1,
          price24hChangePercent: 20,
          last_updated: new Date() as any,
        },
      ];
      await runtime.setCache('tokens_solana', trendingTokens);

      const trendingProvider = (runtime.providers as any[]).find((p: any) => p.name === 'BIRDEYE_TRENDING_CRYPTOCURRENCY');
      expect(trendingProvider).toBeDefined();
      expect(trendingProvider.get).toBeTypeOf('function');

      if (trendingProvider?.get) {
        const result = await trendingProvider.get(runtime, {} as Memory, {} as any);
        expect(result).toBeTruthy();
        expect(result?.text).toContain('TEST');
        expect(result?.text).toContain('0.1');
        expect(result?.data?.tokens).toEqual(trendingTokens);
      }
    });

    it('should provide portfolio data correctly', async () => {
      const portfolioData: Portfolio = {
        key: 'PORTFOLIO',
        data: {
          wallet: '3nMBmufBUBVnk28sTp3NsrSJsdVGTyLZYmsqpMFaUT9J',
          totalUsd: 1000,
          items: [
            {
              name: 'Test Token',
              symbol: 'TEST',
              address: 'test-address',
              decimals: 9,
              balance: '1000',
              uiAmount: '1',
              chainId: 'solana',
              icon: 'test-icon.png',
              logoURI: 'test-logo.png',
              priceUsd: 500,
              valueUsd: '500',
            },
          ],
        },
      };
      await runtime.setCache('portfolio', portfolioData);

      const transactionHistory: TransactionHistory[] = [
        {
          txHash: 'test-tx-hash',
          blockTime: new Date('2024-01-01T00:00:00Z') as any,
          data: {
            status: true,
            mainAction: 'swap',
            balanceChange: [
              {
                name: 'Test Token',
                symbol: 'TEST',
                amount: 1000,
                address: 'test-address',
                logoURI: 'test-logo.png',
                decimals: 9,
              },
            ],
          },
        },
      ];
      await runtime.setCache('transaction_history', transactionHistory);

      const portfolioProvider = (runtime.providers as any[]).find((p: any) => p.name === 'INTEL_TRADE_PORTFOLIO');
      expect(portfolioProvider).toBeDefined();
      expect(portfolioProvider.get).toBeTypeOf('function');

      if (portfolioProvider?.get) {
        const result = await portfolioProvider.get(runtime, {} as Memory, {} as any);
        expect(result).toBeTruthy();
        expect(result?.text).toContain('3nMBmufBUBVnk28sTp3NsrSJsdVGTyLZYmsqpMFaUT9J');
        expect(result?.text).toContain('1000'); // totalUsd
        expect(result?.data?.portfolio).toEqual(portfolioData.data);
        expect(result?.data?.trades).toEqual(transactionHistory);
      }
    });

    it('should handle missing data gracefully in providers', async () => {
      await runtime.setCache('tokens_solana', []);
      const trendingProvider = (runtime.providers as any[]).find((p: any) => p.name === 'BIRDEYE_TRENDING_CRYPTOCURRENCY');
      if (trendingProvider?.get) {
        const result = await trendingProvider.get(runtime, {} as Memory, {} as any);
        expect(result).toBeNull();
      }

      await runtime.setCache('coinmarketcap_sync', []);
      const marketProvider = (runtime.providers as any[]).find((p: any) => p.name === 'COINMARKETCAP_CURRENCY_LATEST');
      if (marketProvider?.get) {
        const result = await marketProvider.get(runtime, {} as Memory, {} as any);
        expect(result).toBeNull();
      }

      await runtime.setCache('sentiments', []);
      const sentimentProvider = (runtime.providers as any[]).find((p: any) => p.name === 'CRYPTOTWITTER_MARKET_SENTIMENT');
      if (sentimentProvider?.get) {
        const result = await sentimentProvider.get(runtime, {} as Memory, {} as any);
        expect(result).toBeNull();
      }

      await runtime.setCache('portfolio', null);
      await runtime.setCache('transaction_history', []);
      const portfolioProvider = (runtime.providers as any[]).find((p: any) => p.name === 'INTEL_TRADE_PORTFOLIO');
      if (portfolioProvider?.get) {
        const result = await portfolioProvider.get(runtime, {} as Memory, {} as any);
        expect(result).toBeNull(); 
      }
    });
  });

  describe('API Routes', () => {
    it('should have sentiment route', () => {
      const sentimentRoute = degenIntelPlugin.routes?.find(
        (r: any) => r.path === '/api/intel/sentiment'
      );
      expect(sentimentRoute).toBeDefined();
      expect(sentimentRoute?.type).toBe('GET');
    });

    it('should have signals route', () => {
      const signalsRoute = degenIntelPlugin.routes?.find(
        (r: any) => r.path === '/api/intel/signals'
      );
      expect(signalsRoute).toBeDefined();
      expect(signalsRoute?.type).toBe('GET');
    });

    it('should have trending route', () => {
      const trendingRoute = degenIntelPlugin.routes?.find(
        (r: any) => r.path === '/api/intel/trending'
      );
      expect(trendingRoute).toBeDefined();
      expect(trendingRoute?.type).toBe('GET');
    });

    it('should have tweets route', () => {
      const tweetsRoute = degenIntelPlugin.routes?.find((r: any) => r.path === '/api/intel/tweets');
      expect(tweetsRoute).toBeDefined();
      expect(tweetsRoute?.type).toBe('GET');
    });

    it('should have portfolio route', () => {
      const portfolioRoute = degenIntelPlugin.routes?.find(
        (r: any) => r.path === '/api/intel/portfolio'
      );
      expect(portfolioRoute).toBeDefined();
      expect(portfolioRoute?.type).toBe('GET');
    });

    it('should have market route', () => {
      const marketRoute = degenIntelPlugin.routes?.find((r: any) => r.path === '/api/intel/market');
      expect(marketRoute).toBeDefined();
      expect(marketRoute?.type).toBe('GET');
    });

    it('should have summary route', () => {
      const summaryRoute = degenIntelPlugin.routes?.find(
        (r: any) => r.path === '/api/intel/summary'
      );
      expect(summaryRoute).toBeDefined();
      expect(summaryRoute?.type).toBe('GET');
    });
  });

  describe('Route Handlers', () => {
    let mockReq: any;
    let mockRes: any;
    let createUniqueUuidSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      mockReq = {}; 
      mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
        sendFile: vi.fn(),
        send: vi.fn(), 
      };
      createUniqueUuidSpy = vi.spyOn(core, 'createUniqueUuid').mockImplementation((rt, seed) => {
        if (seed === 'twitter-feed') return 'twitter-feed-uuid' as UUID;
        if (seed === 'sentiment-analysis') return 'sentiment-analysis-uuid' as UUID;
        return `mocked-uuid-${seed}` as UUID; 
      });
    });

    afterEach(() => {
      createUniqueUuidSpy.mockRestore();
    });

    it('should handle GET /degen-intel (frontend main) correctly', async () => {
      const mainRoute = degenIntelPlugin.routes?.find((r: any) => r.path === '/degen-intel');
      expect(mainRoute).toBeDefined();
      if (mainRoute?.handler) {
        await mainRoute.handler(mockReq, mockRes, runtime);
        expect(mockRes.sendFile).toHaveBeenCalledWith(expect.stringContaining('index.html'));
      }
    });

    it('should handle POST /trending (API) correctly', async () => {
      const trendingTokens: Token[] = [
        { name: 'TokenA', rank: 1, provider: 'birdeye', chain: 'solana', address: 'addrA', decimals: 9, liquidity: 1000, marketcap:10000, logoURI: 'uriA', symbol: 'TA', volume24hUSD: 100, price: 1, price24hChangePercent: 10, last_updated: new Date() as any },
        { name: 'TokenB', rank: 2, provider: 'birdeye', chain: 'solana', address: 'addrB', decimals: 9, liquidity: 2000, marketcap:20000, logoURI: 'uriB', symbol: 'TB', volume24hUSD: 200, price: 2, price24hChangePercent: 5, last_updated: new Date() as any },
      ];
      await runtime.setCache('tokens_solana', trendingTokens);

      const trendingRoute = degenIntelPlugin.routes?.find((r: any) => r.path === '/trending' && r.type === 'POST');
      expect(trendingRoute).toBeDefined();

      if (trendingRoute?.handler) {
        await trendingRoute.handler(mockReq, mockRes, runtime);
        expect(mockRes.json).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: 'TokenA' })]));
        const responseData = mockRes.json.mock.calls[0][0];
        expect(responseData[0].name).toBe('TokenA');
        expect(responseData[1].name).toBe('TokenB');
      }
    });

    it('should handle POST /wallet (API) correctly', async () => {
      const portfolioData: Portfolio = { key: 'PORTFOLIO', data: { wallet: 'wallet1', totalUsd: 100, items: [] } };
      const transactionHistory: TransactionHistory[] = [
        { txHash: 'tx1', blockTime: new Date() as any, data: { mainAction: 'received' } },
        { txHash: 'tx2', blockTime: new Date(Date.now() - 1000) as any, data: { mainAction: 'received' } },
      ];
      await runtime.setCache('portfolio', portfolioData);
      await runtime.setCache('transaction_history', transactionHistory);

      const walletRoute = degenIntelPlugin.routes?.find((r: any) => r.path === '/wallet' && r.type === 'POST');
      expect(walletRoute).toBeDefined();

      if (walletRoute?.handler) {
        await walletRoute.handler(mockReq, mockRes, runtime);
        expect(mockRes.json).toHaveBeenCalledWith({
          history: expect.arrayContaining([expect.objectContaining({ txHash: 'tx1' })]),
          portfolio: portfolioData.data,
        });
        const responseData = mockRes.json.mock.calls[0][0];
        expect(responseData.history.length).toBe(2);
        expect(new Date(responseData.history[0].blockTime).getTime()).toBeGreaterThanOrEqual(new Date(responseData.history[1].blockTime).getTime());
      }
    });

    it('should handle GET /tweets (API) correctly', async () => {
      const tweetMemories: Memory[] = [
        {
          id: 't1' as UUID,
          roomId: 'twitter-feed-uuid' as UUID, 
          agentId: 'agent1' as UUID, 
          entityId: 'user1' as UUID, 
          createdAt: Date.now(), 
          content: { 
            source: 'twitter', 
            text: 'Tweet 1', 
            tweet: { username: 'userA', likes: 10, retweets: 5 }
          } 
        },
        {
          id: 't2' as UUID, 
          roomId: 'twitter-feed-uuid' as UUID, 
          agentId: 'agent1' as UUID, 
          entityId: 'user1' as UUID, 
          createdAt: Date.now() - 1000, 
          content: { 
            source: 'twitter', 
            text: 'Tweet 2', 
            tweet: { username: 'userB', likes: 20, retweets: 15 }
          }
        },
      ];
      (runtime.getMemories as ReturnType<typeof vi.fn>).mockImplementation(async (params: any) => {
        if (params.roomId === 'twitter-feed-uuid') {
          return tweetMemories.slice(0, params.count || 50);
        }
        return [];
      });

      const tweetsRoute = degenIntelPlugin.routes?.find((r: any) => r.path === '/tweets' && r.type === 'GET');
      expect(tweetsRoute).toBeDefined();

      if (tweetsRoute?.handler) {
        await tweetsRoute.handler(mockReq, mockRes, runtime);
        expect(runtime.getMemories).toHaveBeenCalledWith(expect.objectContaining({ roomId: 'twitter-feed-uuid' }));
        
        expect(mockRes.json).toHaveBeenCalledWith(expect.arrayContaining([
          expect.objectContaining({
            text: 'Tweet 1',
            username: 'userA',
            likes: 10,
            retweets: 5,
            id: 't1',
            _id: 't1'
          }),
          expect.objectContaining({
            text: 'Tweet 2',
            username: 'userB',
            likes: 20,
            retweets: 15,
            id: 't2',
            _id: 't2'
          }),
        ]));
        const responseData = mockRes.json.mock.calls[0][0];
        expect(responseData.length).toBe(2);
        expect(responseData[0].text).toBe('Tweet 1');
      }
    });

    it('should handle GET /sentiment (API) correctly', async () => {
      const baseTime = Date.now();
      type MockSentimentMemoryContent = {
        source: string;
        text?: string;
        metadata: { 
          timeslot?: string;      // Made optional for s3 mock
          processed?: boolean;     // Made optional for s3 mock
          occuringTokens?: Array<{token: string; sentiment: number; reason: string}>;
        };
      };

      const sentimentMemories: (Memory & { content: MockSentimentMemoryContent })[] = [
        { 
          id: 's1' as UUID, roomId: 'sentiment-analysis-uuid' as UUID, agentId: 'agent1' as UUID, entityId: 'user1' as UUID, 
          createdAt: baseTime - 500,
          content: { 
            source: 'sentiment-analysis', text: 'Sentiment Alpha', 
            metadata: { 
              timeslot: new Date(baseTime - 3600000 * 1).toISOString(), 
              processed: true, 
              occuringTokens: [{token: 'TKA', sentiment: 10, reason: 'RA'}, {token: 'TKB', sentiment: 12, reason: 'RB'}] 
            }
          }
        },
        { 
          id: 's2' as UUID, roomId: 'sentiment-analysis-uuid' as UUID, agentId: 'agent1' as UUID, entityId: 'user1' as UUID, 
          createdAt: baseTime - 1500,
          content: { 
            source: 'sentiment-analysis', text: 'Sentiment Beta', 
            metadata: { 
              timeslot: new Date(baseTime - 3600000 * 2).toISOString(), 
              processed: true, 
              occuringTokens: [{token: 'TKC', sentiment: 20, reason: 'RC'}] 
            }
          }
        },
        {
          id: 's3' as UUID, roomId: 'sentiment-analysis-uuid' as UUID, agentId: 'agent1' as UUID, entityId: 'user1' as UUID, 
          createdAt: baseTime - 2500,
          content: { 
            source: 'sentiment-analysis', text: 'Sentiment Gamma (Bad Meta)', 
            metadata: { occuringTokens: [{token: 'TKD', sentiment:30, reason:'RD'}] } // Missing timeslot & processed
          }
        },
        { 
          id: 's4' as UUID, roomId: 'sentiment-analysis-uuid' as UUID, agentId: 'agent1' as UUID, entityId: 'user1' as UUID, 
          createdAt: baseTime - 10500, 
          content: { 
            source: 'sentiment-analysis', text: 'Sentiment Delta (Older)', 
            metadata: { 
              timeslot: new Date(baseTime - 3600000 * 5).toISOString(), 
              processed: false, 
              occuringTokens: [{token: 'TKE', sentiment: 5, reason: 'RE'}, {token: 'TKF', sentiment: 8, reason: 'RF'}] 
            }
          }
        },
      ];
      
      (runtime.getMemories as ReturnType<typeof vi.fn>).mockImplementation(async (params: any) => {
        if (params.roomId === 'sentiment-analysis-uuid') { 
          return sentimentMemories.slice(0, params.count || 30);
        }
        return [];
      });

      const sentimentRoute = degenIntelPlugin.routes?.find((r: any) => r.path === '/sentiment' && r.type === 'GET');
      expect(sentimentRoute).toBeDefined();

      if (sentimentRoute?.handler) {
        await sentimentRoute.handler(mockReq, mockRes, runtime);
        expect(runtime.getMemories).toHaveBeenCalledWith(expect.objectContaining({ roomId: 'sentiment-analysis-uuid' }));
        
        const expectedS1 = {
            timeslot: expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/),
            text: 'Sentiment Alpha',
            processed: true,
            occuringTokens: [{token: 'TKA', sentiment: 10, reason: 'RA'}, {token: 'TKB', sentiment: 12, reason: 'RB'}],
            createdAt: new Date(baseTime - 500).toISOString(),
            updatedAt: new Date(baseTime - 500).toISOString(), // API defaults updatedAt to createdAt if not present
        };
        const expectedS4 = {
            timeslot: expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/),
            text: 'Sentiment Delta (Older)',
            processed: false,
            occuringTokens: [{token: 'TKE', sentiment: 5, reason: 'RE'}, {token: 'TKF', sentiment: 8, reason: 'RF'}],
            createdAt: new Date(baseTime - 10500).toISOString(),
            updatedAt: new Date(baseTime - 10500).toISOString(), // API defaults updatedAt to createdAt
        };

        expect(mockRes.json).toHaveBeenCalledWith(expect.arrayContaining([
          expect.objectContaining(expectedS1),
          expect.objectContaining(expectedS4),
        ]));
        const responseData = mockRes.json.mock.calls[0][0];
        expect(responseData.length).toBe(2); 
        expect(new Date(responseData[0].timeslot).getTime()).toBeGreaterThan(new Date(responseData[1].timeslot).getTime());
        expect(responseData[0].text).toBe('Sentiment Alpha');
        expect(responseData[1].text).toBe('Sentiment Delta (Older)');
      }
    });

    it('should handle POST /signal (API) correctly', async () => {
      const buySignalData = { recommended_buy: 'BTC', reason: 'Strong buy' };
      await runtime.setCache('BUY_SIGNAL', { data: buySignalData });

      const signalRoute = degenIntelPlugin.routes?.find((r: any) => r.path === '/signal' && r.type === 'POST');
      expect(signalRoute).toBeDefined();

      if (signalRoute?.handler) {
        await signalRoute.handler(mockReq, mockRes, runtime);
        expect(mockRes.json).toHaveBeenCalledWith(buySignalData);
      }
    });

    it('should handle GET /api/intel/sentiment (new API) correctly', async () => {
      const apiSentimentData = [{ timeslot: new Date().toISOString(), text: 'API Sentiment' }];
      await runtime.setCache('sentiments', apiSentimentData);

      const apiSentimentRoute = degenIntelPlugin.routes?.find(
        (r: any) => r.path === '/api/intel/sentiment' && r.type === 'GET'
      );
      expect(apiSentimentRoute).toBeDefined();

      if (apiSentimentRoute?.handler) {
        await apiSentimentRoute.handler(mockReq, mockRes, runtime);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: apiSentimentData,
        });
      }
    });

    it('should handle errors in POST /trending API correctly', async () => {
        (runtime.getCache as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Cache fail'));

        const trendingRoute = degenIntelPlugin.routes?.find((r: any) => r.path === '/trending' && r.type === 'POST');
        if (trendingRoute?.handler) {
            await trendingRoute.handler(mockReq, mockRes, runtime);
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
        }
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow with all API keys and services', async () => {
      (runtime.getSetting as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        const settings: Record<string, string | null> = {
          BIRDEYE_API_KEY: 'test-birdeye-key',
          COINMARKETCAP_API_KEY: 'test-cmc-key',
          SOLANA_PUBLIC_KEY: 'BzsJQeZ7cvk3pTHmKeuvdhNDkDxcZ6uCXxW2rjwC7RTq',
          SOLANA_PRIVATE_KEY: 'test-private-key',
          TWITTER_USERNAME: 'testuser',
        };
        return settings[key] || null;
      });
      runtime.plugins = [{ name: 'twitter' } as Plugin];
      const mockTwitterService = runtime.getService('twitter') as any;
      if (mockTwitterService && mockTwitterService.getClient) {
        mockTwitterService.getClient.mockReturnValue({ 
          client: { twitterClient: { 
              getTweets: vi.fn().mockImplementation(async function* () { 
                yield { id: 'tweet1', text:'Test tweet for XYZ', isRetweet: false, username:'testuser', timestamp: Date.now()/1000, likes:10, retweets:5 }; 
              }),
              fetchFollowingTimeline: vi.fn().mockImplementation(async function* () {}),
            } 
          }
        });
      }

      expect(runtime.registerTaskWorker).toHaveBeenCalledWith(expect.objectContaining({ name: 'INTEL_SYNC_WALLET' }));
      expect(runtime.registerTaskWorker).toHaveBeenCalledWith(expect.objectContaining({ name: 'INTEL_SYNC_RAW_TWEETS' }));
      expect(runtime.registerTaskWorker).toHaveBeenCalledWith(expect.objectContaining({ name: 'INTEL_PARSE_TWEETS' }));

      const birdeyeTask = new Birdeye(runtime);
      const twitterTask = new Twitter(runtime);
      const twitterParserTask = new TwitterParser(runtime);

      const mockBirdeyeTxList = { ok: true, json: async () => ({ data: { solana: [{ txHash: 'tx123', blockTime: '2023-01-01T00:00:00Z', data: {} }] } }) };
      const mockBirdeyeTokenList = { ok: true, json: async () => ({ data: { wallet: 'w1', items:[], totalUsd: 0 } }) };
      const mockBirdeyeTrendingResponse = { ok: true, json: async () => ({ data: { updateUnixTime: Date.now()/1000, tokens: [{address: 'token1', name:'TestCoin', symbol:'TC', rank:1, price:1, price24hChangePercent:1, liquidity:1000, decimals:9, logoURI:'', volume24hUSD:1000, marketcap: 100000 }] } }) };
      
      global.fetch = vi.fn()
        .mockResolvedValueOnce(mockBirdeyeTxList)
        .mockResolvedValueOnce(mockBirdeyeTokenList)
        .mockResolvedValueOnce(mockBirdeyeTrendingResponse)
        .mockResolvedValueOnce(mockBirdeyeTrendingResponse)
        .mockResolvedValueOnce(mockBirdeyeTrendingResponse)
        .mockResolvedValueOnce(mockBirdeyeTrendingResponse)
        .mockResolvedValueOnce(mockBirdeyeTrendingResponse);
    
      await birdeyeTask.syncWallet();
      await birdeyeTask.syncTrendingTokens('solana');
      
      expect(runtime.setCache).toHaveBeenCalledWith('portfolio', expect.objectContaining({ data: expect.objectContaining({ wallet: 'w1'}) }));
      expect(runtime.setCache).toHaveBeenCalledWith('transaction_history', expect.arrayContaining([expect.objectContaining({ txHash: 'tx123'})]));
      expect(runtime.setCache).toHaveBeenCalledWith('tokens_solana', expect.arrayContaining([expect.objectContaining({ address: 'token1'})]));

      (runtime.getMemoryById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      await twitterTask.syncRawTweets();
      expect(mockTwitterService.getClient().client.twitterClient.getTweets).toHaveBeenCalled();
      expect(runtime.createMemory).toHaveBeenCalled();

      const unprocessedSentiment = { timeslot: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), processed: false, text: '', occuringTokens:[] };
      await runtime.setCache('sentiments', [unprocessedSentiment]);
      const tweetMemoryForParsing: Memory = { 
        id: 'parsedTweet1' as UUID, 
        roomId: twitterParserTask.twitterFeedRoomId, 
        agentId: runtime.agentId, entityId: runtime.agentId, 
        createdAt: Date.now() - 1.5 * 3600 * 1000, 
        content: {source: 'twitter', text: 'Great news for $XYZ', tweet: { username: 'testuser'}}
      };
      (runtime.getMemories as ReturnType<typeof vi.fn>).mockImplementation(async (params: any) => 
        params.roomId === twitterParserTask.twitterFeedRoomId ? [tweetMemoryForParsing] : []
      );
      (runtime.useModel as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify({ text: 'Positive sentiment for XYZ', occuringTokens: [{token: 'XYZ', sentiment: 80, reason: 'good news'}]}));
      
      await twitterParserTask.parseTweets();
      expect(runtime.useModel).toHaveBeenCalled();
      expect(runtime.setCache).toHaveBeenCalledWith('sentiments', 
        expect.arrayContaining([expect.objectContaining({ text: 'Positive sentiment for XYZ', processed: true })])
      );
      const initialProvidersCount = (runtime.registerProvider as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(initialProvidersCount).toBeGreaterThanOrEqual(1);
    });

    it('should handle missing API keys gracefully by not registering certain providers/tasks', async () => {
      const runtimeNoApiKeys = createMockRuntime();
      
      (runtimeNoApiKeys.getSetting as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'SOLANA_PUBLIC_KEY' || key === 'SOLANA_PRIVATE_KEY') return 'test-key';
        return null;
      });
      runtimeNoApiKeys.plugins = [];
      
      (runtimeNoApiKeys.registerTaskWorker as ReturnType<typeof vi.fn>).mockClear();
      (runtimeNoApiKeys.createTask as ReturnType<typeof vi.fn>).mockClear();
      (runtimeNoApiKeys.registerProvider as ReturnType<typeof vi.fn>).mockClear();

      if (degenIntelPlugin.init) {
        await degenIntelPlugin.init(null as any, runtimeNoApiKeys);
      }
      
      expect(runtimeNoApiKeys.registerProvider).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'COINMARKETCAP_CURRENCY_LATEST' }));
      expect(runtimeNoApiKeys.registerProvider).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'BIRDEYE_TRENDING_CRYPTOCURRENCY' }));
      expect(runtimeNoApiKeys.registerProvider).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'INTEL_TRADE_PORTFOLIO' }));
      expect(runtimeNoApiKeys.registerProvider).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'CRYPTOTWITTER_MARKET_SENTIMENT' }));

      const registeredTaskWorkers = (runtimeNoApiKeys.registerTaskWorker as ReturnType<typeof vi.fn>).mock.calls.map((call: any[]) => call[0].name);
      expect(registeredTaskWorkers).not.toContain('INTEL_SYNC_RAW_TWEETS');
      expect(registeredTaskWorkers).not.toContain('INTEL_PARSE_TWEETS');
    });
  });
});
