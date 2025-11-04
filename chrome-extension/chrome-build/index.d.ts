import { Plugin } from '@elizaos/core';
import { z } from 'zod';

declare const spartanDefiConfigSchema: z.ZodObject<{
    SOLANA_RPC_URL: z.ZodDefault<z.ZodString>;
    JUPITER_API_URL: z.ZodDefault<z.ZodString>;
    BIRDEYE_API_KEY: z.ZodOptional<z.ZodString>;
    SPARTAN_CHAT_MODEL: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    SOLANA_RPC_URL: string;
    JUPITER_API_URL: string;
    SPARTAN_CHAT_MODEL: string;
    BIRDEYE_API_KEY?: string | undefined;
}, {
    SOLANA_RPC_URL?: string | undefined;
    JUPITER_API_URL?: string | undefined;
    BIRDEYE_API_KEY?: string | undefined;
    SPARTAN_CHAT_MODEL?: string | undefined;
}>;
type SpartanDefiConfig = z.infer<typeof spartanDefiConfigSchema>;
interface Token {
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
interface TokenBalance {
    mint: string;
    symbol: string;
    name: string;
    balance: string;
    decimals: number;
    uiAmount: number;
    valueUsd?: number;
}
interface WalletBalances {
    solBalance: number;
    tokens: TokenBalance[];
    totalValueUsd?: number;
}
interface SwapQuote {
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
interface SwapParams {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps?: number;
    walletAddress: string;
}
interface SwapResult {
    signature: string;
    success: boolean;
    error?: string;
    inputAmount: number;
    outputAmount: number;
    priceImpact: number;
}
interface SpartanChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
}
interface SpartanChatContext {
    walletBalances?: WalletBalances;
    recentTransactions?: any[];
    marketData?: any;
    tradingHistory?: any[];
}
interface SpartanChatResponse {
    message: string;
    suggestions?: string[];
    data?: any;
    confidence: number;
}
interface MarketData {
    token: string;
    price: number;
    priceChange24h: number;
    volume24h: number;
    marketCap: number;
    circulatingSupply: number;
    totalSupply: number;
}
interface Transaction {
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
interface SpartanDefiServiceState {
    connectedWallets: string[];
    activeQuotes: Map<string, SwapQuote>;
    chatHistory: SpartanChatMessage[];
    marketDataCache: Map<string, MarketData>;
}
interface GetTokenBalanceParams {
    walletAddress: string;
    tokenMint: string;
}
interface GetWalletBalancesParams {
    walletAddress: string;
    includePrices?: boolean;
}
interface SwapTokensParams {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps?: number;
    walletAddress: string;
}
interface ChatWithSpartanParams {
    message: string;
    context?: any;
    userId?: string;
}

declare const spartanDefiPlugin: Plugin;

export { type ChatWithSpartanParams, type GetTokenBalanceParams, type GetWalletBalancesParams, type MarketData, type SpartanChatContext, type SpartanChatMessage, type SpartanChatResponse, type SpartanDefiConfig, type SpartanDefiServiceState, type SwapParams, type SwapQuote, type SwapResult, type SwapTokensParams, type Token, type TokenBalance, type Transaction, type WalletBalances, spartanDefiPlugin as default, spartanDefiConfigSchema, spartanDefiPlugin };
