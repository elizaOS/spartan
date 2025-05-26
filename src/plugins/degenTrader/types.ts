import { IAgentRuntime, UUID } from '@elizaos/core';

// Token Security Types
export interface TokenSecurityData {
  ownerBalance: string;
  creatorBalance: string;
  ownerPercentage: number;
  creatorPercentage: number;
  top10HolderBalance: string;
  top10HolderPercent: number;
}

// Token Trading Types
export interface TokenTradeData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  volume24hUsd: string;
  uniqueWallets24h: number;
  uniqueWallets24hChange: number;
}

export interface DexScreenerPair {
  priceUsd: number;
  volume: { h24: number };
  marketCap: number;
  liquidity: { usd: number; base: number };
  priceChange: { h24: number };
  txns: { h24: { buys: number; sells: number } };
}

export interface ProcessedTokenData {
  security: TokenSecurityData;
  tradeData: TokenTradeData;
  dexScreenerData: { pairs: DexScreenerPair[] };
  holderDistributionTrend: string;
  highValueHolders: any[];
  recentTrades: boolean;
  highSupplyHoldersCount: number;
}

// Market and Position Types
export type MarketData = {
  priceChange24h: number;
  volume24h: number;
  liquidity: {
    usd: number;
  };
};

export type Position = {
  id: UUID;
  token: string;
  tokenAddress: string;
  entryPrice: number;
  amount: number;
  timestamp: number;
  sold?: boolean;
  exitPrice?: number;
  exitTimestamp?: number;
  initialMetrics: {
    trustScore: number;
    volume24h: number;
    liquidity: { usd: number };
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  highestPrice?: number;
  partialTakeProfit?: boolean;
};

// Analysis Types
export type TokenAnalysis = {
  security: {
    ownerBalance: string;
    creatorBalance: string;
    ownerPercentage: number;
    top10HolderPercent: number;
  };
  trading: {
    price: number;
    priceChange24h: number;
    volume24h: number;
    uniqueWallets24h: number;
    walletChanges: {
      unique_wallet_30m_change_percent: number;
      unique_wallet_1h_change_percent: number;
      unique_wallet_24h_change_percent: number;
    };
  };
  market: {
    liquidity: number;
    marketCap: number;
    fdv: number;
  };
};

export interface TokenAnalysisState {
  lastAnalyzedIndex: number;
  analyzedTokens: Set<string>;
}

// Signal Types
export interface BuySignalMessage {
  positionId: string;
  tokenAddress: string;
  tradeAmount: string;
  expectedOutAmount: string;
  entityId: string;
}

export interface SellSignalMessage {
  positionId: string;
  tokenAddress: string;
  pairId?: string;
  amount: string;
  currentBalance?: string;
  sellRecommenderId?: string;
  walletAddress?: string;
  isSimulation?: boolean;
  reason?: string;
  entityId?: string;
  slippage?: number;
}

export interface QuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  walletAddress: string;
  slippageBps: number;
}

export interface StartProcessParams {
  id: string;
  tokenAddress: string;
  balance: string;
  isSimulation: boolean;
  initialMarketCap: string;
  entityId: string;
  walletAddress?: string;
  txHash?: string;
}

export interface AddTransactionParams {
  id: string;
  address: string;
  amount: string;
  walletAddress: string;
  isSimulation: boolean;
  marketCap: number;
  entityId: string;
  txHash: string;
}

export interface PriceSignalMessage {
  initialPrice: string;
  currentPrice: string;
  priceChange: number;
  tokenAddress: string;
}

export interface StartDegenProcessParams extends StartProcessParams {
  initialPrice: string;
}

export interface ITradeService {
  dataService: {
    getTokensMarketData: (tokens: string[]) => Promise<any>;
  };
}

export enum ServiceTypes {
  DEGEN_TRADING = 'DEGEN_TRADING',
  WALLET = 'wallet',
  DATA = 'data',
  ANALYTICS = 'analytics',
  MONITORING = 'monitoring',
  TASK = 'task',
  TRADE_MEMORY = 'trade_memory',
  BUY = 'buy',
  SELL = 'sell',
}

export type ServiceType = (typeof ServiceTypes)[keyof typeof ServiceTypes];

// Ensure TradePerformanceData is correctly defined or imported if it's from another file within types
export interface TradePerformanceData {
  token_address: string;
  buy_price: number;
  buy_timeStamp: string; // Consider Date type if appropriate
  buy_amount: number;
  buy_value_usd: number;
  buy_market_cap: number;
  buy_liquidity: number;
  // Fields for sell data if applicable, or keep as is if only for buy performance
  sell_price?: number;
  sell_timeStamp?: string; // Consider Date type
  sell_amount?: number;
  sell_value_usd?: number;
  profit_usd: number;
  profit_percent: number;
  rapidDump: boolean; // Consider a more descriptive name or enum if states are fixed
  // Add other relevant fields like trade duration, slippage, etc.
  trade_duration_ms?: number;
  buy_slippage_percent?: number;
  sell_slippage_percent?: number;
}

// Portfolio and Signal Types
export interface PortfolioStatus {
  totalValue: number;
  positions: Record<
    string,
    {
      amount: number;
      value: number;
      price: number;
    }
  >;
  solBalance: number;
  drawdown: number;
}

export interface TokenSignal {
  address: string;
  symbol: string;
  marketCap: number;
  volume24h: number;
  price: number;
  liquidity: number;
  score: number;
  reasons: string[];
  technicalSignals?: {
    rsi: number;
    macd: {
      value: number;
      signal: number;
      histogram: number;
    };
    volumeProfile?: {
      trend: 'increasing' | 'decreasing' | 'stable';
      unusualActivity: boolean;
    };
    volatility: number;
  };
  socialMetrics?: {
    mentionCount: number;
    sentiment: number;
    influencerMentions: number;
  };
  cmcMetrics?: {
    rank: number;
    priceChange24h: number;
    volumeChange24h: number;
  };
}
