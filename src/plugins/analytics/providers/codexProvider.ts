import type { IAgentRuntime } from '@elizaos/core';
import type {
    TokenPriceData,
    HistoricalPriceData,
    MarketAnalytics,
    AccountAnalytics,
    TokenHolderAnalytics,
    SniperAnalytics
} from '../interfaces/types';

/**
 * Codex Data Provider
 * Integrates with Codex API for Solana token analytics and holder data
 */
export class CodexProvider {
    private runtime: IAgentRuntime;
    private apiKey: string;

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
        this.apiKey = runtime.getSetting('CODEX_API_KEY') as string;

        if (!this.apiKey) {
            throw new Error('Codex API key not configured');
        }
    }

    /**
     * Get token holder analytics from Codex
     */
    async getTokenHolderAnalytics(tokenAddress: string): Promise<TokenHolderAnalytics | null> {
        try {
            const cacheKey = `codex_holders_${tokenAddress}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            const query = `
        query TokenHolderStats($input: TokenHolderStatsInput!) {
          tokenHolderStats(input: $input) {
            totalHolders
            holdersByAcquisition {
              swap
              transfer
              airdrop
            }
            holderChange {
              change
              changePercent
            }
            holderDistribution {
              whales
              sharks
              dolphins
              fish
              octopus
              crabs
              shrimps
            }
          }
        }
      `;

            const variables = {
                input: {
                    tokenAddress: tokenAddress,
                    networkId: 1399811149 // Solana network ID
                }
            };

            const response = await fetch('https://api.codex.com/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.apiKey,
                    'x-apollo-operation-name': 'TokenHolderStats'
                },
                body: JSON.stringify({ query, variables })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const result = data.data?.tokenHolderStats;

            if (!result) {
                return null;
            }

            // Calculate concentration risk
            const totalHolders = result.totalHolders;
            const whalePercentage = (result.holderDistribution.whales / totalHolders) * 100;
            const sharkPercentage = (result.holderDistribution.sharks / totalHolders) * 100;
            const topTierPercentage = whalePercentage + sharkPercentage;

            let concentrationRisk: 'low' | 'moderate' | 'high';
            if (topTierPercentage > 50) {
                concentrationRisk = 'high';
            } else if (topTierPercentage > 20) {
                concentrationRisk = 'moderate';
            } else {
                concentrationRisk = 'low';
            }

            // Calculate community growth
            const recentGrowth = result.holderChange['24h']?.change || 0;
            const weeklyGrowth = result.holderChange['7d']?.change || 0;
            const monthlyGrowth = result.holderChange['30d']?.change || 0;

            let communityGrowth: 'declining' | 'stable' | 'growing' | 'explosive';
            if (recentGrowth > 0 && weeklyGrowth > 0 && monthlyGrowth > 0) {
                if (monthlyGrowth > 1000) {
                    communityGrowth = 'explosive';
                } else {
                    communityGrowth = 'growing';
                }
            } else if (recentGrowth > 0 && weeklyGrowth > 0) {
                communityGrowth = 'growing';
            } else if (recentGrowth < 0 && weeklyGrowth < 0) {
                communityGrowth = 'declining';
            } else {
                communityGrowth = 'stable';
            }

            const holderAnalytics: TokenHolderAnalytics = {
                tokenAddress,
                totalHolders: result.totalHolders,
                holdersByAcquisition: result.holdersByAcquisition,
                holderDistribution: result.holderDistribution,
                holderChange: result.holderChange,
                concentrationRisk,
                communityGrowth,
            };

            await this.setCachedData(cacheKey, holderAnalytics, 900); // 15 minutes cache
            return holderAnalytics;
        } catch (error) {
            console.error('Error fetching token holder analytics from Codex:', error);
            return null;
        }
    }

    /**
     * Get sniper analytics from Codex
     */
    async getSniperAnalytics(tokenAddress: string): Promise<SniperAnalytics | null> {
        try {
            const cacheKey = `codex_snipers_${tokenAddress}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            const query = `
        query TokenSnipers($input: TokenSnipersInput!) {
          tokenSnipers(input: $input) {
            walletAddress
            snipedTransactions {
              transactionHash
              transactionTimestamp
              blocksAfterCreation
            }
            sellTransactions {
              transactionHash
              transactionTimestamp
              blocksAfterCreation
            }
            totalSellTransactions
            totalSnipedTransactions
            totalTokensSniped
            totalSnipedUsd
            totalTokensSold
            totalSoldUsd
            currentBalance
            currentBalanceUsdValue
            realizedProfitPercentage
            realizedProfitUsd
          }
        }
      `;

            const variables = {
                input: {
                    tokenAddress: tokenAddress,
                    networkId: 1399811149, // Solana network ID
                    blocksAfterCreation: 1000
                }
            };

            const response = await fetch('https://api.codex.com/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.apiKey,
                    'x-apollo-operation-name': 'TokenSnipers'
                },
                body: JSON.stringify({ query, variables })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const snipers = data.data?.tokenSnipers || [];

            if (snipers.length === 0) {
                return null;
            }

            // Calculate aggregate statistics
            let totalSnipedUsd = 0;
            let totalSoldUsd = 0;
            let totalProfitUsd = 0;
            let totalProfitPercentage = 0;
            let activeSnipers = 0;
            const topPerformers: Array<{
                walletAddress: string;
                realizedProfitUsd: number;
                realizedProfitPercent: number;
            }> = [];

            for (const sniper of snipers) {
                totalSnipedUsd += sniper.totalSnipedUsd || 0;
                totalSoldUsd += sniper.totalSoldUsd || 0;
                totalProfitUsd += sniper.realizedProfitUsd || 0;
                totalProfitPercentage += sniper.realizedProfitPercentage || 0;

                if (sniper.currentBalance > 0) {
                    activeSnipers++;
                }

                if (sniper.realizedProfitUsd > 0) {
                    topPerformers.push({
                        walletAddress: sniper.walletAddress,
                        realizedProfitUsd: sniper.realizedProfitUsd,
                        realizedProfitPercent: sniper.realizedProfitPercentage,
                    });
                }
            }

            // Sort top performers by profit
            topPerformers.sort((a, b) => b.realizedProfitUsd - a.realizedProfitUsd);
            const top5Performers = topPerformers.slice(0, 5);

            const avgProfitPercentage = snipers.length > 0 ? totalProfitPercentage / snipers.length : 0;

            const sniperAnalytics: SniperAnalytics = {
                tokenAddress,
                activeSnipers,
                totalSnipedUsd,
                totalSoldUsd,
                totalProfitUsd,
                averageProfitPercent: avgProfitPercentage,
                topPerformers: top5Performers,
            };

            await this.setCachedData(cacheKey, sniperAnalytics, 900); // 15 minutes cache
            return sniperAnalytics;
        } catch (error) {
            console.error('Error fetching sniper analytics from Codex:', error);
            return null;
        }
    }

    /**
     * Get wallet analytics from Codex
     */
    async getWalletAnalytics(walletAddress: string): Promise<any | null> {
        try {
            const cacheKey = `codex_wallet_${walletAddress}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            const query = `
        query WalletStats($input: WalletStatsInput!) {
          walletStats(input: $input) {
            totalValue
            totalValueChange24h
            totalValueChangePercent24h
            portfolio {
              tokenAddress
              symbol
              balance
              value
              valueChange24h
            }
            performance {
              totalPnL
              totalPnLPercent
              bestPerformer
              worstPerformer
              riskMetrics {
                sharpeRatio
                maxDrawdown
                volatility
              }
            }
            tradingHistory {
              totalTrades
              winningTrades
              losingTrades
              winRate
              averageTradeSize
            }
          }
        }
      `;

            const variables = {
                input: {
                    walletAddress: walletAddress,
                    networkId: 1399811149 // Solana network ID
                }
            };

            const response = await fetch('https://api.codex.com/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.apiKey,
                    'x-apollo-operation-name': 'WalletStats'
                },
                body: JSON.stringify({ query, variables })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const result = data.data?.walletStats;

            if (!result) {
                return null;
            }

            await this.setCachedData(cacheKey, result, 300); // 5 minutes cache
            return result;
        } catch (error) {
            console.error('Error fetching wallet analytics from Codex:', error);
            return null;
        }
    }

    /**
     * Get historical token holder data from Codex
     */
    async getHistoricalHolderData(
        tokenAddress: string,
        fromDate: Date,
        toDate: Date
    ): Promise<any[] | null> {
        try {
            const cacheKey = `codex_historical_holders_${tokenAddress}_${fromDate.getTime()}_${toDate.getTime()}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            const query = `
        query HistoricalTokenHolderStats($input: HistoricalTokenHolderStatsInput!) {
          historicalTokenHolderStats(input: $input) {
            timestamp
            totalHolders
            netHolderChange
            holderPercentChange
            newHoldersByAcquisition {
              swap
              transfer
              airdrop
            }
            holdersIn {
              whales
              sharks
              dolphins
              fish
              octopus
              crab
              shrimps
            }
            holdersOut {
              whales
              sharks
              dolphins
              fish
              octopus
              crab
              shrimps
            }
          }
        }
      `;

            const variables = {
                input: {
                    tokenAddress: tokenAddress,
                    networkId: 1399811149, // Solana network ID
                    fromDate: fromDate.getTime() / 1000,
                    toDate: toDate.getTime() / 1000,
                    resolution: "1d"
                }
            };

            const response = await fetch('https://api.codex.com/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.apiKey,
                    'x-apollo-operation-name': 'HistoricalTokenHolderStats'
                },
                body: JSON.stringify({ query, variables })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const result = data.data?.historicalTokenHolderStats || [];

            await this.setCachedData(cacheKey, result, 600); // 10 minutes cache
            return result;
        } catch (error) {
            console.error('Error fetching historical holder data from Codex:', error);
            return null;
        }
    }

    /**
     * Rate limiting for Codex API calls
     */
    private async rateLimit(): Promise<void> {
        const lastCallKey = 'codex_last_call_time';
        const rateLimitDelay = 0.5; // 500ms between calls

        const lastCall = await this.getCachedData(lastCallKey);
        if (lastCall) {
            const timeSinceLastCall = Date.now() - lastCall;
            if (timeSinceLastCall < rateLimitDelay * 1000) {
                const sleepTime = (rateLimitDelay * 1000) - timeSinceLastCall;
                await new Promise(resolve => setTimeout(resolve, sleepTime));
            }
        }

        await this.setCachedData(lastCallKey, Date.now(), 60);
    }

    /**
     * Get cached data
     */
    private async getCachedData(key: string): Promise<any | null> {
        try {
            return await this.runtime.getCache(key);
        } catch (error) {
            return null;
        }
    }

    /**
     * Set cached data
     */
    private async setCachedData(key: string, data: any, ttlSeconds: number): Promise<void> {
        try {
            await this.runtime.setCache(key, data, ttlSeconds);
        } catch (error) {
            console.error('Failed to cache data:', error);
        }
    }
} 