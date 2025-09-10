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

            const chartRequest: ChartRequest = {
                tokenAddress,
                chain,
                timeframe: timeframe as any,
                chartType: 'line',
                theme: 'crypto',
                width: 800,
                height: 600,
                indicators: indicators.length > 0 ? indicators : undefined,
                dataSource: 'analytics'
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

            // Generate the chart
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
                type: chartData.type,
                hasDatasets: !!chartData.datasets,
                datasetsCount: chartData.datasets?.length || 0,
                hasMetadata: !!chartData.metadata,
                hasIndicators: !!chartData.indicators
            });
            
            // Format response with technical information
            let responseText = `📊 **Technical Chart Generated Successfully**\n\n`;
            responseText += `**Token:** ${tokenAddress}\n`;
            responseText += `**Timeframe:** ${timeframe}\n`;
            responseText += `**Chain:** ${chain}\n`;
            responseText += `**Indicators:** ${chartData.metadata?.dataPoints || 0} data points\n`;

            // Add technical indicators summary if available
            if (chartData.type === 'technical' && chartData.indicators) {
                responseText += `\n**Technical Indicators:**\n`;
                
                if (chartData.indicators.rsi && chartData.indicators.rsi.length > 0) {
                    const rsiValue = chartData.indicators.rsi[0].y;
                    let rsiStatus = 'Neutral';
                    if (rsiValue > 70) rsiStatus = 'Overbought';
                    else if (rsiValue < 30) rsiStatus = 'Oversold';
                    responseText += `- **RSI:** ${rsiValue.toFixed(2)} (${rsiStatus})\n`;
                }

                if (chartData.indicators.macd && chartData.indicators.macd.length > 0) {
                    const macdValue = chartData.indicators.macd[0].y;
                    const signalValue = chartData.indicators.macdSignal?.[0]?.y || 0;
                    const macdSignal = macdValue > signalValue ? 'Bullish' : 'Bearish';
                    responseText += `- **MACD:** ${macdValue.toFixed(4)} (${macdSignal})\n`;
                }

                if (chartData.indicators.bollingerBands) {
                    const bb = chartData.indicators.bollingerBands;
                    if (bb.upper?.length > 0 && bb.middle?.length > 0 && bb.lower?.length > 0) {
                        responseText += `- **Bollinger Bands:**\n`;
                        responseText += `  - Upper: $${bb.upper[0].y.toFixed(4)}\n`;
                        responseText += `  - Middle: $${bb.middle[0].y.toFixed(4)}\n`;
                        responseText += `  - Lower: $${bb.lower[0].y.toFixed(4)}\n`;
                    }
                }

                if (chartData.indicators.movingAverages) {
                    const ma = chartData.indicators.movingAverages;
                    if (ma.sma20?.length > 0) {
                        responseText += `- **SMA 20:** $${ma.sma20[0].y.toFixed(4)}\n`;
                    }
                    if (ma.sma50?.length > 0) {
                        responseText += `- **SMA 50:** $${ma.sma50[0].y.toFixed(4)}\n`;
                    }
                    if (ma.sma200?.length > 0) {
                        responseText += `- **SMA 200:** $${ma.sma200[0].y.toFixed(4)}\n`;
                    }
                }
            }

            responseText += `\n**Chart Configuration:**\n`;
            responseText += `- Theme: ${chartData.config?.theme || 'crypto'}\n`;
            responseText += `- Dimensions: ${chartData.config?.width || 800}x${chartData.config?.height || 600}\n`;
            responseText += `- Type: ${chartData.config?.type || 'line'}\n`;

            // Add trading signals interpretation
            if (chartData.datasets && chartData.datasets.length > 0) {
                responseText += `\n**Trading Signals:**\n`;
                
                // RSI interpretation
                const rsiDataset = chartData.datasets.find(d => d.label === 'RSI');
                if (rsiDataset && rsiDataset.data.length > 0) {
                    const rsiValue = rsiDataset.data[0].y;
                    if (rsiValue > 70) {
                        responseText += `- RSI indicates overbought conditions (${rsiValue.toFixed(2)})\n`;
                    } else if (rsiValue < 30) {
                        responseText += `- RSI indicates oversold conditions (${rsiValue.toFixed(2)})\n`;
                    } else {
                        responseText += `- RSI is in neutral territory (${rsiValue.toFixed(2)})\n`;
                    }
                }

                // MACD interpretation
                const macdDataset = chartData.datasets.find(d => d.label === 'MACD');
                const macdSignalDataset = chartData.datasets.find(d => d.label === 'MACD Signal');
                if (macdDataset && macdSignalDataset && macdDataset.data.length > 0 && macdSignalDataset.data.length > 0) {
                    const macdValue = macdDataset.data[0].y;
                    const signalValue = macdSignalDataset.data[0].y;
                    if (macdValue > signalValue) {
                        responseText += `- MACD shows bullish momentum\n`;
                    } else {
                        responseText += `- MACD shows bearish momentum\n`;
                    }
                }
            }

            responseText += `\n*Technical chart generated at ${new Date(chartResponse.timestamp).toLocaleString()}*`;

            // Generate SVG chart for image attachment
            console.log('🎨 [generateTechnicalChart] Starting SVG chart generation...');
            let svgChart = '';
            
            try {
                console.log('🔧 [generateTechnicalChart] Calling chartService.generateSvgChart...');
                const svgOptions = {
                    width: 800,
                    height: 600,
                    theme: 'crypto',
                    showGrid: true,
                    showLegend: true,
                    showTooltips: true
                };
                console.log('⚙️ [generateTechnicalChart] SVG options:', svgOptions);
                
                svgChart = await chartService.generateSvgChart(chartData, svgOptions);
                console.log('✅ [generateTechnicalChart] SVG chart generated successfully');
                console.log('📏 [generateTechnicalChart] SVG length:', svgChart.length);
            } catch (error) {
                console.error('❌ [generateTechnicalChart] Error generating SVG chart:', error);
                console.error('❌ [generateTechnicalChart] Error details:', {
                    name: error instanceof Error ? error.name : 'Unknown',
                    message: error instanceof Error ? error.message : 'Unknown',
                    stack: error instanceof Error ? error.stack : 'Unknown'
                });
                svgChart = '<!-- Error generating SVG chart -->';
            }

            // Prepare chart for attachment - convert SVG to PNG
            console.log('💾 [generateTechnicalChart] Preparing chart for attachment...');
            let chartFilePath = '';
            let chartAsText = '';
            
            try {
                // Create temporary directory and files
                const tempDir = mkdtempSync(join(tmpdir(), 'chart-'));
                
                // Process chart
                if (svgChart) {
                    const svgFilePath = join(tempDir, `technical-chart-${Date.now()}.svg`);
                    chartFilePath = join(tempDir, `technical-chart-${Date.now()}.png`);
                    
                    // Write SVG file first
                    writeFileSync(svgFilePath, svgChart, 'utf8');
                    console.log('✅ [generateTechnicalChart] SVG file saved to:', svgFilePath);
                    
                    // Convert SVG to PNG using svg2img
                    console.log('🔄 [generateTechnicalChart] Converting SVG to PNG...');
                    await new Promise<void>((resolve, reject) => {
                        svg2img(svgChart, { format: 'png' as any }, (error: any, buffer: Buffer) => {
                            if (error) {
                                console.error('❌ [generateTechnicalChart] SVG to PNG conversion failed:', error);
                                reject(error);
                                return;
                            }
                            
                            try {
                                writeFileSync(chartFilePath, buffer);
                                console.log('✅ [generateTechnicalChart] PNG file created at:', chartFilePath);
                                resolve();
                            } catch (writeError) {
                                console.error('❌ [generateTechnicalChart] Error writing PNG file:', writeError);
                                reject(writeError);
                            }
                        });
                    });
                }
                
                // Create a text representation of the chart for fallback
                chartAsText = `📊 Technical Chart Generated\n\n` +
                    `Token: ${tokenAddress}\n` +
                    `Timeframe: ${timeframe}\n` +
                    `Chain: ${chain}\n` +
                    `Dimensions: 800x600\n` +
                    `Data Points: ${chartData.metadata?.dataPoints || 0}\n` +
                    `Indicators: ${indicators.length > 0 ? indicators.join(', ') : 'All available'}\n\n` +
                    `Chart is available as PNG format.`;
                
            } catch (error) {
                console.error('❌ [generateTechnicalChart] Error preparing chart:', error);
                chartFilePath = '';
                chartAsText = 'Error generating chart data.';
            }

            const attachmentId = crypto.randomUUID();
            console.log('🆔 [generateTechnicalChart] Generated attachment ID:', attachmentId);

            // Send PNG image for all platforms (including Telegram)
            let responseContent;
            const attachments: any[] = [];
            
            if (chartFilePath) {
                attachments.push({
                    id: attachmentId,
                    url: chartFilePath,
                    title: 'Technical Chart (PNG)',
                    contentType: 'image/png' as any,
                });
            }
            
            if (attachments.length > 0) {
                // Send as PNG image for all platforms
                responseContent = {
                    text: responseText,
                    attachments,
                    source: 'auto',
                    channelType: 'text',
                    inReplyTo: message.id
                };
            } else {
                // Fallback to text-only response
                let enhancedResponseText = responseText;
                enhancedResponseText += `\n\n📱 *Note: Chart image generation failed. Chart data is available as text above.*`;
                
                responseContent = {
                    text: enhancedResponseText,
                    attachments: [],
                    source: 'auto',
                    channelType: 'text',
                    inReplyTo: message.id
                };
            }

            console.log('📤 [generateTechnicalChart] Response content prepared:', {
                hasAttachments: !!responseContent.attachments,
                attachmentCount: responseContent.attachments.length,
                attachmentId: responseContent.attachments[0]?.id || 'N/A',
                attachmentUrl: responseContent.attachments[0]?.url || 'N/A',
                contentType: responseContent.attachments[0]?.contentType || 'N/A',
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
                    chartData,
                    attachmentId,
                    chartFilePath,
                    chartAsText
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
