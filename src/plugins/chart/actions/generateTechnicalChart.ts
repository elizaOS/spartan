import type { Action, HandlerCallback, IAgentRuntime, Memory, State, ActionResult, ActionExample } from '@elizaos/core';
import type { ChartRequest } from '../interfaces/types';
import { writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import svg2img from 'svg2img';

/**
 * Generate Technical Chart Action
 * Creates technical indicators charts from analytics data
 */
export const generateTechnicalChart: Action = {
    name: 'GENERATE_TECHNICAL_CHART',
    description: 'Generate a technical indicators chart showing RSI, MACD, Bollinger Bands, and other technical analysis metrics',
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me technical indicators for SOL token',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Show me technical indicators for SOL token',
                    actions: ['GENERATE_TECHNICAL_CHART']
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Generate a technical chart with RSI and MACD for token 0x1234...',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Generate a technical chart with RSI and MACD for token 0x1234...',
                    actions: ['GENERATE_TECHNICAL_CHART']
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Create a technical analysis chart for BONK with 1d timeframe',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Create a technical analysis chart for BONK with 1d timeframe',
                    actions: ['GENERATE_TECHNICAL_CHART']
                },
            },
        ],
    ] as ActionExample[][],
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        const text = message.content?.text?.toLowerCase() || '';
        return text.includes('technical') && (text.includes('chart') || text.includes('indicator') || text.includes('rsi') || text.includes('macd'));
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: Memory[] = []
    ): Promise<ActionResult | void | undefined> => {
        console.log('🚀 [generateTechnicalChart] Action started');
        console.log('📝 [generateTechnicalChart] Message text:', message.content?.text);
        
        try {
            const text = message.content?.text || '';
            
            // Extract token address or symbol from the message
            const tokenMatch = text.match(/(?:token|for)\s+([a-zA-Z0-9]+)/i);
            const addressMatch = text.match(/(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})/);
            
            let tokenAddress = '';
            if (addressMatch) {
                tokenAddress = addressMatch[1];
            } else if (tokenMatch) {
                tokenAddress = tokenMatch[1];
            }

            if (!tokenAddress) {
                console.log('❌ [generateTechnicalChart] No token address or symbol found');
                const errorResponse = 'Please provide a token address or symbol to generate a technical chart.';
                if (callback) {
                    callback({
                        text: errorResponse,
                        attachments: [],
                        source: 'auto',
                        channelType: 'text',
                        inReplyTo: message.id
                    });
                }
                return;
            }

            console.log('🪙 [generateTechnicalChart] Token address/symbol:', tokenAddress);

            // Extract timeframe
            let timeframe = '1d';
            if (text.includes('1h')) timeframe = '1h';
            else if (text.includes('4h')) timeframe = '4h';
            else if (text.includes('1d')) timeframe = '1d';
            else if (text.includes('1w')) timeframe = '1w';
            else if (text.includes('1m')) timeframe = '1m';

            // Extract chain
            let chain = 'solana';
            if (text.includes('ethereum') || text.includes('eth')) chain = 'ethereum';
            else if (text.includes('base')) chain = 'base';

            // Extract specific indicators
            const indicators: string[] = [];
            if (text.includes('rsi')) indicators.push('rsi');
            if (text.includes('macd')) indicators.push('macd');
            if (text.includes('bollinger') || text.includes('bb')) indicators.push('bollinger');
            if (text.includes('sma') || text.includes('moving')) indicators.push('sma');
            
            console.log('⏰ [generateTechnicalChart] Timeframe:', timeframe);
            console.log('🔗 [generateTechnicalChart] Chain:', chain);
            console.log('📈 [generateTechnicalChart] Indicators:', indicators);

            // Extract real technical indicator values from the message text
            const realIndicators = extractRealIndicatorsFromText(text);
            
            const chartRequest: ChartRequest = {
                tokenAddress,
                chain,
                timeframe: timeframe as any,
                chartType: 'line',
                theme: 'crypto',
                width: 800,
                height: 600,
                indicators: indicators.length > 0 ? indicators : undefined,
                dataSource: 'analytics',
                realIndicators: realIndicators
            };
            
            console.log('📋 [generateTechnicalChart] Chart request:', JSON.stringify(chartRequest, null, 2));

            // Get chart service
            const chartService = runtime.getService('CHART_SERVICE') as any;
            if (!chartService) {
                console.error('❌ [generateTechnicalChart] Chart service not available');
                const errorResponse = 'Chart service is not available. Please ensure the chart plugin is properly configured.';
                if (callback) {
                    callback({
                        text: errorResponse,
                        attachments: [],
                        source: 'auto',
                        channelType: 'text',
                        inReplyTo: message.id
                    });
                }
                return;
            }
            
            console.log('✅ [generateTechnicalChart] Chart service found:', typeof chartService);

            // Generate multiple technical charts
            console.log('🎯 [generateTechnicalChart] Calling chartService.generateTechnicalChart...');
            const chartResponse = await chartService.generateTechnicalChart(chartRequest);
            console.log('📈 [generateTechnicalChart] Chart response received:', {
                success: chartResponse.success,
                hasData: !!chartResponse.data,
                timestamp: chartResponse.timestamp,
                error: chartResponse.error
            });

            if (!chartResponse.success) {
                console.error('❌ [generateTechnicalChart] Chart generation failed:', chartResponse.error);
                const errorResponse = `Failed to generate technical chart: ${chartResponse.error}`;
                if (callback) {
                    callback({
                        text: errorResponse,
                        attachments: [],
                        source: 'auto',
                        channelType: 'text',
                        inReplyTo: message.id
                    });
                }
                return;
            }

            const chartData = chartResponse.data;
            console.log('📊 [generateTechnicalChart] Chart data structure:', {
                isArray: Array.isArray(chartData),
                length: Array.isArray(chartData) ? chartData.length : 0,
                firstChart: Array.isArray(chartData) ? chartData[0]?.type : chartData?.type
            });
            
            // Handle multiple charts
            const charts = Array.isArray(chartData) ? chartData : [chartData];
            
            // Format response with technical information
            let responseText = `📊 **Technical Analysis Charts Generated Successfully**\n\n`;
            responseText += `**Token:** ${tokenAddress}\n`;
            responseText += `**Timeframe:** ${timeframe}\n`;
            responseText += `**Chain:** ${chain}\n`;
            responseText += `**Charts Generated:** ${charts.length}\n\n`;

            // Generate multiple chart images
            console.log('🎨 [generateTechnicalChart] Starting multiple chart generation...');
            const attachments: any[] = [];
            
            for (let i = 0; i < charts.length; i++) {
                const chart = charts[i];
                console.log(`📊 [generateTechnicalChart] Processing chart ${i + 1}/${charts.length}: ${chart.config?.title}`);
                
                try {
                    // Generate SVG chart
                    const svgOptions = {
                        width: 800,
                        height: 400,
                        theme: 'crypto',
                        showGrid: true,
                        showLegend: true,
                        showTooltips: true
                    };
                    
                    const svgChart = await chartService.generateSvgChart(chart, svgOptions);
                    console.log(`✅ [generateTechnicalChart] SVG chart ${i + 1} generated successfully`);
                    
                    // Convert to PNG
                    const tempDir = mkdtempSync(join(tmpdir(), `chart-${i}-`));
                    const chartFilePath = join(tempDir, `chart-${i + 1}-${Date.now()}.png`);
                    
                    await new Promise<void>((resolve, reject) => {
                        svg2img(svgChart, { format: 'png' as any }, (error: any, buffer: Buffer) => {
                            if (error) {
                                console.error(`❌ [generateTechnicalChart] SVG to PNG conversion failed for chart ${i + 1}:`, error);
                                reject(error);
                                return;
                            }
                            
                            try {
                                writeFileSync(chartFilePath, buffer);
                                console.log(`✅ [generateTechnicalChart] PNG file created for chart ${i + 1}:`, chartFilePath);
                                resolve();
                            } catch (writeError) {
                                console.error(`❌ [generateTechnicalChart] Error writing PNG file for chart ${i + 1}:`, writeError);
                                reject(writeError);
                            }
                        });
                    });
                    
                    // Add to attachments
                    attachments.push({
                        id: crypto.randomUUID(),
                        url: chartFilePath,
                        title: chart.config?.title || `Chart ${i + 1}`,
                        contentType: 'image/png' as any,
                    });
                    
                } catch (error) {
                    console.error(`❌ [generateTechnicalChart] Error generating chart ${i + 1}:`, error);
                }
            }

            // Add technical indicators summary
            responseText += `\n**Technical Indicators Summary:**\n`;
            responseText += `- **Current Price:** $${realIndicators.currentPrice || 'N/A'}\n`;
            responseText += `- **RSI:** ${realIndicators.rsi || 'N/A'} (${realIndicators.rsi > 70 ? 'Overbought' : realIndicators.rsi < 30 ? 'Oversold' : 'Neutral'})\n`;
            responseText += `- **MACD:** ${realIndicators.macd || 'N/A'} (${realIndicators.macd > realIndicators.macdSignal ? 'Bullish' : 'Bearish'})\n`;
            responseText += `- **Bollinger Bands:** Upper: $${realIndicators.bollingerUpper || 'N/A'}, Middle: $${realIndicators.bollingerMiddle || 'N/A'}, Lower: $${realIndicators.bollingerLower || 'N/A'}\n`;
            responseText += `- **Moving Averages:** SMA 20: $${realIndicators.sma20 || 'N/A'}, SMA 50: $${realIndicators.sma50 || 'N/A'}\n`;

            responseText += `\n*Technical analysis charts generated at ${new Date(chartResponse.timestamp).toLocaleString()}*`;

            // Prepare response content
            let responseContent;
            
            if (attachments.length > 0) {
                responseContent = {
                    text: responseText,
                    attachments,
                    source: 'auto',
                    channelType: 'text',
                    inReplyTo: message.id
                };
            } else {
                responseContent = {
                    text: responseText + `\n\n📱 *Note: Chart image generation failed. Technical data is available above.*`,
                    attachments: [],
                    source: 'auto',
                    channelType: 'text',
                    inReplyTo: message.id
                };
            }

            console.log('📤 [generateTechnicalChart] Response content prepared:', {
                hasAttachments: !!responseContent.attachments,
                attachmentCount: responseContent.attachments.length,
                textLength: responseContent.text.length
            });

            if (callback) {
                console.log('📞 [generateTechnicalChart] Calling callback with response...');
                await callback(responseContent);
                console.log('✅ [generateTechnicalChart] Callback completed successfully');
            }

            return {
                success: true,
                text: responseText,
                data: {
                    tokenAddress,
                    timeframe,
                    chain,
                    indicators,
                    charts,
                    attachments
                }
            };

        } catch (error) {
            console.error('❌ [generateTechnicalChart] Error in generateTechnicalChart action:', error);
            console.error('❌ [generateTechnicalChart] Error details:', {
                name: error instanceof Error ? error.name : 'Unknown',
                message: error instanceof Error ? error.message : 'Unknown',
                stack: error instanceof Error ? error.stack : 'Unknown'
            });
            
            const errorResponse = `Error generating technical chart: ${error instanceof Error ? error.message : 'Unknown error'}`;
            if (callback) {
                callback({
                    text: errorResponse,
                    attachments: [],
                    source: 'auto',
                    channelType: 'text',
                    inReplyTo: message.id
                });
            }
            
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
};

/**
 * Extract real technical indicator values from message text
 */
function extractRealIndicatorsFromText(text: string): any {
        const indicators: any = {};
        
        // Extract current price
        const priceMatch = text.match(/Current Price: \$([0-9.]+)/);
        if (priceMatch) {
            indicators.currentPrice = parseFloat(priceMatch[1]);
        }
        
        // Extract RSI
        const rsiMatch = text.match(/Current RSI: ([0-9.]+)/);
        if (rsiMatch) {
            indicators.rsi = parseFloat(rsiMatch[1]);
        }
        
        // Extract MACD
        const macdMatch = text.match(/MACD Line: ([0-9.-]+)/);
        if (macdMatch) {
            indicators.macd = parseFloat(macdMatch[1]);
        }
        
        const macdSignalMatch = text.match(/Signal Line: ([0-9.-]+)/);
        if (macdSignalMatch) {
            indicators.macdSignal = parseFloat(macdSignalMatch[1]);
        }
        
        // Extract Bollinger Bands
        const bbUpperMatch = text.match(/Upper Band: \$([0-9.]+)/);
        if (bbUpperMatch) {
            indicators.bollingerUpper = parseFloat(bbUpperMatch[1]);
        }
        
        const bbMiddleMatch = text.match(/Middle Band \(SMA20\): \$([0-9.]+)/);
        if (bbMiddleMatch) {
            indicators.bollingerMiddle = parseFloat(bbMiddleMatch[1]);
        }
        
        const bbLowerMatch = text.match(/Lower Band: \$([0-9.]+)/);
        if (bbLowerMatch) {
            indicators.bollingerLower = parseFloat(bbLowerMatch[1]);
        }
        
        // Extract Moving Averages
        const sma20Match = text.match(/SMA 20: \$([0-9.]+)/);
        if (sma20Match) {
            indicators.sma20 = parseFloat(sma20Match[1]);
        }
        
        const sma50Match = text.match(/SMA 50: \$([0-9.]+)/);
        if (sma50Match) {
            indicators.sma50 = parseFloat(sma50Match[1]);
        }
        
        const sma200Match = text.match(/SMA 200: \$([0-9.]+)/);
        if (sma200Match) {
            indicators.sma200 = parseFloat(sma200Match[1]);
        }
        
        const ema12Match = text.match(/EMA 12: \$([0-9.]+)/);
        if (ema12Match) {
            indicators.ema12 = parseFloat(ema12Match[1]);
        }
        
        const ema26Match = text.match(/EMA 26: \$([0-9.]+)/);
        if (ema26Match) {
            indicators.ema26 = parseFloat(ema26Match[1]);
        }
        
        console.log('📊 [generateTechnicalChart] Extracted real indicators:', indicators);
        return indicators;
}
