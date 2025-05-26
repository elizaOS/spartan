import { TokenSignal } from '../../types/trading';
import { BaseTradeService } from '../base/BaseTradeService';
import { logger } from '@elizaos/core';
import { UUID } from '@elizaos/core';

export class SignalCalculationService extends BaseTradeService {
  async calculateTechnicalSignals(marketData: any) {
    const rsi = this.analyticsService.calculateRSI(marketData.priceHistory, 14);
    const macd = this.analyticsService.calculateMACD(marketData.priceHistory);

    const volatility =
      marketData.priceHistory.length > 1
        ? Math.abs(
            marketData.priceHistory[marketData.priceHistory.length - 1] -
              marketData.priceHistory[marketData.priceHistory.length - 2]
          ) / marketData.priceHistory[marketData.priceHistory.length - 2]
        : 0;

    const volumeTrend = marketData.volume24h > marketData.marketCap * 0.1 ? 'increasing' : 'stable';
    const unusualActivity = marketData.volume24h > marketData.marketCap * 0.2;

    return {
      rsi,
      macd,
      volumeProfile: {
        trend: volumeTrend as 'increasing' | 'stable',
        unusualActivity,
      },
      volatility,
    };
  }

  async scoreTokenSignals(signals: TokenSignal[]): Promise<TokenSignal[]> {
    // Group signals by token address
    const tokenMap = new Map<string, TokenSignal>();

    for (const signal of signals) {
      if (tokenMap.has(signal.address)) {
        const existing = tokenMap.get(signal.address)!;
        existing.reasons.push(...signal.reasons);
        existing.score = (existing.score || 0) + (signal.score || 0);
      } else {
        tokenMap.set(signal.address, { ...signal });
      }
    }

    // Score each token based on its aggregated data and pre-populated technical/social/market metrics
    const scoredTokens = await Promise.all(
      Array.from(tokenMap.values()).map(async (token) => {
        let newScore = 0;

        // Technical Analysis Score (0-40)
        if (token.technicalSignals) {
          newScore += await this.analyticsService.scoreTechnicalSignals(token.technicalSignals);
        }

        // Social Signal Score (0-30)
        if (token.socialMetrics) {
          newScore += await this.analyticsService.scoreSocialMetrics(token.socialMetrics);
        }

        // Market Metrics Score (0-30)
        newScore += await this.analyticsService.scoreMarketMetrics({
          marketCap: token.marketCap,
          volume24h: token.volume24h,
          liquidity: token.liquidity,
        });

        token.score = newScore;
        return token;
      })
    );

    // Sort by score and filter minimum requirements
    return scoredTokens
      .filter(
        (token) =>
          token.score >= (this.tradingConfig.thresholds.minScore || 60) &&
          token.liquidity >= (this.tradingConfig.thresholds.minLiquidity || 50000) &&
          token.volume24h >= (this.tradingConfig.thresholds.minVolume || 100000)
      )
      .sort((a, b) => b.score - a.score);
  }

  async calculateDrawdown(portfolio: {
    totalValue: number;
    positions: { [tokenAddress: string]: { amount: number; value: number } };
    solBalance: number;
  }): Promise<number> {
    try {
      // Get historical high water mark from storage
      const highWaterMarkValue = await this.runtime.getMemoryById('high_water_mark_memory' as UUID);
      const highWaterMark =
        highWaterMarkValue && highWaterMarkValue.content.value
          ? Number(highWaterMarkValue.content.value)
          : 0;

      // Calculate current drawdown
      const currentDrawdown =
        highWaterMark > 0 ? (highWaterMark - portfolio.totalValue) / highWaterMark : 0;

      // Update high water mark if needed
      if (portfolio.totalValue > highWaterMark) {
        await this.runtime.createMemory(
          {
            id: 'high_water_mark_memory' as UUID,
            agentId: this.runtime.agentId,
            entityId: this.runtime.agentId,
            roomId: this.runtime.agentId,
            content: { value: portfolio.totalValue.toString() },
            metadata: { tableName: 'portfolio_metrics' } as any,
            createdAt: Date.now(),
          },
          'portfolio_metrics'
        );
      }

      return Math.max(0, currentDrawdown);
    } catch (error) {
      logger.error('Error calculating drawdown:', error);
      return 0;
    }
  }
}
