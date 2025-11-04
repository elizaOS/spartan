#!/usr/bin/env node

/**
 * Spartan Analytics Agent
 * 
 * This agent uses the Anthropic SDK to interact with the MCP Gateway
 * and access Spartan's analytics, news, sentiment analysis, and market intelligence.
 * 
 * Usage:
 *   ANTHROPIC_API_KEY=your_key bun run agents/analytics-agent.ts
 *   SPARTAN_API_KEY=your_key bun run agents/analytics-agent.ts (optional)
 */

import Anthropic from '@anthropic-ai/sdk';
import { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { wrapFetchWithPayment } from 'x402-fetch';

const DEFAULT_WALLET_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
const SPARTAN_API_BASE = process.env.SPARTAN_BACKEND_URL || 'http://localhost:2096/api/agents/spartan/plugins/spartan-intel';

async function main(): Promise<void> {
  try {
    const walletKey = (process.env.WALLET_PRIVATE_KEY || DEFAULT_WALLET_KEY) as Hex;
    const account = privateKeyToAccount(walletKey);
    
    console.log('[Agent] Spartan Analytics Agent');
    console.log(`[Agent] Wallet Address: ${account.address}`);
    console.log(`[Agent] API Base: ${SPARTAN_API_BASE}\n`);

    // Setup x402-wrapped fetch for payment protocol
    const paymentFetch = wrapFetchWithPayment(fetch, account);

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || 'required',
      fetch: paymentFetch
    });

    // Define available analytics tools
    const tools: Array<Anthropic.Tool> = [
      {
        name: 'spartan_get_market_analytics',
        description: 'Get comprehensive market analytics including top gainers, losers, trending tokens, and market sentiment',
        input_schema: {
          type: 'object' as const,
          properties: {
            chain: {
              type: 'string',
              description: 'Blockchain to analyze (solana, ethereum, all)',
              default: 'solana'
            }
          }
        }
      },
      {
        name: 'spartan_get_news_feed',
        description: 'Get latest DeFi and crypto news from curated sources',
        input_schema: {
          type: 'object' as const,
          properties: {
            category: {
              type: 'string',
              description: 'News category (defi, nft, market, protocol, security)',
              default: 'defi'
            },
            limit: {
              type: 'number',
              description: 'Number of articles to return',
              default: 10
            }
          }
        }
      },
      {
        name: 'spartan_get_sentiment_analysis',
        description: 'Get market sentiment analysis for specific tokens or overall market',
        input_schema: {
          type: 'object' as const,
          properties: {
            token_address: {
              type: 'string',
              description: 'Token address (optional, if not provided returns overall market sentiment)'
            },
            timeframe: {
              type: 'string',
              description: 'Analysis timeframe (1h, 4h, 24h, 7d, 30d)',
              default: '24h'
            }
          }
        }
      },
      {
        name: 'spartan_get_trending_tokens',
        description: 'Get trending tokens based on Spartan analytics',
        input_schema: {
          type: 'object' as const,
          properties: {
            timeframe: {
              type: 'string',
              description: 'Trending timeframe (1h, 6h, 24h, 7d)',
              default: '24h'
            },
            chain: {
              type: 'string',
              description: 'Blockchain filter (solana, ethereum, all)',
              default: 'solana'
            },
            limit: {
              type: 'number',
              description: 'Number of tokens to return',
              default: 20
            }
          }
        }
      },
      {
        name: 'spartan_get_whale_activity',
        description: 'Get whale wallet activity and large transactions',
        input_schema: {
          type: 'object' as const,
          properties: {
            min_value_usd: {
              type: 'number',
              description: 'Minimum transaction value in USD',
              default: 100000
            },
            token_address: {
              type: 'string',
              description: 'Filter by specific token address'
            },
            limit: {
              type: 'number',
              description: 'Number of transactions to return',
              default: 20
            }
          }
        }
      },
      {
        name: 'spartan_get_token_analysis',
        description: 'Get comprehensive token analysis including risks, opportunities, and recommendations',
        input_schema: {
          type: 'object' as const,
          properties: {
            token_address: {
              type: 'string',
              description: 'Token contract address'
            },
            depth: {
              type: 'string',
              description: 'Analysis depth (quick, standard, deep)',
              default: 'standard'
            }
          },
          required: ['token_address']
        }
      }
    ];

    console.log('[Agent] Available analytics tools:', tools.map(t => t.name).join(', '));
    console.log('\n[Agent] Requesting market intelligence and analytics...\n');

    const messages: Array<Anthropic.MessageParam> = [
      {
        role: 'user',
        content: `Give me a comprehensive market analysis for today. Include:
1. Latest DeFi news and important developments
2. Overall market sentiment
3. Trending tokens and why they're trending
4. Any whale activity worth noting
5. AI-generated trading signals with high confidence

Provide actionable insights and recommendations.`
      }
    ];

    let continueLoop = true;
    let iterations = 0;
    const maxIterations = 25;

    while (continueLoop && iterations < maxIterations) {
      iterations++;

      const response = await anthropic.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4096,
        system: `you're spartan, defi warlord with full market intelligence access

capabilities:
- real-time defi news
- market sentiment analysis
- whale wallet tracking
- trending tokens with analytics
- deep token analysis
- portfolio optimization
- market overview and metrics
- ai trading signals
- defi protocol analysis

analysis doctrine:
- data only, no speculation without disclaimer
- security risks called out immediately
- recommendations are actionable or worthless
- context matters, read the market
- admit when you dont know

communication rules:
- be direct and brief
- no emojis, no exclamations, no question marks
- say the quiet part out loud
- no crypto jargon or shill bs
- no metaphors or analogies
- separate key points with double newlines
- never apologize
- if giving financial advice say "not financial advice"

format:
most important info first
key metrics upfront
risks before opportunities
clear recommendations based on data`,
        messages,
        tools
      });

      if (response.stop_reason === 'end_turn') {
        const textContent = response.content.find((c: { type: string; text?: string }) => c.type === 'text');
        if (textContent && 'text' in textContent) {
          console.log('\n[Agent] Market Intelligence Report:\n');
          console.log(textContent.text);
        }
        continueLoop = false;
        break;
      }

      if (response.stop_reason === 'tool_use') {
        const toolResults: Array<Anthropic.ToolResultBlockParam> = [];

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            console.log(`[Agent] Calling: ${block.name}`);
            
            try {
              const args = block.input as Record<string, unknown>;
              let apiResponse;

              // Route to appropriate API endpoint
              switch (block.name) {
                case 'spartan_get_market_analytics': {
                  const chain = args.chain || 'solana';
                  apiResponse = await paymentFetch(
                    `${SPARTAN_API_BASE}/api/analytics/market-overview?chain=${chain}`
                  );
                  break;
                }
                case 'spartan_get_news_feed': {
                  const category = args.category || 'defi';
                  const limit = args.limit || 10;
                  const since = args.since || '';
                  apiResponse = await paymentFetch(
                    `${SPARTAN_API_BASE}/api/analytics/news?category=${category}&limit=${limit}${since ? `&since=${since}` : ''}`
                  );
                  break;
                }
                case 'spartan_get_sentiment_analysis': {
                  const token_address = args.token_address || '';
                  const timeframe = args.timeframe || '24h';
                  apiResponse = await paymentFetch(
                    `${SPARTAN_API_BASE}/api/analytics/sentiment?token_address=${token_address}&timeframe=${timeframe}`
                  );
                  break;
                }
                case 'spartan_get_trending_tokens': {
                  const timeframe = args.timeframe || '24h';
                  const chain = args.chain || 'solana';
                  const limit = args.limit || 20;
                  apiResponse = await paymentFetch(
                    `${SPARTAN_API_BASE}/api/analytics/trending?timeframe=${timeframe}&chain=${chain}&limit=${limit}`
                  );
                  break;
                }
                case 'spartan_get_whale_activity': {
                  const min_value_usd = args.min_value_usd || 100000;
                  const token_address = args.token_address || '';
                  const limit = args.limit || 20;
                  apiResponse = await paymentFetch(
                    `${SPARTAN_API_BASE}/api/analytics/whale-activity?min_value_usd=${min_value_usd}${token_address ? `&token_address=${token_address}` : ''}&limit=${limit}`
                  );
                  break;
                }
                case 'spartan_get_token_analysis': {
                  apiResponse = await paymentFetch(
                    `${SPARTAN_API_BASE}/api/analytics/analyze-token`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        token_address: args.token_address,
                        depth: args.depth || 'standard'
                      })
                    }
                  );
                  break;
                }
                default:
                  throw new Error(`Unknown tool: ${block.name}`);
              }

              const data = await apiResponse.json();
              
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(data)
              });
            } catch (toolError) {
              console.error(`[Agent] Tool error:`, toolError);
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: `Error: ${toolError instanceof Error ? toolError.message : String(toolError)}`
              });
            }
          }
        }

        messages.push({
          role: 'assistant',
          content: response.content
        });
        messages.push({
          role: 'user',
          content: toolResults
        });
      } else {
        continueLoop = false;
      }
    }

    console.log('\n[Agent] Analysis complete!');

  } catch (error) {
    console.error('[Agent] Error:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\n[Agent] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Agent] Shutting down...');
  process.exit(0);
});

main().catch((error) => {
  console.error('[Agent] Fatal error:', error);
  process.exit(1);
});

