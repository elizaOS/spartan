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
});


