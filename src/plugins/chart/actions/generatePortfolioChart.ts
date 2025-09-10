import type { Action, HandlerCallback, IAgentRuntime, Memory, State, ActionResult, ActionExample } from '@elizaos/core';
import type { ChartRequest } from '../interfaces/types';
import { writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import svg2img from 'svg2img';

/**
 * Generate Portfolio Chart Action
 * Creates portfolio allocation charts from account analytics data
 */
export const generatePortfolioChart: Action = {
    name: 'GENERATE_PORTFOLIO_CHART',
    description: 'Generate a portfolio allocation chart showing token distribution and percentages',
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me my portfolio allocation chart',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Show me my portfolio allocation chart',
                    actions: ['GENERATE_PORTFOLIO_CHART']
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Generate a pie chart of my token holdings',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Generate a pie chart of my token holdings',
                    actions: ['GENERATE_PORTFOLIO_CHART']
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Create a portfolio chart for wallet 0x1234...',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Create a portfolio chart for wallet 0x1234...',
                    actions: ['GENERATE_PORTFOLIO_CHART']
                },
            },
        ],
    ] as ActionExample[][],
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        const text = message.content?.text?.toLowerCase() || '';
        return text.includes('portfolio') && (text.includes('chart') || text.includes('allocation') || text.includes('pie'));
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: Memory[] = []
    ): Promise<ActionResult | void | undefined> => {
        console.log('🚀 [generatePortfolioChart] Action started');
        console.log('📝 [generatePortfolioChart] Message text:', message.content?.text);
        
        try {
            const text = message.content?.text || '';
            
            // Extract wallet address from the message
            const addressMatch = text.match(/(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})/);
            let walletAddress = '';
            
            if (addressMatch) {
                walletAddress = addressMatch[1];
            } else {
                walletAddress = state?.user?.walletAddress || '';
            }

            if (!walletAddress) {
                console.log('❌ [generatePortfolioChart] No wallet address found');
                const errorResponse = 'Please provide a wallet address or connect your wallet to generate a portfolio chart.';
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

            console.log('🔗 [generatePortfolioChart] Wallet address:', walletAddress.slice(0, 8) + '...');

            // Extract chain
            let chain = 'solana';
            if (text.includes('ethereum') || text.includes('eth')) chain = 'ethereum';
            else if (text.includes('base')) chain = 'base';

            // Extract chart type
            let chartType = 'pie';
            if (text.includes('donut')) chartType = 'donut';
            else if (text.includes('bar')) chartType = 'bar';
            
            console.log('🔗 [generatePortfolioChart] Chain:', chain);
            console.log('📊 [generatePortfolioChart] Chart type:', chartType);

            const chartRequest: ChartRequest = {
                walletAddress,
                chain,
                chartType: chartType as any,
                theme: 'crypto',
                width: 600,
                height: 400,
                dataSource: 'analytics'
            };
            
            console.log('📋 [generatePortfolioChart] Chart request:', JSON.stringify(chartRequest, null, 2));

            // Get chart service
            const chartService = runtime.getService('CHART_SERVICE') as any;
            if (!chartService) {
                console.error('❌ [generatePortfolioChart] Chart service not available');
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
            
            console.log('✅ [generatePortfolioChart] Chart service found:', typeof chartService);

            // Generate the chart
            console.log('🎯 [generatePortfolioChart] Calling chartService.generatePortfolioChart...');
            const chartResponse = await chartService.generatePortfolioChart(chartRequest);
            console.log('📈 [generatePortfolioChart] Chart response received:', {
                success: chartResponse.success,
                hasData: !!chartResponse.data,
                timestamp: chartResponse.timestamp,
                error: chartResponse.error
            });

            if (!chartResponse.success) {
                console.error('❌ [generatePortfolioChart] Chart generation failed:', chartResponse.error);
                const errorResponse = `Failed to generate portfolio chart: ${chartResponse.error}`;
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
            console.log('📊 [generatePortfolioChart] Chart data structure:', {
                type: chartData.type,
                hasAllocations: !!chartData.allocations,
                allocationsCount: chartData.allocations?.length || 0,
                hasMetadata: !!chartData.metadata
            });
            
            // Format response with portfolio information
            let responseText = `📊 **Portfolio Chart Generated Successfully**\n\n`;
            responseText += `**Wallet:** ${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}\n`;
            responseText += `**Chart Type:** ${chartType}\n`;
            responseText += `**Chain:** ${chain}\n`;
            responseText += `**Tokens:** ${chartData.metadata?.dataPoints || 0}\n`;

            // Add portfolio summary if available
            if (chartData.type === 'portfolio' && chartData.allocations) {
                const totalValue = chartData.allocations.reduce((sum, item) => sum + item.value, 0);
                responseText += `**Total Value:** $${totalValue.toFixed(2)}\n\n`;
                
                responseText += `**Token Allocations:**\n`;
                chartData.allocations
                    .sort((a, b) => b.percentage - a.percentage)
                    .forEach((allocation, index) => {
                        responseText += `${index + 1}. **${allocation.symbol}**: ${allocation.percentage.toFixed(2)}% ($${allocation.value.toFixed(2)})\n`;
                    });
            }

            responseText += `\n**Chart Configuration:**\n`;
            responseText += `- Theme: ${chartData.config?.theme || 'crypto'}\n`;
            responseText += `- Dimensions: ${chartData.config?.width || 600}x${chartData.config?.height || 400}\n`;
            responseText += `- Type: ${chartData.config?.type || chartType}\n`;

            responseText += `\n*Portfolio chart generated at ${new Date(chartResponse.timestamp).toLocaleString()}*`;

            // Generate SVG chart for image attachment
            console.log('🎨 [generatePortfolioChart] Starting SVG chart generation...');
            let svgChart = '';
            
            try {
                console.log('🔧 [generatePortfolioChart] Calling chartService.generateSvgChart...');
                const svgOptions = {
                    width: 600,
                    height: 400,
                    theme: 'crypto',
                    showGrid: true,
                    showLegend: true,
                    showTooltips: true
                };
                console.log('⚙️ [generatePortfolioChart] SVG options:', svgOptions);
                
                svgChart = await chartService.generateSvgChart(chartData, svgOptions);
                console.log('✅ [generatePortfolioChart] SVG chart generated successfully');
                console.log('📏 [generatePortfolioChart] SVG length:', svgChart.length);
            } catch (error) {
                console.error('❌ [generatePortfolioChart] Error generating SVG chart:', error);
                console.error('❌ [generatePortfolioChart] Error details:', {
                    name: error instanceof Error ? error.name : 'Unknown',
                    message: error instanceof Error ? error.message : 'Unknown',
                    stack: error instanceof Error ? error.stack : 'Unknown'
                });
                svgChart = '<!-- Error generating SVG chart -->';
            }

            // Prepare chart for attachment - convert SVG to PNG
            console.log('💾 [generatePortfolioChart] Preparing chart for attachment...');
            let chartFilePath = '';
            let chartAsText = '';
            
            try {
                // Create temporary directory and files
                const tempDir = mkdtempSync(join(tmpdir(), 'chart-'));
                
                // Process chart
                if (svgChart) {
                    const svgFilePath = join(tempDir, `portfolio-chart-${Date.now()}.svg`);
                    chartFilePath = join(tempDir, `portfolio-chart-${Date.now()}.png`);
                    
                    // Write SVG file first
                    writeFileSync(svgFilePath, svgChart, 'utf8');
                    console.log('✅ [generatePortfolioChart] SVG file saved to:', svgFilePath);
                    
                    // Convert SVG to PNG using svg2img
                    console.log('🔄 [generatePortfolioChart] Converting SVG to PNG...');
                    await new Promise<void>((resolve, reject) => {
                        svg2img(svgChart, { format: 'png' as any }, (error: any, buffer: Buffer) => {
                            if (error) {
                                console.error('❌ [generatePortfolioChart] SVG to PNG conversion failed:', error);
                                reject(error);
                                return;
                            }
                            
                            try {
                                writeFileSync(chartFilePath, buffer);
                                console.log('✅ [generatePortfolioChart] PNG file created at:', chartFilePath);
                                resolve();
                            } catch (writeError) {
                                console.error('❌ [generatePortfolioChart] Error writing PNG file:', writeError);
                                reject(writeError);
                            }
                        });
                    });
                }
                
                // Create a text representation of the chart for fallback
                chartAsText = `📊 Portfolio Chart Generated\n\n` +
                    `Wallet: ${walletAddress.slice(0, 8)}...\n` +
                    `Chart Type: ${chartType}\n` +
                    `Chain: ${chain}\n` +
                    `Dimensions: 600x400\n` +
                    `Tokens: ${chartData.metadata?.dataPoints || 0}\n\n` +
                    `Chart is available as PNG format.`;
                
            } catch (error) {
                console.error('❌ [generatePortfolioChart] Error preparing chart:', error);
                chartFilePath = '';
                chartAsText = 'Error generating chart data.';
            }

            const attachmentId = crypto.randomUUID();
            console.log('🆔 [generatePortfolioChart] Generated attachment ID:', attachmentId);

            // Send PNG image for all platforms (including Telegram)
            let responseContent;
            const attachments: any[] = [];
            
            if (chartFilePath) {
                attachments.push({
                    id: attachmentId,
                    url: chartFilePath,
                    title: 'Portfolio Chart (PNG)',
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

            console.log('📤 [generatePortfolioChart] Response content prepared:', {
                hasAttachments: !!responseContent.attachments,
                attachmentCount: responseContent.attachments.length,
                attachmentId: responseContent.attachments[0]?.id || 'N/A',
                attachmentUrl: responseContent.attachments[0]?.url || 'N/A',
                contentType: responseContent.attachments[0]?.contentType || 'N/A',
                textLength: responseContent.text.length
            });

            if (callback) {
                console.log('📞 [generatePortfolioChart] Calling callback with response...');
                await callback(responseContent);
                console.log('✅ [generatePortfolioChart] Callback completed successfully');
            }

            return {
                success: true,
                text: responseText,
                data: {
                    walletAddress,
                    chartType,
                    chain,
                    chartData,
                    attachmentId,
                    chartFilePath,
                    chartAsText
                }
            };

        } catch (error) {
            console.error('❌ [generatePortfolioChart] Error in generatePortfolioChart action:', error);
            console.error('❌ [generatePortfolioChart] Error details:', {
                name: error instanceof Error ? error.name : 'Unknown',
                message: error instanceof Error ? error.message : 'Unknown',
                stack: error instanceof Error ? error.stack : 'Unknown'
            });
            
            const errorResponse = `Error generating portfolio chart: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
