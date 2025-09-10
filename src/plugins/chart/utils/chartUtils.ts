import type { ChartTheme, ChartDataPoint, ChartDataset } from '../interfaces/types';
import type { HistoricalPriceData, TechnicalIndicators } from '../../analytics/interfaces/types';

/**
 * Chart utility functions for data formatting and processing
 */
export class ChartUtils {
    /**
     * Format historical price data into chart data points
     */
    static formatPriceData(historicalData: HistoricalPriceData[]): ChartDataPoint[] {
        return historicalData.map(data => ({
            x: data.timestamp,
            y: data.close,
            label: `$${data.close.toFixed(6)}`,
            metadata: {
                open: data.open,
                high: data.high,
                low: data.low,
                close: data.close,
                volume: data.volume
            }
        }));
    }

    /**
     * Format technical indicators into chart datasets
     */
    static formatTechnicalIndicators(indicators: TechnicalIndicators, timestamps: number[]): ChartDataset[] {
        const datasets: ChartDataset[] = [];
        const colors = this.generateColors(8, 'crypto');

        // RSI
        if (indicators.rsi) {
            datasets.push({
                label: 'RSI',
                data: timestamps.map((timestamp, index) => ({
                    x: timestamp,
                    y: indicators.rsi.value,
                    label: `RSI: ${indicators.rsi.value.toFixed(2)}`
                })),
                color: colors[0],
                borderColor: colors[0]
            });
        }

        // MACD
        if (indicators.macd) {
            datasets.push({
                label: 'MACD',
                data: timestamps.map((timestamp, index) => ({
                    x: timestamp,
                    y: indicators.macd.macd,
                    label: `MACD: ${indicators.macd.macd.toFixed(4)}`
                })),
                color: colors[1],
                borderColor: colors[1]
            });

            datasets.push({
                label: 'MACD Signal',
                data: timestamps.map((timestamp, index) => ({
                    x: timestamp,
                    y: indicators.macd.signal,
                    label: `MACD Signal: ${indicators.macd.signal.toFixed(4)}`
                })),
                color: colors[2],
                borderColor: colors[2]
            });
        }

        // Bollinger Bands
        if (indicators.bollingerBands) {
            datasets.push({
                label: 'BB Upper',
                data: timestamps.map((timestamp, index) => ({
                    x: timestamp,
                    y: indicators.bollingerBands.upper,
                    label: `BB Upper: $${indicators.bollingerBands.upper.toFixed(4)}`
                })),
                color: colors[3],
                borderColor: colors[3]
            });

            datasets.push({
                label: 'BB Middle',
                data: timestamps.map((timestamp, index) => ({
                    x: timestamp,
                    y: indicators.bollingerBands.middle,
                    label: `BB Middle: $${indicators.bollingerBands.middle.toFixed(4)}`
                })),
                color: colors[4],
                borderColor: colors[4]
            });

            datasets.push({
                label: 'BB Lower',
                data: timestamps.map((timestamp, index) => ({
                    x: timestamp,
                    y: indicators.bollingerBands.lower,
                    label: `BB Lower: $${indicators.bollingerBands.lower.toFixed(4)}`
                })),
                color: colors[5],
                borderColor: colors[5]
            });
        }

        return datasets;
    }

    /**
     * Generate colors based on theme
     */
    static generateColors(count: number, theme: ChartTheme): string[] {
        const colorPalettes = {
            light: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'],
            dark: ['#60A5FA', '#F87171', '#34D399', '#FBBF24', '#A78BFA', '#F472B6', '#22D3EE', '#A3E635'],
            crypto: ['#00D4AA', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'],
            minimal: ['#2C3E50', '#E74C3C', '#3498DB', '#F39C12', '#9B59B6', '#1ABC9C', '#34495E', '#E67E22'],
            professional: ['#1F2937', '#DC2626', '#2563EB', '#D97706', '#7C3AED', '#DB2777', '#0891B2', '#059669']
        };

        const palette = colorPalettes[theme] || colorPalettes.crypto;
        const colors: string[] = [];

        for (let i = 0; i < count; i++) {
            colors.push(palette[i % palette.length]);
        }

        return colors;
    }

    /**
     * Calculate optimal chart dimensions
     */
    static calculateChartDimensions(width?: number, height?: number): { width: number; height: number } {
        return {
            width: width || 800,
            height: height || 400
        };
    }

    /**
     * Validate chart data structure
     */
    static validateChartData(data: any): boolean {
        if (!data || typeof data !== 'object') {
            return false;
        }

        if (!data.datasets || !Array.isArray(data.datasets)) {
            return false;
        }

        if (!data.config || typeof data.config !== 'object') {
            return false;
        }

        return true;
    }

    /**
     * Format number for display
     */
    static formatNumber(value: number, decimals: number = 2): string {
        if (value >= 1e9) {
            return (value / 1e9).toFixed(decimals) + 'B';
        } else if (value >= 1e6) {
            return (value / 1e6).toFixed(decimals) + 'M';
        } else if (value >= 1e3) {
            return (value / 1e3).toFixed(decimals) + 'K';
        } else {
            return value.toFixed(decimals);
        }
    }

    /**
     * Format percentage for display
     */
    static formatPercentage(value: number, decimals: number = 2): string {
        return `${value.toFixed(decimals)}%`;
    }

    /**
     * Format price for display
     */
    static formatPrice(value: number, decimals: number = 6): string {
        return `$${value.toFixed(decimals)}`;
    }

    /**
     * Generate chart cache key
     */
    static generateCacheKey(request: any): string {
        const keyParts = [
            request.tokenAddress || '',
            request.walletAddress || '',
            request.chain || 'solana',
            request.timeframe || '1d',
            request.chartType || 'line',
            request.theme || 'crypto'
        ];
        return `chart_${keyParts.join('_')}`;
    }

    /**
     * Calculate chart statistics
     */
    static calculateChartStats(dataPoints: ChartDataPoint[]): {
        min: number;
        max: number;
        avg: number;
        count: number;
    } {
        if (dataPoints.length === 0) {
            return { min: 0, max: 0, avg: 0, count: 0 };
        }

        const values = dataPoints.map(point => point.y);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((sum, value) => sum + value, 0) / values.length;

        return {
            min,
            max,
            avg,
            count: dataPoints.length
        };
    }
}
