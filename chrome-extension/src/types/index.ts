import { z } from "zod";

// Configuration schema
export const spartanDefiConfigSchema = z.object({
  SOLANA_RPC_URL: z.string().url().default("https://api.mainnet-beta.solana.com"),
  JUPITER_API_URL: z.string().url().default("https://quote-api.jup.ag/v6"),
  BIRDEYE_API_KEY: z.string().optional(),
  SPARTAN_CHAT_MODEL: z.string().default("gpt-4"),
});

export type SpartanDefiConfig = z.infer<typeof spartanDefiConfigSchema>;

// Token types
export interface Token {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  price?: number;
  priceChange24h?: number;
  volume24h?: number;
  marketCap?: number;
}

export interface TokenBalance {
  mint: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  uiAmount: number;
  valueUsd?: number;
}

export interface WalletBalances {
  solBalance: number;
  tokens: TokenBalance[];
  totalValueUsd?: number;
}

// Swap types
export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  amount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: {
    feeBps: number;
    feeAccounts: Record<string, string>;
  };
  priceImpactPct: number;
  routePlan: any[];
  contextSlot: number;
  timeTaken: number;
}

export interface SwapParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
  walletAddress: string;
}

export interface SwapResult {
  signature: string;
  success: boolean;
  error?: string;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
}

// Spartan Chat types
export interface SpartanChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export interface SpartanChatContext {
  walletBalances?: WalletBalances;
  recentTransactions?: any[];
  marketData?: any;
  tradingHistory?: any[];
}

export interface SpartanChatResponse {
  message: string;
  suggestions?: string[];
  data?: any;
  confidence: number;
}

// Market data types
export interface MarketData {
  token: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  circulatingSupply: number;
  totalSupply: number;
}

// Transaction types
export interface Transaction {
  signature: string;
  blockTime: number;
  slot: number;
  success: boolean;
  fee: number;
  type: "swap" | "transfer" | "stake" | "unstake" | "other";
  description: string;
  amount?: number;
  token?: string;
}

// Service state
export interface SpartanDefiServiceState {
  connectedWallets: string[];
  activeQuotes: Map<string, SwapQuote>;
  chatHistory: SpartanChatMessage[];
  marketDataCache: Map<string, MarketData>;
}

// Action parameters
export interface GetTokenBalanceParams {
  walletAddress: string;
  tokenMint: string;
}

export interface GetWalletBalancesParams {
  walletAddress: string;
  includePrices?: boolean;
}

export interface SwapTokensParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
  walletAddress: string;
}

export interface ChatWithSpartanParams {
  message: string;
  context?: any;
  userId?: string;
}
