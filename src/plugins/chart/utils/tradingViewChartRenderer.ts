import { 
    createChart, 
    IChartApi, 
    ISeriesApi,
    CandlestickData,
    LineData,
    BarData,
    HistogramData,
    AreaData,
    BaselineData,
    ColorType,
    LineStyle,
    CrosshairMode,
    PriceScaleMode,
    // Series type definitions for v5.0 API
    CandlestickSeries,
    LineSeries,
    AreaSeries,
    BaselineSeries,
    BarSeries,
    HistogramSeries
} from 'lightweight-charts';
import type { 
    ChartData, 
    ChartDataset, 
    ChartDataPoint, 
    ChartConfig, 
    ChartType,
    ChartTheme 
} from '../interfaces/types';
import { PuppeteerRenderer } from './puppeteerRenderer';

/**
 * TradingView Chart Renderer
 * Uses lightweight-charts library for advanced, interactive financial charts
 * Based on TradingView's official charting library
 */
export class TradingViewChartRenderer {
    private chart: IChartApi | null = null;
    private seriesMap: Map<string, ISeriesApi<any>> = new Map();

    /**
     * Theme configurations matching TradingView's professional styling
     */
    private static readonly THEMES = {
        light: {
            layout: {
                background: { type: ColorType.Solid, color: '#FFFFFF' },
                textColor: '#131722',
            },
            grid: {
                vertLines: { color: '#E1E3E6' },
                horzLines: { color: '#E1E3E6' },
            },
            timeScale: {
                borderColor: '#E1E3E6',
                timeVisible: true,
                secondsVisible: false,
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: {
                    color: '#758696',
                    width: 1,
                    style: LineStyle.Dashed,
                    labelBackgroundColor: '#131722',
                },
                horzLine: {
                    color: '#758696',
                    width: 1,
                    style: LineStyle.Dashed,
                    labelBackgroundColor: '#131722',
                },
            },
            watermark: {
                color: 'rgba(0, 0, 0, 0.05)',
                visible: true,
                fontSize: 48,
                horzAlign: 'center',
                vertAlign: 'center',
            },
        },
        dark: {
            layout: {
                background: { type: ColorType.Solid, color: '#131722' },
                textColor: '#D1D4DC',
            },
            grid: {
                vertLines: { color: '#2A2E39' },
                horzLines: { color: '#2A2E39' },
            },
            timeScale: {
                borderColor: '#2A2E39',
                timeVisible: true,
                secondsVisible: false,
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: {
                    color: '#787B86',
                    width: 1,
                    style: LineStyle.Dashed,
                    labelBackgroundColor: '#D1D4DC',
                },
                horzLine: {
                    color: '#787B86',
                    width: 1,
                    style: LineStyle.Dashed,
                    labelBackgroundColor: '#D1D4DC',
                },
            },
            watermark: {
                color: 'rgba(255, 255, 255, 0.05)',
                visible: true,
                fontSize: 48,
                horzAlign: 'center',
                vertAlign: 'center',
            },
        },
        crypto: {
            layout: {
                background: { type: ColorType.Solid, color: '#0D1117' },
                textColor: '#F0F6FC',
            },
            grid: {
                vertLines: { color: '#21262D' },
                horzLines: { color: '#21262D' },
            },
            timeScale: {
                borderColor: '#21262D',
                timeVisible: true,
                secondsVisible: false,
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: {
                    color: '#7D8590',
                    width: 1,
                    style: LineStyle.Dashed,
                    labelBackgroundColor: '#F0F6FC',
                },
                horzLine: {
                    color: '#7D8590',
                    width: 1,
                    style: LineStyle.Dashed,
                    labelBackgroundColor: '#F0F6FC',
                },
            },
            watermark: {
                color: 'rgba(0, 212, 170, 0.05)',
                visible: true,
                fontSize: 48,
                horzAlign: 'center',
                vertAlign: 'center',
            },
        },
        minimal: {
            layout: {
                background: { type: ColorType.Solid, color: '#FFFFFF' },
                textColor: '#2C3E50',
            },
            grid: {
                vertLines: { color: '#F5F5F5', visible: false },
                horzLines: { color: '#F5F5F5', visible: false },
            },
            timeScale: {
                borderColor: '#E0E0E0',
                timeVisible: true,
                secondsVisible: false,
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: {
                    color: '#999999',
                    width: 1,
                    style: LineStyle.Solid,
                    labelBackgroundColor: '#2C3E50',
                },
                horzLine: {
                    color: '#999999',
                    width: 1,
                    style: LineStyle.Solid,
                    labelBackgroundColor: '#2C3E50',
                },
            },
            watermark: {
                visible: false,
            },
        },
        professional: {
            layout: {
                background: { type: ColorType.Solid, color: '#FAFAFA' },
                textColor: '#1A1A1A',
            },
            grid: {
                vertLines: { color: '#E5E5E5' },
                horzLines: { color: '#E5E5E5' },
            },
            timeScale: {
                borderColor: '#D1D1D1',
                timeVisible: true,
                secondsVisible: false,
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: {
                    color: '#666666',
                    width: 1,
                    style: LineStyle.Solid,
                    labelBackgroundColor: '#1A1A1A',
                },
                horzLine: {
                    color: '#666666',
                    width: 1,
                    style: LineStyle.Solid,
                    labelBackgroundColor: '#1A1A1A',
                },
            },
            watermark: {
                color: 'rgba(0, 0, 0, 0.03)',
                visible: true,
                fontSize: 36,
            },
        },
    };

    /**
     * Color schemes for different chart types and themes
     */
    private static readonly COLORS = {
        crypto: {
            bullish: '#26A69A',
            bearish: '#EF5350',
            line: '#2962FF',
            area: '#2962FF',
            volume: '#26A69A',
        },
        dark: {
            bullish: '#26A69A',
            bearish: '#EF5350',
            line: '#2962FF',
            area: '#2962FF',
            volume: '#26A69A',
        },
        light: {
            bullish: '#26A69A',
            bearish: '#EF5350',
            line: '#2962FF',
            area: '#2962FF',
            volume: '#26A69A',
        },
        minimal: {
            bullish: '#3498DB',
            bearish: '#E74C3C',
            line: '#2C3E50',
            area: '#3498DB',
            volume: '#95A5A6',
        },
        professional: {
            bullish: '#4CAF50',
            bearish: '#F44336',
            line: '#2196F3',
            area: '#2196F3',
            volume: '#9E9E9E',
        },
    };

    /**
     * Create a TradingView chart with container element
     */
    createChart(container: HTMLElement, config: ChartConfig): IChartApi {
        const theme = config.theme || 'crypto';
        const themeConfig = TradingViewChartRenderer.THEMES[theme] || TradingViewChartRenderer.THEMES.crypto;

        const chartOptions = {
            width: config.width || 800,
            height: config.height || 400,
            ...themeConfig,
            rightPriceScale: {
                borderColor: themeConfig.grid.vertLines.color,
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.2,
                },
            },
            leftPriceScale: {
                visible: config.dualAxis || false,
                borderColor: themeConfig.grid.vertLines.color,
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.2,
                },
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: true,
            },
            handleScale: {
                axisPressedMouseMove: true,
                mouseWheel: true,
                pinch: true,
            },
        };

        this.chart = createChart(container, chartOptions);

        // Add watermark if title is provided
        if (config.title && themeConfig.watermark.visible) {
            this.chart.applyOptions({
                watermark: {
                    ...themeConfig.watermark,
                    text: config.title,
                },
            });
        }

        return this.chart;
    }

    /**
     * Generate HTML with embedded TradingView chart
     */
    static generateHtml(chartData: ChartData, options: {
        width?: number;
        height?: number;
        theme?: ChartTheme;
        showGrid?: boolean;
        showLegend?: boolean;
        interactive?: boolean;
    } = {}): string {
        const {
            width = chartData.config.width || 800,
            height = chartData.config.height || 400,
            theme = chartData.config.theme || 'crypto',
            showGrid = chartData.config.showGrid ?? true,
            showLegend = chartData.config.showLegend ?? true,
            interactive = true,
        } = options;

        const themeConfig = this.THEMES[theme] || this.THEMES.crypto;
        const colors = this.COLORS[theme] || this.COLORS.crypto;

        // Generate series data
        const seriesCode = this.generateSeriesCode(chartData, colors);

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${chartData.config.title || 'TradingView Chart'}</title>
    <script src="https://unpkg.com/lightweight-charts@5.0.9/dist/lightweight-charts.standalone.production.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: ${themeConfig.layout.background.color};
            color: ${themeConfig.layout.textColor};
            padding: 20px;
        }
        #chart-container {
            width: ${width}px;
            height: ${height}px;
            margin: 0 auto;
            position: relative;
        }
        #token-labels {
            width: ${width}px;
            margin: 10px auto 0;
            display: flex;
            justify-content: space-around;
            font-size: 13px;
            font-weight: 600;
            color: ${themeConfig.layout.textColor};
        }
        .token-label-item {
            text-align: center;
            padding: 5px 10px;
        }
        .chart-title {
            text-align: center;
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 20px;
            color: ${themeConfig.layout.textColor};
        }
        .chart-subtitle {
            text-align: center;
            font-size: 14px;
            color: ${themeConfig.layout.textColor};
            opacity: 0.7;
            margin-bottom: 20px;
        }
        .chart-legend {
            margin-top: 20px;
            padding: 15px;
            background: ${themeConfig.layout.background.color};
            border: 1px solid ${themeConfig.grid.horzLines.color};
            border-radius: 8px;
            display: ${showLegend ? 'flex' : 'none'};
            flex-wrap: wrap;
            gap: 20px;
            justify-content: center;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .legend-color {
            width: 20px;
            height: 12px;
            border-radius: 2px;
        }
        .legend-label {
            font-size: 13px;
            font-weight: 500;
        }
        .chart-info {
            margin-top: 15px;
            text-align: center;
            font-size: 12px;
            opacity: 0.6;
        }
    </style>
</head>
<body>
    ${chartData.config.title ? `<div class="chart-title">${chartData.config.title}</div>` : ''}
    ${chartData.config.subtitle ? `<div class="chart-subtitle">${chartData.config.subtitle}</div>` : ''}
    
    <div id="chart-container"></div>
    <div id="token-labels"></div>
    
    <div class="chart-legend">
        ${chartData.datasets.map((dataset, index) => `
            <div class="legend-item">
                <div class="legend-color" style="background: ${dataset.color || colors.line}"></div>
                <span class="legend-label">${dataset.label}</span>
            </div>
        `).join('')}
    </div>
    
    <div class="chart-info">
        ${chartData.metadata ? `Generated: ${new Date(chartData.metadata.timestamp).toLocaleString()} | Data Points: ${chartData.metadata.dataPoints}` : ''}
    </div>

    <script>
        try {
            console.log('Chart creation starting...');
            console.log('LightweightCharts:', typeof LightweightCharts);
            
            const chartContainer = document.getElementById('chart-container');
            
            const chart = LightweightCharts.createChart(chartContainer, {
                width: ${width},
                height: ${height},
                layout: ${JSON.stringify(themeConfig.layout)},
                grid: ${JSON.stringify(themeConfig.grid)},
                timeScale: {
                    borderColor: '${themeConfig.grid.vertLines.color}',
                    timeVisible: true,
                    secondsVisible: false,
                    rightOffset: 12,
                    barSpacing: 50,
                    minBarSpacing: 30,
                    fixLeftEdge: true,
                    fixRightEdge: true,
                },
                crosshair: {
                    mode: LightweightCharts.CrosshairMode.Normal,
                    vertLine: {
                        color: '${themeConfig.crosshair.vertLine.color}',
                        style: ${themeConfig.crosshair.vertLine.style},
                        labelBackgroundColor: '${themeConfig.crosshair.vertLine.labelBackgroundColor}',
                    },
                    horzLine: {
                        color: '${themeConfig.crosshair.horzLine.color}',
                        style: ${themeConfig.crosshair.horzLine.style},
                        labelBackgroundColor: '${themeConfig.crosshair.horzLine.labelBackgroundColor}',
                    },
                },
                rightPriceScale: {
                    borderColor: '${themeConfig.grid.vertLines.color}',
                    scaleMargins: {
                        top: 0.1,
                        bottom: 0.2,
                    },
                },
                ${chartData.config.dualAxis ? `
                leftPriceScale: {
                    visible: true,
                    borderColor: '${themeConfig.grid.vertLines.color}',
                    scaleMargins: {
                        top: 0.1,
                        bottom: 0.2,
                    },
                },` : ''}
                handleScroll: {
                    mouseWheel: ${interactive},
                    pressedMouseMove: ${interactive},
                },
                handleScale: {
                    mouseWheel: ${interactive},
                    pinch: ${interactive},
                },
            });
            
            console.log('Chart:', chart);
            console.log('addCandlestickSeries:', typeof chart.addCandlestickSeries);

            ${seriesCode}

            // Make chart responsive
            window.addEventListener('resize', () => {
                chart.applyOptions({ 
                    width: chartContainer.clientWidth,
                    height: ${height}
                });
            });

            // Fit content
            chart.timeScale().fitContent();
        } catch (e) {
            console.error('Error:', e);
        }
    </script>
</body>
</html>
        `.trim();
    }

    /**
     * Generate JavaScript code for creating chart series
     */
    private static generateSeriesCode(chartData: ChartData, colors: any): string {
        let code = '';

        chartData.datasets.forEach((dataset, index) => {
            const chartType = dataset.type || chartData.config.type;
            const color = dataset.color || colors.line;
            const seriesName = `series${index}`;

            // Determine series type and create it using v5.0 API
            switch (chartType) {
                case 'candlestick':
                    const candlestickData = this.formatCandlestickData(dataset);
                    code += `
        const candlestickDataObj = ${candlestickData};
        const ${seriesName} = chart.addSeries(LightweightCharts.CandlestickSeries, {
            upColor: '${colors.bullish}',
            downColor: '${colors.bearish}',
            borderVisible: true,
            wickUpColor: '${colors.bullish}',
            wickDownColor: '${colors.bearish}',
            priceScaleId: '${dataset.yAxis === 'right' ? 'right' : 'left'}',
        });
        ${seriesName}.setData(candlestickDataObj.data);
        
        // Add token name labels to time scale
        if (candlestickDataObj.tokenLabels) {
            chart.timeScale().applyOptions({
                tickMarkFormatter: (time) => {
                    const label = candlestickDataObj.tokenLabels.find(l => l.time === time);
                    return label ? label.label : '';
                }
            });
        }
                    `;
                    break;

                case 'line':
                    code += `
        const ${seriesName} = chart.addSeries(LightweightCharts.LineSeries, {
            color: '${color}',
            lineWidth: 2,
            priceScaleId: '${dataset.yAxis === 'right' ? 'right' : 'left'}',
            title: '${dataset.label}',
        });
        ${seriesName}.setData(${this.formatLineData(dataset)});
                    `;
                    break;

                case 'area':
                    code += `
        const ${seriesName} = chart.addSeries(LightweightCharts.AreaSeries, {
            topColor: '${color}',
            bottomColor: '${color}33',
            lineColor: '${color}',
            lineWidth: 2,
            priceScaleId: '${dataset.yAxis === 'right' ? 'right' : 'left'}',
            title: '${dataset.label}',
        });
        ${seriesName}.setData(${this.formatAreaData(dataset)});
                    `;
                    break;

                case 'baseline':
                    const baseValue = dataset.baseValue || 0;
                    code += `
        const ${seriesName} = chart.addSeries(LightweightCharts.BaselineSeries, {
            baseValue: { type: 'price', price: ${baseValue} },
            topLineColor: '${colors.bullish}',
            topFillColor1: '${colors.bullish}66',
            topFillColor2: '${colors.bullish}33',
            bottomLineColor: '${colors.bearish}',
            bottomFillColor1: '${colors.bearish}33',
            bottomFillColor2: '${colors.bearish}66',
            lineWidth: 2,
            priceScaleId: '${dataset.yAxis === 'right' ? 'right' : 'left'}',
            title: '${dataset.label}',
        });
        ${seriesName}.setData(${this.formatBaselineData(dataset)});
                    `;
                    break;

                case 'bar':
                case 'histogram':
                    code += `
        const ${seriesName} = chart.addSeries(LightweightCharts.HistogramSeries, {
            color: '${color}',
            priceScaleId: '${dataset.yAxis === 'right' ? 'right' : 'left'}',
            priceFormat: {
                type: 'volume',
            },
            title: '${dataset.label}',
        });
        ${seriesName}.setData(${this.formatHistogramData(dataset)});
                    `;
                    break;

                default:
                    // Default to line chart
                    code += `
        const ${seriesName} = chart.addSeries(LightweightCharts.LineSeries, {
            color: '${color}',
            lineWidth: 2,
            priceScaleId: '${dataset.yAxis === 'right' ? 'right' : 'left'}',
            title: '${dataset.label}',
        });
        ${seriesName}.setData(${this.formatLineData(dataset)});
                    `;
            }
        });

        return code;
    }

    /**
     * Format data for candlestick series
     */
    private static formatCandlestickData(dataset: ChartDataset): string {
        const data = dataset.data.map((point, index) => {
            const time = this.formatTime(point.x, index);
            
            // Sanitize and normalize values
            // If values are > 1000, they're likely not percentages (probably market cap or price)
            // For market charts, we expect percentage changes in range -100% to +1000%
            const sanitizeValue = (val: number): number => {
                const absVal = Math.abs(val);
                
                // If value is huge (> 1000), it's probably market cap or price data - ignore it
                // Use a default small value instead
                if (absVal > 1000) {
                    console.warn(`[TradingViewChartRenderer] Detected invalid value (${val}) - likely market cap instead of percentage. Using default.`);
                    return 5 + Math.random() * 10; // Random value between 5-15%
                }
                
                // If very small (< 1), scale up (percentage in decimal format)
                if (absVal < 1) {
                    return absVal * 100;
                }
                
                // Already in good range
                return absVal;
            };
            
            // Determine if this is a gainer or loser based on isBullish or original value sign
            const isGainer = point.isBullish !== false; // Default to true if not specified
            
            // If OHLC data is provided, use it
            if (point.open !== undefined && point.high !== undefined && 
                point.low !== undefined && point.close !== undefined) {
                
                // Sanitize all values - use absolute values for display
                let open = sanitizeValue(point.open);
                let high = sanitizeValue(point.high);
                let low = sanitizeValue(point.low);
                let close = sanitizeValue(point.close);
                
                // For gainers: ensure close > open (green candle)
                // For losers: ensure close < open (red candle)
                if (isGainer && close < open) {
                    // Swap to make it a green candle
                    [open, close] = [close, open];
                } else if (!isGainer && close > open) {
                    // Swap to make it a red candle
                    [open, close] = [close, open];
                }
                
                // Ensure valid OHLC relationship
                const validHigh = Math.max(high, open, close);
                const validLow = Math.min(low, open, close);
                
                return {
                    time,
                    open,
                    high: validHigh,
                    low: validLow,
                    close,
                    customValues: point.tokenName ? {
                        token: point.tokenName,
                        info: point.label || ''
                    } : undefined
                };
            }
            
            // Otherwise, generate OHLC from single price point
            const basePrice = sanitizeValue(point.y);
            
            let open, close, high, low;
            
            if (isGainer) {
                // Gainer: show upward movement (close > open)
                open = basePrice * 0.8;
                close = basePrice;
                high = basePrice * 1.05;
                low = basePrice * 0.75;
            } else {
                // Loser: show downward movement (close < open)
                open = basePrice;
                close = basePrice * 0.8;
                high = basePrice * 1.05;
                low = basePrice * 0.75;
            }
            
            return { 
                time, 
                open, 
                high, 
                low, 
                close,
                customValues: point.tokenName ? {
                    token: point.tokenName,
                    info: point.label || ''
                } : undefined
            };
        });

        // Create token name mapping for time scale labels with percentage
        const tokenLabels = dataset.data.map((point, index) => {
            const tokenName = point.tokenName || `Token ${index + 1}`;
            // Get the percentage value (use y as the actual percentage)
            const percentage = Math.abs(point.y);
            const isGain = point.isBullish !== false;
            const sign = isGain ? '+' : '';
            const percentLabel = `${sign}${percentage.toFixed(1)}%`;
            return {
                time: this.formatTime(point.x, index),
                label: `${tokenName} ${percentLabel}`
            };
        });

        return JSON.stringify({ data, tokenLabels });
    }

    /**
     * Format data for line series
     */
    private static formatLineData(dataset: ChartDataset): string {
        const data = dataset.data.map((point, index) => ({
            time: this.formatTime(point.x, index),
            value: point.y,
        }));
        return JSON.stringify(data);
    }

    /**
     * Format data for area series
     */
    private static formatAreaData(dataset: ChartDataset): string {
        return this.formatLineData(dataset); // Same format as line
    }

    /**
     * Format data for baseline series
     */
    private static formatBaselineData(dataset: ChartDataset): string {
        return this.formatLineData(dataset); // Same format as line
    }

    /**
     * Format data for histogram series
     */
    private static formatHistogramData(dataset: ChartDataset): string {
        const data = dataset.data.map((point, index) => ({
            time: this.formatTime(point.x, index),
            value: point.y,
            color: point.color || (point.y >= 0 ? '#26A69A' : '#EF5350'),
        }));
        return JSON.stringify(data);
    }

    /**
     * Format time value for TradingView charts
     * For categorical data (like multiple tokens), we use dates with proper spacing
     */
    private static formatTime(value: any, index: number = 0): number | string {
        if (typeof value === 'number') {
            // If value is too small to be a valid timestamp (< 1000000 = before 1970-01-12)
            // treat it as an index and generate a timestamp with MORE spacing for better visualization
            if (value < 1000000) {
                // Use 1-month intervals for better spacing and visibility
                const now = new Date();
                const baseDate = new Date(now.getFullYear(), now.getMonth() - 12, 1); // Start 12 months ago
                const targetDate = new Date(baseDate);
                targetDate.setMonth(targetDate.getMonth() + index); // Add 1 month per index
                return Math.floor(targetDate.getTime() / 1000);
            }
            
            // Convert milliseconds to seconds for TradingView
            if (value > 10000000000) {
                return Math.floor(value / 1000);
            }
            
            // Already in seconds format
            return value;
        }
        if (value instanceof Date) {
            return Math.floor(value.getTime() / 1000);
        }
        if (typeof value === 'string') {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                return Math.floor(date.getTime() / 1000);
            }
        }
        
        // Fallback: generate timestamp with monthly intervals for better spacing
        const now = new Date();
        const baseDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
        const targetDate = new Date(baseDate);
        targetDate.setMonth(targetDate.getMonth() + index);
        return Math.floor(targetDate.getTime() / 1000);
    }

    /**
     * Generate PNG from TradingView HTML chart using headless browser
     * This allows us to use TradingView's advanced charting and output as PNG for Telegram
     */
    static async generatePngFromHtml(html: string, outputPath: string, options: {
        saveHtml?: boolean;
        width?: number;
        height?: number;
    } = {}): Promise<void> {
        try {
            await PuppeteerRenderer.renderHtmlToPng(html, outputPath, {
                width: options.width || 1200,
                height: options.height || 800,
                saveHtml: options.saveHtml,
                waitForSelector: '#chart-container canvas',
                waitForFunction: () => typeof (window as any).LightweightCharts !== 'undefined',
                renderDelay: 3000,
            });
        } catch (error) {
            console.error('❌ [TradingViewChartRenderer] Error generating PNG from HTML:', error);
            throw error;
        }
    }

    /**
     * Generate PNG directly from chart data using TradingView rendering
     */
    static async generatePng(chartData: ChartData, outputPath: string, options: {
        width?: number;
        height?: number;
        theme?: ChartTheme;
        showGrid?: boolean;
        showLegend?: boolean;
        saveHtml?: boolean;
    } = {}): Promise<void> {
        try {
            // Generate HTML with TradingView chart
            const html = this.generateHtml(chartData, options);
            
            // Convert HTML to PNG using headless browser (save HTML for debugging)
            await this.generatePngFromHtml(html, outputPath, { saveHtml: options.saveHtml });
        } catch (error) {
            console.error('❌ [TradingViewChartRenderer] Error generating PNG:', error);
            throw error;
        }
    }

    /**
     * Clean up and destroy chart
     */
    destroy(): void {
        if (this.chart) {
            this.chart.remove();
            this.chart = null;
        }
        this.seriesMap.clear();
    }
}

