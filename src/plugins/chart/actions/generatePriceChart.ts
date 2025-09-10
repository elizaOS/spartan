import type { Action, HandlerCallback, IAgentRuntime, Memory, State, ActionResult, ActionExample } from '@elizaos/core';
import type { ChartRequest } from '../interfaces/types';
import { writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import svg2img from 'svg2img';

/**
 * Generate Price Chart Action
 * Creates price charts (candlestick/line) from analytics data
 */
export const generatePriceChart: Action = {
    name: 'GENERATE_PRICE_CHART',
    description: 'Generate a price chart (candlestick or line) for a specific token using analytics data',
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Generate a price chart for SOL token',
                },
            },
            {
                name: '{{name2}}',
            content: {
                text: 'Generate a price chart for SOL token',
                    actions: ['GENERATE_PRICE_CHART']
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me a candlestick chart for token 0x1234... with technical indicators',
                },
            },
            {
                name: '{{name2}}',
            content: {
                text: 'Show me a candlestick chart for token 0x1234... with technical indicators',
                    actions: ['GENERATE_PRICE_CHART']
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Create a line chart for BONK with 1d timeframe',
                },
            },
            {
                name: '{{name2}}',
            content: {
                text: 'Create a line chart for BONK with 1d timeframe',
                    actions: ['GENERATE_PRICE_CHART']
                },
            },
        ],
    ] as ActionExample[][],
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        const text = message.content?.text?.toLowerCase() || '';
        return text.includes('chart') && (text.includes('price') || text.includes('candlestick') || text.includes('line'));
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: Memory[] = []
    ): Promise<ActionResult | void | undefined> => {
        console.log('🚀 [generatePriceChart] Action started');
        console.log('📝 [generatePriceChart] Message text:', message.content?.text);
        
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
                console.log('❌ [generatePriceChart] No token address or symbol found');
                const errorResponse = 'Please provide a token address or symbol to generate a price chart.';
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

            console.log('🪙 [generatePriceChart] Token address/symbol:', tokenAddress);

            // Extract chart type
            let chartType = 'candlestick';
            if (text.includes('line')) {
                chartType = 'line';
            } else if (text.includes('candlestick')) {
                chartType = 'candlestick';
            }

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

            // Check if technical indicators should be included
            const includeIndicators = text.includes('indicator') || text.includes('technical') || text.includes('rsi') || text.includes('macd');
            
            console.log('📊 [generatePriceChart] Chart type:', chartType);
            console.log('⏰ [generatePriceChart] Timeframe:', timeframe);
            console.log('🔗 [generatePriceChart] Chain:', chain);
            console.log('📈 [generatePriceChart] Include indicators:', includeIndicators);

            const chartRequest: ChartRequest = {
                tokenAddress,
                chain,
                timeframe: timeframe as any,
                chartType: chartType as any,
                theme: 'crypto',
                width: 800,
                height: 400,
                includeIndicators,
                dataSource: 'analytics'
            };
            
            console.log('📋 [generatePriceChart] Chart request:', JSON.stringify(chartRequest, null, 2));

            // Get chart service
            const chartService = runtime.getService('CHART_SERVICE') as any;
            if (!chartService) {
                console.error('❌ [generatePriceChart] Chart service not available');
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
            
            console.log('✅ [generatePriceChart] Chart service found:', typeof chartService);

            // Generate the chart
            console.log('🎯 [generatePriceChart] Calling chartService.generatePriceChart...');
            const chartResponse = await chartService.generatePriceChart(chartRequest);
            console.log('📈 [generatePriceChart] Chart response received:', {
                success: chartResponse.success,
                hasData: !!chartResponse.data,
                timestamp: chartResponse.timestamp,
                error: chartResponse.error
            });

            if (!chartResponse.success) {
                console.error('❌ [generatePriceChart] Chart generation failed:', chartResponse.error);
                const errorResponse = `Failed to generate price chart: ${chartResponse.error}`;
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
            console.log('📊 [generatePriceChart] Chart data structure:', {
                type: chartData.type,
                hasDatasets: !!chartData.datasets,
                datasetsCount: chartData.datasets?.length || 0,
                hasMetadata: !!chartData.metadata
            });
            
            // Format response with chart information
            let responseText = `📊 **Price Chart Generated Successfully**\n\n`;
            responseText += `**Token:** ${tokenAddress}\n`;
            responseText += `**Chart Type:** ${chartType}\n`;
            responseText += `**Timeframe:** ${timeframe}\n`;
            responseText += `**Chain:** ${chain}\n`;
            responseText += `**Data Points:** ${chartData.metadata?.dataPoints || 0}\n`;
            
            if (includeIndicators) {
                responseText += `**Technical Indicators:** Included\n`;
            }

            // Add price information if available
            if (chartData.datasets && chartData.datasets.length > 0) {
                const priceDataset = chartData.datasets.find(d => d.label === 'Price');
                if (priceDataset && priceDataset.data.length > 0) {
                    const pricePoint = priceDataset.data[0];
                    responseText += `**Current Price:** $${pricePoint.y.toFixed(6)}\n`;
                }
            }

            responseText += `\n**Chart Configuration:**\n`;
            responseText += `- Theme: ${chartData.config?.theme || 'crypto'}\n`;
            responseText += `- Dimensions: ${chartData.config?.width || 800}x${chartData.config?.height || 400}\n`;
            responseText += `- Responsive: ${chartData.config?.responsive ? 'Yes' : 'No'}\n`;

            // Add technical indicators summary if available
            if (includeIndicators && chartData.datasets) {
                const indicatorDatasets = chartData.datasets.filter(d => d.label !== 'Price');
                if (indicatorDatasets.length > 0) {
                    responseText += `\n**Technical Indicators:**\n`;
                    indicatorDatasets.forEach(dataset => {
                        if (dataset.data.length > 0) {
                            const value = dataset.data[0].y;
                            responseText += `- ${dataset.label}: ${value.toFixed(4)}\n`;
                        }
                    });
                }
            }

            responseText += `\n*Chart data generated at ${new Date(chartResponse.timestamp).toLocaleString()}*`;

            // Generate SVG chart for image attachment
            console.log('🎨 [generatePriceChart] Starting SVG chart generation...');
            let svgChart = '';
            
            try {
                console.log('🔧 [generatePriceChart] Calling chartService.generateSvgChart...');
                const svgOptions = {
                    width: 800,
                    height: 400,
                    theme: 'crypto',
                    showGrid: true,
                    showLegend: true,
                    showTooltips: true
                };
                console.log('⚙️ [generatePriceChart] SVG options:', svgOptions);
                
                svgChart = await chartService.generateSvgChart(chartData, svgOptions);
                console.log('✅ [generatePriceChart] SVG chart generated successfully');
                console.log('📏 [generatePriceChart] SVG length:', svgChart.length);
            } catch (error) {
                console.error('❌ [generatePriceChart] Error generating SVG chart:', error);
                console.error('❌ [generatePriceChart] Error details:', {
                    name: error instanceof Error ? error.name : 'Unknown',
                    message: error instanceof Error ? error.message : 'Unknown',
                    stack: error instanceof Error ? error.stack : 'Unknown'
                });
                svgChart = '<!-- Error generating SVG chart -->';
            }

            // Prepare chart for attachment - convert SVG to PNG
            console.log('💾 [generatePriceChart] Preparing chart for attachment...');
            let chartFilePath = '';
            let chartAsText = '';
            
            try {
                // Create temporary directory and files
                const tempDir = mkdtempSync(join(tmpdir(), 'chart-'));
                
                // Process chart
                if (svgChart) {
                    const svgFilePath = join(tempDir, `price-chart-${Date.now()}.svg`);
                    chartFilePath = join(tempDir, `price-chart-${Date.now()}.png`);
                    
                    // Write SVG file first
                    writeFileSync(svgFilePath, svgChart, 'utf8');
                    console.log('✅ [generatePriceChart] SVG file saved to:', svgFilePath);
                    
                    // Convert SVG to PNG using svg2img
                    console.log('🔄 [generatePriceChart] Converting SVG to PNG...');
                    await new Promise<void>((resolve, reject) => {
                        svg2img(svgChart, { format: 'png' as any }, (error: any, buffer: Buffer) => {
                            if (error) {
                                console.error('❌ [generatePriceChart] SVG to PNG conversion failed:', error);
                                reject(error);
                                return;
                            }
                            
                            try {
                                writeFileSync(chartFilePath, buffer);
                                console.log('✅ [generatePriceChart] PNG file created at:', chartFilePath);
                                resolve();
                            } catch (writeError) {
                                console.error('❌ [generatePriceChart] Error writing PNG file:', writeError);
                                reject(writeError);
                            }
                        });
                    });
                }
                
                // Create a text representation of the chart for fallback
                chartAsText = `📊 Price Chart Generated\n\n` +
                    `Token: ${tokenAddress}\n` +
                    `Chart Type: ${chartType}\n` +
                    `Timeframe: ${timeframe}\n` +
                    `Chain: ${chain}\n` +
                    `Dimensions: 800x400\n` +
                    `Data Points: ${chartData.metadata?.dataPoints || 0}\n` +
                    `Indicators: ${includeIndicators ? 'Included' : 'Not included'}\n\n` +
                    `Chart is available as PNG format.`;
                
            } catch (error) {
                console.error('❌ [generatePriceChart] Error preparing chart:', error);
                chartFilePath = '';
                chartAsText = 'Error generating chart data.';
            }

            const attachmentId = crypto.randomUUID();
            console.log('🆔 [generatePriceChart] Generated attachment ID:', attachmentId);

            // Send PNG image for all platforms (including Telegram)
            let responseContent;
            const attachments: any[] = [];
            
            if (chartFilePath) {
                attachments.push({
                    id: attachmentId,
                    url: chartFilePath,
                    title: 'Price Chart (PNG)',
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

            console.log('📤 [generatePriceChart] Response content prepared:', {
                hasAttachments: !!responseContent.attachments,
                attachmentCount: responseContent.attachments.length,
                attachmentId: responseContent.attachments[0]?.id || 'N/A',
                attachmentUrl: responseContent.attachments[0]?.url || 'N/A',
                contentType: responseContent.attachments[0]?.contentType || 'N/A',
                textLength: responseContent.text.length
            });

            if (callback) {
                console.log('📞 [generatePriceChart] Calling callback with response...');
                await callback(responseContent);
                console.log('✅ [generatePriceChart] Callback completed successfully');
            }

            return {
                success: true,
                text: responseText,
                data: {
                    tokenAddress,
                    chartType,
                    timeframe,
                    chain,
                    includeIndicators,
                    chartData,
                    attachmentId,
                    chartFilePath,
                    chartAsText
                }
            };

        } catch (error) {
            console.error('❌ [generatePriceChart] Error in generatePriceChart action:', error);
            console.error('❌ [generatePriceChart] Error details:', {
                name: error instanceof Error ? error.name : 'Unknown',
                message: error instanceof Error ? error.message : 'Unknown',
                stack: error instanceof Error ? error.stack : 'Unknown'
            });
            
            const errorResponse = `Error generating price chart: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
