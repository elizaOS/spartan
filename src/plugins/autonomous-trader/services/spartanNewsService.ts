// @ts-nocheck
import {
  Service,
  logger,
  createUniqueUuid,
  asUUID,
  ChannelType,
  type IAgentRuntime,
  type Memory,
  type ServiceTypeName,
  type UUID,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { PublicKey } from '@solana/web3.js';

type NewsCategory = 'trending' | 'performance' | 'analytics' | 'holders';

export interface SpartanNewsArticle {
  id: UUID;
  title: string;
  summary: string;
  body: string;
  category: NewsCategory;
  timeFrame: string;
  limit: number;
  createdAt: number;
  metadata: {
    tokens: TrendingToken[];
    hasAnalytics: boolean;
    marketSentiment: {
      bullish: number;
      bearish: number;
      neutral: number;
      overall: 'bullish' | 'bearish' | 'mixed';
    };
    recommendations: string[];
  };
}

export interface SpartanNewsRequest {
  timeFrame?: string | null;
  category?: string | null;
  limit?: number | null;
  suppressCache?: boolean;
}

export interface TrendingToken {
  address: string;
  symbol: string;
  price: number;
  volume24h: number;
  priceChange24h: number;
}

const NEWS_MEMORY_TABLE = 'documents';
const NEWS_MEMORY_TYPE = 'spartan-news';
const DEFAULT_NEWS_TITLE = 'Spartan Market Recon';
const MIN_LIMIT = 3;
const MAX_LIMIT = 25;
const DEFAULT_LIMIT = 10;
const DEFAULT_CATEGORY: NewsCategory = 'trending';
const DEFAULT_TIMEFRAME = '24h';
const NEWS_TASK_TAGS = ['queue', 'repeat', 'autonomous-trader', 'spartan-news'];

const getStringSetting = (runtime: IAgentRuntime, key: string): string | undefined => {
  const value = runtime.getSetting(key);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

export class SpartanNewsService extends Service {
  static serviceType = 'SPARTAN_NEWS_SERVICE';
  capabilityDescription = 'Generates Spartan news briefings and stores them in agent memory.';

  private newsWorldId: UUID | null = null;
  private newsRoomId: UUID | null = null;

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime): Promise<SpartanNewsService> {
    const service = new SpartanNewsService(runtime);
    await service.initialize();
    return service;
  }

  static async stop(runtime: IAgentRuntime): Promise<void> {
    const service = runtime.getService(
      SpartanNewsService.serviceType as ServiceTypeName,
    ) as SpartanNewsService | undefined;

    if (!service) {
      logger.warn('[SpartanNewsService] stop called, but service instance not found');
      return;
    }

    await service.stop();
  }

  /**
   * Generate and persist a Spartan news article.
   */
  async generateAndStoreArticle(request: SpartanNewsRequest = {}): Promise<SpartanNewsArticle | null> {
    const article = await this.generateArticle(request);
    if (!article) {
      return null;
    }

    await this.storeArticle(article);
    return article;
  }

  /**
   * Generate a Spartan news article without persisting it.
   */
  async generateArticle(request: SpartanNewsRequest = {}): Promise<SpartanNewsArticle | null> {
    const timeFrame = (request.timeFrame || DEFAULT_TIMEFRAME).toLowerCase();
    const category = (request.category || DEFAULT_CATEGORY).toLowerCase() as NewsCategory;
    const limit = this.normalizeLimit(request.limit);

    try {
      const tokens = await this.fetchTrendingTokens(limit);
      if (!tokens.length) {
        logger.warn('[SpartanNewsService] No trending tokens available for report generation.');
        return this.buildEmptyArticle(timeFrame, category, limit);
      }

      const moralisApiKey = getStringSetting(this.runtime, 'MORALIS_API_KEY');
      const hasAnalytics = !!moralisApiKey;

      const sections = await this.generateSections(tokens, timeFrame, limit, category, hasAnalytics);
      const sentiment = this.computeMarketSentiment(tokens);
      const recommendations = this.generateInvestmentRecommendations(tokens);

      const createdAt = Date.now();
      const title = `${DEFAULT_NEWS_TITLE} • ${timeFrame.toUpperCase()}`;
      const summary = this.buildSummary(tokens, sentiment, category);
      const body = [
        `📰 ${title}`,
        `Time Frame: ${timeFrame}`,
        `Category: ${category}`,
        `Top ${limit} tokens`,
        '',
        sections.main,
        sections.category,
        sections.sentiment,
        recommendations.length ? this.renderRecommendations(recommendations) : '',
      ]
        .filter(Boolean)
        .join('\n');

      return {
        id: asUUID(uuidv4()),
        title,
        summary,
        body,
        category,
        timeFrame,
        limit,
        createdAt,
        metadata: {
          tokens,
          hasAnalytics,
          marketSentiment: sentiment,
          recommendations,
        },
      };
    } catch (error) {
      logger.error('[SpartanNewsService] Failed to generate Spartan news article', error);
      return null;
    }
  }

  /**
   * Retrieve the most recent articles from memory.
   */
  async getRecentArticles(limit = 5): Promise<SpartanNewsArticle[]> {
    const memories = await this.runtime.getMemories({
      agentId: this.runtime.agentId,
      tableName: NEWS_MEMORY_TABLE,
      count: limit * 3, // fetch extra in case of other documents
    });

    return memories
      .filter((memory) => {
        const metadata = memory.content?.metadata as { type?: string } | undefined;
        return metadata?.type === NEWS_MEMORY_TYPE;
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, limit)
      .map((memory) => this.memoryToArticle(memory))
      .filter((article): article is SpartanNewsArticle => article !== null);
  }

  /**
   * Retrieve article by ID.
   */
  async getArticleById(id: string): Promise<SpartanNewsArticle | null> {
    const memories = await this.runtime.getMemoriesByIds([id as UUID], NEWS_MEMORY_TABLE);
    if (!memories.length) {
      return null;
    }
    return this.memoryToArticle(memories[0]);
  }

  /**
   * Ensure a background task exists that generates Spartan news articles.
   */
  async ensureNewsTask(intervalMs: number): Promise<void> {
    await this.runtime.initPromise;

    const existingTasks = await this.runtime.getTasks({ tags: NEWS_TASK_TAGS });
    for (const task of existingTasks) {
      if (task.id) {
        await this.runtime.deleteTask(task.id);
      }
    }

    this.runtime.registerTaskWorker({
      name: 'SPARTAN_NEWS_ARTICLE_TASK',
      validate: async () => true,
      execute: async (runtime) => {
        try {
          const service = runtime.getService(
            SpartanNewsService.serviceType as ServiceTypeName,
          ) as SpartanNewsService | undefined;

          if (!service) {
            logger.warn('[SpartanNewsTask] SpartanNewsService not available during task execution');
            return;
          }

          await service.generateAndStoreArticle();
        } catch (error) {
          logger.error('[SpartanNewsTask] Failed to execute Spartan news task', error);
        }
      },
    });

    await this.runtime.createTask({
      name: 'SPARTAN_NEWS_ARTICLE_TASK',
      description: 'Generate Spartan news briefing',
      worldId: this.runtime.agentId,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updateInterval: intervalMs,
      },
      tags: NEWS_TASK_TAGS,
    });
  }

  private normalizeLimit(limit?: number | null): number {
    if (typeof limit !== 'number' || Number.isNaN(limit)) {
      return DEFAULT_LIMIT;
    }
    return Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, Math.floor(limit)));
  }

  protected async fetchTrendingTokens(limit: number): Promise<TrendingToken[]> {
    const tokens: TrendingToken[] = [];
    try {
      // Try v2 cache format first (used by strategy service)
      const v2Wrapper = await this.runtime.getCache<any>('tokens_v2_solana');
      let cachedTokens: any[] = [];

      if (v2Wrapper && v2Wrapper.data && Array.isArray(v2Wrapper.data)) {
        cachedTokens = v2Wrapper.data;
        logger.debug('[SpartanNewsService] Using tokens from v2 cache format');
      } else {
        // Fall back to legacy cache format
        const legacyTokens = await this.runtime.getCache<any[]>('tokens_solana');
        if (legacyTokens && Array.isArray(legacyTokens)) {
          cachedTokens = legacyTokens;
          logger.debug('[SpartanNewsService] Using tokens from legacy cache format');
        }
      }

      if (!cachedTokens.length) {
        logger.warn('[SpartanNewsService] No tokens found in either cache format (tokens_v2_solana or tokens_solana)');
      }

      const candidateAddresses = cachedTokens.map((token) => token.address).filter(Boolean);

      const dataProvider = this.runtime.getService('INTEL_DATAPROVIDER') as any;
      const birdeyeService = this.runtime.getService('birdeye' as ServiceTypeName) as any;
      const solanaService = this.runtime.getService('chain_solana' as ServiceTypeName) as any;

      if (!dataProvider || !birdeyeService || !solanaService) {
        logger.warn(
          '[SpartanNewsService] Required services not available for trending token lookup',
        );
        return [];
      }

      const targetAddresses = candidateAddresses.length
        ? candidateAddresses.slice(0, limit * 2)
        : [];

      if (!targetAddresses.length) {
        logger.warn('[SpartanNewsService] No target addresses to fetch');
        return [];
      }

      // Batch fetch all token data with single API calls per service
      try {
        const chainAndAddresses = targetAddresses.map(address => ({ chain: 'solana', address }));

        const [intelInfos, birdeyeInfos, symbolsMap] = await Promise.all([
          dataProvider.getTokensInfo(chainAndAddresses),
          birdeyeService.getTokensMarketData('solana', targetAddresses),
          solanaService.getTokensSymbols(targetAddresses),
        ]);

        // Process results and build tokens array
        for (const address of targetAddresses) {
          try {
            // Extract data from batch results
            const intelResults = Array.isArray(intelInfos) ? intelInfos.flat() : [];
            const intelInfo = intelResults.find((info: any) => info?.address === address);
            const birdeyeInfo = birdeyeInfos?.[address];
            const symbol = symbolsMap?.[address];

            if (birdeyeInfo?.priceUsd && birdeyeInfo?.volume24h) {
              tokens.push({
                address,
                symbol: symbol || intelInfo?.symbol || address.slice(0, 8),
                price: birdeyeInfo.priceUsd,
                volume24h: birdeyeInfo.volume24h || 0,
                priceChange24h: intelInfo?.priceChange24h || birdeyeInfo.priceChange24h || 0,
              });
            }
          } catch (error) {
            logger.debug(
              `[SpartanNewsService] Failed to process data for token ${address}`,
              error,
            );
          }
        }
      } catch (error) {
        logger.error('[SpartanNewsService] Failed to batch fetch token data', error);
      }

      const sortedTokens = tokens
        .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
        .slice(0, limit);

      logger.debug(`[SpartanNewsService] Fetched ${sortedTokens.length} trending tokens`);
      return sortedTokens;
    } catch (error) {
      logger.error('[SpartanNewsService] Error while fetching trending tokens', error);
      return [];
    }
  }

  private computeMarketSentiment(tokens: TrendingToken[]) {
    let bullish = 0;
    let bearish = 0;

    for (const token of tokens) {
      if (token.priceChange24h > 0) bullish++;
      else if (token.priceChange24h < 0) bearish++;
    }

    const total = tokens.length || 1;
    const bullishPercent = (bullish / total) * 100;
    const bearishPercent = (bearish / total) * 100;
    const neutralPercent = Math.max(0, 100 - bullishPercent - bearishPercent);

    let overall: 'bullish' | 'bearish' | 'mixed' = 'mixed';
    if (bullishPercent > 60) overall = 'bullish';
    else if (bearishPercent > 60) overall = 'bearish';

    return {
      bullish: Number(bullishPercent.toFixed(1)),
      bearish: Number(bearishPercent.toFixed(1)),
      neutral: Number(neutralPercent.toFixed(1)),
      overall,
    };
  }

  private generateInvestmentRecommendations(tokens: TrendingToken[]): string[] {
    const recs: string[] = [];
    for (const token of tokens) {
      if (token.volume24h > 100_000 && token.priceChange24h > 10) {
        recs.push(
          `🚀 ${token.symbol}: Strong momentum with elevated volume. Consider scaling into strength, but trail stops tightly.`,
        );
      } else if (token.volume24h > 100_000 && token.priceChange24h < -10) {
        recs.push(
          `⚠️ ${token.symbol}: Heavy sell pressure on high volume. Monitor for capitulation or structural breakdowns.`,
        );
      } else if (token.volume24h < 10_000 && Math.abs(token.priceChange24h) > 20) {
        recs.push(
          `📊 ${token.symbol}: Volatile move on thin liquidity. Treat any momentum as suspect and size accordingly.`,
        );
      }
    }
    return recs.slice(0, 5);
  }

  private renderRecommendations(recs: string[]): string {
    return ['💡 INVESTMENT RECOMMENDATIONS', '', ...recs.map((rec) => `• ${rec}`), ''].join(
      '\n',
    );
  }

  private async generateSections(
    tokens: TrendingToken[],
    timeFrame: string,
    limit: number,
    category: NewsCategory,
    hasAnalytics: boolean,
  ) {
    const main = this.renderTrendingOverview(tokens, limit);
    const categorySection = await this.renderCategorySection(
      tokens,
      timeFrame,
      limit,
      category,
      hasAnalytics,
    );
    const sentiment = this.renderMarketSentiment(tokens);

    return {
      main,
      category: categorySection,
      sentiment,
    };
  }

  private renderTrendingOverview(tokens: TrendingToken[], limit: number): string {
    if (!tokens.length) {
      return 'No trending token data available at this time.\n';
    }

    const trending = [...tokens]
      .sort((a, b) => Math.abs(b.priceChange24h) - Math.abs(a.priceChange24h))
      .slice(0, limit);

    const lines = [
      '🔥 TRENDING TOKENS',
      '',
      ...trending.map((token, index) => {
        const changeIcon = token.priceChange24h > 0 ? '📈' : token.priceChange24h < 0 ? '📉' : '⏸️';
        const sign = token.priceChange24h > 0 ? '+' : '';
        return [
          `${index + 1}. ${token.symbol} (${token.address.substring(0, 8)}...)`,
          `   ${changeIcon} Price: $${token.price.toFixed(6)} (${sign}${token.priceChange24h.toFixed(
            2,
          )}%)`,
          `   💰 Volume: $${Math.round(token.volume24h).toLocaleString()}`,
        ].join('\n');
      }),
      '',
    ];

    const positive = trending.filter((t) => t.priceChange24h > 0).length;
    const negative = trending.filter((t) => t.priceChange24h < 0).length;

    lines.push('📊 TREND SNAPSHOT');
    lines.push(`• Bullish: ${positive}/${trending.length}`);
    lines.push(`• Bearish: ${negative}/${trending.length}`);
    lines.push('');

    return lines.join('\n');
  }

  private async renderCategorySection(
    tokens: TrendingToken[],
    timeFrame: string,
    limit: number,
    category: NewsCategory,
    hasAnalytics: boolean,
  ): Promise<string> {
    switch (category) {
      case 'performance':
        return this.renderPerformanceSection(tokens, limit);
      case 'analytics':
        return this.renderAnalyticsSection(hasAnalytics);
      case 'holders':
        return this.renderHoldersSection(hasAnalytics);
      case 'trending':
      default:
        return this.renderTrendingSection(tokens, limit);
    }
  }

  private renderTrendingSection(tokens: TrendingToken[], limit: number): string {
    if (!tokens.length) {
      return '';
    }
    const trending = [...tokens]
      .sort((a, b) => Math.abs(b.priceChange24h) - Math.abs(a.priceChange24h))
      .slice(0, limit);

    return [
      '🔥 MOMENTUM SCAN',
      '',
      ...trending.map((token) => {
        const direction = token.priceChange24h >= 0 ? 'Upside momentum' : 'Downside pressure';
        return `• ${token.symbol}: ${direction} (${token.priceChange24h.toFixed(
          2,
        )}%) on $${Math.round(token.volume24h).toLocaleString()} volume`;
      }),
      '',
    ].join('\n');
  }

  private renderPerformanceSection(tokens: TrendingToken[], limit: number): string {
    if (!tokens.length) {
      return '';
    }
    const performers = [...tokens].sort((a, b) => b.priceChange24h - a.priceChange24h).slice(0, limit);

    const positiveChanges = tokens.filter((t) => t.priceChange24h > 0).length;
    const negativeChanges = tokens.filter((t) => t.priceChange24h < 0).length;
    const avgChange =
      tokens.reduce((sum, token) => sum + token.priceChange24h, 0) / (tokens.length || 1);

    return [
      '📊 PERFORMANCE LEADERBOARD',
      '',
      ...performers.map((token, index) => {
        const icon = token.priceChange24h >= 0 ? '🟢' : '🔴';
        const sign = token.priceChange24h >= 0 ? '+' : '';
        return `${index + 1}. ${token.symbol} — ${icon} ${sign}${token.priceChange24h.toFixed(
          2,
        )}% (${Math.round(token.volume24h).toLocaleString()} volume)`;
      }),
      '',
      'SUMMARY',
      `• Bullish tokens: ${positiveChanges}/${tokens.length}`,
      `• Bearish tokens: ${negativeChanges}/${tokens.length}`,
      `• Average change: ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%`,
      '',
    ].join('\n');
  }

  private renderAnalyticsSection(hasAnalytics: boolean): string {
    if (!hasAnalytics) {
      return [
        '📈 ADVANCED ANALYTICS',
        '',
        'Moralis analytics unavailable. Configure MORALIS_API_KEY for holder trends, sniper detection, and marketing insights.',
        '',
      ].join('\n');
    }

    return [
      '📈 ADVANCED ANALYTICS',
      '',
      '• Holder composition breakdown (whales vs. retail)',
      '• Acquisition flow (DEX vs OTCP transfers)',
      '• Sniper and early entrant tracking',
      '• Community traction and retention curves',
      '• Comparative benchmarking across tracked tokens',
      '',
    ].join('\n');
  }

  private renderHoldersSection(hasAnalytics: boolean): string {
    if (!hasAnalytics) {
      return [
        '👥 HOLDER INTELLIGENCE',
        '',
        'Holder analytics require MORALIS_API_KEY for distribution modeling, whale tracking, and retention insights.',
        '',
      ].join('\n');
    }

    return [
      '👥 HOLDER INTELLIGENCE',
      '',
      '• Net holder growth segmented by cohort',
      '• Holder concentration risk indicators',
      '• Whale ticket flow & redistribution patterns',
      '• Airdrop vs organic wallet acquisition ratios',
      '',
    ].join('\n');
  }

  private renderMarketSentiment(tokens: TrendingToken[]): string {
    const sentiment = this.computeMarketSentiment(tokens);

    const lines = [
      '🎯 MARKET SENTIMENT',
      '',
      `• Bullish tokens: ${sentiment.bullish}%`,
      `• Bearish tokens: ${sentiment.bearish}%`,
      `• Neutral tokens: ${sentiment.neutral}%`,
      '',
    ];

    if (sentiment.overall === 'bullish') {
      lines.push('🟢 OVERALL: Bullish — Momentum lifting more names than it is crushing.');
    } else if (sentiment.overall === 'bearish') {
      lines.push('🔴 OVERALL: Bearish — Flow is defensive, rotations are dumping risk.');
    } else {
      lines.push('🟡 OVERALL: Mixed — Fragmented moves, stay tactical and nimble.');
    }

    lines.push('');
    return lines.join('\n');
  }

  private buildSummary(
    tokens: TrendingToken[],
    sentiment: {
      bullish: number;
      bearish: number;
      neutral: number;
      overall: 'bullish' | 'bearish' | 'mixed';
    },
    category: string,
  ): string {
    const topToken = tokens[0];
    const direction =
      sentiment.overall === 'bullish'
        ? 'Momentum expanding across majors.'
        : sentiment.overall === 'bearish'
          ? 'Risk-off bleed undercutting bids.'
          : 'Choppy rotations, no dominant regime.';

    const headlineToken = topToken
      ? `${topToken.symbol} ${topToken.priceChange24h >= 0 ? '+' : ''}${topToken.priceChange24h.toFixed(
        2,
      )}%`
      : 'No dominant token';

    return `${headlineToken} • ${direction} • Focus: ${category}`;
  }

  private buildEmptyArticle(
    timeFrame: string,
    category: NewsCategory,
    limit: number,
  ): SpartanNewsArticle {
    const createdAt = Date.now();
    const title = `${DEFAULT_NEWS_TITLE} • ${timeFrame.toUpperCase()}`;

    return {
      id: asUUID(uuidv4()),
      title,
      summary: 'No market data available for this interval.',
      body: [
        `📰 ${title}`,
        `Time Frame: ${timeFrame}`,
        `Category: ${category}`,
        `Top ${limit} tokens`,
        '',
        'Unable to retrieve market data at this time. Try again later.',
        '',
      ].join('\n'),
      category,
      timeFrame,
      limit,
      createdAt,
      metadata: {
        tokens: [],
        hasAnalytics: false,
        marketSentiment: {
          bullish: 0,
          bearish: 0,
          neutral: 100,
          overall: 'mixed',
        },
        recommendations: [],
      },
    };
  }

  private async storeArticle(article: SpartanNewsArticle): Promise<void> {
    try {
      const memory = this.articleToMemory(article);
      await this.runtime.createMemory(memory, NEWS_MEMORY_TABLE);
    } catch (error) {
      logger.error('Error creating memory:', {
        error: error instanceof Error ? error.message : String(error),
        memoryId: article.id,
      });
      throw error;
    }
  }

  private articleToMemory(article: SpartanNewsArticle): Memory {
    const worldId = this.getNewsWorldId();
    const roomId = this.getNewsRoomId();

    return {
      id: article.id,
      agentId: this.runtime.agentId,
      entityId: this.runtime.agentId,
      worldId,
      roomId,
      createdAt: article.createdAt,
      content: {
        type: NEWS_MEMORY_TYPE,
        text: article.body,
        title: article.title,
        summary: article.summary,
        metadata: {
          type: NEWS_MEMORY_TYPE,
          category: article.category,
          timeFrame: article.timeFrame,
          limit: article.limit,
          tokens: article.metadata.tokens,
          sentiment: article.metadata.marketSentiment,
          recommendations: article.metadata.recommendations,
        },
      },
    };
  }

  private memoryToArticle(memory: Memory | null): SpartanNewsArticle | null {
    const metadata = memory?.content?.metadata as { type?: string } | undefined;
    if (!memory?.content || metadata?.type !== NEWS_MEMORY_TYPE) {
      return null;
    }

    const metadataRecord = (memory.content.metadata ?? {}) as {
      category?: NewsCategory;
      timeFrame?: string;
      limit?: number;
      tokens?: TrendingToken[];
      hasAnalytics?: boolean;
      sentiment?: SpartanNewsArticle['metadata']['marketSentiment'];
      recommendations?: string[];
    };
    return {
      id: memory.id || asUUID(uuidv4()),
      title: (memory.content as any).title || DEFAULT_NEWS_TITLE,
      summary: (memory.content as any).summary || '',
      body: memory.content.text || '',
      category: metadataRecord.category || DEFAULT_CATEGORY,
      timeFrame: metadataRecord.timeFrame || DEFAULT_TIMEFRAME,
      limit: metadataRecord.limit || DEFAULT_LIMIT,
      createdAt: memory.createdAt || Date.now(),
      metadata: {
        tokens: metadataRecord.tokens || [],
        hasAnalytics: Boolean(metadataRecord.hasAnalytics),
        marketSentiment:
          metadataRecord.sentiment || this.computeMarketSentiment(metadataRecord.tokens || []),
        recommendations: metadataRecord.recommendations || [],
      },
    };
  }

  private getNewsWorldId(): UUID {
    if (!this.newsWorldId) {
      this.newsWorldId = createUniqueUuid(this.runtime, `${this.runtime.agentId}:spartan-news-world`);
    }
    return this.newsWorldId;
  }

  private getNewsRoomId(): UUID {
    if (!this.newsRoomId) {
      this.newsRoomId = createUniqueUuid(this.runtime, `${this.runtime.agentId}:spartan-news-room`);
    }
    return this.newsRoomId;
  }

  private async initialize(): Promise<void> {
    try {
      await this.runtime.initPromise;

      // Ensure the world and room exist in the database
      const worldId = this.getNewsWorldId();
      const roomId = this.getNewsRoomId();

      await this.runtime.ensureWorldExists({
        id: worldId,
        name: 'Spartan News World',
        agentId: this.runtime.agentId,
        serverId: 'spartan-news-server',
        metadata: {
          description: 'World for Spartan news articles and market recon',
        },
      });

      await this.runtime.ensureRoomExists({
        id: roomId,
        name: 'Spartan News Room',
        agentId: this.runtime.agentId,
        source: 'spartan-news',
        type: ChannelType.SELF,
        channelId: roomId,
        serverId: 'spartan-news-server',
        worldId: worldId,
        metadata: {
          description: 'Room for storing Spartan news articles',
        },
      });

      logger.info('[SpartanNewsService] World and room initialized successfully');
    } catch (error) {
      logger.error('[SpartanNewsService] Failed during initialization', error);
      throw error;
    }
  }

  override async stop(): Promise<void> {
    this.newsWorldId = null;
    this.newsRoomId = null;

    try {
      const tasks = await this.runtime.getTasks({ tags: NEWS_TASK_TAGS });
      for (const task of tasks) {
        if (task.id) {
          await this.runtime.deleteTask(task.id);
        }
      }
    } catch (error) {
      logger.debug('[SpartanNewsService] Failed to clean up scheduled tasks during stop', error);
    }
  }
}

