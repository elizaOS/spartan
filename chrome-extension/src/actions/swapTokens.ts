import {
    Action,
    IAgentRuntime,
    Memory,
    logger,
} from "@elizaos/core";
import { z } from "zod";
import { SwapTokensParams } from "../types";
import { getSwapQuoteFromServices } from "../../../src/plugins/degenIntel/utils";

const swapTokensSchema = z.object({
    inputMint: z.string().min(32).max(44),
    outputMint: z.string().min(32).max(44),
    amount: z.number().positive(),
    slippageBps: z.number().min(1).max(10000).optional().default(100),
    walletAddress: z.string().min(32).max(44),
});

export const swapTokensAction: Action = {
    name: "SWAP_TOKENS",
    description: "Get a swap quote and execute token swaps on Solana using Jupiter and degenIntel services",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase() || "";

        // Check if message contains swap intent
        const hasSwapIntent = /swap|exchange|trade|convert/.test(text);
        const hasTokenContext = /token|coin|mint|sol|usdc|usdt/.test(text);
        const hasAmountContext = /\d+/.test(text);

        return hasSwapIntent && hasTokenContext && hasAmountContext;
    },

    handler: async (runtime: IAgentRuntime, message: Memory) => {
        try {
            // Extract swap parameters from message
            const text = message.content.text || "";

            // Look for Solana addresses (base58 encoded, 32-44 characters)
            const addressMatches = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);

            if (!addressMatches || addressMatches.length < 2) {
                return {
                    success: false,
                    error: "Could not extract input and output token mints from message. Please provide both token addresses.",
                };
            }

            // Look for amount (number with optional decimal)
            const amountMatch = text.match(/(\d+(?:\.\d+)?)/);
            if (!amountMatch) {
                return {
                    success: false,
                    error: "Could not extract swap amount from message. Please specify how much you want to swap.",
                };
            }

            const [inputMint, outputMint] = addressMatches;
            const amount = parseFloat(amountMatch[1]);

            // For now, use a default wallet address - in a real implementation this would come from user context
            const walletAddress = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"; // Example address

            const params: SwapTokensParams = {
                inputMint,
                outputMint,
                amount,
                slippageBps: 100, // 1% slippage
                walletAddress,
            };

            // Validate parameters
            const validated = swapTokensSchema.parse(params);

            // Get swap quote using degenIntel services
            const quote = await getSwapQuoteFromServices(runtime, validated);

            if (!quote) {
                return {
                    success: false,
                    error: "Failed to get swap quote. Please check your token addresses and try again.",
                };
            }

            logger.info(`Got swap quote: ${validated.amount} -> ${quote.otherAmountThreshold}`);

            // For now, just return the quote - in a real implementation you'd execute the swap
            const response = formatSwapQuoteResponse(quote, validated);

            return {
                success: true,
                data: {
                    quote,
                    params: validated,
                },
                message: response,
            };
        } catch (error) {
            logger.error("Failed to get swap quote:", error);
            return {
                success: false,
                error:
                    error instanceof Error ? error.message : "Failed to get swap quote",
            };
        }
    },

    examples: [
        [
            {
                name: "SOL to USDC Swap",
                content: { text: "Swap 1 SOL to USDC" }
            },
            {
                name: "USDC to SOL Quote",
                content: { text: "Get a quote for swapping 100 USDC to SOL" }
            },
            {
                name: "SOL to USDT Exchange",
                content: { text: "Exchange 0.5 SOL for USDT" }
            },
            {
                name: "Token Conversion",
                content: { text: "Convert 50 USDC to another token" }
            },
        ]
    ],

    similes: [
        "EXCHANGE_TOKENS",
        "TRADE_TOKENS",
        "CONVERT_TOKENS",
        "GET_SWAP_QUOTE",
    ],
};

function formatSwapQuoteResponse(quote: any, params: any): string {
    const inputAmount = parseFloat(quote.amount);
    const outputAmount = parseFloat(quote.otherAmountThreshold);
    const priceImpact = quote.priceImpactPct;
    const slippage = params.slippageBps / 100; // Convert basis points to percentage

    return `🔄 **Swap Quote**

**Input:** ${inputAmount.toFixed(4)} tokens
**Output:** ${outputAmount.toFixed(4)} tokens
**Price Impact:** ${priceImpact.toFixed(2)}%
**Slippage Tolerance:** ${slippage}%

**Route Details:**
- Input Mint: \`${quote.inputMint}\`
- Output Mint: \`${quote.outputMint}\`
- Swap Mode: ${quote.swapMode}
- Route Steps: ${quote.routePlan.length}

💡 **Note:** This is a quote only. To execute the swap, additional wallet signing would be required.`;
} 