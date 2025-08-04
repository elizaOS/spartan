import type { IAgentRuntime } from '@elizaos/core';
import type {
    TokenPriceData,
    HistoricalPriceData,
    MarketAnalytics,
    AccountAnalytics
} from '../interfaces/types';

/**
 * TAAPI Data Provider
 * Integrates with TAAPI.IO for comprehensive technical indicators
 * Supports 208+ indicators including RSI, MACD, Bollinger Bands, etc.
 */
export class TaapiProvider {
    private runtime: IAgentRuntime;
    private apiKey: string;
    private readonly API_BASE_URL = 'https://api.taapi.io';

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
        this.apiKey = runtime.getSetting('TAAPI_API_KEY') as string;

        if (!this.apiKey) {
            console.warn('TAAPI API key not configured. Technical indicators will not be available.');
        }
    }

    /**
     * Get comprehensive technical indicators for a token
     */
    async getTechnicalIndicators(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        indicators: string[] = ['rsi', 'macd', 'bbands', 'sma', 'ema', 'stoch', 'adx', 'cci', 'willr', 'mfi']
    ): Promise<any> {
        if (!this.apiKey) {
            console.warn('TAAPI API key not configured, skipping technical indicators');
            return null;
        }

        try {
            const cacheKey = `taapi_indicators_${symbol}_${exchange}_${interval}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            console.log(`Fetching technical indicators for ${symbol} on ${exchange} with interval ${interval}...`);

            // Try multiple exchanges if the primary one fails
            const exchanges = [exchange, 'binance', 'kucoin', 'coinbase'];
            let data: any = null;

            for (const ex of exchanges) {
                try {
                    // Use bulk endpoint for multiple indicators
                    const bulkData = {
                        "secret": this.apiKey,
                        "construct": {
                            "exchange": ex,
                            "symbol": symbol,
                            "interval": interval,
                            "indicators": indicators.map(indicator => ({
                                "indicator": indicator,
                                "parameters": this.getIndicatorParameters(indicator)
                            }))
                        }
                    };

                    const response = await fetch(`${this.API_BASE_URL}/bulk`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(bulkData)
                    });

                    if (response.ok) {
                        data = await response.json();
                        console.log(`TAAPI response from ${ex}:`, JSON.stringify(data, null, 2));

                        if (data && data.success) {
                            console.log(`Successfully fetched data from ${ex}`);
                            break;
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to fetch from ${ex}:`, error);
                    continue;
                }
            }

            if (!data || !data.success) {
                console.warn(`TAAPI request failed for ${symbol} on all exchanges`);
                return null;
            }

            const indicatorsData = this.processIndicatorsResponse(data.data, indicators);
            console.log(`Successfully fetched ${Object.keys(indicatorsData).length} indicators for ${symbol}`);

            await this.setCachedData(cacheKey, indicatorsData, 300); // 5 minutes cache
            return indicatorsData;
        } catch (error) {
            console.error('Error fetching technical indicators from TAAPI:', error);
            return null;
        }
    }

    /**
     * Get specific indicator data
     */
    async getIndicator(
        symbol: string,
        indicator: string,
        exchange: string = 'binance',
        interval: string = '1h',
        parameters: any = {}
    ): Promise<any> {
        if (!this.apiKey) {
            console.warn('TAAPI API key not configured, skipping indicator fetch');
            return null;
        }

        try {
            const cacheKey = `taapi_${indicator}_${symbol}_${exchange}_${interval}`;
            const cached = await this.getCachedData(cacheKey);
            if (cached) return cached;

            console.log(`Fetching ${indicator} for ${symbol} on ${exchange}...`);

            const url = new URL(`${this.API_BASE_URL}/${indicator}`);
            url.searchParams.append('secret', this.apiKey);
            url.searchParams.append('exchange', exchange);
            url.searchParams.append('symbol', symbol);
            url.searchParams.append('interval', interval);

            // Add indicator-specific parameters
            const defaultParams = this.getIndicatorParameters(indicator);
            const allParams = { ...defaultParams, ...parameters };

            Object.entries(allParams).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    url.searchParams.append(key, String(value));
                }
            });

            const response = await fetch(url.toString());

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`TAAPI ${indicator} API error: ${errorText}`);
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
            }

            const data = await response.json();
            console.log(`${indicator} response:`, JSON.stringify(data, null, 2));

            if (!data.success) {
                console.warn(`TAAPI ${indicator} request failed for ${symbol}: ${data.error || 'Unknown error'}`);
                return null;
            }

            await this.setCachedData(cacheKey, data, 300); // 5 minutes cache
            return data;
        } catch (error) {
            console.error(`Error fetching ${indicator} from TAAPI:`, error);
            return null;
        }
    }

    /**
     * Get RSI (Relative Strength Index)
     */
    async getRSI(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        period: number = 14
    ): Promise<any> {
        return this.getIndicator(symbol, 'rsi', exchange, interval, { period });
    }

    /**
     * Get MACD (Moving Average Convergence Divergence)
     */
    async getMACD(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        fastPeriod: number = 12,
        slowPeriod: number = 26,
        signalPeriod: number = 9
    ): Promise<any> {
        return this.getIndicator(symbol, 'macd', exchange, interval, {
            fastperiod: fastPeriod,
            slowperiod: slowPeriod,
            signalperiod: signalPeriod
        });
    }

    /**
     * Get Bollinger Bands
     */
    async getBollingerBands(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        period: number = 20,
        stdDev: number = 2
    ): Promise<any> {
        return this.getIndicator(symbol, 'bbands', exchange, interval, {
            period,
            stddev: stdDev
        });
    }

    /**
     * Get Stochastic Oscillator
     */
    async getStochastic(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        kPeriod: number = 14,
        dPeriod: number = 3
    ): Promise<any> {
        return this.getIndicator(symbol, 'stoch', exchange, interval, {
            kperiod: kPeriod,
            dperiod: dPeriod
        });
    }

    /**
     * Get ADX (Average Directional Index)
     */
    async getADX(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        period: number = 14
    ): Promise<any> {
        return this.getIndicator(symbol, 'adx', exchange, interval, { period });
    }

    /**
     * Get CCI (Commodity Channel Index)
     */
    async getCCI(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        period: number = 20
    ): Promise<any> {
        return this.getIndicator(symbol, 'cci', exchange, interval, { period });
    }

    /**
     * Get Williams %R
     */
    async getWilliamsR(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        period: number = 14
    ): Promise<any> {
        return this.getIndicator(symbol, 'willr', exchange, interval, { period });
    }

    /**
     * Get MFI (Money Flow Index)
     */
    async getMFI(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        period: number = 14
    ): Promise<any> {
        return this.getIndicator(symbol, 'mfi', exchange, interval, { period });
    }

    /**
     * Get Simple Moving Average
     */
    async getSMA(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        period: number = 20
    ): Promise<any> {
        return this.getIndicator(symbol, 'sma', exchange, interval, { period });
    }

    /**
     * Get Exponential Moving Average
     */
    async getEMA(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        period: number = 20
    ): Promise<any> {
        return this.getIndicator(symbol, 'ema', exchange, interval, { period });
    }

    /**
     * Get VWAP (Volume Weighted Average Price)
     */
    async getVWAP(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h'
    ): Promise<any> {
        return this.getIndicator(symbol, 'vwap', exchange, interval);
    }

    /**
     * Get ATR (Average True Range)
     */
    async getATR(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h',
        period: number = 14
    ): Promise<any> {
        return this.getIndicator(symbol, 'atr', exchange, interval, { period });
    }

    /**
     * Get comprehensive market analysis
     */
    async getMarketAnalysis(
        symbol: string,
        exchange: string = 'binance',
        interval: string = '1h'
    ): Promise<any> {
        try {
            console.log(`Getting comprehensive market analysis for ${symbol}...`);

            // Try multiple exchanges if the primary one fails
            const exchanges = [exchange, 'binance', 'kucoin', 'coinbase'];
            let indicators = null;

            for (const ex of exchanges) {
                try {
                    // Get all major indicators
                    indicators = await this.getTechnicalIndicators(symbol, ex, interval, [
                        'rsi', 'macd', 'bbands', 'sma', 'ema', 'stoch', 'adx', 'cci', 'willr', 'mfi', 'vwap', 'atr'
                    ]);

                    if (indicators) {
                        console.log(`Successfully got indicators from ${ex}`);
                        break;
                    }
                } catch (error) {
                    console.warn(`Failed to get indicators from ${ex}:`, error);
                    continue;
                }
            }

            if (!indicators) {
                console.warn(`Failed to get indicators from any exchange for ${symbol}`);
                return null;
            }

            // Analyze signals
            const signals = this.analyzeSignals(indicators);
            const summary = this.generateSummary(indicators, signals);

            return {
                symbol,
                exchange: exchange,
                interval,
                timestamp: Date.now(),
                indicators,
                signals,
                summary
            };
        } catch (error) {
            console.error('Error getting market analysis:', error);
            return null;
        }
    }

    /**
     * Get indicator parameters based on indicator type
     */
    private getIndicatorParameters(indicator: string): any {
        switch (indicator.toLowerCase()) {
            case 'rsi':
                return { period: 14 };
            case 'macd':
                return { fastperiod: 12, slowperiod: 26, signalperiod: 9 };
            case 'bbands':
                return { period: 20, stddev: 2 };
            case 'stoch':
                return { kperiod: 14, dperiod: 3 };
            case 'adx':
                return { period: 14 };
            case 'cci':
                return { period: 20 };
            case 'willr':
                return { period: 14 };
            case 'mfi':
                return { period: 14 };
            case 'sma':
                return { period: 20 };
            case 'ema':
                return { period: 20 };
            case 'atr':
                return { period: 14 };
            case 'vwap':
                return {};
            default:
                return {};
        }
    }

    /**
     * Process indicators response from bulk endpoint
     */
    private processIndicatorsResponse(data: any, requestedIndicators: string[]): any {
        const result: any = {};

        if (!data || !Array.isArray(data)) {
            return result;
        }

        data.forEach((item: any) => {
            if (item && item.indicator && item.result) {
                result[item.indicator] = item.result;
            }
        });

        return result;
    }

    /**
     * Analyze signals from indicators
     */
    private analyzeSignals(indicators: any): any {
        const signals: any = {};

        // RSI Analysis
        if (indicators.rsi && indicators.rsi.value !== undefined) {
            const rsi = indicators.rsi.value;
            if (rsi > 70) {
                signals.rsi = { signal: 'sell', strength: 'strong', value: rsi, reason: 'Overbought' };
            } else if (rsi < 30) {
                signals.rsi = { signal: 'buy', strength: 'strong', value: rsi, reason: 'Oversold' };
            } else {
                signals.rsi = { signal: 'hold', strength: 'weak', value: rsi, reason: 'Neutral' };
            }
        }

        // MACD Analysis
        if (indicators.macd && indicators.macd.macd !== undefined && indicators.macd.signal !== undefined) {
            const macdValue = indicators.macd.macd;
            const signalValue = indicators.macd.signal;
            const histogramValue = indicators.macd.histogram;

            if (macdValue > signalValue && histogramValue > 0) {
                signals.macd = {
                    signal: 'buy',
                    strength: 'strong',
                    macdValue,
                    signalValue,
                    histogramValue,
                    reason: 'Bullish crossover'
                };
            } else if (macdValue < signalValue && histogramValue < 0) {
                signals.macd = {
                    signal: 'sell',
                    strength: 'strong',
                    macdValue,
                    signalValue,
                    histogramValue,
                    reason: 'Bearish crossover'
                };
            } else {
                signals.macd = {
                    signal: 'hold',
                    strength: 'weak',
                    macdValue,
                    signalValue,
                    histogramValue,
                    reason: 'No clear signal'
                };
            }
        }

        // Bollinger Bands Analysis
        if (indicators.bbands && indicators.bbands.upper !== undefined) {
            const upper = indicators.bbands.upper;
            const middle = indicators.bbands.middle;
            const lower = indicators.bbands.lower;
            const close = indicators.bbands.close || middle; // Use middle if close not available

            if (close <= lower) {
                signals.bbands = { signal: 'buy', strength: 'strong', close, lower, middle, upper, reason: 'Price at lower band' };
            } else if (close >= upper) {
                signals.bbands = { signal: 'sell', strength: 'strong', close, lower, middle, upper, reason: 'Price at upper band' };
            } else {
                signals.bbands = { signal: 'hold', strength: 'weak', close, lower, middle, upper, reason: 'Price within bands' };
            }
        }

        // Stochastic Analysis
        if (indicators.stoch && indicators.stoch.k !== undefined) {
            const k = indicators.stoch.k;
            const d = indicators.stoch.d;

            if (k < 20 && d < 20) {
                signals.stoch = { signal: 'buy', strength: 'strong', k, d, reason: 'Oversold' };
            } else if (k > 80 && d > 80) {
                signals.stoch = { signal: 'sell', strength: 'strong', k, d, reason: 'Overbought' };
            } else {
                signals.stoch = { signal: 'hold', strength: 'weak', k, d, reason: 'Neutral' };
            }
        }

        // ADX Analysis
        if (indicators.adx && indicators.adx.adx !== undefined) {
            const adx = indicators.adx.adx;
            const plusDI = indicators.adx.plusdi;
            const minusDI = indicators.adx.minusdi;

            if (adx > 25) {
                if (plusDI > minusDI) {
                    signals.adx = { signal: 'buy', strength: 'strong', adx, plusDI, minusDI, reason: 'Strong uptrend' };
                } else {
                    signals.adx = { signal: 'sell', strength: 'strong', adx, plusDI, minusDI, reason: 'Strong downtrend' };
                }
            } else {
                signals.adx = { signal: 'hold', strength: 'weak', adx, plusDI, minusDI, reason: 'Weak trend' };
            }
        }

        return signals;
    }

    /**
     * Generate summary from indicators and signals
     */
    private generateSummary(indicators: any, signals: any): any {
        let buySignals = 0;
        let sellSignals = 0;
        let holdSignals = 0;
        let strongSignals = 0;

        Object.values(signals).forEach((signal: any) => {
            if (signal.signal === 'buy') buySignals++;
            else if (signal.signal === 'sell') sellSignals++;
            else holdSignals++;

            if (signal.strength === 'strong') strongSignals++;
        });

        const totalSignals = Object.keys(signals).length;
        const buyPercentage = totalSignals > 0 ? (buySignals / totalSignals) * 100 : 0;
        const sellPercentage = totalSignals > 0 ? (sellSignals / totalSignals) * 100 : 0;
        const strongPercentage = totalSignals > 0 ? (strongSignals / totalSignals) * 100 : 0;

        let overallSignal = 'hold';
        let confidence = 0;

        if (buyPercentage > 60 && strongPercentage > 50) {
            overallSignal = 'buy';
            confidence = Math.min(buyPercentage + strongPercentage, 100);
        } else if (sellPercentage > 60 && strongPercentage > 50) {
            overallSignal = 'sell';
            confidence = Math.min(sellPercentage + strongPercentage, 100);
        } else {
            overallSignal = 'hold';
            confidence = Math.max(100 - Math.abs(buyPercentage - sellPercentage), 0);
        }

        return {
            overallSignal,
            confidence: Math.round(confidence),
            buySignals,
            sellSignals,
            holdSignals,
            strongSignals,
            totalSignals,
            buyPercentage: Math.round(buyPercentage),
            sellPercentage: Math.round(sellPercentage),
            strongPercentage: Math.round(strongPercentage)
        };
    }

    /**
     * Get cached data
     */
    private async getCachedData(key: string): Promise<any | null> {
        try {
            return await this.runtime.getCache(key);
        } catch (error) {
            return null;
        }
    }

    /**
     * Set cached data
     */
    private async setCachedData(key: string, data: any, ttlSeconds: number): Promise<void> {
        try {
            // Note: runtime.setCache only takes key and data, TTL is handled internally
            await this.runtime.setCache(key, data);
        } catch (error) {
            console.error('Failed to cache TAAPI data:', error);
        }
    }
} 