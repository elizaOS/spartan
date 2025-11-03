import {
    type Action,
    type ActionExample,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    ModelType,
    type State,
    composePromptFromState,
    logger,
    parseJSONObjectFromText,
} from '@elizaos/core';
import { HasEntityIdFromMessage, getAccountFromMessage, messageReply, takeItPrivate2 } from '../../autonomous-trader/utils';

/**
 * Interface representing the content of a Spartan news request.
 *
 * @interface SpartanNewsContent
 * @extends Content
 * @property {string | null} timeFrame - The time frame for trending analysis (e.g., '24h', '7d', '30d')
 * @property {string | null} category - The category of news to focus on (e.g., 'trending', 'performance', 'analytics')
 * @property {number | null} limit - The number of tokens to include in the report
 */
interface SpartanNewsContent extends Content {
    timeFrame: string | null;
    category: string | null;
    limit: number | null;
}

/**
 * Template for determining the type of Spartan news report to generate.
 */
const newsRequestTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Recent Messages:
{{recentMessages}}

Extract the following information about the requested Spartan news report:
- Time frame for analysis (if user specifies "last 7 days", "24 hours", "this month", etc., otherwise use null)
- Category of news (if user specifies "trending", "performance", "analytics", "holders", etc., otherwise use null)
- Limit of tokens to include (if user specifies a number like "top 5", "10 tokens", etc., otherwise use null)

Example responses:
If user asks for "trending tokens in the last 7 days":
\`\`\`json
{
    "timeFrame": "7d",
    "category": "trending",
    "limit": null
}
\`\`\`

If user asks for "top 5 performing tokens":
\`\`\`json
{
    "timeFrame": null,
    "category": "performance",
    "limit": 5
}
\`\`\`

If user just asks for "Spartan news" or "token insights":
\`\`\`json
{
    "timeFrame": null,
    "category": null,
    "limit": null
}
\`\`\`

Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the JSON response format without any preamble or explanation.

IMPORTANT: Your response must ONLY contain the json block above. Do not include any text, thinking, or reasoning before or after this JSON block. Start your response immediately with { and end with }.`;

export default {
    name: 'SPARTAN_NEWS',
    similes: [
        'SPARTAN_NEWS_REPORT',
        'SPARTAN_NEWS_INSIGHTS',
        'SPARTAN_NEWS_ANALYSIS',
        'SPARTAN_NEWS_SUMMARY',
        'SPARTAN_NEWS_UPDATE',
        'SPARTAN_NEWS_OVERVIEW',
        'SPARTAN_NEWS_DIGEST',
        'SPARTAN_NEWS_BRIEF',
        'SPARTAN_NEWS_ALERT',
        'SPARTAN_NEWS_FEED',
        'TRENDING_TOKENS',
        'TRENDING_TOKENS_REPORT',
        'TRENDING_TOKENS_INSIGHTS',
        'TRENDING_TOKENS_ANALYSIS',
        'TOKEN_INSIGHTS',
        'TOKEN_INSIGHTS_REPORT',
        'TOKEN_INSIGHTS_ANALYSIS',
        'TOKEN_MARKET_INSIGHTS',
        'TOKEN_MARKET_REPORT',
        'TOKEN_MARKET_ANALYSIS',
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        if (!await HasEntityIdFromMessage(runtime, message)) {
            console.warn('SPARTAN_NEWS validate - author not found')
            return false
        }

        const account = await getAccountFromMessage(runtime, message)
        if (!account) return false;

        return true;
    },
    description: 'Generate comprehensive insights and news about trending tokens, market performance, and analytics based on market data and popular Solana tokens.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: Memory[] = []
    ): Promise<boolean> => {
        logger.log('SPARTAN_NEWS Starting news report handler...');

        // Parse user request for specific parameters
        const sourcePrompt = composePromptFromState({
            state: state,
            template: newsRequestTemplate,
        });
        const content = await runtime.useModel(ModelType.OBJECT_LARGE, {
            prompt: sourcePrompt,
        });
        //console.log('SPARTAN_NEWS sourceResult', sourceResult)

        //const content = parseJSONObjectFromText(sourceResult) as SpartanNewsContent;
        if (!content) {
            console.log('SPARTAN_NEWS failed to parse response')
            return false
        }

        // Determine time frame for analysis
        const timeFrame = content.timeFrame || '7d'; // Default to 7 days
        const category = content.category || 'trending'; // Default to trending
        const limit = content.limit || 10; // Default to top 10

        let newsReport = `📰 SPARTAN NEWS REPORT\n`
        newsReport += `Time Frame: ${timeFrame}\n`
        newsReport += `Category: ${category}\n`
        newsReport += `Top ${limit} tokens\n\n`

        try {
            // Get market data for trending tokens (not just user's positions)
            const dataProviderService = runtime.getService('TRADER_DATAPROVIDER') as any;

            // Get trending tokens from market data
            const trendingTokens = await getTrendingTokensFromMarket(runtime, dataProviderService, limit)

            if (trendingTokens.length === 0) {
                newsReport += 'Unable to fetch market data at this time.\n'
                newsReport += 'Please try again later.\n\n'
            } else {
                newsReport += `Analyzing ${trendingTokens.length} trending tokens from the market...\n\n`

                // Get Moralis API key for analytics
                const moralisApiKey = runtime.getSetting('MORALIS_API_KEY') as string
                const hasAnalytics = !!moralisApiKey

                // Generate different types of reports based on category
                switch (category.toLowerCase()) {
                    case 'trending':
                        newsReport += await generateTrendingReport(runtime, trendingTokens, timeFrame, limit, hasAnalytics)
                        break
                    case 'performance':
                        newsReport += await generateMarketPerformanceReport(runtime, trendingTokens, timeFrame, limit)
                        break
                    case 'analytics':
                        if (hasAnalytics) {
                            newsReport += await generateAnalyticsReport(runtime, trendingTokens, timeFrame, limit, moralisApiKey)
                        } else {
                            newsReport += 'Analytics require Moralis API key. Using market performance report instead.\n\n'
                            newsReport += await generateMarketPerformanceReport(runtime, trendingTokens, timeFrame, limit)
                        }
                        break
                    case 'holders':
                        if (hasAnalytics) {
                            newsReport += await generateHoldersReport(runtime, trendingTokens, timeFrame, limit, moralisApiKey)
                        } else {
                            newsReport += 'Holder analytics require Moralis API key. Using market performance report instead.\n\n'
                            newsReport += await generateMarketPerformanceReport(runtime, trendingTokens, timeFrame, limit)
                        }
                        break
                    default:
                        newsReport += await generateTrendingReport(runtime, trendingTokens, timeFrame, limit, hasAnalytics)
                        break
                }

                // Add market sentiment summary
                newsReport += await generateMarketSentiment(runtime, trendingTokens, timeFrame)
            }

            // Add investment recommendations
            newsReport += await generateInvestmentRecommendations(runtime, trendingTokens, timeFrame)

        } catch (error) {
            console.error('SPARTAN_NEWS error generating report', error)
            newsReport += `❌ Error generating news report: ${error}\n`
        }

        console.log('SPARTAN_NEWS newsReport', newsReport)

        // Send response
        //takeItPrivate2(runtime, message, newsReport, callback)
        callback(messageReply(runtime, message, newsReport))

        return true;
    },

    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me Spartan news',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll generate a comprehensive Spartan news report for you.',
                    actions: ['SPARTAN_NEWS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'What are the trending tokens?',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Let me analyze trending tokens from the market.',
                    actions: ['SPARTAN_NEWS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me top 5 performing tokens in the last 7 days',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll check the top performing tokens from the market.',
                    actions: ['SPARTAN_NEWS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Give me token analytics insights',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll provide detailed analytics on your tokens.',
                    actions: ['SPARTAN_NEWS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'What\'s the market sentiment for my tokens?',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll analyze market sentiment for trending tokens.',
                    actions: ['SPARTAN_NEWS'],
                },
            },
        ],
    ] as ActionExample[][],
} as Action;

/**
 * Get trending tokens from market data
 */
async function getTrendingTokensFromMarket(runtime: IAgentRuntime, dataProviderService: any, limit: number): Promise<Array<{ address: string; symbol: string; price: number; volume24h: number; priceChange24h: number }>> {
    const trendingTokens: Array<{ address: string; symbol: string; price: number; volume24h: number; priceChange24h: number }> = []

    try {
        // Get trending tokens from market data
        // This would typically come from a trending tokens API or market data service
        // For now, we'll use a placeholder list of popular Solana tokens
        const popularTokens = [
            'So11111111111111111111111111111111111111112', // SOL
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
            'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
            'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
            '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', // POPCAT
            'HZ1JovNiVvGrGNiiYvEozEVg58WUyNpVzqKqQqKqQqKq', // SAMO
            'AFbX8oGjGpmVFywbVouvhQSRmiW2aR1mohfahi4Y2AdB', // GST
            '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj', // stSOL
            'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
            'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn'  // jitoSOL
        ]

        // Get market data for each token
        for (const tokenAddress of popularTokens.slice(0, limit * 2)) { // Get more to filter
            try {
                const tokenInfo = await dataProviderService.getTokenInfo('solana', tokenAddress)
                if (tokenInfo && tokenInfo.priceUsd && tokenInfo.volume24h) {
                    trendingTokens.push({
                        address: tokenAddress,
                        symbol: tokenInfo.symbol || tokenAddress.substring(0, 8),
                        price: tokenInfo.priceUsd,
                        volume24h: tokenInfo.volume24h || 0,
                        priceChange24h: tokenInfo.priceChange24h || 0
                    })
                }
            } catch (error) {
                console.error('Error getting token info for', tokenAddress, error)
            }
        }

        // Sort by 24h volume and return top tokens
        return trendingTokens
            .sort((a, b) => b.volume24h - a.volume24h)
            .slice(0, limit)

    } catch (error) {
        console.error('Error getting trending tokens from market:', error)
        return []
    }
}

/**
 * Generate trending tokens report
 */
async function generateTrendingReport(runtime: IAgentRuntime, tokens: Array<{ address: string; symbol: string; price: number; volume24h: number; priceChange24h: number }>, timeFrame: string, limit: number, hasAnalytics: boolean): Promise<string> {
    let report = `🔥 TRENDING TOKENS REPORT\n`

    // Sort by 24h price change (trending)
    const trendingTokens = tokens
        .sort((a, b) => Math.abs(b.priceChange24h) - Math.abs(a.priceChange24h))
        .slice(0, limit)

    if (trendingTokens.length === 0) {
        report += 'No trending data available for your tokens.\n\n'
        return report
    }

    report += `Top ${trendingTokens.length} Trending Tokens (24h):\n\n`

    for (let i = 0; i < trendingTokens.length; i++) {
        const token = trendingTokens[i]
        const changeIcon = token.priceChange24h > 0 ? '📈' : '📉'
        const changeSign = token.priceChange24h > 0 ? '+' : ''

        report += `${i + 1}. ${token.symbol} (${token.address.substring(0, 8)}...)\n`
        report += `   ${changeIcon} Price: $${token.price.toFixed(6)} (${changeSign}${token.priceChange24h.toFixed(2)}%)\n`
        report += `   💰 Volume: $${token.volume24h.toLocaleString()}\n\n`
    }

    // Add trending analysis
    const positiveChanges = trendingTokens.filter(t => t.priceChange24h > 0).length
    const negativeChanges = trendingTokens.filter(t => t.priceChange24h < 0).length

    report += `📊 TRENDING ANALYSIS:\n`
    report += `• Bullish tokens: ${positiveChanges}/${trendingTokens.length}\n`
    report += `• Bearish tokens: ${negativeChanges}/${trendingTokens.length}\n`
    report += `• Market sentiment: ${positiveChanges > negativeChanges ? '🟢 Bullish' : '🔴 Bearish'}\n\n`

    return report
}

/**
 * Generate market performance report
 */
async function generateMarketPerformanceReport(runtime: IAgentRuntime, tokens: Array<{ address: string; symbol: string; price: number; volume24h: number; priceChange24h: number }>, timeFrame: string, limit: number): Promise<string> {
    let report = `📊 MARKET PERFORMANCE REPORT\n`

    // Sort by 24h price change (best performers)
    const topPerformers = tokens
        .sort((a, b) => b.priceChange24h - a.priceChange24h)
        .slice(0, limit)

    if (topPerformers.length === 0) {
        report += 'No market data available for performance analysis.\n\n'
        return report
    }

    report += `Top ${topPerformers.length} Market Performers (24h):\n\n`

    for (let i = 0; i < topPerformers.length; i++) {
        const token = topPerformers[i]
        const performanceIcon = token.priceChange24h > 0 ? '🟢' : '🔴'
        const sign = token.priceChange24h > 0 ? '+' : ''

        report += `${i + 1}. ${token.symbol} (${token.address.substring(0, 8)}...)\n`
        report += `   ${performanceIcon} Price: $${token.price.toFixed(6)} (${sign}${token.priceChange24h.toFixed(2)}%)\n`
        report += `   💰 Volume: $${token.volume24h.toLocaleString()}\n\n`
    }

    // Add market summary statistics
    const positiveChanges = tokens.filter(t => t.priceChange24h > 0).length
    const negativeChanges = tokens.filter(t => t.priceChange24h < 0).length
    const avgChange = tokens.reduce((sum, token) => sum + token.priceChange24h, 0) / tokens.length

    report += `📈 MARKET SUMMARY:\n`
    report += `• Bullish tokens: ${positiveChanges}/${tokens.length} (${((positiveChanges / tokens.length) * 100).toFixed(1)}%)\n`
    report += `• Bearish tokens: ${negativeChanges}/${tokens.length} (${((negativeChanges / tokens.length) * 100).toFixed(1)}%)\n`
    report += `• Average change: ${avgChange > 0 ? '+' : ''}${avgChange.toFixed(2)}%\n`
    report += `• Market sentiment: ${positiveChanges > negativeChanges ? '🟢 Bullish' : '🔴 Bearish'}\n\n`

    return report
}



/**
 * Generate analytics report using Moralis data
 */
async function generateAnalyticsReport(runtime: IAgentRuntime, tokens: Array<{ address: string; symbol: string; price: number; volume24h: number; priceChange24h: number }>, timeFrame: string, limit: number, apiKey: string): Promise<string> {
    let report = `📈 ANALYTICS REPORT\n`

    // This would use the analytics provider functionality from analytics.ts
    // For now, return a detailed placeholder
    report += 'Analytics report will include:\n'
    report += '• Holder distribution analysis (whales, sharks, dolphins, etc.)\n'
    report += '• Historical holder trends and growth patterns\n'
    report += '• Sniper activity and early investor analysis\n'
    report += '• Community growth and retention metrics\n'
    report += '• Marketing effectiveness analysis\n'
    report += '• Comparative analysis across multiple tokens\n\n'

    report += '🔧 To enable full analytics:\n'
    report += '• Set MORALIS_API_KEY in your environment\n'
    report += '• This will unlock detailed token analytics and insights\n\n'

    return report
}

/**
 * Generate holders report using Moralis data
 */
async function generateHoldersReport(runtime: IAgentRuntime, tokens: Array<{ address: string; symbol: string; price: number; volume24h: number; priceChange24h: number }>, timeFrame: string, limit: number, apiKey: string): Promise<string> {
    let report = `👥 HOLDERS REPORT\n`

    // This would use the analytics provider functionality from analytics.ts
    // For now, return a detailed placeholder
    report += 'Holders report will include:\n'
    report += '• Total holder count and growth trends\n'
    report += '• Holder distribution by size categories\n'
    report += '• Acquisition method analysis (swaps, transfers, airdrops)\n'
    report += '• Holder concentration risk assessment\n'
    report += '• Community growth and retention analysis\n'
    report += '• Whale movement tracking\n\n'

    report += '🔧 To enable full holders analysis:\n'
    report += '• Set MORALIS_API_KEY in your environment\n'
    report += '• This will unlock detailed holder analytics and insights\n\n'

    return report
}

/**
 * Generate market sentiment analysis
 */
async function generateMarketSentiment(runtime: IAgentRuntime, tokens: Array<{ address: string; symbol: string; price: number; volume24h: number; priceChange24h: number }>, timeFrame: string): Promise<string> {
    let report = `🎯 MARKET SENTIMENT\n`

    // Analyze sentiment from token data
    let bullishCount = 0
    let bearishCount = 0
    let totalTokens = tokens.length

    for (const token of tokens) {
        if (token.priceChange24h > 0) {
            bullishCount++
        } else if (token.priceChange24h < 0) {
            bearishCount++
        }
    }

    if (totalTokens === 0) {
        report += 'Unable to determine market sentiment.\n\n'
        return report
    }

    const bullishPercent = (bullishCount / totalTokens) * 100
    const bearishPercent = (bearishCount / totalTokens) * 100
    const neutralPercent = 100 - bullishPercent - bearishPercent

    report += `Market Sentiment Analysis:\n`
    report += `• Bullish tokens: ${bullishCount}/${totalTokens} (${bullishPercent.toFixed(1)}%)\n`
    report += `• Bearish tokens: ${bearishCount}/${totalTokens} (${bearishPercent.toFixed(1)}%)\n`
    report += `• Neutral tokens: ${totalTokens - bullishCount - bearishCount}/${totalTokens} (${neutralPercent.toFixed(1)}%)\n\n`

    // Overall sentiment
    if (bullishPercent > 60) {
        report += `🟢 OVERALL SENTIMENT: BULLISH\n`
        report += `The majority of your tokens are showing positive momentum.\n\n`
    } else if (bearishPercent > 60) {
        report += `🔴 OVERALL SENTIMENT: BEARISH\n`
        report += `Most of your tokens are experiencing downward pressure.\n\n`
    } else {
        report += `🟡 OVERALL SENTIMENT: MIXED\n`
        report += `Your portfolio shows mixed signals with no clear trend.\n\n`
    }

    return report
}

/**
 * Generate investment recommendations
 */
async function generateInvestmentRecommendations(runtime: IAgentRuntime, tokens: Array<{ address: string; symbol: string; price: number; volume24h: number; priceChange24h: number }>, timeFrame: string): Promise<string> {
    let report = `💡 INVESTMENT RECOMMENDATIONS\n`

    // Analyze volume and price changes for recommendations
    const recommendations: string[] = []

    for (const token of tokens) {
        const symbol = token.symbol

        // High volume, positive price change
        if (token.volume24h > 100000 && token.priceChange24h > 10) {
            recommendations.push(`🚀 ${symbol}: Strong momentum with high volume. Consider holding or adding.`)
        }
        // High volume, negative price change
        else if (token.volume24h > 100000 && token.priceChange24h < -10) {
            recommendations.push(`⚠️ ${symbol}: High volume sell-off. Monitor closely for potential reversal.`)
        }
        // Low volume, significant price change
        else if (token.volume24h < 10000 && Math.abs(token.priceChange24h) > 20) {
            recommendations.push(`📊 ${symbol}: Low volume price movement. Could be manipulation or low liquidity.`)
        }
    }

    if (recommendations.length === 0) {
        report += 'No specific recommendations at this time.\n'
        report += 'Continue monitoring your positions and market conditions.\n\n'
    } else {
        report += 'Based on current market conditions:\n\n'
        for (const rec of recommendations.slice(0, 5)) { // Limit to top 5 recommendations
            report += `• ${rec}\n`
        }
        report += '\n'
    }

    // General advice
    report += `📋 GENERAL ADVICE:\n`
    report += `• Diversify your portfolio across different tokens and strategies\n`
    report += `• Set stop-loss orders to manage risk\n`
    report += `• Monitor volume and liquidity for better entry/exit timing\n`
    report += `• Consider market cycles and overall crypto sentiment\n\n`

    return report
}