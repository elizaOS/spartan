import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockRuntime } from '../../../../../test-utils/src/mocks/runtime';
import type { IAgentRuntime } from '@elizaos/core';
import { SpartanNewsService, type TrendingToken } from '../services/spartanNewsService';

class TestSpartanNewsService extends SpartanNewsService {
  constructor(runtime: IAgentRuntime, private readonly tokens: TrendingToken[]) {
    super(runtime);
  }

  protected async fetchTrendingTokens(limit: number): Promise<TrendingToken[]> {
    return this.tokens.slice(0, limit);
  }
}

describe('SpartanNewsService', () => {
  const sampleTokens: TrendingToken[] = [
    {
      address: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      price: 180.25,
      volume24h: 5120000,
      priceChange24h: 6.5,
    },
    {
      address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      symbol: 'BONK',
      price: 0.000028,
      volume24h: 1890000,
      priceChange24h: -12.4,
    },
    {
      address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
      symbol: 'POPCAT',
      price: 0.95,
      volume24h: 890000,
      priceChange24h: 25.7,
    },
  ];

  let runtime: IAgentRuntime;

  beforeEach(() => {
    runtime = createMockRuntime({
      getSetting: vi.fn().mockReturnValue(undefined),
    });
  });

  it('generates a structured article with summary and body', async () => {
    const service = new TestSpartanNewsService(runtime, sampleTokens);
    const article = await service.generateArticle({
      timeFrame: '24h',
      category: 'performance',
      limit: 3,
    });

    expect(article).not.toBeNull();
    expect(article?.body).toContain('🔥');
    expect(article?.summary.length).toBeGreaterThan(0);
    expect(article?.metadata.tokens).toHaveLength(3);
  });

  it('stores generated article into runtime memory', async () => {
    const createMemoryMock = vi.fn().mockResolvedValue(undefined);
    runtime = createMockRuntime({
      createMemory: createMemoryMock,
      getSetting: vi.fn().mockReturnValue(undefined),
    });

    const service = new TestSpartanNewsService(runtime, sampleTokens);
    const article = await service.generateAndStoreArticle({
      timeFrame: '24h',
      category: 'trending',
      limit: 2,
    });

    expect(article).not.toBeNull();
    expect(createMemoryMock).toHaveBeenCalledTimes(1);
    const [memoryArg, tableName] = createMemoryMock.mock.calls[0];
    expect(tableName).toBe('documents');
    expect(memoryArg.content?.metadata?.type).toBe('spartan-news');
  });

  it('supports both v2 and legacy cache formats', async () => {
    // Test v2 format (used by strategy service)
    const getCacheMock = vi.fn().mockImplementation(async (key: string) => {
      if (key === 'tokens_v2_solana') {
        return {
          data: sampleTokens,
          setAt: Date.now(),
        };
      }
      return null;
    });

    runtime = createMockRuntime({
      getCache: getCacheMock,
      getSetting: vi.fn().mockReturnValue(undefined),
      getService: vi.fn().mockReturnValue({
        getTokenInfo: vi.fn().mockResolvedValue({ priceChange24h: 5 }),
        getTokenMarketData: vi.fn().mockResolvedValue({ price: 180, volume24h: 1000000 }),
        getTokenSymbol: vi.fn().mockResolvedValue('SOL'),
      }),
    });

    // Use the base SpartanNewsService to test cache behavior
    const service = new SpartanNewsService(runtime);
    const article = await service.generateArticle({
      timeFrame: '24h',
      category: 'trending',
      limit: 3,
    });

    expect(article).not.toBeNull();
    expect(getCacheMock).toHaveBeenCalledWith('tokens_v2_solana');

    // Test legacy format fallback
    const getCacheMockLegacy = vi.fn().mockImplementation(async (key: string) => {
      if (key === 'tokens_v2_solana') {
        return null; // v2 not available
      }
      if (key === 'tokens_solana') {
        return sampleTokens; // legacy format
      }
      return null;
    });

    runtime = createMockRuntime({
      getCache: getCacheMockLegacy,
      getSetting: vi.fn().mockReturnValue(undefined),
      getService: vi.fn().mockReturnValue({
        getTokenInfo: vi.fn().mockResolvedValue({ priceChange24h: 5 }),
        getTokenMarketData: vi.fn().mockResolvedValue({ price: 180, volume24h: 1000000 }),
        getTokenSymbol: vi.fn().mockResolvedValue('SOL'),
      }),
    });

    const serviceLegacy = new SpartanNewsService(runtime);
    const articleLegacy = await serviceLegacy.generateArticle({
      timeFrame: '24h',
      category: 'trending',
      limit: 3,
    });

    expect(articleLegacy).not.toBeNull();
    expect(getCacheMockLegacy).toHaveBeenCalledWith('tokens_v2_solana');
    expect(getCacheMockLegacy).toHaveBeenCalledWith('tokens_solana');
  });
});


