import type { Action, HandlerCallback, IAgentRuntime, Memory, State, ActionResult, ActionExample } from '@elizaos/core';
import type { ChartRequest } from '../interfaces/types';
import { writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import svg2img from 'svg2img';

/**
 * Generate Performance Chart Action
 * Creates performance charts showing portfolio value, PnL, and returns over time
 */
export const generatePerformanceChart: Action = {
    name: 'GENERATE_PERFORMANCE_CHART',
    description: 'Generate a performance chart showing portfolio value, PnL, returns, and drawdown over time',
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me my portfolio performance chart',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Show me my portfolio performance chart',
                    actions: ['GENERATE_PERFORMANCE_CHART']
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Generate a PnL chart for my wallet',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Generate a PnL chart for my wallet',
                    actions: ['GENERATE_PERFORMANCE_CHART']
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Create a performance chart for wallet 0x1234...',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Create a performance chart for wallet 0x1234...',
                    actions: ['GENERATE_PERFORMANCE_CHART']
                },
            },
        ],
    ] as ActionExample[][],
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        const text = message.content?.text?.toLowerCase() || '';
        return text.includes('performance') && (text.includes('chart') || text.includes('pnl') || text.includes('return'));
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: Memory[] = []
    ): Promise<ActionResult | void | undefined> => {
        console.log('🚀 [generatePerformanceChart] Action started');
        console.log('📝 [generatePerformanceChart] Message text:', message.content?.text);
        
        try {
            const text = message.content?.text || '';
            
            // Extract wallet address from the message
            const addressMatch = text.match(/(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})/);
            let walletAddress = '';
            
            if (addressMatch) {
                walletAddress = addressMatch[1];
            } else {
                // Try to get wallet address from state or user context
                walletAddress = state?.user?.walletAddress || '';
            }

            if (!walletAddress) {
                console.log('❌ [generatePerformanceChart] No wallet address found');
                const errorResponse = 'Please provide a wallet address or connect your wallet to generate a performance chart.';
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

            console.log('🔗 [generatePerformanceChart] Wallet address:', walletAddress.slice(0, 8) + '...');

            // Extract timeframe
            let timeframe = '1m';
            if (text.includes('1d')) timeframe = '1d';
            else if (text.includes('1w')) timeframe = '1w';
            else if (text.includes('1m')) timeframe = '1m';
            else if (text.includes('3m')) timeframe = '3m';
            else if (text.includes('6m')) timeframe = '6m';
            else if (text.includes('1y')) timeframe = '1y';

            // Extract chain
            let chain = 'solana';
            if (text.includes('ethereum') || text.includes('eth')) chain = 'ethereum';
            else if (text.includes('base')) chain = 'base';
            
            console.log('⏰ [generatePerformanceChart] Timeframe:', timeframe);
            console.log('🔗 [generatePerformanceChart] Chain:', chain);

            const chartRequest: ChartRequest = {
                walletAddress,
                chain,
                timeframe: timeframe as any,
                chartType: 'line',
                theme: 'crypto',
                width: 800,
                height: 400,
                dataSource: 'analytics'
            };
            
            console.log('📋 [generatePerformanceChart] Chart request:', JSON.stringify(chartRequest, null, 2));

            // Get chart service
            const chartService = runtime.getService('CHART_SERVICE') as any;
            if (!chartService) {
                console.error('❌ [generatePerformanceChart] Chart service not available');
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
            
            console.log('✅ [generatePerformanceChart] Chart service found:', typeof chartService);

            // Generate the chart
            console.log('🎯 [generatePerformanceChart] Calling chartService.generatePerformanceChart...');
            const chartResponse = await chartService.generatePerformanceChart(chartRequest);
            console.log('📈 [generatePerformanceChart] Chart response received:', {
                success: chartResponse.success,
                hasData: !!chartResponse.data,
                timestamp: chartResponse.timestamp,
                error: chartResponse.error
            });

            if (!chartResponse.success) {
                console.error('❌ [generatePerformanceChart] Chart generation failed:', chartResponse.error);
                const errorResponse = `Failed to generate performance chart: ${chartResponse.error}`;
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
            console.log('📊 [generatePerformanceChart] Chart data structure:', {
                type: chartData.type,
                hasDatasets: !!chartData.datasets,
                datasetsCount: chartData.datasets?.length || 0,
                hasMetadata: !!chartData.metadata
            });
            
            // Format response with performance information
            let responseText = `📊 **Performance Chart Generated Successfully**\n\n`;
            responseText += `**Wallet:** ${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}\n`;
            responseText += `**Timeframe:** ${timeframe}\n`;
            responseText += `**Chain:** ${chain}\n`;
            responseText += `**Data Points:** ${chartData.metadata?.dataPoints || 0}\n`;

            // Add performance summary if available
            if (chartData.type === 'performance') {
                responseText += `**Total Value:** $${chartData.totalValue?.toFixed(2) || 'N/A'}\n`;
                responseText += `**Total PnL:** $${chartData.totalPnL?.toFixed(2) || 'N/A'}\n`;
                responseText += `**Total PnL %:** ${chartData.totalPnLPercent?.toFixed(2) || 'N/A'}%\n\n`;

                // Performance interpretation
                if (chartData.totalPnL > 0) {
                    responseText += `🎉 **Portfolio is in profit!**\n`;
                } else if (chartData.totalPnL < 0) {
                    responseText += `📉 **Portfolio is at a loss**\n`;
                } else {
                    responseText += `➖ **Portfolio is at break-even**\n`;
                }

                // Performance rating
                if (chartData.totalPnLPercent > 50) {
                    responseText += `**Performance Rating:** Excellent (${chartData.totalPnLPercent.toFixed(2)}%)\n`;
                } else if (chartData.totalPnLPercent > 20) {
                    responseText += `**Performance Rating:** Good (${chartData.totalPnLPercent.toFixed(2)}%)\n`;
                } else if (chartData.totalPnLPercent > 0) {
                    responseText += `**Performance Rating:** Positive (${chartData.totalPnLPercent.toFixed(2)}%)\n`;
                } else if (chartData.totalPnLPercent > -10) {
                    responseText += `**Performance Rating:** Moderate Loss (${chartData.totalPnLPercent.toFixed(2)}%)\n`;
                } else {
                    responseText += `**Performance Rating:** Significant Loss (${chartData.totalPnLPercent.toFixed(2)}%)\n`;
                }
            }

            responseText += `\n**Chart Configuration:**\n`;
            responseText += `- Theme: ${chartData.config?.theme || 'crypto'}\n`;
            responseText += `- Dimensions: ${chartData.config?.width || 800}x${chartData.config?.height || 400}\n`;
            responseText += `- Type: ${chartData.config?.type || 'line'}\n`;

            // Add performance insights
            if (chartData.datasets && chartData.datasets.length > 0) {
                responseText += `\n**Performance Insights:**\n`;
                
                const portfolioDataset = chartData.datasets.find(d => d.label === 'Portfolio Value');
                const pnlDataset = chartData.datasets.find(d => d.label === 'PnL');
                
                if (portfolioDataset && portfolioDataset.data.length > 0) {
                    const currentValue = portfolioDataset.data[portfolioDataset.data.length - 1].y;
                    responseText += `- Current portfolio value: $${currentValue.toFixed(2)}\n`;
                }
                
                if (pnlDataset && pnlDataset.data.length > 0) {
                    const currentPnL = pnlDataset.data[pnlDataset.data.length - 1].y;
                    responseText += `- Current PnL: $${currentPnL.toFixed(2)}\n`;
                    
                    if (currentPnL > 0) {
                        responseText += `- Portfolio is currently profitable\n`;
                    } else {
                        responseText += `- Portfolio is currently at a loss\n`;
                    }
                }

                // Risk assessment
                if (chartData.type === 'performance') {
                    responseText += `\n**Risk Assessment:**\n`;
                    
                    if (Math.abs(chartData.totalPnLPercent) < 5) {
                        responseText += `- Low volatility portfolio\n`;
                    } else if (Math.abs(chartData.totalPnLPercent) < 20) {
                        responseText += `- Moderate volatility portfolio\n`;
                    } else {
                        responseText += `- High volatility portfolio\n`;
                    }
                    
                    if (chartData.totalPnL > 0) {
                        responseText += `- Positive risk-adjusted returns\n`;
                    } else {
                        responseText += `- Negative risk-adjusted returns\n`;
                    }
                }
            }

            responseText += `\n*Performance chart generated at ${new Date(chartResponse.timestamp).toLocaleString()}*`;

            // Generate SVG chart for image attachment
            console.log('🎨 [generatePerformanceChart] Starting SVG chart generation...');
            let svgChart = '';
            
            try {
                console.log('🔧 [generatePerformanceChart] Calling chartService.generateSvgChart...');
                const svgOptions = {
                    width: 800,
                    height: 400,
                    theme: 'crypto',
                    showGrid: true,
                    showLegend: true,
                    showTooltips: true
                };
                console.log('⚙️ [generatePerformanceChart] SVG options:', svgOptions);
                
                svgChart = await chartService.generateSvgChart(chartData, svgOptions);
                console.log('✅ [generatePerformanceChart] SVG chart generated successfully');
                console.log('📏 [generatePerformanceChart] SVG length:', svgChart.length);
            } catch (error) {
                console.error('❌ [generatePerformanceChart] Error generating SVG chart:', error);
                console.error('❌ [generatePerformanceChart] Error details:', {
                    name: error instanceof Error ? error.name : 'Unknown',
                    message: error instanceof Error ? error.message : 'Unknown',
                    stack: error instanceof Error ? error.stack : 'Unknown'
                });
                svgChart = '<!-- Error generating SVG chart -->';
            }

            // Prepare chart for attachment - convert SVG to PNG
            console.log('💾 [generatePerformanceChart] Preparing chart for attachment...');
            let chartFilePath = '';
            let chartAsText = '';
            
            try {
                // Create temporary directory and files
                const tempDir = mkdtempSync(join(tmpdir(), 'chart-'));
                
                // Process chart
                if (svgChart) {
                    const svgFilePath = join(tempDir, `performance-chart-${Date.now()}.svg`);
                    chartFilePath = join(tempDir, `performance-chart-${Date.now()}.png`);
                    
                    // Write SVG file first
                    writeFileSync(svgFilePath, svgChart, 'utf8');
                    console.log('✅ [generatePerformanceChart] SVG file saved to:', svgFilePath);
                    
                    // Convert SVG to PNG using svg2img
                    console.log('🔄 [generatePerformanceChart] Converting SVG to PNG...');
                    await new Promise<void>((resolve, reject) => {
                        svg2img(svgChart, { format: 'png' as any }, (error: any, buffer: Buffer) => {
                            if (error) {
                                console.error('❌ [generatePerformanceChart] SVG to PNG conversion failed:', error);
                                reject(error);
                                return;
                            }
                            
                            try {
                                writeFileSync(chartFilePath, buffer);
                                console.log('✅ [generatePerformanceChart] PNG file created at:', chartFilePath);
                                resolve();
                            } catch (writeError) {
                                console.error('❌ [generatePerformanceChart] Error writing PNG file:', writeError);
                                reject(writeError);
                            }
                        });
                    });
                }
                
                // Create a text representation of the chart for fallback
                chartAsText = `📊 Performance Chart Generated\n\n` +
                    `Wallet: ${walletAddress.slice(0, 8)}...\n` +
                    `Timeframe: ${timeframe}\n` +
                    `Chain: ${chain}\n` +
                    `Dimensions: 800x400\n` +
                    `Data Points: ${chartData.metadata?.dataPoints || 0}\n\n` +
                    `Chart is available as PNG format.`;
                
            } catch (error) {
                console.error('❌ [generatePerformanceChart] Error preparing chart:', error);
                chartFilePath = '';
                chartAsText = 'Error generating chart data.';
            }

            const attachmentId = crypto.randomUUID();
            console.log('🆔 [generatePerformanceChart] Generated attachment ID:', attachmentId);

            // Send PNG image for all platforms (including Telegram)
            let responseContent;
            const attachments: any[] = [];
            
            if (chartFilePath) {
                attachments.push({
                    id: attachmentId,
                    url: chartFilePath,
                    title: 'Performance Chart (PNG)',
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

            console.log('📤 [generatePerformanceChart] Response content prepared:', {
                hasAttachments: !!responseContent.attachments,
                attachmentCount: responseContent.attachments.length,
                attachmentId: responseContent.attachments[0]?.id || 'N/A',
                attachmentUrl: responseContent.attachments[0]?.url || 'N/A',
                contentType: responseContent.attachments[0]?.contentType || 'N/A',
                textLength: responseContent.text.length
            });

            if (callback) {
                console.log('📞 [generatePerformanceChart] Calling callback with response...');
                await callback(responseContent);
                console.log('✅ [generatePerformanceChart] Callback completed successfully');
            }

            return {
                success: true,
                text: responseText,
                data: {
                    walletAddress,
                    timeframe,
                    chain,
                    chartData,
                    attachmentId,
                    chartFilePath,
                    chartAsText
                }
            };

        } catch (error) {
            console.error('❌ [generatePerformanceChart] Error in generatePerformanceChart action:', error);
            console.error('❌ [generatePerformanceChart] Error details:', {
                name: error instanceof Error ? error.name : 'Unknown',
                message: error instanceof Error ? error.message : 'Unknown',
                stack: error instanceof Error ? error.stack : 'Unknown'
            });
            
            const errorResponse = `Error generating performance chart: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
