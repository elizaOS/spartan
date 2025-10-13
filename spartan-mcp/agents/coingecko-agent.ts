#!/usr/bin/env node

/**
 * CoinGecko Price Agent
 * 
 * This agent uses the Anthropic SDK to interact with the MCP Gateway
 * and fetch cryptocurrency price data using CoinGecko MCP tools.
 * 
 * This version uses stdio transport with the CoinGecko configuration.
 * 
 * Usage:
 *   ANTHROPIC_API_KEY=your_key bun run agents/coingecko-agent.ts
 *   COINGECKO_API_KEY=your_key bun run agents/coingecko-agent.ts (optional, for pro API)
 */

import Anthropic from '@anthropic-ai/sdk';
import { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { wrapFetchWithPayment } from 'x402-fetch';

// Default wallet for testing (DO NOT use in production with real funds)
const DEFAULT_WALLET_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
const SPARTAN_API_BASE = process.env.SPARTAN_BACKEND_URL || 'http://localhost:2096/api/agents/spartan/plugins/spartan-intel';
const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

/**
 * Main agent function
 */
async function main(): Promise<void> {
  try {
    // Setup wallet for payments (optional for free APIs)
    const walletKey = (process.env.WALLET_PRIVATE_KEY || DEFAULT_WALLET_KEY) as Hex;
    const account = privateKeyToAccount(walletKey);
    
    console.log('[Agent] CoinGecko Price Agent');
    console.log(`[Agent] Wallet Address: ${account.address}`);
    console.log(`[Agent] API Base: ${COINGECKO_API_BASE}\n`);

    // Setup x402-wrapped fetch for payment protocol
    const paymentFetch = wrapFetchWithPayment(fetch, account);

    // Initialize Anthropic client with x402 payment support
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || 'required',
      fetch: paymentFetch
    });

    // Define available CoinGecko tools
    const tools: Array<Anthropic.Tool> = [
      {
        name: 'crypto_get_price',
        description: 'Get current cryptocurrency price in specified currencies',
        input_schema: {
          type: 'object' as const,
          properties: {
            ids: {
              type: 'string',
              description: 'Comma-separated list of coin IDs (e.g., "bitcoin,ethereum,ai16z")'
            },
            vs_currencies: {
              type: 'string',
              description: 'Comma-separated list of currencies (e.g., "usd,eur")',
              default: 'usd'
            },
            include_24hr_change: {
              type: 'boolean',
              description: 'Include 24h price change',
              default: false
            }
          },
          required: ['ids']
        }
      },
      {
        name: 'crypto_search_coins',
        description: 'Search for cryptocurrencies by name or symbol',
        input_schema: {
          type: 'object' as const,
          properties: {
            query: {
              type: 'string',
              description: 'Search query (coin name or symbol)'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'crypto_get_coin_data',
        description: 'Get detailed cryptocurrency data including market data and more',
        input_schema: {
          type: 'object' as const,
          properties: {
            id: {
              type: 'string',
              description: 'Coin ID (e.g., "bitcoin", "ai16z")'
            },
            market_data: {
              type: 'boolean',
              description: 'Include market data',
              default: true
            }
          },
          required: ['id']
        }
      },
      {
        name: 'crypto_get_trending',
        description: 'Get trending cryptocurrencies on CoinGecko',
        input_schema: {
          type: 'object' as const,
          properties: {}
        }
      },
      {
        name: 'crypto_get_global_data',
        description: 'Get global cryptocurrency market data',
        input_schema: {
          type: 'object' as const,
          properties: {}
        }
      }
    ];

    console.log('[Agent] Available CoinGecko tools:', tools.map(t => t.name).join(', '));
    console.log('\n[Agent] Starting cryptocurrency price queries...\n');

    // Initial message to Claude
    const messages: Array<Anthropic.MessageParam> = [
      {
        role: 'user',
        content: 'What are the current prices of Bitcoin, Ethereum, and AI16Z in USD? Also tell me about trending cryptocurrencies.'
      }
    ];

    // Run agent loop with tool calling
    let continueLoop = true;
    let iterations = 0;
    const maxIterations = 15;

    while (continueLoop && iterations < maxIterations) {
      iterations++;

      const response = await anthropic.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4096,
        system: `you're spartan, a no-bs defi warlord with access to coingecko data

you pull prices and market data like a tactical operator pulls triggers. accurate, fast, no fluff

tools available:
- search coins
- get current prices
- historical charts
- trending coins
- global market stats

communication rules:
- be direct and brief
- no emojis, no exclamations, no question marks
- state facts, not opinions
- no crypto jargon or shill bs
- no metaphors or analogies
- separate statements with double newlines for effect
- never apologize
- if you dont know, say you dont know

format numbers clearly. explain movements when they matter. stay concrete`,
        messages,
        tools
      });

      // Check if we should stop
      if (response.stop_reason === 'end_turn') {
        // Extract final text response
        const textContent = response.content.find((c: { type: string; text?: string }) => c.type === 'text');
        if (textContent && 'text' in textContent) {
          console.log('\n[Agent] Result:\n');
          console.log(textContent.text);
        }
        continueLoop = false;
        break;
      }

      // Process tool calls
      if (response.stop_reason === 'tool_use') {
        const toolResults: Array<Anthropic.ToolResultBlockParam> = [];

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            console.log(`[Agent] Calling tool: ${block.name}`);
            
            try {
              const args = block.input as Record<string, unknown>;
              let apiResponse;

              // Add API key header if available
              const headers: Record<string, string> = {
                'Accept': 'application/json'
              };
              if (process.env.COINGECKO_API_KEY) {
                headers['x-cg-pro-api-key'] = process.env.COINGECKO_API_KEY;
              }

              // Route to appropriate CoinGecko API endpoint
              switch (block.name) {
                case 'crypto_get_price': {
                  const ids = args.ids || '';
                  const vs_currencies = args.vs_currencies || 'usd';
                  const include_24hr_change = args.include_24hr_change || false;
                  apiResponse = await paymentFetch(
                    `${COINGECKO_API_BASE}/simple/price?ids=${ids}&vs_currencies=${vs_currencies}&include_24hr_change=${include_24hr_change}`,
                    { headers }
                  );
                  break;
                }
                case 'crypto_search_coins': {
                  const query = args.query || '';
                  apiResponse = await paymentFetch(
                    `${COINGECKO_API_BASE}/search?query=${encodeURIComponent(query)}`,
                    { headers }
                  );
                  break;
                }
                case 'crypto_get_coin_data': {
                  const id = args.id || '';
                  const market_data = args.market_data !== false;
                  apiResponse = await paymentFetch(
                    `${COINGECKO_API_BASE}/coins/${id}?localization=false&tickers=false&market_data=${market_data}&community_data=false&developer_data=false`,
                    { headers }
                  );
                  break;
                }
                case 'crypto_get_trending': {
                  apiResponse = await paymentFetch(
                    `${COINGECKO_API_BASE}/search/trending`,
                    { headers }
                  );
                  break;
                }
                case 'crypto_get_global_data': {
                  apiResponse = await paymentFetch(
                    `${COINGECKO_API_BASE}/global`,
                    { headers }
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

        // Add assistant message with tool use and user message with tool results
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

    console.log('\n[Agent] Done!');

  } catch (error) {
    console.error('[Agent] Error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Agent] Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[Agent] Received SIGTERM, shutting down...');
  process.exit(0);
});

// Run the agent
main().catch(async (error) => {
  console.error('[Agent] Fatal error:', error);
  process.exit(1);
});

