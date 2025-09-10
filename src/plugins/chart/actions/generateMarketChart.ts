import type { Action, HandlerCallback, IAgentRuntime, Memory, State, ActionResult, ActionExample } from '@elizaos/core';
import type { ChartRequest } from '../interfaces/types';
import { writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import svg2img from 'svg2img';

/**
 * Generate Market Chart Action
 * Creates market overview charts showing top gainers, losers, and market sentiment
 */
export const generateMarketChart: Action = {
    name: 'GENERATE_MARKET_CHART',
    description: 'Generate a market overview chart showing top gainers, losers, trending tokens, and market sentiment',
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me the market overview chart',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Show me the market overview chart',
                    actions: ['GENERATE_MARKET_CHART']
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Generate a chart of top gainers and losers',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Generate a chart of top gainers and losers',
                    actions: ['GENERATE_MARKET_CHART']
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Create a market sentiment chart for Solana',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Create a market sentiment chart for Solana',
                    actions: ['GENERATE_MARKET_CHART']
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me a candlestick chart of the market',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Show me a candlestick chart of the market',
                    actions: ['GENERATE_MARKET_CHART']
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Generate a baseline area chart for market trends',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Generate a baseline area chart for market trends',
                    actions: ['GENERATE_MARKET_CHART']
                },
            },
        ],
    ] as ActionExample[][],
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        const text = message.content?.text?.toLowerCase() || '';
        return text.includes('market') && (
            text.includes('chart') || 
            text.includes('overview') || 
            text.includes('gainer') || 
            text.includes('loser') ||
            text.includes('candlestick') ||
            text.includes('candle') ||
            text.includes('baseline') ||
            text.includes('area') ||
            text.includes('histogram')
        );
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: Memory[] = []
    ): Promise<ActionResult | void | undefined> => {
        console.log('🚀 [generateMarketChart] Action started');
        console.log('📝 [generateMarketChart] Message text:', message.content?.text);
        
        try {
            const text = message.content?.text || '';
            
            // Extract chain
            let chain = 'solana';
            if (text.includes('ethereum') || text.includes('eth')) chain = 'ethereum';
            else if (text.includes('base')) chain = 'base';
            else if (text.includes('bitcoin') || text.includes('btc')) chain = 'bitcoin';
            
            console.log('🔗 [generateMarketChart] Extracted chain:', chain);

            // Extract chart type
            let chartType = 'bar';
            if (text.includes('pie')) chartType = 'pie';
            else if (text.includes('line')) chartType = 'line';
            else if (text.includes('area')) chartType = 'area';
            else if (text.includes('baseline')) chartType = 'baseline';
            else if (text.includes('candlestick') || text.includes('candle')) chartType = 'candlestick';
            else if (text.includes('histogram')) chartType = 'histogram';
            
            console.log('📊 [generateMarketChart] Chart type:', chartType);

            const chartRequest: ChartRequest = {
                chain,
                chartType: chartType as any,
                theme: 'crypto',
                width: 900,
                height: 600,
                dataSource: 'market'
            };
            
            console.log('📋 [generateMarketChart] Chart request:', JSON.stringify(chartRequest, null, 2));

            // Get chart service
            const chartService = runtime.getService('CHART_SERVICE') as any;
            if (!chartService) {
                console.error('❌ [generateMarketChart] Chart service not available');
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
            
            console.log('✅ [generateMarketChart] Chart service found:', typeof chartService);
            console.log('🔍 [generateMarketChart] Chart service methods:', Object.getOwnPropertyNames(chartService));

            // Generate the chart
            console.log('🎯 [generateMarketChart] Calling chartService.generateMarketChart...');
            const chartResponse = await chartService.generateMarketChart(chartRequest);
            console.log('📈 [generateMarketChart] Chart response received:', {
                success: chartResponse.success,
                hasData: !!chartResponse.data,
                timestamp: chartResponse.timestamp,
                error: chartResponse.error
            });

            if (!chartResponse.success) {
                console.error('❌ [generateMarketChart] Chart generation failed:', chartResponse.error);
                const errorResponse = `Failed to generate market chart: ${chartResponse.error}`;
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

            const chartsData = chartResponse.data;
            console.log('📊 [generateMarketChart] Charts data structure:', {
                hasGainersChart: !!chartsData.gainersChart,
                hasLosersChart: !!chartsData.losersChart,
                gainersDatasets: chartsData.gainersChart?.datasets?.length || 0,
                losersDatasets: chartsData.losersChart?.datasets?.length || 0
            });
            
            // Format response with market information
            let responseText = `📊 **Market Charts Generated Successfully**\n\n`;
            responseText += `**Chain:** ${chain}\n`;
            responseText += `**Chart Type:** ${chartType.toUpperCase()}\n`;
            responseText += `**Charts:** Separate gainers and losers charts\n`;
            
            // Add market summary if available
            const gainersChart = chartsData.gainersChart;
            const losersChart = chartsData.losersChart;
            
            if (gainersChart) {
                responseText += `**Gainers Data Points:** ${gainersChart.metadata?.dataPoints || 0}\n`;
            }
            if (losersChart) {
                responseText += `**Losers Data Points:** ${losersChart.metadata?.dataPoints || 0}\n`;
            }

            // Add top gainers
            if (gainersChart && gainersChart.topGainers && gainersChart.topGainers.length > 0) {
                responseText += `\n**Top Gainers (24h):**\n`;
                gainersChart.topGainers.slice(0, 5).forEach((token, index) => {
                    responseText += `${index + 1}. **${token.symbol}**: +${token.priceChangePercent24h?.toFixed(2) || 'N/A'}% ($${token.price?.toFixed(6) || 'N/A'})\n`;
                });
            }

            // Add top losers
            if (losersChart && losersChart.topLosers && losersChart.topLosers.length > 0) {
                responseText += `\n**Top Losers (24h):**\n`;
                losersChart.topLosers.slice(0, 5).forEach((token, index) => {
                    responseText += `${index + 1}. **${token.symbol}**: ${token.priceChangePercent24h?.toFixed(2) || 'N/A'}% ($${token.price?.toFixed(6) || 'N/A'})\n`;
                });
            }

            // Add market sentiment
            if (gainersChart && gainersChart.sentiment) {
                responseText += `\n**Market Sentiment:**\n`;
                responseText += `- Bullish: ${(gainersChart.sentiment.bullish * 100).toFixed(1)}%\n`;
                responseText += `- Bearish: ${(gainersChart.sentiment.bearish * 100).toFixed(1)}%\n`;
                responseText += `- Neutral: ${(gainersChart.sentiment.neutral * 100).toFixed(1)}%\n`;
            }

            responseText += `\n*Market charts generated at ${new Date(chartResponse.timestamp).toLocaleString()}*`;

            // Generate SVG charts for image attachment
            console.log('🎨 [generateMarketChart] Starting SVG chart generation...');
            let gainersSvgChart = '';
            let losersSvgChart = '';
            
            try {
                console.log('🔧 [generateMarketChart] Calling chartService.generateSvgChart...');
                const svgOptions = {
                    width: 900,
                    height: 600,
                    theme: 'crypto',
                    showGrid: true,
                    showLegend: true,
                    showTooltips: true
                };
                console.log('⚙️ [generateMarketChart] SVG options:', svgOptions);
                
                // Generate gainers chart
                if (gainersChart) {
                    gainersSvgChart = await chartService.generateSvgChart(gainersChart, svgOptions);
                    console.log('✅ [generateMarketChart] Gainers SVG chart generated successfully');
                }
                
                // Generate losers chart
                if (losersChart) {
                    losersSvgChart = await chartService.generateSvgChart(losersChart, svgOptions);
                    console.log('✅ [generateMarketChart] Losers SVG chart generated successfully');
                }
                
                console.log('📏 [generateMarketChart] Gainers SVG length:', gainersSvgChart.length);
                console.log('📏 [generateMarketChart] Losers SVG length:', losersSvgChart.length);
            } catch (error) {
                console.error('❌ [generateMarketChart] Error generating SVG chart:', error);
                console.error('❌ [generateMarketChart] Error details:', {
                    name: error instanceof Error ? error.name : 'Unknown',
                    message: error instanceof Error ? error.message : 'Unknown',
                    stack: error instanceof Error ? error.stack : 'Unknown'
                });
                gainersSvgChart = '<!-- Error generating gainers SVG chart -->';
                losersSvgChart = '<!-- Error generating losers SVG chart -->';
            }

            // Prepare charts for attachment - convert SVG to PNG
            console.log('💾 [generateMarketChart] Preparing charts for attachment...');
            let gainersChartFilePath = '';
            let losersChartFilePath = '';
            let chartAsText = '';
            
            try {
                // Create temporary directory and files
                const tempDir = mkdtempSync(join(tmpdir(), 'chart-'));
                
                // Process gainers chart
                if (gainersSvgChart) {
                    const gainersSvgFilePath = join(tempDir, `gainers-chart-${Date.now()}.svg`);
                    gainersChartFilePath = join(tempDir, `gainers-chart-${Date.now()}.png`);
                    
                    // Write SVG file first
                    writeFileSync(gainersSvgFilePath, gainersSvgChart, 'utf8');
                    console.log('✅ [generateMarketChart] Gainers SVG file saved to:', gainersSvgFilePath);
                    
                    // Convert SVG to PNG using svg2img
                    console.log('🔄 [generateMarketChart] Converting gainers SVG to PNG...');
                    await new Promise<void>((resolve, reject) => {
                        svg2img(gainersSvgChart, { format: 'png' as any }, (error: any, buffer: Buffer) => {
                            if (error) {
                                console.error('❌ [generateMarketChart] Gainers SVG to PNG conversion failed:', error);
                                reject(error);
                                return;
                            }
                            
                            try {
                                writeFileSync(gainersChartFilePath, buffer);
                                console.log('✅ [generateMarketChart] Gainers PNG file created at:', gainersChartFilePath);
                                resolve();
                            } catch (writeError) {
                                console.error('❌ [generateMarketChart] Error writing gainers PNG file:', writeError);
                                reject(writeError);
                            }
                        });
                    });
                }
                
                // Process losers chart
                if (losersSvgChart) {
                    const losersSvgFilePath = join(tempDir, `losers-chart-${Date.now()}.svg`);
                    losersChartFilePath = join(tempDir, `losers-chart-${Date.now()}.png`);
                    
                    // Write SVG file first
                    writeFileSync(losersSvgFilePath, losersSvgChart, 'utf8');
                    console.log('✅ [generateMarketChart] Losers SVG file saved to:', losersSvgFilePath);
                    
                    // Convert SVG to PNG using svg2img
                    console.log('🔄 [generateMarketChart] Converting losers SVG to PNG...');
                    await new Promise<void>((resolve, reject) => {
                        svg2img(losersSvgChart, { format: 'png' as any }, (error: any, buffer: Buffer) => {
                            if (error) {
                                console.error('❌ [generateMarketChart] Losers SVG to PNG conversion failed:', error);
                                reject(error);
                                return;
                            }
                            
                            try {
                                writeFileSync(losersChartFilePath, buffer);
                                console.log('✅ [generateMarketChart] Losers PNG file created at:', losersChartFilePath);
                                resolve();
                            } catch (writeError) {
                                console.error('❌ [generateMarketChart] Error writing losers PNG file:', writeError);
                                reject(writeError);
                            }
                        });
                    });
                }
                
                // Create a text representation of the charts for fallback
                chartAsText = `📊 Market Charts Generated\n\n` +
                    `Chart Type: ${chartType}\n` +
                    `Chain: ${chain}\n` +
                    `Dimensions: 900x600\n` +
                    `Gainers Data Points: ${gainersChart?.metadata?.dataPoints || 0}\n` +
                    `Losers Data Points: ${losersChart?.metadata?.dataPoints || 0}\n\n` +
                    `Charts are available as PNG format.`;
                
            } catch (error) {
                console.error('❌ [generateMarketChart] Error preparing charts:', error);
                gainersChartFilePath = '';
                losersChartFilePath = '';
                chartAsText = 'Error generating chart data.';
            }

            const gainersAttachmentId = crypto.randomUUID();
            const losersAttachmentId = crypto.randomUUID();
            console.log('🆔 [generateMarketChart] Generated attachment IDs:', { gainersAttachmentId, losersAttachmentId });

            // Send PNG images for all platforms (including Telegram)
            let responseContent;
            const attachments: any[] = [];
            
            if (gainersChartFilePath) {
                attachments.push({
                    id: gainersAttachmentId,
                    url: gainersChartFilePath,
                    title: 'Top Gainers Chart (PNG)',
                    contentType: 'image/png' as any,
                });
            }
            
            if (losersChartFilePath) {
                attachments.push({
                    id: losersAttachmentId,
                    url: losersChartFilePath,
                    title: 'Top Losers Chart (PNG)',
                    contentType: 'image/png' as any,
                });
            }
            
            if (attachments.length > 0) {
                // Send as PNG images for all platforms
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

            console.log('📤 [generateMarketChart] Response content prepared:', {
                hasAttachments: !!responseContent.attachments,
                attachmentCount: responseContent.attachments.length,
                attachmentId: responseContent.attachments[0]?.id || 'N/A',
                attachmentUrl: responseContent.attachments[0]?.url || 'N/A',
                contentType: responseContent.attachments[0]?.contentType || 'N/A',
                textLength: responseContent.text.length,
                dataUrlLength: gainersChartFilePath.length + losersChartFilePath.length
            });

            if (callback) {
                console.log('📞 [generateMarketChart] Calling callback with response...');
                await callback(responseContent);
                console.log('✅ [generateMarketChart] Callback completed successfully');
            }

            return {
                success: true,
                text: responseText,
                data: {
                    chain,
                    chartType,
                    gainersChart,
                    losersChart,
                    gainersAttachmentId,
                    losersAttachmentId,
                    gainersChartFilePath,
                    losersChartFilePath,
                    chartAsText
                }
            };

        } catch (error) {
            console.error('❌ [generateMarketChart] Error in generateMarketChart action:', error);
            console.error('❌ [generateMarketChart] Error details:', {
                name: error instanceof Error ? error.name : 'Unknown',
                message: error instanceof Error ? error.message : 'Unknown',
                stack: error instanceof Error ? error.stack : 'Unknown'
            });
            
            const errorResponse = `Error generating market chart: ${error instanceof Error ? error.message : 'Unknown error'}`;
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

