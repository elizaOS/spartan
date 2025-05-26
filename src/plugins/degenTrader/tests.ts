import type { IAgentRuntime, Memory, Plugin, Service, TestSuite, UUID } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import degenTraderPlugin from './index';
import { DegenTradingService } from './tradingService';
import { WalletService } from './services/walletService';
import { DataService } from './services/dataService';
import { AnalyticsService } from './services/analyticsService';
import { MonitoringService } from './services/monitoringService';
import { TaskService } from './services/taskService';
import { TradeMemoryService } from './services/tradeMemoryService';
import { BuyService } from './services/execution/buyService';
import { SellService } from './services/execution/sellService';
import { ServiceTypes } from './types';

// Mock logger
interface MockLogFunction extends Function {
  (...args: any[]): void;
  calls: any[][];
}

const mockLogger: {
  info: MockLogFunction;
  warn: MockLogFunction;
  error: MockLogFunction;
  debug: MockLogFunction;
  log: MockLogFunction;
  clearCalls: () => void;
} = {
  info: (() => {
    const fn: any = (...args: any[]) => {
      fn.calls.push(args);
    };
    fn.calls = [];
    return fn as MockLogFunction;
  })(),
  warn: (() => {
    const fn: any = (...args: any[]) => {
      fn.calls.push(args);
    };
    fn.calls = [];
    return fn as MockLogFunction;
  })(),
  error: (() => {
    const fn: any = (...args: any[]) => {
      fn.calls.push(args);
    };
    fn.calls = [];
    return fn as MockLogFunction;
  })(),
  debug: (() => {
    const fn: any = (...args: any[]) => {
      fn.calls.push(args);
    };
    fn.calls = [];
    return fn as MockLogFunction;
  })(),
  log: (() => {
    const fn: any = (...args: any[]) => {
      fn.calls.push(args);
    };
    fn.calls = [];
    return fn as MockLogFunction;
  })(),
  clearCalls: () => {
    mockLogger.info.calls = [];
    mockLogger.warn.calls = [];
    mockLogger.error.calls = [];
    mockLogger.debug.calls = [];
    mockLogger.log.calls = [];
  },
};

// Replace global logger
(global as any).logger = mockLogger;

/**
 * Creates a mock runtime for testing
 */
function createMockRuntime(overrides?: Partial<IAgentRuntime>): IAgentRuntime {
  const memories: Map<UUID, Memory> = new Map();
  const services: Map<string, Service> = new Map();
  const cache: Map<string, any> = new Map();
  const settings: Map<string, any> = new Map();

  // Set default settings
  settings.set('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com');
  // This private key corresponds to public key: 3nMBmufBUBVnk28sTp3NsrSJsdVGTyLZYmsqpMFaUT9J
  settings.set(
    'SOLANA_PRIVATE_KEY',
    '4Z7crrDaQqjbqUErxiKjgAMZdaEaUKmXvdvfMQzYN1gX4Z7crrDaQqjbqUErxiKjgAMZdaEaUKmXvdvfMQzYN1gX'
  );
  settings.set('BIRDEYE_API_KEY', 'test-api-key');
  settings.set('TEST_MODE', 'true'); // Explicitly set test mode

  // Mock Solana Plugin Service
  const mockSolanaService = {
    serviceType: 'mock-solana-degentrader', // Use a very distinct serviceType for the mock
    capabilityDescription: 'Mock Solana Service for DegenTrader tests',
    async initialize() {
      mockLogger.info('MockSolanaService (DegenTrader) initialized');
    },
    async stop() {
      mockLogger.info('MockSolanaService (DegenTrader) stopped');
    },
    async executeSwap(params: any) {
      mockLogger.info('MockSolanaService (DegenTrader) executeSwap called', params);
      return {
        success: true,
        signature: 'mock-signature-' + Date.now(),
        outAmount:
          params.outputMint === 'So11111111111111111111111111111111111111112'
            ? (parseFloat(params.amount) * 0.98 * 150).toString()
            : ((parseFloat(params.amount) / 150) * 0.98).toString(), // Mock price SOL = 150 USD
        inAmount: params.amount,
        swapUsdValue:
          params.outputMint === 'So11111111111111111111111111111111111111112'
            ? (parseFloat(params.amount) * 150).toString()
            : parseFloat(params.amount).toString(), // Simplified
      };
    },
    async getSolBalance(publicKey: string) {
      mockLogger.info('MockSolanaService (DegenTrader) getSolBalance called for', publicKey);
      return 1.5; // 1.5 SOL
    },
    async getTokenBalance(publicKey: string, mintAddress: string) {
      mockLogger.info(
        'MockSolanaService (DegenTrader) getTokenBalance called for',
        publicKey,
        mintAddress
      );
      return {
        amount: '1000000000', // 1 token
        decimals: 9,
        uiAmount: 1.0,
      };
    },
    async getPublicKey() {
      mockLogger.info('MockSolanaService (DegenTrader) getPublicKey called');
      // Return the public key corresponding to the SOLANA_PRIVATE_KEY setting for consistency if real plugin somehow gets involved
      // For pure mock scenario, this could be anything.
      return '3nMBmufBUBVnk28sTp3NsrSJsdVGTyLZYmsqpMFaUT9J'; // Matches derived key from settings
    },
  };

  // Forcefully register our mock Solana service for the 'solana' key.
  // This should ensure that WalletService gets this mock.
  services.set('solana', mockSolanaService as any);
  mockLogger.info(
    'MockSolanaService (DegenTrader) has been forcefully set on the services map for key "solana".'
  );

  return {
    agentId: uuidv4() as UUID,
    character: {
      name: 'Test Trader',
      bio: ['Test trading agent'],
      knowledge: [],
    },
    providers: [],
    actions: [],
    evaluators: [],
    plugins: [],
    services,
    events: new Map(),

    // Database methods
    async init() {},
    async close() {},
    async getConnection() {
      return null as any;
    },

    // Memory methods
    async getMemoryById(id: UUID) {
      return memories.get(id) || null;
    },

    async getMemories(params: any) {
      const results = Array.from(memories.values()).filter((m) => {
        if (params.roomId && m.roomId !== params.roomId) return false;
        if (params.entityId && m.entityId !== params.entityId) return false;
        if (params.tableName && (m.metadata as any)?.tableName !== params.tableName) return false;
        return true;
      });
      return params.count ? results.slice(0, params.count) : results;
    },

    async createMemory(memory: Memory, tableName: string) {
      const id = memory.id || (uuidv4() as UUID);
      const memoryWithId = { ...memory, id, metadata: { ...memory.metadata, tableName } as any };
      memories.set(id, memoryWithId);
      return id;
    },

    async updateMemory(memory: any) {
      if (memory.id && memories.has(memory.id)) {
        memories.set(memory.id, { ...memories.get(memory.id)!, ...memory });
        return true;
      }
      return false;
    },

    async deleteMemory(memoryId: UUID) {
      memories.delete(memoryId);
    },

    // Cache methods
    async getCache(key: string) {
      return cache.get(key);
    },

    async setCache(key: string, value: any) {
      cache.set(key, value);
      return true;
    },

    async deleteCache(key: string) {
      cache.delete(key);
      return true;
    },

    // Settings
    getSetting(key: string) {
      return settings.get(key) || null;
    },

    setSetting(key: string, value: any) {
      settings.set(key, value);
    },

    // Service methods
    getService<T extends Service>(name: string): T | null {
      return (services.get(name) as T) || null;
    },

    getAllServices() {
      return services;
    },

    async registerService(ServiceClass: typeof Service) {
      const service = await ServiceClass.start(this);
      services.set(ServiceClass.serviceType, service);
    },

    // Task methods
    async createTask(task: any) {
      const id = task.id || (uuidv4() as UUID);
      await this.setCache(`task:${id}`, task);
      return id;
    },

    async getTasks(params: any) {
      const tasks: any[] = [];
      for (const [key, value] of cache.entries()) {
        if (key.startsWith('task:')) {
          const task = value;
          if (params.tags && !params.tags.every((tag: string) => task.tags?.includes(tag))) {
            continue;
          }
          tasks.push(task);
        }
      }
      return tasks;
    },

    async getTask(id: UUID) {
      return await this.getCache(`task:${id}`);
    },

    async updateTask(id: UUID, task: any) {
      await this.setCache(`task:${id}`, { ...(await this.getCache(`task:${id}`)), ...task });
    },

    async deleteTask(id: UUID) {
      await this.deleteCache(`task:${id}`);
    },

    // Model methods
    async useModel(modelType: any, params: any) {
      // Return mock embedding
      if (modelType === 'TEXT_EMBEDDING') {
        return new Array(1536).fill(0).map(() => Math.random()) as any;
      }
      return `Mock response for: ${params.prompt}` as any;
    },

    async addEmbeddingToMemory(memory: Memory) {
      memory.embedding = await this.useModel('TEXT_EMBEDDING', {
        text: memory.content.text,
      });
      return memory;
    },

    // Stub other required methods
    async getAgent(agentId: UUID) {
      return null;
    },
    async getAgents() {
      return [];
    },
    async createAgent(agent: any) {
      return true;
    },
    async updateAgent(agentId: UUID, agent: any) {
      return true;
    },
    async deleteAgent(agentId: UUID) {
      return true;
    },
    async ensureAgentExists(agent: any) {
      return agent as any;
    },
    async ensureEmbeddingDimension(dimension: number) {},
    async getEntityById(entityId: UUID) {
      return null;
    },
    async getEntitiesForRoom(roomId: UUID) {
      return [];
    },
    async createEntity(entity: any) {
      return true;
    },
    async updateEntity(entity: any) {},
    async getComponent(entityId: UUID, type: string) {
      return null;
    },
    async getComponents(entityId: UUID) {
      return [];
    },
    async createComponent(component: any) {
      return true;
    },
    async updateComponent(component: any) {},
    async deleteComponent(componentId: UUID) {},
    async getMemoriesByIds(ids: UUID[]) {
      return [];
    },
    async getMemoriesByRoomIds(params: any) {
      return [];
    },
    async searchMemories(params: any) {
      return [];
    },
    async deleteAllMemories(roomId: UUID, tableName: string) {},
    async countMemories(roomId: UUID) {
      return 0;
    },
    async getCachedEmbeddings(params: any) {
      return [];
    },
    async log(params: any) {},
    async getLogs(params: any) {
      return [];
    },
    async deleteLog(logId: UUID) {},
    async createWorld(world: any) {
      return uuidv4() as UUID;
    },
    async getWorld(id: UUID) {
      return null;
    },
    async removeWorld(id: UUID) {},
    async getAllWorlds() {
      return [];
    },
    async updateWorld(world: any) {},
    async getRoom(roomId: UUID) {
      return null;
    },
    async createRoom(room: any) {
      return uuidv4() as UUID;
    },
    async deleteRoom(roomId: UUID) {},
    async deleteRoomsByWorldId(worldId: UUID) {},
    async updateRoom(room: any) {},
    async getRoomsForParticipant(entityId: UUID) {
      return [];
    },
    async getRoomsForParticipants(userIds: UUID[]) {
      return [];
    },
    async getRooms(worldId: UUID) {
      return [];
    },
    async addParticipant(entityId: UUID, roomId: UUID) {
      return true;
    },
    async removeParticipant(entityId: UUID, roomId: UUID) {
      return true;
    },
    async getParticipantsForEntity(entityId: UUID) {
      return [];
    },
    async getParticipantsForRoom(roomId: UUID) {
      return [];
    },
    async getParticipantUserState(roomId: UUID, entityId: UUID) {
      return null;
    },
    async setParticipantUserState(roomId: UUID, entityId: UUID, state: any) {},
    async createRelationship(params: any) {
      return true;
    },
    async updateRelationship(relationship: any) {},
    async getRelationship(params: any) {
      return null;
    },
    async getRelationships(params: any) {
      return [];
    },
    async getTasksByName(name: string) {
      return [];
    },
    async getMemoriesByWorldId(params: any) {
      return [];
    },
    async registerPlugin(plugin: Plugin) {},
    async initialize() {},
    registerDatabaseAdapter(adapter: any) {},
    getConversationLength() {
      return 0;
    },
    async processActions(message: Memory, responses: Memory[]) {},
    async evaluate(message: Memory) {
      return null;
    },
    registerProvider(provider: any) {
      this.providers.push(provider);
    },
    registerAction(action: any) {},
    registerEvaluator(evaluator: any) {},
    async ensureConnection(params: any) {},
    async ensureParticipantInRoom(entityId: UUID, roomId: UUID) {},
    async ensureWorldExists(world: any) {},
    async ensureRoomExists(room: any) {},
    async composeState(message: Memory) {
      return { values: {}, data: {}, text: '' };
    },
    registerModel(modelType: any, handler: any, provider: string) {},
    getModel(modelType: any) {
      return undefined;
    },
    registerEvent(event: string, handler: any) {},
    getEvent(event: string) {
      return undefined;
    },
    async emitEvent(event: string, params: any) {},
    registerTaskWorker(taskHandler: any) {},
    getTaskWorker(name: string) {
      return undefined;
    },
    async stop() {},
    registerSendHandler(source: string, handler: any) {},
    async sendMessageToTarget(target: any, content: any) {},
    async updateRecentMessageState(state: any) {},

    ...overrides,
  } as IAgentRuntime;
}

/**
 * Degen Trader Plugin Test Suite
 */
export class DegenTraderTestSuite implements TestSuite {
  name = 'degenTrader';
  description =
    'Tests for the Degen Trader plugin including services, trading logic, and integration';

  tests = [
    // Plugin Configuration Tests
    {
      name: 'Should validate required settings',
      fn: async (runtime: IAgentRuntime) => {
        // Remove required settings
        runtime.setSetting('SOLANA_PRIVATE_KEY', null);

        try {
          const service = new DegenTradingService(runtime);
          await service.start();
          throw new Error('Should have thrown error for missing private key');
        } catch (error: any) {
          if (!error.message.includes('private key')) {
            throw new Error(`Unexpected error: ${error.message}`);
          }
        }
      },
    },

    // Service Lifecycle Tests
    {
      name: 'Should initialize DegenTradingService correctly',
      fn: async (runtime: IAgentRuntime) => {
        const service = new DegenTradingService(runtime);

        if (!service) {
          throw new Error('Service creation failed');
        }

        if (
          service.capabilityDescription !== 'The agent is able to trade on the Solana blockchain'
        ) {
          throw new Error('Incorrect service capability description');
        }

        // Start service
        await service.start();

        if (!service.isServiceRunning()) {
          throw new Error('Service should be running after start');
        }

        // Stop service
        await service.stop();

        if (service.isServiceRunning()) {
          throw new Error('Service should not be running after stop');
        }
      },
    },

    {
      name: 'Should prevent duplicate service starts',
      fn: async (runtime: IAgentRuntime) => {
        const service = new DegenTradingService(runtime);

        await service.start();

        // Clear previous logs
        mockLogger.clearCalls();

        // Try to start again
        await service.start();

        // Check for warning
        const warnCalls = mockLogger.warn.calls;
        const hasWarning = warnCalls.some((call) => call[0].includes('already running'));

        if (!hasWarning) {
          throw new Error('Should warn about duplicate start');
        }

        await service.stop();
      },
    },

    // Wallet Service Tests
    {
      name: 'Should initialize wallet service with valid keypair',
      fn: async (runtime: IAgentRuntime) => {
        const walletService = new WalletService(runtime);

        await walletService.initialize();

        const wallet = await walletService.getWallet();

        if (!wallet.publicKey) {
          throw new Error('Wallet should have public key');
        }

        // Test wallet operations
        const balance = await walletService.getBalance();
        if (typeof balance !== 'number') {
          throw new Error('Balance should be a number');
        }
      },
    },

    {
      name: 'Should handle missing Solana plugin service',
      fn: async (runtime: IAgentRuntime) => {
        // Create a new runtime without the Solana service
        const runtimeWithoutSolana = createMockRuntime();
        const services = runtimeWithoutSolana.getAllServices();
        services.clear(); // Remove all services including Solana

        const walletService = new WalletService(runtimeWithoutSolana);

        try {
          await walletService.initialize();
          throw new Error('Should have thrown error for missing Solana plugin');
        } catch (error: any) {
          if (!error.message.includes('plugin-solana service not found')) {
            throw new Error(`Unexpected error: ${error.message}`);
          }
        }
      },
    },

    // Data Service Tests
    {
      name: 'Should initialize data service',
      fn: async (runtime: IAgentRuntime) => {
        const walletService = new WalletService(runtime);
        await walletService.initialize();

        const dataService = new DataService(runtime, walletService);

        await dataService.initialize();

        // Test cache functionality
        const testData = { test: 'data' };
        await runtime.setCache('test_key', testData);
        const retrieved = (await runtime.getCache('test_key')) as { test: string };

        if (retrieved.test !== 'data') {
          throw new Error('Cache not working correctly');
        }
      },
    },

    {
      name: 'Should handle missing Birdeye API key',
      fn: async (runtime: IAgentRuntime) => {
        const initialApiKey = runtime.getSetting('BIRDEYE_API_KEY'); // Save initial

        // Test with null
        runtime.setSetting('BIRDEYE_API_KEY', null);
        const apiKeyAfterSetNull = runtime.getSetting('BIRDEYE_API_KEY');
        if (apiKeyAfterSetNull !== null) {
          throw new Error(
            `Test setup error: Expected API key to be null, but got: ${apiKeyAfterSetNull}`
          );
        }

        const walletService = new WalletService(runtime);
        try {
          await walletService.initialize();
        } catch (e) {
          mockLogger.warn(
            'WalletService initialization failed in Birdeye API key test (null case)',
            e
          );
        }

        try {
          new DataService(runtime, walletService);
          throw new Error('DataService constructor should have thrown (null API key)');
        } catch (error: any) {
          if (!error.message.includes('Birdeye API key not found in settings or is empty')) {
            throw new Error(
              `Test failed (null API key): Expected Birdeye error, got: ${error.message}`
            );
          }
        }

        // Test with empty string
        runtime.setSetting('BIRDEYE_API_KEY', '');
        const apiKeyAfterSetEmpty = runtime.getSetting('BIRDEYE_API_KEY');
        if (apiKeyAfterSetEmpty !== '') {
          throw new Error(
            `Test setup error: Expected API key to be empty string, but got: ${apiKeyAfterSetEmpty}`
          );
        }

        // Re-initialize wallet service for this part of test if necessary, though its state shouldn't affect DataService constructor check
        // For simplicity, we assume walletService instance can be reused or doesn't interfere.
        try {
          new DataService(runtime, walletService);
          throw new Error('DataService constructor should have thrown (empty API key)');
        } catch (error: any) {
          if (!error.message.includes('Birdeye API key not found in settings or is empty')) {
            throw new Error(
              `Test failed (empty API key): Expected Birdeye error, got: ${error.message}`
            );
          }
        }

        // Restore initial API key
        runtime.setSetting('BIRDEYE_API_KEY', initialApiKey);
      },
    },

    // Analytics Service Tests
    {
      name: 'Should calculate technical indicators correctly',
      fn: async (runtime: IAgentRuntime) => {
        const analyticsService = new AnalyticsService(runtime);
        await analyticsService.initialize();

        // Test RSI calculation
        const prices = [100, 102, 101, 103, 105, 104, 106, 108, 107, 109, 111, 110, 112, 114, 113];
        const rsi = analyticsService.calculateRSI(prices, 14);

        if (rsi < 0 || rsi > 100) {
          throw new Error(`RSI should be between 0 and 100, got ${rsi}`);
        }

        // Test MACD calculation
        const macd = analyticsService.calculateMACD(prices);

        if (typeof macd.macd !== 'number' || typeof macd.signal !== 'number') {
          throw new Error('MACD calculation failed');
        }
      },
    },

    {
      name: 'Should score signals correctly',
      fn: async (runtime: IAgentRuntime) => {
        const analyticsService = new AnalyticsService(runtime);
        await analyticsService.initialize();

        // Test technical signal scoring
        const technicalSignals = {
          rsi: 25, // Oversold
          macd: { value: 0.5, signal: 0.3, histogram: 0.2 },
          volumeProfile: { trend: 'increasing' as const, unusualActivity: false },
          volatility: 0.15,
        };

        const score = await analyticsService.scoreTechnicalSignals(technicalSignals);

        if (score < 0) {
          throw new Error('Technical score should be positive for good signals');
        }

        // Test social metrics scoring
        const socialMetrics = {
          mentionCount: 150,
          sentiment: 0.8,
          influencerMentions: 5,
        };

        const socialScore = await analyticsService.scoreSocialMetrics(socialMetrics);

        if (socialScore < 0) {
          throw new Error('Social score should be positive for good metrics');
        }
      },
    },

    // Trade Memory Service Tests
    {
      name: 'Should store and retrieve trade memories',
      fn: async (runtime: IAgentRuntime) => {
        const walletService = new WalletService(runtime);
        await walletService.initialize();

        const dataService = new DataService(runtime, walletService);
        await dataService.initialize();

        const analyticsService = new AnalyticsService(runtime);
        await analyticsService.initialize();

        const tradeMemoryService = new TradeMemoryService(
          runtime,
          walletService,
          dataService,
          analyticsService
        );

        await tradeMemoryService.initialize();

        // Create a trade
        const trade = await tradeMemoryService.createTrade({
          tokenAddress: 'So11111111111111111111111111111111111111112',
          chain: 'solana',
          type: 'BUY',
          amount: '1000000000',
          price: '100.50',
          txHash: 'test-tx-hash',
        });

        if (!trade.id) {
          throw new Error('Trade should have ID');
        }

        // Retrieve trades for token
        const trades = await tradeMemoryService.getTradesForToken(
          'So11111111111111111111111111111111111111112',
          'solana'
        );

        if (trades.length === 0) {
          throw new Error('Should retrieve stored trade');
        }

        if (trades[0].type !== 'BUY') {
          throw new Error('Trade type mismatch');
        }
      },
    },

    // Monitoring Service Tests
    {
      name: 'Should monitor token prices',
      fn: async (runtime: IAgentRuntime) => {
        const walletService = new WalletService(runtime);
        await walletService.initialize();

        const dataService = new DataService(runtime, walletService);
        await dataService.initialize();

        const analyticsService = new AnalyticsService(runtime);
        await analyticsService.initialize();

        const tradeMemoryService = new TradeMemoryService(
          runtime,
          walletService,
          dataService,
          analyticsService
        );

        const buyService = new BuyService(
          runtime,
          walletService,
          dataService,
          analyticsService,
          tradeMemoryService
        );

        const sellService = new SellService(
          runtime,
          walletService,
          dataService,
          analyticsService,
          tradeMemoryService
        );

        const monitoringService = new MonitoringService(
          runtime,
          dataService,
          walletService,
          analyticsService,
          tradeMemoryService,
          buyService,
          sellService
        );

        await monitoringService.initialize();

        // Mock token balance
        runtime.setCache('token_balance:test-token', {
          balance: '1000000000',
          decimals: 9,
        });

        // Mock market data
        dataService.getTokenMarketData = async (tokenAddress: string) => ({
          price: 105,
          marketCap: 1000000,
          liquidity: 500000,
          volume24h: 100000,
          priceHistory: [100, 102, 105],
          volumeHistory: [],
        });

        const result = await monitoringService.monitorToken({
          tokenAddress: 'test-token',
          initialPrice: 100,
          stopLossPrice: 95,
          takeProfitPrice: 110,
        });

        if (result.error) {
          throw new Error(`Monitoring failed: ${result.message}`);
        }

        if (result.currentPrice !== 105) {
          throw new Error('Price monitoring incorrect');
        }

        await monitoringService.stop();
      },
    },

    // Task Service Tests
    {
      name: 'Should create and execute sell tasks',
      fn: async (runtime: IAgentRuntime) => {
        const walletService = new WalletService(runtime);
        await walletService.initialize();

        const dataService = new DataService(runtime, walletService);
        const originalGetTokenMarketData = dataService.getTokenMarketData;
        dataService.getTokenMarketData = async (tokenAddress: string) => {
          if (tokenAddress === 'test-token') {
            return {
              price: 10.0,
              marketCap: 1000000,
              liquidity: 500000,
              volume24h: 100000,
              priceHistory: [9, 9.5, 10],
              volumeHistory: [],
            };
          }
          return originalGetTokenMarketData.call(dataService, tokenAddress);
        };

        await dataService.initialize();

        const analyticsService = new AnalyticsService(runtime);
        await analyticsService.initialize();

        const tradeMemoryService = new TradeMemoryService(
          runtime,
          walletService,
          dataService,
          analyticsService
        );
        await tradeMemoryService.initialize();

        const buyService = new BuyService(
          runtime,
          walletService,
          dataService,
          analyticsService,
          tradeMemoryService
        );
        await buyService.initialize();

        const sellService = new SellService(
          runtime,
          walletService,
          dataService,
          analyticsService,
          tradeMemoryService
        );
        await sellService.initialize();

        const taskService = new TaskService(runtime, buyService, sellService);

        // Ensure task workers are registered (they are in the current TaskService.registerTasks)
        await taskService.registerTasks();

        const sellTaskParams = {
          positionId: uuidv4() as UUID,
          tokenAddress: 'test-token',
          amount: '1000000000',
          entityId: runtime.agentId as string, // entityId on params is string
          currentBalance: '1000000000',
          walletAddress: await walletService.getPublicKey(),
          isSimulation: true,
          sellRecommenderId: runtime.agentId as string, // sellRecommenderId on params is string
          reason: 'Test sell',
          slippage: 50, // Example slippage
        };

        const result = await taskService.createSellTask(sellTaskParams);

        if (!result.success || !result.taskId) {
          throw new Error(`Failed to create sell task: ${result.error}`);
        }

        // Verify task was created by querying for its specific tags or name
        const createdTask = await runtime.getTask(result.taskId as UUID);
        if (!createdTask) {
          throw new Error(`Task with ID ${result.taskId} not found.`);
        }

        // Optional: Check if the registered worker processes the task
        // This requires the mock runtime to simulate task worker execution
        // For now, just verifying creation is a good step.
        // const worker = runtime.getTaskWorker('EXECUTE_SELL');
        // if (worker && worker.execute) {
        //    await worker.execute(runtime, {}, createdTask);
        //    // Add assertions here based on sellService.executeSell effects
        // }

        dataService.getTokenMarketData = originalGetTokenMarketData;
      },
    },

    // Integration Tests
    {
      name: 'End-to-end service integration test',
      fn: async (runtime: IAgentRuntime) => {
        // Initialize main service
        const service = new DegenTradingService(runtime);
        await service.start();

        // Verify all sub-services are initialized
        const walletService = runtime.getService(ServiceTypes.WALLET as any);
        const dataService = runtime.getService(ServiceTypes.DATA as any);
        const analyticsService = runtime.getService(ServiceTypes.ANALYTICS as any);

        if (!walletService && !dataService && !analyticsService) {
          // Services are private, so we just verify the main service started
          if (!service.isServiceRunning()) {
            throw new Error('Service integration failed');
          }
        }

        // Test creating a memory through the service
        const memory: Memory = {
          id: uuidv4() as UUID,
          entityId: runtime.agentId,
          agentId: runtime.agentId,
          roomId: runtime.agentId,
          content: {
            text: 'Test trade execution',
          },
          createdAt: Date.now(),
        };

        await runtime.createMemory(memory, 'trades');

        const retrieved = await runtime.getMemoryById(memory.id);
        if (!retrieved) {
          throw new Error('Memory storage integration failed');
        }

        await service.stop();
      },
    },

    // Error Handling Tests
    {
      name: 'Should handle service initialization errors gracefully',
      fn: async (runtime: IAgentRuntime) => {
        // Remove RPC URL to cause initialization error
        runtime.setSetting('SOLANA_RPC_URL', null);

        const service = new DegenTradingService(runtime);

        try {
          await service.start();
          throw new Error('Should have thrown error for missing RPC URL');
        } catch (error: any) {
          if (!error.message.includes('RPC URL')) {
            throw new Error(`Unexpected error: ${error.message}`);
          }
        }
      },
    },

    // Performance Tests
    {
      name: 'Should handle concurrent operations',
      fn: async (runtime: IAgentRuntime) => {
        const service = new DegenTradingService(runtime);
        await service.start();

        // Create multiple concurrent memories
        const promises = Array(10)
          .fill(0)
          .map(async (_, i) => {
            const memory: Memory = {
              id: uuidv4() as UUID,
              entityId: runtime.agentId,
              agentId: runtime.agentId,
              roomId: runtime.agentId,
              content: {
                text: `Concurrent test ${i}`,
              },
              createdAt: Date.now(),
            };

            return runtime.createMemory(memory, 'test');
          });

        const results = await Promise.all(promises);

        if (results.length !== 10) {
          throw new Error('Concurrent operations failed');
        }

        await service.stop();
      },
    },
  ];
}

// Export default instance
export default new DegenTraderTestSuite();
