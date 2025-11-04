#!/usr/bin/env node

/**
 * Birdeye Solana Market Agent
 * 
 * This agent uses the Anthropic SDK to interact with the MCP Gateway
 * and fetch Solana token data, trending tokens, and market analytics using Birdeye API.
 * 
 * Usage:
 *   ANTHROPIC_API_KEY=your_key BIRDEYE_API_KEY=your_key bun run agents/birdeye-agent.ts
 */

import Anthropic from '@anthropic-ai/sdk';
import { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { wrapFetchWithPayment } from 'x402-fetch';

const DEFAULT_WALLET_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
const SPARTAN_API_BASE = process.env.SPARTAN_BACKEND_URL || 'http://localhost:2096/api/agents/spartan/plugins/spartan-intel';
const BIRDEYE_API_BASE = 'https://public-api.birdeye.so';

async function main(): Promise<void> {
  try {
    const walletKey = (process.env.WALLET_PRIVATE_KEY || DEFAULT_WALLET_KEY) as Hex;
    const account = privateKeyToAccount(walletKey);
    
    console.log('[Agent] Birdeye Solana Market Agent');
    console.log(`[Agent] Wallet Address: ${account.address}`);
    console.log(`[Agent] API Base: ${BIRDEYE_API_BASE}\n`);

    if (!process.env.BIRDEYE_API_KEY) {
      console.warn('[Agent] WARNING: BIRDEYE_API_KEY not set. API calls will fail.');
    }

    // Setup x402-wrapped fetch for payment protocol
    const paymentFetch = wrapFetchWithPayment(fetch, account);

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || 'required',
      fetch: paymentFetch
    });

    // Define available Birdeye tools
    const tools: Array<Anthropic.Tool> = [
      {
        name: 'birdeye_get_token_overview',
        description: 'Get comprehensive token overview including price, volume, liquidity',
        input_schema: {
          type: 'object' as const,
          properties: {
            address: {
              type: 'string',
              description: 'Token contract address on Solana'
            }
          },
          required: ['address']
        }
      },
      {
        name: 'birdeye_get_token_security',
        description: 'Get token security analysis and risk metrics',
        input_schema: {
          type: 'object' as const,
          properties: {
            address: {
              type: 'string',
              description: 'Token contract address'
            }
          },
          required: ['address']
        }
      },
      {
        name: 'birdeye_get_trending_tokens',
        description: 'Get trending tokens on Solana',
        input_schema: {
          type: 'object' as const,
          properties: {
            sort_by: {
              type: 'string',
              description: 'Sort criteria (rank, volume, price_change_24h)',
              default: 'rank'
            },
            limit: {
              type: 'number',
              description: 'Number of results to return',
              default: 20
            }
          }
        }
      },
      {
        name: 'birdeye_get_token_trades',
        description: 'Get recent trades for a specific token',
        input_schema: {
          type: 'object' as const,
          properties: {
            address: {
              type: 'string',
              description: 'Token contract address'
            },
            limit: {
              type: 'number',
              description: 'Number of trades to return',
              default: 20
            }
          },
          required: ['address']
        }
      }
    ];

    console.log('[Agent] Available Birdeye tools:', tools.map(t => t.name).join(', '));
    console.log('\n[Agent] Querying Solana market data...\n');

    const messages: Array<Anthropic.MessageParam> = [
      {
        role: 'user',
        content: 'Show me the trending tokens on Solana right now. For the top token, get me detailed information including price, security analysis, and recent trades.'
      }
    ];

    let continueLoop = true;
    let iterations = 0;
    const maxIterations = 20;

    while (continueLoop && iterations < maxIterations) {
      iterations++;

      const response = await anthropic.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4096,
        system: `you're spartan, solana defi tactician with birdeye access

you analyze tokens like a sniper checks targets. security first, hype never

capabilities:
- trending solana tokens
- security analysis and risk assessment
- token metadata and creation info
- wallet portfolios
- trades and holder distribution
- ohlcv charting data

security is non-negotiable. new tokens get extra scrutiny. rug pulls are for the weak

communication style:
- direct and efficient
- no emojis, no exclamations, no question marks
- call out red flags immediately
- no crypto jargon or shill talk
- brief and concrete
- separate statements with double newlines
- never apologize for being right

format:
token address, price, metrics
security red flags upfront
volume and liquidity numbers
recommendation based on data not vibes`,
        messages,
        tools
      });

      if (response.stop_reason === 'end_turn') {
        const textContent = response.content.find((c: { type: string; text?: string }) => c.type === 'text');
        if (textContent && 'text' in textContent) {
          console.log('\n[Agent] Analysis:\n');
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

              // Add API key header
              const headers: Record<string, string> = {
                'Accept': 'application/json',
                'X-API-KEY': process.env.BIRDEYE_API_KEY || ''
              };

              // Route to appropriate Birdeye API endpoint
              switch (block.name) {
                case 'birdeye_get_token_overview': {
                  const address = args.address;
                  apiResponse = await paymentFetch(
                    `${BIRDEYE_API_BASE}/defi/token_overview?address=${address}`,
                    { headers }
                  );
                  break;
                }
                case 'birdeye_get_token_security': {
                  const address = args.address;
                  apiResponse = await paymentFetch(
                    `${BIRDEYE_API_BASE}/defi/token_security?address=${address}`,
                    { headers }
                  );
                  break;
                }
                case 'birdeye_get_trending_tokens': {
                  const sort_by = args.sort_by || 'rank';
                  const limit = args.limit || 20;
                  apiResponse = await paymentFetch(
                    `${BIRDEYE_API_BASE}/defi/tokenlist?sort_by=${sort_by}&sort_type=desc&offset=0&limit=${limit}`,
                    { headers }
                  );
                  break;
                }
                case 'birdeye_get_token_trades': {
                  const address = args.address;
                  const limit = args.limit || 20;
                  apiResponse = await paymentFetch(
                    `${BIRDEYE_API_BASE}/defi/txs/token?address=${address}&offset=0&limit=${limit}`,
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

