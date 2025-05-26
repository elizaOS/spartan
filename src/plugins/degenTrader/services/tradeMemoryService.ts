import { IAgentRuntime, logger, Memory, UUID } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { Position, ServiceTypes } from '../types';
import { AnalyticsService } from './analyticsService';
import { BaseTradeService } from './base/BaseTradeService';
import { DataService } from './dataService';
import { WalletService } from './walletService';

export interface TradeMemory {
  id: UUID;
  tokenAddress: string;
  chain: string;
  type: 'BUY' | 'SELL';
  amount: string;
  price: string; // in USD
  timestamp: Date;
  txHash?: string;
  metadata?: {
    slippage?: number;
    expectedAmount?: string;
    receivedAmount?: string;
    valueUsd?: string;
  };
}

export class TradeMemoryService extends BaseTradeService {
  public static readonly serviceType = ServiceTypes.TRADE_MEMORY;
  public capabilityDescription = 'Manages storage and retrieval of trade and position data.';

  constructor(
    runtime: IAgentRuntime,
    walletService: WalletService,
    dataService: DataService,
    analyticsService: AnalyticsService
  ) {
    super(runtime, walletService, dataService, analyticsService);
  }

  async initialize(): Promise<void> {
    logger.info('Trade memory service initialized');
  }

  async stop(): Promise<void> {
    // Cleanup if needed
  }

  async storeTrade(trade: TradeMemory): Promise<void> {
    try {
      const memory: Memory = {
        id: uuidv4() as UUID,
        agentId: this.runtime.agentId,
        entityId: this.runtime.agentId,
        roomId: this.runtime.agentId,
        content: { trade },
        createdAt: Date.now(),
        metadata: { tableName: 'trades' } as any,
      };
      await this.runtime.createMemory(memory, 'trades');
      logger.info(`Trade stored for ${trade.tokenAddress} (${trade.type})`);
    } catch (error) {
      logger.error(`Error storing trade for ${trade.tokenAddress}:`, error);
      throw error;
    }
  }

  async getTradesForToken(tokenAddress: string, chain: string): Promise<TradeMemory[]> {
    try {
      const memories = await this.runtime.getMemories({
        tableName: 'trades',
      });

      return memories
        .filter((memory) => {
          if (memory.content && typeof memory.content === 'object' && 'trade' in memory.content) {
            const trade = memory.content.trade as TradeMemory; // Assert type after check
            return trade.tokenAddress === tokenAddress && trade.chain === chain;
          }
          return false;
        })
        .map((memory) => memory.content.trade as TradeMemory);
    } catch (error) {
      logger.error(`Error getting trades for token ${tokenAddress}:`, error);
      return [];
    }
  }

  async createTrade(params: {
    tokenAddress: string;
    chain: string;
    type: 'BUY' | 'SELL';
    amount: string;
    price: string;
    txHash?: string;
    metadata?: TradeMemory['metadata'];
  }): Promise<TradeMemory> {
    const trade: TradeMemory = {
      id: uuidv4() as UUID,
      timestamp: new Date(),
      ...params,
    };
    await this.storeTrade(trade);
    return trade;
  }

  async getRecentTrades(limit: number = 10): Promise<TradeMemory[]> {
    try {
      const memories = await this.runtime.getMemories({
        agentId: this.runtime.agentId,
        tableName: 'trades',
        count: limit,
      });

      // Sort after fetching
      return memories
        .sort((a, b) => {
          const tradeA = a.content.trade as TradeMemory;
          const tradeB = b.content.trade as TradeMemory;
          return tradeB.timestamp.getTime() - tradeA.timestamp.getTime();
        })
        .map((memory) => memory.content.trade as TradeMemory);
    } catch (error) {
      logger.error('Error getting recent trades:', error);
      return [];
    }
  }

  async searchTrades(query: string): Promise<TradeMemory[]> {
    try {
      const queryEmbedding = await this.runtime.useModel('TEXT_EMBEDDING', { text: query });
      const memories = await this.runtime.searchMemories({
        embedding: queryEmbedding,
        tableName: 'trades',
        count: 10,
        match_threshold: 0.7,
      });

      return memories
        .filter(
          (memory) =>
            memory.content && typeof memory.content === 'object' && 'trade' in memory.content
        )
        .map((memory) => memory.content.trade as TradeMemory);
    } catch (error) {
      logger.error('Error searching trades:', error);
      return [];
    }
  }

  async deleteTrade(tradeId: UUID): Promise<void> {
    try {
      await this.runtime.deleteMemory(tradeId);
      logger.info(`Deleted trade ${tradeId}`);
    } catch (error) {
      logger.error(`Error deleting trade ${tradeId}:`, error);
      throw error;
    }
  }

  async getPosition(positionId: UUID): Promise<Position | null> {
    logger.info(`Getting position ${positionId}`);
    const memory = await this.runtime.getMemoryById(positionId);
    if (memory && memory.content.position) {
      return memory.content.position as Position;
    }
    return null;
  }

  async updatePosition(position: Position): Promise<void> {
    logger.info(`Updating position ${position.id}`);
    const memoryToUpdate = {
      id: position.id,
      content: { position },
    };
    await this.runtime.updateMemory(memoryToUpdate as any);
  }

  async deletePosition(positionId: UUID): Promise<void> {
    logger.info(`Deleting position ${positionId}`);
    await this.runtime.deleteMemory(positionId);
  }

  async getAllPositions(): Promise<Position[]> {
    logger.info('Getting all positions');
    const memories = await this.runtime.getMemories({ tableName: 'positions' } as any);
    return memories.map((m) => m.content.position as Position).filter((p) => p);
  }
}
