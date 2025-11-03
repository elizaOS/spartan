import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { AnalyticsService } from '../services/analyticsService';
import { getAccountFromMessage } from '../../autonomous-trader/utils';
import { parseDateFilterFromMessage, formatDateFilterText } from '../../autonomous-trader/providers/date_filter';

/**
 * Main Analytics Provider
 * Provides comprehensive analytics data from multiple sources
 */
export const analyticsProvider: Provider = {
    name: 'ANALYTICS',
    description: 'Comprehensive analytics platform providing token analysis, technical indicators, holder analytics, market data, and account insights from multiple data providers (Birdeye, CoinMarketCap, Codex)',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('ANALYTICS')

        let analyticsStr = ''

        // DM or public?
        const isDM = message.content.channelType?.toUpperCase() === 'DM'
        if (isDM) {
            const account = await getAccountFromMessage(runtime, message)
            if (!account) {
                return {
                    data: {},
                    values: {},
                    text: 'No account found for this user.',
                }
            }

            // Initialize analytics service
            const analyticsService = new AnalyticsService(runtime);

            // Parse message for analytics requests
            const messageText = message.content?.text?.toLowerCase() || '';
            const dateFilter = parseDateFilterFromMessage(messageText);

            analyticsStr += `=== COMPREHENSIVE ANALYTICS REPORT ===\n`

            // Add date filter info if applied
            if (dateFilter) {
                analyticsStr += `📅 Date Filter: ${formatDateFilterText(dateFilter)}\n\n`
            }

            // Extract token addresses from user's positions
            const uniqueTokens = new Set<string>()
            if (account.metawallets) {
                for (const mw of account.metawallets) {
                    for (const chain in mw.keypairs) {
                        const kp = mw.keypairs[chain]
                        if (kp.positions) {
                            for (const p of kp.positions) {
                                uniqueTokens.add(p.token)
                            }
                        }
                    }
                }
            }

            if (uniqueTokens.size === 0) {
                analyticsStr += 'No token positions found for analysis.\n'
            } else {
                analyticsStr += `Analyzing ${uniqueTokens.size} unique tokens from your positions...\n\n`

                // Analyze each token with comprehensive analytics
                for (const tokenAddress of uniqueTokens) {
                    analyticsStr += await analyzeTokenComprehensive(analyticsService, tokenAddress, dateFilter)
                    analyticsStr += '\n' + '='.repeat(50) + '\n\n'
                }

                // Add portfolio analysis
                analyticsStr += await analyzePortfolio(analyticsService, account, dateFilter)
            }

            // Add market overview
            analyticsStr += await getMarketOverview(analyticsService)

        } else {
            analyticsStr = 'Comprehensive analytics are only available in private messages.'
        }

        console.log('analyticsStr', analyticsStr)

        const data = {
            comprehensiveAnalytics: analyticsStr
        };

        const values = {};

        const text = analyticsStr + '\n';

        return {
            data,
            values,
            text,
        };
    },
};

/**
 * Analyze a token with comprehensive analytics
 */
async function analyzeTokenComprehensive(analyticsService: AnalyticsService, tokenAddress: string, dateFilter?: any): Promise<string> {
    let analysis = `🔍 COMPREHENSIVE TOKEN ANALYSIS: ${tokenAddress}\n`

    try {
        const request = {
            tokenAddress,
            chain: 'solana', // Default to Solana for now
            timeframe: '1d',
            includeHistorical: true,
            includeHolders: true,
            includeSnipers: true
        };

        const response = await analyticsService.getTokenAnalytics(request);

        if (!response.success || !response.data) {
            analysis += `❌ Error analyzing token: ${response.error || 'Unknown error'}\n`
            return analysis;
        }

        const tokenData = response.data;

        // Price Analysis
        analysis += `💰 PRICE ANALYSIS:\n`
        analysis += `  • Current Price: $${tokenData.price.price.toFixed(6)}\n`
        analysis += `  • 24h Change: ${tokenData.price.priceChangePercent24h >= 0 ? '+' : ''}${tokenData.price.priceChangePercent24h.toFixed(2)}%\n`
        analysis += `  • 24h Volume: $${tokenData.price.volume24h.toLocaleString()}\n`
        analysis += `  • Market Cap: $${tokenData.price.marketCap.toLocaleString()}\n\n`

        // Technical Analysis
        analysis += `📊 TECHNICAL INDICATORS:\n`
        const tech = tokenData.technicalIndicators;
        analysis += `  • MACD: ${tech.macd.bullish ? '🟢 Bullish' : '🔴 Bearish'} (${tech.macd.macd.toFixed(6)})\n`
        analysis += `  • RSI: ${tech.rsi.value.toFixed(2)} ${tech.rsi.overbought ? '(Overbought)' : tech.rsi.oversold ? '(Oversold)' : '(Neutral)'}\n`
        analysis += `  • Bollinger Bands: ${tech.bollingerBands.percentB.toFixed(2)} (${tech.bollingerBands.percentB > 0.8 ? 'Upper' : tech.bollingerBands.percentB < 0.2 ? 'Lower' : 'Middle'})\n`
        analysis += `  • Volume Ratio: ${tech.volume.volumeRatio.toFixed(2)}x average\n\n`

        // Moving Averages
        analysis += `📈 MOVING AVERAGES:\n`
        analysis += `  • SMA 20: $${tech.movingAverages.sma20.toFixed(6)}\n`
        analysis += `  • SMA 50: $${tech.movingAverages.sma50.toFixed(6)}\n`
        analysis += `  • SMA 200: $${tech.movingAverages.sma200.toFixed(6)}\n`
        analysis += `  • EMA 12: $${tech.movingAverages.ema12.toFixed(6)}\n`
        analysis += `  • EMA 26: $${tech.movingAverages.ema26.toFixed(6)}\n\n`

        // Holder Analytics (if available)
        if (tokenData.holderAnalytics) {
            analysis += `👥 HOLDER ANALYTICS:\n`
            const holders = tokenData.holderAnalytics;
            analysis += `  • Total Holders: ${holders.totalHolders.toLocaleString()}\n`
            analysis += `  • Concentration Risk: ${holders.concentrationRisk.toUpperCase()}\n`
            analysis += `  • Community Growth: ${holders.communityGrowth.toUpperCase()}\n`
            analysis += `  • Acquisition Methods:\n`
            analysis += `    - Swaps: ${((holders.holdersByAcquisition.swap / holders.totalHolders) * 100).toFixed(1)}%\n`
            analysis += `    - Transfers: ${((holders.holdersByAcquisition.transfer / holders.totalHolders) * 100).toFixed(1)}%\n`
            analysis += `    - Airdrops: ${((holders.holdersByAcquisition.airdrop / holders.totalHolders) * 100).toFixed(1)}%\n\n`
        }

        // Sniper Analytics (if available)
        if (tokenData.sniperAnalytics) {
            analysis += `🎯 SNIPER ACTIVITY:\n`
            const snipers = tokenData.sniperAnalytics;
            analysis += `  • Active Snipers: ${snipers.activeSnipers}\n`
            analysis += `  • Total Sniped: $${snipers.totalSnipedUsd.toLocaleString()}\n`
            analysis += `  • Total Sold: $${snipers.totalSoldUsd.toLocaleString()}\n`
            analysis += `  • Total Profit: $${snipers.totalProfitUsd.toLocaleString()}\n`
            analysis += `  • Average Profit: ${snipers.averageProfitPercent >= 0 ? '+' : ''}${snipers.averageProfitPercent.toFixed(2)}%\n\n`
        }

        // Risk Assessment
        analysis += `⚠️ RISK ASSESSMENT:\n`
        const risk = tokenData.riskAssessment;
        analysis += `  • Overall Risk: ${risk.overallRisk.toUpperCase()}\n`
        analysis += `  • Volatility: ${risk.volatility.toFixed(2)}%\n`
        analysis += `  • Liquidity: ${risk.liquidity.toFixed(2)}%\n`
        analysis += `  • Concentration Risk: ${risk.concentrationRisk.toUpperCase()}\n`
        analysis += `  • Technical Risk: ${risk.technicalRisk.toUpperCase()}\n\n`

        // Recommendations
        analysis += `💡 RECOMMENDATIONS:\n`
        const rec = tokenData.recommendations;
        analysis += `  • Action: ${rec.action.toUpperCase()}\n`
        analysis += `  • Confidence: ${rec.confidence.toFixed(0)}%\n`
        analysis += `  • Reasons: ${rec.reasons.join(', ')}\n`
        analysis += `  • Price Targets:\n`
        analysis += `    - Short Term: $${rec.priceTargets.shortTerm.toFixed(6)}\n`
        analysis += `    - Medium Term: $${rec.priceTargets.mediumTerm.toFixed(6)}\n`
        analysis += `    - Long Term: $${rec.priceTargets.longTerm.toFixed(6)}\n\n`

    } catch (error) {
        analysis += `❌ Error in comprehensive analysis: ${error}\n`
    }

    return analysis;
}

/**
 * Analyze portfolio performance
 */
async function analyzePortfolio(analyticsService: AnalyticsService, account: any, dateFilter?: any): Promise<string> {
    let analysis = `📊 PORTFOLIO ANALYSIS\n`

    try {
        // Get account analytics
        const request = {
            walletAddress: account.walletAddress || 'unknown',
            chain: 'solana'
        };

        const response = await analyticsService.getAccountAnalytics(request);

        if (!response.success || !response.data) {
            analysis += `❌ Error analyzing portfolio: ${response.error || 'Unknown error'}\n\n`
            return analysis;
        }

        const portfolioData = response.data;

        analysis += `💰 PORTFOLIO OVERVIEW:\n`
        analysis += `  • Total Value: $${portfolioData.totalValue.toLocaleString()}\n`
        analysis += `  • 24h Change: ${portfolioData.totalValueChangePercent24h >= 0 ? '+' : ''}${portfolioData.totalValueChangePercent24h.toFixed(2)}%\n`
        analysis += `  • Total PnL: ${portfolioData.performance.totalPnLPercent >= 0 ? '+' : ''}${portfolioData.performance.totalPnLPercent.toFixed(2)}%\n\n`

        analysis += `📈 PERFORMANCE METRICS:\n`
        analysis += `  • Best Performer: ${portfolioData.performance.bestPerformer}\n`
        analysis += `  • Worst Performer: ${portfolioData.performance.worstPerformer}\n`
        analysis += `  • Sharpe Ratio: ${portfolioData.performance.riskMetrics.sharpeRatio.toFixed(2)}\n`
        analysis += `  • Max Drawdown: ${portfolioData.performance.riskMetrics.maxDrawdown.toFixed(2)}%\n`
        analysis += `  • Volatility: ${portfolioData.performance.riskMetrics.volatility.toFixed(2)}%\n\n`

        analysis += `🔄 TRADING HISTORY:\n`
        analysis += `  • Total Trades: ${portfolioData.tradingHistory.totalTrades}\n`
        analysis += `  • Win Rate: ${portfolioData.tradingHistory.winRate.toFixed(1)}%\n`
        analysis += `  • Average Trade Size: $${portfolioData.tradingHistory.averageTradeSize.toLocaleString()}\n\n`

        analysis += `🎯 TOP HOLDINGS:\n`
        const sortedPortfolio = portfolioData.portfolio
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        for (let i = 0; i < sortedPortfolio.length; i++) {
            const holding = sortedPortfolio[i];
            analysis += `  ${i + 1}. ${holding.symbol}: $${holding.value.toLocaleString()} (${holding.allocation.toFixed(1)}%)\n`
        }
        analysis += '\n'

    } catch (error) {
        analysis += `❌ Error in portfolio analysis: ${error}\n\n`
    }

    return analysis;
}

/**
 * Get market overview
 */
async function getMarketOverview(analyticsService: AnalyticsService): Promise<string> {
    let analysis = `🌍 MARKET OVERVIEW\n`

    try {
        const request = {
            chain: 'solana'
        };

        const response = await analyticsService.getMarketAnalytics(request);

        if (!response.success || !response.data) {
            analysis += `❌ Error getting market data: ${response.error || 'Unknown error'}\n\n`
            return analysis;
        }

        const marketData = response.data;

        analysis += `📊 MARKET METRICS:\n`
        analysis += `  • Total Market Cap: $${marketData.marketCap.toLocaleString()}\n`
        analysis += `  • 24h Volume: $${marketData.volume24h.toLocaleString()}\n`
        analysis += `  • Market Sentiment: ${getSentimentText(marketData.marketSentiment)}\n\n`

        analysis += `🚀 TOP GAINERS (24h):\n`
        for (let i = 0; i < Math.min(5, marketData.topGainers.length); i++) {
            const token = marketData.topGainers[i];
            analysis += `  ${i + 1}. ${token.symbol}: +${token.priceChangePercent24h.toFixed(2)}% ($${token.price.toFixed(6)})\n`
        }
        analysis += '\n'

        analysis += `📉 TOP LOSERS (24h):\n`
        for (let i = 0; i < Math.min(5, marketData.topLosers.length); i++) {
            const token = marketData.topLosers[i];
            analysis += `  ${i + 1}. ${token.symbol}: ${token.priceChangePercent24h.toFixed(2)}% ($${token.price.toFixed(6)})\n`
        }
        analysis += '\n'

        analysis += `🔥 TRENDING TOKENS:\n`
        for (let i = 0; i < Math.min(5, marketData.trendingTokens.length); i++) {
            const token = marketData.trendingTokens[i];
            analysis += `  ${i + 1}. ${token.symbol}: $${token.volume24h.toLocaleString()} volume ($${token.price.toFixed(6)})\n`
        }
        analysis += '\n'

    } catch (error) {
        analysis += `❌ Error in market overview: ${error}\n\n`
    }

    return analysis;
}

/**
 * Get sentiment text from sentiment data
 */
function getSentimentText(sentiment: any): string {
    if (sentiment.bullish > 0.6) return '🟢 Bullish';
    if (sentiment.bearish > 0.6) return '🔴 Bearish';
    return '🟡 Neutral';
} 