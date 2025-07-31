/**
 * Technical Analysis Utilities
 * Comprehensive collection of technical indicators for cryptocurrency analysis
 */

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(prices: number[], period: number): number[] {
    if (prices.length < period) return [];

    const sma: number[] = [];
    for (let i = period - 1; i < prices.length; i++) {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
    }
    return sma;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(prices: number[], period: number): number[] {
    if (prices.length < period) return [];

    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // First EMA is SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += prices[i];
    }
    ema.push(sum / period);

    // Calculate subsequent EMAs
    for (let i = period; i < prices.length; i++) {
        const newEMA = (prices[i] * multiplier) + (ema[ema.length - 1] * (1 - multiplier));
        ema.push(newEMA);
    }

    return ema;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
    prices: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
): {
    macd: number[];
    signal: number[];
    histogram: number[];
} {
    if (prices.length < slowPeriod) {
        return { macd: [], signal: [], histogram: [] };
    }

    const fastEMA = calculateEMA(prices, fastPeriod);
    const slowEMA = calculateEMA(prices, slowPeriod);

    // Calculate MACD line
    const macd: number[] = [];
    const startIndex = slowPeriod - fastPeriod;
    for (let i = 0; i < fastEMA.length; i++) {
        const slowIndex = i + startIndex;
        if (slowIndex < slowEMA.length) {
            macd.push(fastEMA[i] - slowEMA[slowIndex]);
        }
    }

    // Calculate signal line
    const signal = calculateEMA(macd, signalPeriod);

    // Calculate histogram
    const histogram: number[] = [];
    for (let i = 0; i < signal.length; i++) {
        const macdIndex = i + signalPeriod - 1;
        if (macdIndex < macd.length) {
            histogram.push(macd[macdIndex] - signal[i]);
        }
    }

    return { macd, signal, histogram };
}

/**
 * Calculate RSI (Relative Strength Index)
 */
export function calculateRSI(prices: number[], period: number = 14): number[] {
    if (prices.length < period + 1) return [];

    const rsi: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Calculate initial average gain and loss
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    // Calculate first RSI
    const rs = avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));

    // Calculate subsequent RSI values
    for (let i = period; i < gains.length; i++) {
        avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
        avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;

        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
    }

    return rsi;
}

/**
 * Calculate Bollinger Bands
 */
export function calculateBollingerBands(
    prices: number[],
    period: number = 20,
    standardDeviations: number = 2
): {
    upper: number[];
    middle: number[];
    lower: number[];
    bandwidth: number[];
    percentB: number[];
} {
    if (prices.length < period) {
        return { upper: [], middle: [], lower: [], bandwidth: [], percentB: [] };
    }

    const middle = calculateSMA(prices, period);
    const upper: number[] = [];
    const lower: number[] = [];
    const bandwidth: number[] = [];
    const percentB: number[] = [];

    for (let i = 0; i < middle.length; i++) {
        const startIndex = i;
        const endIndex = startIndex + period;
        const slice = prices.slice(startIndex, endIndex);

        // Calculate standard deviation
        const mean = middle[i];
        const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);

        const upperBand = mean + (standardDeviations * stdDev);
        const lowerBand = mean - (standardDeviations * stdDev);

        upper.push(upperBand);
        lower.push(lowerBand);
        bandwidth.push((upperBand - lowerBand) / mean);

        // Calculate %B
        const currentPrice = prices[endIndex - 1];
        const percentBValue = (currentPrice - lowerBand) / (upperBand - lowerBand);
        percentB.push(percentBValue);
    }

    return { upper, middle, lower, bandwidth, percentB };
}

/**
 * Calculate Volume indicators
 */
export function calculateVolumeIndicators(
    prices: number[],
    volumes: number[],
    period: number = 20
): {
    volumeSMA: number[];
    volumeRatio: number[];
    onBalanceVolume: number[];
} {
    if (prices.length !== volumes.length || prices.length < period) {
        return { volumeSMA: [], volumeRatio: [], onBalanceVolume: [] };
    }

    const volumeSMA = calculateSMA(volumes, period);

    // Calculate volume ratio
    const volumeRatio: number[] = [];
    for (let i = period - 1; i < volumes.length; i++) {
        volumeRatio.push(volumes[i] / volumeSMA[i - period + 1]);
    }

    // Calculate On-Balance Volume (OBV)
    const onBalanceVolume: number[] = [];
    let obv = 0;

    for (let i = 0; i < prices.length; i++) {
        if (i === 0) {
            obv = volumes[i];
        } else {
            if (prices[i] > prices[i - 1]) {
                obv += volumes[i];
            } else if (prices[i] < prices[i - 1]) {
                obv -= volumes[i];
            }
            // If price is same, OBV remains unchanged
        }
        onBalanceVolume.push(obv);
    }

    return { volumeSMA, volumeRatio, onBalanceVolume };
}

/**
 * Calculate Stochastic Oscillator
 */
export function calculateStochastic(
    highs: number[],
    lows: number[],
    closes: number[],
    kPeriod: number = 14,
    dPeriod: number = 3
): {
    k: number[];
    d: number[];
} {
    if (highs.length < kPeriod || lows.length < kPeriod || closes.length < kPeriod) {
        return { k: [], d: [] };
    }

    const k: number[] = [];

    for (let i = kPeriod - 1; i < closes.length; i++) {
        const highestHigh = Math.max(...highs.slice(i - kPeriod + 1, i + 1));
        const lowestLow = Math.min(...lows.slice(i - kPeriod + 1, i + 1));
        const currentClose = closes[i];

        const kValue = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
        k.push(kValue);
    }

    // Calculate %D (SMA of %K)
    const d = calculateSMA(k, dPeriod);

    return { k, d };
}

/**
 * Calculate Average True Range (ATR)
 */
export function calculateATR(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14
): number[] {
    if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) {
        return [];
    }

    const trueRanges: number[] = [];

    for (let i = 1; i < closes.length; i++) {
        const highLow = highs[i] - lows[i];
        const highClose = Math.abs(highs[i] - closes[i - 1]);
        const lowClose = Math.abs(lows[i] - closes[i - 1]);

        const trueRange = Math.max(highLow, highClose, lowClose);
        trueRanges.push(trueRange);
    }

    // Calculate ATR using EMA
    return calculateEMA(trueRanges, period);
}

/**
 * Calculate Williams %R
 */
export function calculateWilliamsR(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14
): number[] {
    if (highs.length < period || lows.length < period || closes.length < period) {
        return [];
    }

    const williamsR: number[] = [];

    for (let i = period - 1; i < closes.length; i++) {
        const highestHigh = Math.max(...highs.slice(i - period + 1, i + 1));
        const lowestLow = Math.min(...lows.slice(i - period + 1, i + 1));
        const currentClose = closes[i];

        const wr = ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
        williamsR.push(wr);
    }

    return williamsR;
}

/**
 * Calculate Commodity Channel Index (CCI)
 */
export function calculateCCI(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 20
): number[] {
    if (highs.length < period || lows.length < period || closes.length < period) {
        return [];
    }

    const cci: number[] = [];

    for (let i = period - 1; i < closes.length; i++) {
        const slice = closes.slice(i - period + 1, i + 1);
        const typicalPrices = slice.map((close, index) => {
            const highIndex = i - period + 1 + index;
            const lowIndex = i - period + 1 + index;
            return (highs[highIndex] + lows[lowIndex] + close) / 3;
        });

        const sma = typicalPrices.reduce((a, b) => a + b, 0) / period;
        const meanDeviation = typicalPrices.reduce((sum, price) => sum + Math.abs(price - sma), 0) / period;

        const currentTypicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
        const cciValue = (currentTypicalPrice - sma) / (0.015 * meanDeviation);
        cci.push(cciValue);
    }

    return cci;
}

/**
 * Calculate Money Flow Index (MFI)
 */
export function calculateMFI(
    highs: number[],
    lows: number[],
    closes: number[],
    volumes: number[],
    period: number = 14
): number[] {
    if (highs.length < period + 1 || lows.length < period + 1 ||
        closes.length < period + 1 || volumes.length < period + 1) {
        return [];
    }

    const mfi: number[] = [];
    const moneyFlows: number[] = [];

    for (let i = 1; i < closes.length; i++) {
        const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
        const prevTypicalPrice = (highs[i - 1] + lows[i - 1] + closes[i - 1]) / 3;

        let moneyFlow = 0;
        if (typicalPrice > prevTypicalPrice) {
            moneyFlow = typicalPrice * volumes[i];
        } else if (typicalPrice < prevTypicalPrice) {
            moneyFlow = -typicalPrice * volumes[i];
        }

        moneyFlows.push(moneyFlow);
    }

    for (let i = period - 1; i < moneyFlows.length; i++) {
        const slice = moneyFlows.slice(i - period + 1, i + 1);
        const positiveFlow = slice.filter(flow => flow > 0).reduce((a, b) => a + b, 0);
        const negativeFlow = Math.abs(slice.filter(flow => flow < 0).reduce((a, b) => a + b, 0));

        const mfiValue = 100 - (100 / (1 + (positiveFlow / negativeFlow)));
        mfi.push(mfiValue);
    }

    return mfi;
}

/**
 * Calculate Parabolic SAR
 */
export function calculateParabolicSAR(
    highs: number[],
    lows: number[],
    accelerationFactor: number = 0.02,
    maximumAcceleration: number = 0.2
): number[] {
    if (highs.length < 2 || lows.length < 2) {
        return [];
    }

    const sar: number[] = [];
    let isLong = true;
    let af = accelerationFactor;
    let ep = lows[0]; // Extreme point
    let prevSar = highs[0];

    sar.push(prevSar);

    for (let i = 1; i < highs.length; i++) {
        let currentSar: number;

        if (isLong) {
            currentSar = prevSar + af * (ep - prevSar);

            // Check if we need to switch to short
            if (lows[i] < currentSar) {
                isLong = false;
                currentSar = ep;
                ep = highs[i];
                af = accelerationFactor;
            } else {
                if (highs[i] > ep) {
                    ep = highs[i];
                    af = Math.min(af + accelerationFactor, maximumAcceleration);
                }
            }
        } else {
            currentSar = prevSar + af * (ep - prevSar);

            // Check if we need to switch to long
            if (highs[i] > currentSar) {
                isLong = true;
                currentSar = ep;
                ep = lows[i];
                af = accelerationFactor;
            } else {
                if (lows[i] < ep) {
                    ep = lows[i];
                    af = Math.min(af + accelerationFactor, maximumAcceleration);
                }
            }
        }

        sar.push(currentSar);
        prevSar = currentSar;
    }

    return sar;
}

/**
 * Calculate Average Directional Index (ADX)
 */
export function calculateADX(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14
): {
    adx: number[];
    plusDI: number[];
    minusDI: number[];
} {
    if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) {
        return { adx: [], plusDI: [], minusDI: [] };
    }

    const trueRanges: number[] = [];
    const plusDM: number[] = [];
    const minusDM: number[] = [];

    for (let i = 1; i < closes.length; i++) {
        const highDiff = highs[i] - highs[i - 1];
        const lowDiff = lows[i - 1] - lows[i];

        const trueRange = Math.max(
            highs[i] - lows[i],
            Math.abs(highs[i] - closes[i - 1]),
            Math.abs(lows[i] - closes[i - 1])
        );
        trueRanges.push(trueRange);

        if (highDiff > lowDiff && highDiff > 0) {
            plusDM.push(highDiff);
        } else {
            plusDM.push(0);
        }

        if (lowDiff > highDiff && lowDiff > 0) {
            minusDM.push(lowDiff);
        } else {
            minusDM.push(0);
        }
    }

    const smoothedTR = calculateEMA(trueRanges, period);
    const smoothedPlusDM = calculateEMA(plusDM, period);
    const smoothedMinusDM = calculateEMA(minusDM, period);

    const plusDI: number[] = [];
    const minusDI: number[] = [];
    const dx: number[] = [];

    for (let i = 0; i < smoothedTR.length; i++) {
        const plusDIValue = (smoothedPlusDM[i] / smoothedTR[i]) * 100;
        const minusDIValue = (smoothedMinusDM[i] / smoothedTR[i]) * 100;

        plusDI.push(plusDIValue);
        minusDI.push(minusDIValue);

        const dxValue = (Math.abs(plusDIValue - minusDIValue) / (plusDIValue + minusDIValue)) * 100;
        dx.push(dxValue);
    }

    const adx = calculateEMA(dx, period);

    return { adx, plusDI, minusDI };
}

/**
 * Generate trading signals based on technical indicators
 */
export function generateSignals(
    prices: number[],
    volumes: number[],
    highs: number[],
    lows: number[]
): {
    macdSignal: 'buy' | 'sell' | 'hold';
    rsiSignal: 'buy' | 'sell' | 'hold';
    bbSignal: 'buy' | 'sell' | 'hold';
    volumeSignal: 'buy' | 'sell' | 'hold';
    overallSignal: 'buy' | 'sell' | 'hold';
    confidence: number;
} {
    if (prices.length < 50) {
        return {
            macdSignal: 'hold',
            rsiSignal: 'hold',
            bbSignal: 'hold',
            volumeSignal: 'hold',
            overallSignal: 'hold',
            confidence: 0
        };
    }

    // Calculate indicators
    const { macd, signal, histogram } = calculateMACD(prices);
    const rsi = calculateRSI(prices);
    const { upper, middle, lower, percentB } = calculateBollingerBands(prices);
    const { volumeRatio } = calculateVolumeIndicators(prices, volumes);

    // Get latest values
    const currentPrice = prices[prices.length - 1];
    const currentMACD = macd[macd.length - 1];
    const currentSignal = signal[signal.length - 1];
    const currentHistogram = histogram[histogram.length - 1];
    const currentRSI = rsi[rsi.length - 1];
    const currentPercentB = percentB[percentB.length - 1];
    const currentVolumeRatio = volumeRatio[volumeRatio.length - 1];

    // MACD signals
    let macdSignal: 'buy' | 'sell' | 'hold' = 'hold';
    if (currentMACD > currentSignal && currentHistogram > 0) {
        macdSignal = 'buy';
    } else if (currentMACD < currentSignal && currentHistogram < 0) {
        macdSignal = 'sell';
    }

    // RSI signals
    let rsiSignal: 'buy' | 'sell' | 'hold' = 'hold';
    if (currentRSI < 30) {
        rsiSignal = 'buy';
    } else if (currentRSI > 70) {
        rsiSignal = 'sell';
    }

    // Bollinger Bands signals
    let bbSignal: 'buy' | 'sell' | 'hold' = 'hold';
    if (currentPercentB < 0.2) {
        bbSignal = 'buy';
    } else if (currentPercentB > 0.8) {
        bbSignal = 'sell';
    }

    // Volume signals
    let volumeSignal: 'buy' | 'sell' | 'hold' = 'hold';
    if (currentVolumeRatio > 1.5) {
        volumeSignal = 'buy';
    } else if (currentVolumeRatio < 0.5) {
        volumeSignal = 'sell';
    }

    // Overall signal calculation
    let buySignals = 0;
    let sellSignals = 0;

    if (macdSignal === 'buy') buySignals++;
    if (macdSignal === 'sell') sellSignals++;
    if (rsiSignal === 'buy') buySignals++;
    if (rsiSignal === 'sell') sellSignals++;
    if (bbSignal === 'buy') buySignals++;
    if (bbSignal === 'sell') sellSignals++;
    if (volumeSignal === 'buy') buySignals++;
    if (volumeSignal === 'sell') sellSignals++;

    let overallSignal: 'buy' | 'sell' | 'hold' = 'hold';
    if (buySignals > sellSignals && buySignals >= 2) {
        overallSignal = 'buy';
    } else if (sellSignals > buySignals && sellSignals >= 2) {
        overallSignal = 'sell';
    }

    // Calculate confidence (0-100)
    const totalSignals = buySignals + sellSignals;
    const confidence = totalSignals > 0 ? (Math.max(buySignals, sellSignals) / totalSignals) * 100 : 0;

    return {
        macdSignal,
        rsiSignal,
        bbSignal,
        volumeSignal,
        overallSignal,
        confidence
    };
} 