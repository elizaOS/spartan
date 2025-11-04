#!/usr/bin/env node

/**
 * Spartan Charting & Technical Analysis Agent
 * 
 * This agent uses the Anthropic SDK to interact with the MCP Gateway
 * and perform technical analysis with charting tools.
 * 
 * Usage:
 *   ANTHROPIC_API_KEY=your_key bun run agents/charting-agent.ts
 *   SPARTAN_API_KEY=your_key bun run agents/charting-agent.ts (optional)
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
    
    console.log('[Agent] Spartan Charting & Technical Analysis Agent');
    console.log(`[Agent] Wallet Address: ${account.address}`);
    console.log(`[Agent] API Base: ${SPARTAN_API_BASE}\n`);

    // Setup x402-wrapped fetch for payment protocol
    const paymentFetch = wrapFetchWithPayment(fetch, account);

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || 'required',
      fetch: paymentFetch
    });

    // Define available charting tools
    const tools: Array<Anthropic.Tool> = [
      {
        name: 'charting_get_ohlcv',
        description: 'Get OHLCV data for charting with customizable timeframes',
        input_schema: {
          type: 'object' as const,
          properties: {
            token_address: {
              type: 'string',
              description: 'Token contract address'
            },
            interval: {
              type: 'string',
              description: 'Candle interval (1m, 5m, 15m, 1h, 4h, 1d, 1w)',
              default: '1h'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of candles',
              default: 500
            }
          },
          required: ['token_address']
        }
      },
      {
        name: 'charting_get_technical_indicators',
        description: 'Calculate technical indicators (RSI, MACD, EMA, SMA, Bollinger Bands)',
        input_schema: {
          type: 'object' as const,
          properties: {
            token_address: {
              type: 'string',
              description: 'Token contract address'
            },
            indicators: {
              type: 'array',
              description: 'List of indicators to calculate',
              items: { type: 'string' }
            },
            interval: {
              type: 'string',
              description: 'Time interval for calculations',
              default: '1h'
            }
          },
          required: ['token_address']
        }
      },
      {
        name: 'charting_detect_patterns',
        description: 'Detect chart patterns (triangles, head & shoulders, support/resistance)',
        input_schema: {
          type: 'object' as const,
          properties: {
            token_address: {
              type: 'string',
              description: 'Token contract address'
            },
            interval: {
              type: 'string',
              description: 'Chart timeframe',
              default: '1h'
            },
            lookback_periods: {
              type: 'number',
              description: 'Number of periods to analyze',
              default: 200
            }
          },
          required: ['token_address']
        }
      },
      {
        name: 'charting_get_support_resistance',
        description: 'Calculate support and resistance levels',
        input_schema: {
          type: 'object' as const,
          properties: {
            token_address: {
              type: 'string',
              description: 'Token contract address'
            },
            interval: {
              type: 'string',
              description: 'Chart timeframe',
              default: '1h'
            }
          },
          required: ['token_address']
        }
      },
      {
        name: 'charting_get_volume_profile',
        description: 'Get volume profile analysis',
        input_schema: {
          type: 'object' as const,
          properties: {
            token_address: {
              type: 'string',
              description: 'Token contract address'
            },
            interval: {
              type: 'string',
              description: 'Time interval',
              default: '1h'
            }
          },
          required: ['token_address']
        }
      }
    ];

    console.log('[Agent] Available charting tools:', tools.map(t => t.name).join(', '));
    console.log('\n[Agent] Performing technical analysis...\n');

    // Example Solana token address (you can change this)
    const exampleTokenAddress = 'So11111111111111111111111111111111111111112'; // Wrapped SOL

    const messages: Array<Anthropic.MessageParam> = [
      {
        role: 'user',
        content: `Perform a comprehensive technical analysis on token ${exampleTokenAddress}. Include:
1. Recent OHLCV data (1-hour timeframe)
2. Key technical indicators (RSI, MACD, moving averages)
3. Chart pattern detection
4. Support and resistance levels
5. Volume profile analysis

Based on this analysis, provide a trading recommendation with entry/exit points and risk assessment.`
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
        system: `you're spartan, technical analyst who reads charts like battlefield maps

capabilities:
- ohlcv data retrieval
- technical indicators (rsi, macd, ema, sma, bollinger bands)
- chart pattern detection
- support and resistance levels
- volume profile analysis
- multi-token comparison
- fibonacci levels
- price correlation

analysis protocol:
1. pull price data and indicators
2. identify key levels and patterns
3. assess momentum and trend
4. volume confirms or its noise
5. entry/exit points with ratios
6. risk management or dont trade
7. state confidence level

technical rules:
- rsi over 70 overbought, under 30 oversold
- macd crossovers signal trend changes
- volume validates moves
- multiple timeframes when possible
- risk reward ratios always

communication style:
- direct and efficient
- no emojis, no exclamations, no question marks
- charts and numbers, not opinions
- no crypto jargon
- brief and concrete
- separate sections with double newlines
- never apologize
- if you dont know the setup, say it

format:
current market structure
indicator summary with numbers
key support resistance levels
patterns identified
trading recommendation with entry exit stop
risk management requirements`,
        messages,
        tools
      });

      if (response.stop_reason === 'end_turn') {
        const textContent = response.content.find((c: { type: string; text?: string }) => c.type === 'text');
        if (textContent && 'text' in textContent) {
          console.log('\n[Agent] Technical Analysis Report:\n');
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
                case 'charting_get_ohlcv': {
                  const token_address = args.token_address;
                  const interval = args.interval || '1h';
                  const limit = args.limit || 500;
                  apiResponse = await paymentFetch(
                    `${SPARTAN_API_BASE}/api/charting/ohlcv?token_address=${token_address}&interval=${interval}&limit=${limit}`
                  );
                  break;
                }
                case 'charting_get_technical_indicators': {
                  apiResponse = await paymentFetch(
                    `${SPARTAN_API_BASE}/api/charting/indicators`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        token_address: args.token_address,
                        indicators: args.indicators || ['rsi', 'macd', 'ema20', 'sma50'],
                        interval: args.interval || '1h',
                        period: args.period
                      })
                    }
                  );
                  break;
                }
                case 'charting_detect_patterns': {
                  const token_address = args.token_address;
                  const interval = args.interval || '1h';
                  const lookback_periods = args.lookback_periods || 200;
                  apiResponse = await paymentFetch(
                    `${SPARTAN_API_BASE}/api/charting/patterns?token_address=${token_address}&interval=${interval}&lookback_periods=${lookback_periods}`
                  );
                  break;
                }
                case 'charting_get_support_resistance': {
                  const token_address = args.token_address;
                  const interval = args.interval || '1h';
                  const sensitivity = args.sensitivity || 'medium';
                  apiResponse = await paymentFetch(
                    `${SPARTAN_API_BASE}/api/charting/support-resistance?token_address=${token_address}&interval=${interval}&sensitivity=${sensitivity}`
                  );
                  break;
                }
                case 'charting_get_volume_profile': {
                  const token_address = args.token_address;
                  const interval = args.interval || '1h';
                  const bins = args.bins || 50;
                  apiResponse = await paymentFetch(
                    `${SPARTAN_API_BASE}/api/charting/volume-profile?token_address=${token_address}&interval=${interval}&bins=${bins}`
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

    console.log('\n[Agent] Technical analysis complete!');

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

