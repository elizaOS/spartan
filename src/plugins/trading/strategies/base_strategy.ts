import type { Plugin } from '@elizaos/core';

/*
interface TradingConfig {
  intervals: {
    priceCheck: number;
    walletSync: number;
    performanceMonitor: number;
  };
}
*/


// USER-LEVEL (user per client (think telegram or discord))

/*
ACCOUNT-LEVEL SETTINGS

Notification Preferences

High: Master notification toggle (on/off)
MedLater: Notification intervals: 15-minute updates, 1-hour summaries, daily reports
LowLater: Notification channels perference Discord, Telegram, Email
Later: Alert types: Position opened/closed, stop loss triggered, take profit hit, significant gains/losses, market volatility

Account Risk Management

Maximum total exposure (% of portfolio in positions)
Maximum drawdown (e.g., 10%)
Daily loss limit (%)
Weekly loss limit (%)
Emergency stop loss (account-wide)
Diversification rules: Max per token, max per sector, minimum positions
Maximum trades per day

  MINIMUM_TRADE: 0.1, // percentage of portofolio
  // buy vs sell?
  // (adjust for last x minutes vol? burst min/max?)
  slippageSettings: {
    baseSlippage: 0.5,
    maxSlippage: 1.0,
    liquidityMultiplier: 1.0,
    volumeMultiplier: 1.0,
  },
  MIN_LIQUIDITY: 50000,
  MIN_VOLUME: 10000,
  MAX_PRICE_CHANGE: 30,
  maxPositionSize: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  Token age requirements
  Market cap thresholds

  Volume spike threshold (?)

Technical Indicators
RSI settings: Oversold threshold (30), overbought threshold (70), period (14, 21)
MACD settings: Fast period (12, 26), slow period (26, 52), signal period (9, 12)
Moving Averages: Fast MA (10, 20), slow MA (50, 200), MA type (SMA/EMA/WMA), crossover strategy
Bollinger Bands: Period (20), standard deviations (2)
Stochastic Oscillator: K period (14), D period (3), oversold/overbought levels
ATR (Average True Range): Period (14), volatility multiplier


Gas optimization (on/off)
Priority fees (low, medium, high)

Account Performance Monitoring
Performance summary frequency (daily, weekly, monthly)
Portfolio rebalancing intervals
*/

export interface Multiwallet_Account_Settings_v0 {
  notifications?: boolean;

}

// metawallet settings
class strategy {
  // strategy config
  //   I think this should just be all code
  //   though a structure allows user scaling
  // scoring weight
  // pull from trust_marketplace: t/f, a weight, a min/max, ?
  // score:
  // rsi: oversold bonus
  // rsi: overbought penalty
  // macd: strong uptrend bonus
  // macd: strong downrend penalty
  // ema: bonus/penalty
  // vol: profile bonus
  // volatility: bonus/penalty
  // social: bonus/penalty (what does this mean? social score 0-100?)
  // market metrics scoring (mcap, volume, liquidity)
}

// per chain settings
  // preferred exchanges

// meta it, maybe we just need a structure to describe a config
class strategy_wallet_config {
  // / per chain (every chain should have a base trading token)
  // min/max trade
  // custom config
  // copy: wallet scaling factor
}

// token (per chain) settings (acts as a black or white list)
// JSON blob of overrides

// we need position settings
// Multiwallet_Position_v0 for the most part