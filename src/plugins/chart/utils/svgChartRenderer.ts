import type { 
    ChartData, 
    ChartDataset, 
    ChartDataPoint, 
    ChartConfig, 
    ChartType,
    ChartTheme 
} from '../interfaces/types';

/**
 * SVG Chart Renderer
 * Converts chart data into actual SVG visualizations
 */
export class SvgChartRenderer {
    private static readonly MARGIN = { top: 120, right: 100, bottom: 120, left: 100 };
    private static readonly COLORS = {
        light: ['#2962FF', '#FF6B6B', '#26A69A', '#FFA726', '#AB47BC', '#EC407A', '#26C6DA', '#66BB6A'],
        dark: ['#2962FF', '#FF6B6B', '#26A69A', '#FFA726', '#AB47BC', '#EC407A', '#26C6DA', '#66BB6A'],
        crypto: ['#00D4AA', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'],
        minimal: ['#2C3E50', '#E74C3C', '#3498DB', '#F39C12', '#9B59B6', '#1ABC9C', '#34495E', '#E67E22'],
        professional: ['#2962FF', '#FF6B6B', '#26A69A', '#FFA726', '#AB47BC', '#EC407A', '#26C6DA', '#66BB6A'],
        tradingview: ['#2962FF', '#FF6B6B', '#26A69A', '#FFA726', '#AB47BC', '#EC407A', '#26C6DA', '#66BB6A']
    };

    private static readonly TRADINGVIEW_THEMES = {
        light: {
            background: '#FFFFFF',
            grid: '#E1E3E6',
            text: '#131722',
            axis: '#787B86',
            candleUp: '#26A69A',
            candleDown: '#EF5350',
            volumeUp: '#26A69A',
            volumeDown: '#EF5350',
            line: '#2962FF',
            area: '#2962FF'
        },
        dark: {
            background: '#131722',
            grid: '#2A2E39',
            text: '#D1D4DC',
            axis: '#787B86',
            candleUp: '#26A69A',
            candleDown: '#EF5350',
            volumeUp: '#26A69A',
            volumeDown: '#EF5350',
            line: '#2962FF',
            area: '#2962FF'
        },
        crypto: {
            background: '#0D1117',
            grid: '#21262D',
            text: '#F0F6FC',
            axis: '#7D8590',
            candleUp: '#00D4AA',
            candleDown: '#FF6B6B',
            volumeUp: '#00D4AA',
            volumeDown: '#FF6B6B',
            line: '#00D4AA',
            area: '#00D4AA'
        }
    };

    /**
     * Generate SVG chart from chart data
     */
    static generateSvg(chartData: ChartData, options: {
        width?: number;
        height?: number;
        theme?: ChartTheme;
        showGrid?: boolean;
        showLegend?: boolean;
        showTooltips?: boolean;
    } = {}): string {
        const {
            width = chartData.config.width || 800,
            height = chartData.config.height || 400,
            theme = chartData.config.theme || 'crypto',
            showGrid = chartData.config.showGrid ?? true,
            showLegend = chartData.config.showLegend ?? true,
            showTooltips = chartData.config.showTooltip ?? true
        } = options;

        const chartWidth = width - this.MARGIN.left - this.MARGIN.right;
        const chartHeight = height - this.MARGIN.top - this.MARGIN.bottom;

        // Calculate scales
        const scales = this.calculateScales(chartData, chartWidth, chartHeight);
        
        // Generate SVG content
        const svgContent = this.generateSvgContent(chartData, scales, {
            chartWidth,
            chartHeight,
            theme,
            showGrid,
            showLegend,
            showTooltips
        });

        return this.wrapSvg(svgContent, width, height, theme);
    }

    /**
     * Calculate chart scales based on data (supports dual Y-axes)
     */
    private static calculateScales(chartData: ChartData, chartWidth: number, chartHeight: number) {
        const allDataPoints = chartData.datasets.flatMap(dataset => dataset.data);
        
        if (allDataPoints.length === 0) {
            return {
                x: { min: 0, max: 100, range: 100 },
                y: { min: 0, max: 100, range: 100 },
                yLeft: { min: 0, max: 100, range: 100 },
                yRight: { min: 0, max: 100, range: 100 }
            };
        }

        // X-axis scale
        const xValues = allDataPoints.map(point => {
            if (typeof point.x === 'number') return point.x;
            if (point.x instanceof Date) return point.x.getTime();
            return 0;
        });
        const xMin = Math.min(...xValues);
        const xMax = Math.max(...xValues);
        const xRange = xMax - xMin || 100;

        // Check if this is a dual-axis chart
        const isDualAxis = chartData.config.dualAxis;
        
        if (isDualAxis) {
            // Separate scales for left and right Y-axes
            const leftAxisPoints = allDataPoints.filter(point => (point as any).yAxis === 'left');
            const rightAxisPoints = allDataPoints.filter(point => (point as any).yAxis === 'right');
            
            // Left Y-axis scale (gainers)
            let yLeft = { min: 0, max: 100, range: 100 };
            if (leftAxisPoints.length > 0) {
                const leftValues = leftAxisPoints.map(point => point.y);
                const leftMin = Math.min(...leftValues);
                const leftMax = Math.max(...leftValues);
                const leftPadding = Math.max(0.1, (leftMax - leftMin) * 0.1);
                yLeft = {
                    min: leftMin - leftPadding,
                    max: leftMax + leftPadding,
                    range: (leftMax + leftPadding) - (leftMin - leftPadding) || 100
                };
            }
            
            // Right Y-axis scale (losers)
            let yRight = { min: 0, max: 100, range: 100 };
            if (rightAxisPoints.length > 0) {
                const rightValues = rightAxisPoints.map(point => point.y);
                const rightMin = Math.min(...rightValues);
                const rightMax = Math.max(...rightValues);
                const rightPadding = Math.max(0.1, (rightMax - rightMin) * 0.1);
                yRight = {
                    min: rightMin - rightPadding,
                    max: rightMax + rightPadding,
                    range: (rightMax + rightPadding) - (rightMin - rightPadding) || 100
                };
            }
            
            return {
                x: { min: xMin, max: xMax, range: xRange },
                y: yLeft, // Default to left axis for backward compatibility
                yLeft,
                yRight
            };
        } else {
            // Single Y-axis scale with padding for better visualization
            const yValues = allDataPoints.map(point => point.y);
            const yMin = Math.min(...yValues);
            const yMax = Math.max(...yValues);
            const yPadding = Math.max(0.15, (yMax - yMin) * 0.15); // 15% padding for more space
            const yMinPadded = yMin - yPadding;
            const yMaxPadded = yMax + yPadding;
            const yRange = yMaxPadded - yMinPadded || 100;

            return {
                x: { min: xMin, max: xMax, range: xRange },
                y: { min: yMinPadded, max: yMaxPadded, range: yRange }
            };
        }
    }

    /**
     * Generate the main SVG content
     */
    private static generateSvgContent(
        chartData: ChartData, 
        scales: any, 
        options: any
    ): string {
        const { chartWidth, chartHeight, theme, showGrid, showLegend } = options;
        
        let content = '';

        // Add chart title
        content += this.generateChartTitle(chartData, chartWidth, theme);

        // Add grid if enabled
        if (showGrid) {
            content += this.generateGrid(scales, chartWidth, chartHeight, theme);
        }

        // Add chart elements based on type
        content += this.generateChartElements(chartData, scales, chartWidth, chartHeight, theme);

        // Add axes
        content += this.generateAxes(scales, chartWidth, chartHeight, theme, chartData);

        // Add axis labels
        content += this.generateAxisLabels(chartData, chartWidth, chartHeight, theme);

        // Add legend if enabled
        if (showLegend) {
            content += this.generateLegend(chartData, chartWidth, chartHeight, theme);
        }

        return content;
    }

    /**
     * Generate chart title (TradingView style)
     */
    private static generateChartTitle(chartData: ChartData, chartWidth: number, theme: ChartTheme): string {
        const title = chartData.config.title || 'Market Chart';
        const themeColors = this.TRADINGVIEW_THEMES[theme] || this.TRADINGVIEW_THEMES.crypto;
        const textColor = themeColors.text;
        
        return `
            <text 
                x="${chartWidth / 2}" 
                y="-25" 
                text-anchor="middle" 
                fill="${textColor}" 
                class="chart-title"
            >
                ${title}
            </text>
        `;
    }

    /**
     * Generate axis labels (TradingView style) - supports dual Y-axes
     */
    private static generateAxisLabels(chartData: ChartData, chartWidth: number, chartHeight: number, theme: ChartTheme): string {
        const themeColors = this.TRADINGVIEW_THEMES[theme] || this.TRADINGVIEW_THEMES.crypto;
        const textColor = themeColors.text;
        const xAxisLabel = chartData.config.xAxisLabel || 'Time';
        const yAxisLabel = chartData.config.yAxisLabel || 'Price';
        const yAxisLeftLabel = chartData.config.yAxisLeftLabel || 'Gainers (%)';
        const yAxisRightLabel = chartData.config.yAxisRightLabel || 'Losers (%)';
        const isDualAxis = chartData.config.dualAxis;
        
        let labels = `
            <!-- X-axis label -->
            <text 
                x="${chartWidth / 2}" 
                y="${chartHeight + 50}" 
                text-anchor="middle" 
                fill="${textColor}" 
                class="axis-label"
            >
                ${xAxisLabel}
            </text>
        `;
        
        if (isDualAxis) {
            // Dual Y-axis labels
            labels += `
                <!-- Left Y-axis label -->
                <text 
                    x="-50" 
                    y="${chartHeight / 2}" 
                    text-anchor="middle" 
                    fill="${textColor}" 
                    class="axis-label"
                    transform="rotate(-90, -50, ${chartHeight / 2})"
                >
                    ${yAxisLeftLabel}
                </text>
                
                <!-- Right Y-axis label -->
                <text 
                    x="${chartWidth + 50}" 
                    y="${chartHeight / 2}" 
                    text-anchor="middle" 
                    fill="${textColor}" 
                    class="axis-label"
                    transform="rotate(90, ${chartWidth + 50}, ${chartHeight / 2})"
                >
                    ${yAxisRightLabel}
                </text>
            `;
        } else {
            // Single Y-axis label
            labels += `
                <!-- Y-axis label -->
                <text 
                    x="-50" 
                    y="${chartHeight / 2}" 
                    text-anchor="middle" 
                    fill="${textColor}" 
                    class="axis-label"
                    transform="rotate(-90, -50, ${chartHeight / 2})"
                >
                    ${yAxisLabel}
                </text>
            `;
        }
        
        return labels;
    }

    /**
     * Generate grid lines (TradingView style)
     */
    private static generateGrid(scales: any, chartWidth: number, chartHeight: number, theme: ChartTheme): string {
        const themeColors = this.TRADINGVIEW_THEMES[theme] || this.TRADINGVIEW_THEMES.crypto;
        const gridColor = themeColors.grid;
        let grid = '';

        // Vertical grid lines (time-based)
        const xSteps = 8; // More grid lines for better precision
        for (let i = 0; i <= xSteps; i++) {
            const x = (i / xSteps) * chartWidth;
            const opacity = i % 2 === 0 ? 0.4 : 0.2; // Alternating opacity
            grid += `<line x1="${x}" y1="0" x2="${x}" y2="${chartHeight}" stroke="${gridColor}" stroke-width="0.8" opacity="${opacity}"/>`;
        }

        // Horizontal grid lines (price-based)
        const ySteps = 8; // More horizontal lines for price precision
        for (let i = 0; i <= ySteps; i++) {
            const y = (i / ySteps) * chartHeight;
            const opacity = i % 2 === 0 ? 0.4 : 0.2; // Alternating opacity
            grid += `<line x1="0" y1="${y}" x2="${chartWidth}" y2="${y}" stroke="${gridColor}" stroke-width="0.8" opacity="${opacity}"/>`;
        }

        // Add center lines for better reference
        const centerX = chartWidth / 2;
        const centerY = chartHeight / 2;
        grid += `<line x1="${centerX}" y1="0" x2="${centerX}" y2="${chartHeight}" stroke="${gridColor}" stroke-width="1.2" opacity="0.3"/>`;
        grid += `<line x1="0" y1="${centerY}" x2="${chartWidth}" y2="${centerY}" stroke="${gridColor}" stroke-width="1.2" opacity="0.3"/>`;

        return grid;
    }

    /**
     * Generate chart elements based on chart type
     */
    private static generateChartElements(
        chartData: ChartData, 
        scales: any, 
        chartWidth: number, 
        chartHeight: number, 
        theme: ChartTheme
    ): string {
        let elements = '';

        chartData.datasets.forEach((dataset, datasetIndex) => {
            const color = dataset.color || this.COLORS[theme][datasetIndex % this.COLORS[theme].length];
            
            switch (dataset.type || chartData.config.type) {
                case 'line':
                    elements += this.generateLineChart(dataset, scales, chartWidth, chartHeight, color);
                    break;
                case 'bar':
                    elements += this.generateBarChart(dataset, scales, chartWidth, chartHeight, color);
                    break;
                case 'pie':
                    elements += this.generatePieChart(dataset, chartWidth, chartHeight, color);
                    break;
                case 'candlestick':
                    elements += this.generateCandlestickChart(dataset, scales, chartWidth, chartHeight, color);
                    break;
                case 'area':
                    elements += this.generateAreaChart(dataset, scales, chartWidth, chartHeight, color);
                    break;
                case 'baseline':
                    elements += this.generateBaselineChart(dataset, scales, chartWidth, chartHeight, color);
                    break;
                case 'histogram':
                    elements += this.generateHistogramChart(dataset, scales, chartWidth, chartHeight, color);
                    break;
                default:
                    elements += this.generateLineChart(dataset, scales, chartWidth, chartHeight, color);
            }
        });

        return elements;
    }

    /**
     * Generate line chart
     */
    private static generateLineChart(
        dataset: ChartDataset, 
        scales: any, 
        chartWidth: number, 
        chartHeight: number, 
        color: string
    ): string {
        if (dataset.data.length < 2) return '';

        const points = dataset.data.map(point => {
            const x = this.scaleX(point.x, scales.x, chartWidth);
            const y = this.scaleY(point.y, scales.y, chartHeight);
            return `${x},${y}`;
        }).join(' ');

        return `
            <polyline 
                points="${points}" 
                fill="none" 
                stroke="${color}" 
                stroke-width="2" 
                opacity="0.8"
            />
            ${dataset.data.map(point => {
                const x = this.scaleX(point.x, scales.x, chartWidth);
                const y = this.scaleY(point.y, scales.y, chartHeight);
                return `<circle cx="${x}" cy="${y}" r="3" fill="${color}" opacity="0.9"/>`;
            }).join('')}
        `;
    }

    /**
     * Generate bar chart (supports grouped bars)
     */
    private static generateBarChart(
        dataset: ChartDataset, 
        scales: any, 
        chartWidth: number, 
        chartHeight: number, 
        color: string
    ): string {
        // Calculate bar width based on whether this is a grouped chart
        const isGrouped = dataset.data.some(point => (point as any).groupIndex !== undefined);
        const barWidth = isGrouped ? 
            Math.max(20, chartWidth / (dataset.data.length * 2) * 0.8) : // Smaller bars for grouped
            Math.max(25, chartWidth / dataset.data.length * 0.6); // Regular bars
        
        let bars = '';

        dataset.data.forEach((point, index) => {
            const x = this.scaleX(point.x, scales.x, chartWidth) - barWidth / 2;
            
            // Use appropriate Y-axis scale based on the point's axis
            const pointAxis = (point as any).yAxis;
            const yScale = pointAxis === 'right' ? scales.yRight : scales.yLeft || scales.y;
            const y = this.scaleY(point.y, yScale, chartHeight);
            const height = Math.max(1, chartHeight - y);
            
            // Use different colors for positive/negative values
            const barColor = point.y >= 0 ? color : '#FF6B6B';
            const opacity = point.y >= 0 ? '0.85' : '0.75';
            
            // Add gradient effect
            const gradientId = `gradient-${index}`;
            bars += `
                <defs>
                    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:${barColor};stop-opacity:1" />
                        <stop offset="100%" style="stop-color:${barColor};stop-opacity:0.7" />
                    </linearGradient>
                </defs>
                <rect 
                    x="${x}" 
                    y="${y}" 
                    width="${barWidth}" 
                    height="${height}" 
                    fill="url(#${gradientId})" 
                    stroke="${barColor}" 
                    stroke-width="1.5"
                    opacity="${opacity}"
                    rx="2"
                    ry="2"
                />
            `;
            
            // Add token name at the bottom of the bar (only for the first bar in each group)
            const tokenName = (point as any).tokenName || `Token ${index + 1}`;
            const groupIndex = (point as any).groupIndex;
            const isFirstInGroup = groupIndex === 0 || !isGrouped || (point as any).isGainer;
            
            if (isFirstInGroup) {
                const tokenNameY = chartHeight + 15;
                const tokenNameX = isGrouped ? 
                    this.scaleX(groupIndex * 2 + 0.5, scales.x, chartWidth) : // Center of group
                    x + barWidth / 2; // Center of single bar
                
                bars += `
                    <text 
                        x="${tokenNameX}" 
                        y="${tokenNameY}" 
                        text-anchor="middle" 
                        fill="#7D8590" 
                        font-size="10" 
                        font-weight="500"
                        class="chart-text"
                    >
                        ${tokenName}
                    </text>
                `;
            }
            
            // Add value labels on top of bars with better positioning
            if (Math.abs(point.y) > 0.1) { // Only show labels for significant values
                const labelY = Math.max(25, y - 12); // More space above bars
                
                // For losers on right axis, show the original negative value
                const displayValue = pointAxis === 'right' ? (point as any).originalValue : point.y;
                const labelText = displayValue > 0 ? `+${displayValue.toFixed(2)}%` : `${displayValue.toFixed(2)}%`;
                const textColor = displayValue >= 0 ? '#00D4AA' : '#FF6B6B';
                
                bars += `
                    <text 
                        x="${x + barWidth / 2}" 
                        y="${labelY}" 
                        text-anchor="middle" 
                        fill="${textColor}" 
                        font-size="9" 
                        font-weight="600"
                        class="chart-text"
                    >
                        ${labelText}
                    </text>
                `;
            }
        });

        return bars;
    }

    /**
     * Generate pie chart
     */
    private static generatePieChart(
        dataset: ChartDataset, 
        chartWidth: number, 
        chartHeight: number, 
        color: string
    ): string {
        const centerX = chartWidth / 2;
        const centerY = chartHeight / 2;
        const radius = Math.min(chartWidth, chartHeight) / 3;
        
        let pie = '';
        const total = dataset.data.reduce((sum, point) => sum + point.y, 0);
        let currentAngle = 0;

        dataset.data.forEach((point, index) => {
            const sliceAngle = (point.y / total) * 2 * Math.PI;
            const endAngle = currentAngle + sliceAngle;
            
            const x1 = centerX + radius * Math.cos(currentAngle);
            const y1 = centerY + radius * Math.sin(currentAngle);
            const x2 = centerX + radius * Math.cos(endAngle);
            const y2 = centerY + radius * Math.sin(endAngle);
            
            const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
            
            const sliceColor = this.COLORS.crypto[index % this.COLORS.crypto.length];
            
            pie += `
                <path 
                    d="M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z" 
                    fill="${sliceColor}" 
                    opacity="0.8"
                />
            `;
            
            currentAngle = endAngle;
        });

        return pie;
    }

    /**
     * Generate candlestick chart (TradingView style)
     */
    private static generateCandlestickChart(
        dataset: ChartDataset, 
        scales: any, 
        chartWidth: number, 
        chartHeight: number, 
        color: string
    ): string {
        if (dataset.data.length === 0) return '';

        const themeColors = this.TRADINGVIEW_THEMES.crypto; // Default to crypto theme
        const upColor = themeColors.candleUp;
        const downColor = themeColors.candleDown;
        
        let candles = '';
        const barWidth = Math.max(4, chartWidth / dataset.data.length * 0.8);
        const wickWidth = 1;

        dataset.data.forEach((point, index) => {
            const x = this.scaleX(point.x, scales.x, chartWidth);
            const centerX = x - barWidth / 2;
            
            // For simplified data, create OHLC from single price point
            const price = point.y;
            const volatility = price * 0.02; // 2% volatility
            const open = price + (Math.random() - 0.5) * volatility;
            const high = Math.max(price, open) + Math.random() * volatility;
            const low = Math.min(price, open) - Math.random() * volatility;
            const close = price;
            
            const isUp = close >= open;
            const candleColor = isUp ? upColor : downColor;
            const wickColor = isUp ? upColor : downColor;
            
            // Scale OHLC values
            const openY = this.scaleY(open, scales.y, chartHeight);
            const highY = this.scaleY(high, scales.y, chartHeight);
            const lowY = this.scaleY(low, scales.y, chartHeight);
            const closeY = this.scaleY(close, scales.y, chartHeight);
            
            const candleTop = Math.min(openY, closeY);
            const candleBottom = Math.max(openY, closeY);
            const candleHeight = Math.max(1, candleBottom - candleTop);
            
            // High wick
            candles += `<line x1="${x}" y1="${highY}" x2="${x}" y2="${candleTop}" stroke="${wickColor}" stroke-width="${wickWidth}"/>`;
            
            // Low wick
            candles += `<line x1="${x}" y1="${candleBottom}" x2="${x}" y2="${lowY}" stroke="${wickColor}" stroke-width="${wickWidth}"/>`;
            
            // Candle body
            if (isUp) {
                // Hollow candle for up movement
                candles += `<rect x="${centerX}" y="${candleTop}" width="${barWidth}" height="${candleHeight}" fill="none" stroke="${candleColor}" stroke-width="1"/>`;
            } else {
                // Filled candle for down movement
                candles += `<rect x="${centerX}" y="${candleTop}" width="${barWidth}" height="${candleHeight}" fill="${candleColor}" stroke="${candleColor}" stroke-width="1"/>`;
            }
        });

        return candles;
    }

    /**
     * Generate area chart (TradingView style)
     */
    private static generateAreaChart(
        dataset: ChartDataset, 
        scales: any, 
        chartWidth: number, 
        chartHeight: number, 
        color: string
    ): string {
        if (dataset.data.length < 2) return '';

        const themeColors = this.TRADINGVIEW_THEMES.crypto;
        const lineColor = color || themeColors.area;
        const fillColor = lineColor + '40'; // 25% opacity
        
        // Create path for area
        let pathData = '';
        let linePath = '';
        
        dataset.data.forEach((point, index) => {
            const x = this.scaleX(point.x, scales.x, chartWidth);
            const y = this.scaleY(point.y, scales.y, chartHeight);
            
            if (index === 0) {
                pathData += `M ${x} ${chartHeight} L ${x} ${y}`;
                linePath += `M ${x} ${y}`;
            } else {
                pathData += ` L ${x} ${y}`;
                linePath += ` L ${x} ${y}`;
            }
        });
        
        // Close the area path
        const lastX = this.scaleX(dataset.data[dataset.data.length - 1].x, scales.x, chartWidth);
        pathData += ` L ${lastX} ${chartHeight} Z`;

        return `
            <path d="${pathData}" fill="${fillColor}" stroke="none"/>
            <path d="${linePath}" fill="none" stroke="${lineColor}" stroke-width="2"/>
        `;
    }

    /**
     * Generate baseline chart (TradingView style)
     */
    private static generateBaselineChart(
        dataset: ChartDataset, 
        scales: any, 
        chartWidth: number, 
        chartHeight: number, 
        color: string
    ): string {
        if (dataset.data.length < 2) return '';

        const themeColors = this.TRADINGVIEW_THEMES.crypto;
        const baseValue = dataset.baseValue || (scales.y.min + scales.y.max) / 2;
        const baseY = this.scaleY(baseValue, scales.y, chartHeight);
        
        const topColor = color || themeColors.line;
        const bottomColor = '#FF6B6B';
        const topFill1 = topColor + '40';
        const topFill2 = topColor + '10';
        const bottomFill1 = bottomColor + '10';
        const bottomFill2 = bottomColor + '40';
        
        // Create paths for above and below baseline
        let topPath = '';
        let bottomPath = '';
        let linePath = '';
        
        dataset.data.forEach((point, index) => {
            const x = this.scaleX(point.x, scales.x, chartWidth);
            const y = this.scaleY(point.y, scales.y, chartHeight);
            
            if (index === 0) {
                topPath += `M ${x} ${baseY} L ${x} ${Math.min(y, baseY)}`;
                bottomPath += `M ${x} ${baseY} L ${x} ${Math.max(y, baseY)}`;
                linePath += `M ${x} ${y}`;
            } else {
                if (point.y >= baseValue) {
                    topPath += ` L ${x} ${y}`;
                } else {
                    bottomPath += ` L ${x} ${y}`;
                }
                linePath += ` L ${x} ${y}`;
            }
        });
        
        // Close paths
        const lastX = this.scaleX(dataset.data[dataset.data.length - 1].x, scales.x, chartWidth);
        topPath += ` L ${lastX} ${baseY} Z`;
        bottomPath += ` L ${lastX} ${baseY} Z`;

        return `
            <defs>
                <linearGradient id="topGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:${topFill1}"/>
                    <stop offset="100%" style="stop-color:${topFill2}"/>
                </linearGradient>
                <linearGradient id="bottomGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:${bottomFill1}"/>
                    <stop offset="100%" style="stop-color:${bottomFill2}"/>
                </linearGradient>
            </defs>
            <path d="${topPath}" fill="url(#topGradient)" stroke="none"/>
            <path d="${bottomPath}" fill="url(#bottomGradient)" stroke="none"/>
            <line x1="0" y1="${baseY}" x2="${chartWidth}" y2="${baseY}" stroke="${themeColors.axis}" stroke-width="1" opacity="0.5"/>
            <path d="${linePath}" fill="none" stroke="${topColor}" stroke-width="2"/>
        `;
    }

    /**
     * Generate histogram chart (TradingView style)
     */
    private static generateHistogramChart(
        dataset: ChartDataset, 
        scales: any, 
        chartWidth: number, 
        chartHeight: number, 
        color: string
    ): string {
        if (dataset.data.length === 0) return '';

        const themeColors = this.TRADINGVIEW_THEMES.crypto;
        const barColor = color || themeColors.line;
        let histogram = '';

        dataset.data.forEach((point, index) => {
            const x = this.scaleX(point.x, scales.x, chartWidth);
            const y = this.scaleY(point.y, scales.y, chartHeight);
            const barWidth = Math.max(2, chartWidth / dataset.data.length * 0.8);
            const height = chartHeight - y;
            
            // Use different colors for positive/negative values
            const isPositive = point.y >= 0;
            const currentColor = isPositive ? barColor : '#FF6B6B';
            
            histogram += `
                <rect 
                    x="${x - barWidth / 2}" 
                    y="${y}" 
                    width="${barWidth}" 
                    height="${height}" 
                    fill="${currentColor}" 
                    opacity="0.8"
                />
            `;
        });

        return histogram;
    }

    /**
     * Generate axes (TradingView style) - supports dual Y-axes
     */
    private static generateAxes(scales: any, chartWidth: number, chartHeight: number, theme: ChartTheme, chartData?: ChartData): string {
        const themeColors = this.TRADINGVIEW_THEMES[theme] || this.TRADINGVIEW_THEMES.crypto;
        const axisColor = themeColors.axis;
        const textColor = themeColors.text;
        const isDualAxis = chartData?.config.dualAxis;
        
        let axes = `
            <!-- X-axis -->
            <line x1="0" y1="${chartHeight}" x2="${chartWidth}" y2="${chartHeight}" stroke="${axisColor}" stroke-width="1"/>
            
            <!-- Left Y-axis -->
            <line x1="0" y1="0" x2="0" y2="${chartHeight}" stroke="${axisColor}" stroke-width="1"/>
        `;
        
        if (isDualAxis) {
            // Add right Y-axis for dual-axis charts
            axes += `
                <!-- Right Y-axis -->
                <line x1="${chartWidth}" y1="0" x2="${chartWidth}" y2="${chartHeight}" stroke="${axisColor}" stroke-width="1"/>
            `;
        }
        
        axes += `
            <!-- X-axis labels -->
            ${this.generateAxisTickLabels(scales.x, chartWidth, chartHeight, 'x', textColor)}
            
            <!-- Left Y-axis labels -->
            ${this.generateAxisTickLabels(scales.yLeft || scales.y, chartWidth, chartHeight, 'y', textColor)}
        `;
        
        if (isDualAxis && scales.yRight) {
            // Add right Y-axis labels
            axes += `
                <!-- Right Y-axis labels -->
                ${this.generateAxisTickLabels(scales.yRight, chartWidth, chartHeight, 'y', textColor, true)}
            `;
        }
        
        return axes;
    }


    /**
     * Generate legend
     */
    private static generateLegend(chartData: ChartData, chartWidth: number, chartHeight: number, theme: ChartTheme): string {
        const themeColors = this.TRADINGVIEW_THEMES[theme] || this.TRADINGVIEW_THEMES.crypto;
        const textColor = themeColors.text;
        const bgColor = themeColors.background;
        const borderColor = themeColors.grid;
        
        // Position legend inside the chart area, top-right
        const legendX = chartWidth - 160;
        const legendY = 20;
        const itemHeight = 20;
        const legendWidth = 140;
        
        let legend = '';
        
        // Add legend background with better styling
        const legendHeight = chartData.datasets.length * itemHeight + 20;
        legend += `
            <rect 
                x="${legendX - 10}" 
                y="${legendY - 10}" 
                width="${legendWidth}" 
                height="${legendHeight}" 
                fill="${bgColor}" 
                opacity="0.95" 
                stroke="${borderColor}" 
                stroke-width="1" 
                rx="8"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
            />
        `;
        
            // Add legend title
            legend += `
                <text 
                    x="${legendX + legendWidth/2}" 
                    y="${legendY + 5}" 
                    text-anchor="middle" 
                    fill="${textColor}" 
                    font-size="11" 
                    font-weight="600"
                >
                    Legend
                </text>
            `;
        
        chartData.datasets.forEach((dataset, index) => {
            const color = dataset.color || this.COLORS[theme][index % this.COLORS[theme].length];
            const y = legendY + 20 + index * itemHeight;
            
            // Create a more prominent legend item
            legend += `
                <rect 
                    x="${legendX + 5}" 
                    y="${y - 7}" 
                    width="14" 
                    height="14" 
                    fill="${color}" 
                    opacity="0.9"
                    stroke="${color}"
                    stroke-width="1.5"
                    rx="2"
                />
                <text 
                    x="${legendX + 28}" 
                    y="${y}" 
                    fill="${textColor}" 
                    font-size="10" 
                    font-weight="500"
                >
                    ${dataset.label}
                </text>
            `;
        });
        
        // Add grouped bar explanation if this is a grouped chart
        const isGrouped = chartData.config.isGrouped;
        if (isGrouped) {
            const explanationY = legendY + 20 + chartData.datasets.length * itemHeight + 10;
            legend += `
                <text 
                    x="${legendX + legendWidth/2}" 
                    y="${explanationY}" 
                    text-anchor="middle" 
                    fill="${textColor}" 
                    font-size="9" 
                    font-weight="400"
                    opacity="0.8"
                >
                    Side-by-side comparison
                </text>
            `;
        }
        
        return legend;
    }

    /**
     * Scale X value to chart coordinates
     */
    private static scaleX(value: any, scale: any, chartWidth: number): number {
        if (typeof value === 'number') {
            return ((value - scale.min) / scale.range) * chartWidth;
        }
        if (value instanceof Date) {
            return ((value.getTime() - scale.min) / scale.range) * chartWidth;
        }
        return 0;
    }

    /**
     * Scale Y value to chart coordinates
     */
    private static scaleY(value: number, scale: any, chartHeight: number): number {
        return chartHeight - ((value - scale.min) / scale.range) * chartHeight;
    }

    /**
     * Generate axis tick labels (TradingView style) - supports right Y-axis
     */
    private static generateAxisTickLabels(scale: any, chartWidth: number, chartHeight: number, axis: 'x' | 'y', color: string, isRightAxis: boolean = false): string {
        const steps = axis === 'x' ? 6 : 8; // More steps for better precision
        let labels = '';

        for (let i = 0; i <= steps; i++) {
            const value = scale.min + (i / steps) * scale.range;
            const formattedValue = this.formatAxisValue(value, axis);
            
            if (axis === 'x') {
                const x = (i / steps) * chartWidth;
                // Add tick marks
                labels += `<line x1="${x}" y1="${chartHeight}" x2="${x}" y2="${chartHeight + 6}" stroke="${color}" stroke-width="1.5"/>`;
                labels += `<text x="${x}" y="${chartHeight + 22}" text-anchor="middle" fill="${color}" class="chart-text" font-size="11">${formattedValue}</text>`;
            } else {
                const y = chartHeight - (i / steps) * chartHeight;
                if (isRightAxis) {
                    // Right Y-axis tick marks and labels
                    labels += `<line x1="${chartWidth}" y1="${y}" x2="${chartWidth + 6}" y2="${y}" stroke="${color}" stroke-width="1.5"/>`;
                    labels += `<text x="${chartWidth + 10}" y="${y + 4}" text-anchor="start" fill="${color}" class="chart-text" font-size="11">${formattedValue}</text>`;
                } else {
                    // Left Y-axis tick marks and labels
                    labels += `<line x1="0" y1="${y}" x2="-6" y2="${y}" stroke="${color}" stroke-width="1.5"/>`;
                    labels += `<text x="-10" y="${y + 4}" text-anchor="end" fill="${color}" class="chart-text" font-size="11">${formattedValue}</text>`;
                }
            }
        }

        return labels;
    }

    /**
     * Format axis value for display (TradingView style)
     */
    private static formatAxisValue(value: number, axis: 'x' | 'y'): string {
        if (axis === 'x') {
            // For timestamps, show time/date
            if (value > 1000000000000) { // Unix timestamp in milliseconds
                const date = new Date(value);
                const now = new Date();
                const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
                
                if (diffHours < 24) {
                    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                } else if (diffHours < 168) { // Less than a week
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                } else {
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
                }
            }
            // For numerical X-axis values, limit to 2 decimal places
            return value.toFixed(2);
        }
        
        // For Y-axis (price values), format like TradingView
        if (Math.abs(value) >= 1e9) {
            return (value / 1e9).toFixed(2) + 'B';
        } else if (Math.abs(value) >= 1e6) {
            return (value / 1e6).toFixed(2) + 'M';
        } else if (Math.abs(value) >= 1e3) {
            return (value / 1e3).toFixed(2) + 'K';
        } else if (Math.abs(value) >= 1) {
            return value.toFixed(2);
        } else if (Math.abs(value) >= 0.01) {
            return value.toFixed(4);
        } else {
            return value.toFixed(6);
        }
    }

    /**
     * Wrap SVG content in SVG element (TradingView style)
     */
    private static wrapSvg(content: string, width: number, height: number, theme: ChartTheme): string {
        const themeColors = this.TRADINGVIEW_THEMES[theme] || this.TRADINGVIEW_THEMES.crypto;
        const backgroundColor = themeColors.background;
        const textColor = themeColors.text;
        
        return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <style>
            .chart-text { 
                font-family: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', Arial, sans-serif; 
                font-size: 12px;
                font-weight: 400;
            }
            .chart-title { 
                font-family: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', Arial, sans-serif; 
                font-size: 18px;
                font-weight: 700;
                letter-spacing: -0.025em;
            }
            .axis-label { 
                font-family: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', Arial, sans-serif; 
                font-size: 12px;
                font-weight: 600;
                letter-spacing: 0.025em;
            }
        </style>
        <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.1)"/>
        </filter>
    </defs>
    <rect width="${width}" height="${height}" fill="${backgroundColor}"/>
    <g transform="translate(${this.MARGIN.left}, ${this.MARGIN.top})" class="chart-text">
        ${content}
    </g>
</svg>`;
    }
}
