import {
    Action,
    IAgentRuntime,
    Memory,
    logger,
} from "@elizaos/core";
import { z } from "zod";
import { GetWalletBalancesParams } from "../types";
import { getWalletBalancesFromServices } from "../../../src/plugins/degenIntel/utils";

const getWalletBalancesSchema = z.object({
    walletAddress: z.string().min(32).max(44),
    includePrices: z.boolean().optional().default(true),
});

export const getWalletBalancesAction: Action = {
    name: "GET_WALLET_BALANCES",
    description: "Get all token balances for a wallet address including SOL and SPL tokens using degenIntel services",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase() || "";

        // Check if message contains wallet balance checking intent
        const hasBalanceIntent = /balance|balances|portfolio|holdings|tokens/.test(text);
        const hasWalletContext = /wallet|address|account|portfolio/.test(text);
        const hasAllIntent = /all|everything|total|summary/.test(text);

        return hasBalanceIntent && (hasWalletContext || hasAllIntent);
    },

    handler: async (runtime: IAgentRuntime, message: Memory) => {
        try {
            // Extract wallet address from message
            const text = message.content.text || "";

            // Look for Solana address (base58 encoded, 32-44 characters)
            const addressMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);

            if (!addressMatch) {
                return {
                    success: false,
                    error: "Could not extract wallet address from message. Please provide a valid Solana wallet address.",
                };
            }

            const walletAddress = addressMatch[0];

            const params: GetWalletBalancesParams = {
                walletAddress,
                includePrices: true,
            };

            // Validate parameters
            const validated = getWalletBalancesSchema.parse(params);

            // Get wallet balances using degenIntel services
            const balances = await getWalletBalancesFromServices(runtime, validated.walletAddress, validated.includePrices);

            logger.info(`Retrieved wallet balances: ${balances.tokens.length} tokens, SOL: ${balances.solBalance}`);

            const response = formatWalletBalancesResponse(balances);

            return {
                success: true,
                data: {
                    balances,
                    walletAddress: validated.walletAddress,
                },
                message: response,
            };
        } catch (error) {
            logger.error("Failed to get wallet balances:", error);
            return {
                success: false,
                error:
                    error instanceof Error ? error.message : "Failed to get wallet balances",
            };
        }
    },

    examples: [
        [
            {
                name: "Wallet Portfolio",
                content: { text: "Show my wallet balances for 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM" }
            },
            {
                name: "Portfolio Overview",
                content: { text: "What's in my portfolio?" }
            },
            {
                name: "All Balances",
                content: { text: "Get all token balances for my wallet" }
            },
            {
                name: "Account Summary",
                content: { text: "Show me everything in my account" }
            },
        ]
    ],

    similes: [
        "CHECK_WALLET_BALANCES",
        "GET_PORTFOLIO",
        "SHOW_ALL_BALANCES",
        "WALLET_SUMMARY",
    ],
};

function formatWalletBalancesResponse(balances: any): string {
    const solValue = balances.totalValueUsd ? balances.totalValueUsd - (balances.tokens.reduce((sum: number, t: any) => sum + (t.valueUsd || 0), 0)) : undefined;

    let response = `💼 **Wallet Portfolio**

**SOL Balance:** ${balances.solBalance.toFixed(4)}${solValue ? ` ($${solValue.toFixed(2)})` : ''}
**Total Tokens:** ${balances.tokens.length}
${balances.totalValueUsd ? `**Total Value:** $${balances.totalValueUsd.toFixed(2)}` : ''}

**Token Balances:**`;

    if (balances.tokens.length === 0) {
        response += `\nNo SPL tokens found in wallet.`;
    } else {
        // Sort tokens by USD value (highest first)
        const sortedTokens = balances.tokens.sort((a: any, b: any) => (b.valueUsd || 0) - (a.valueUsd || 0));

        sortedTokens.forEach((token: any, index: number) => {
            const valueText = token.valueUsd ? ` ($${token.valueUsd.toFixed(2)})` : '';
            response += `\n${index + 1}. **${token.symbol}:** ${token.uiAmount.toFixed(4)}${valueText}`;
        });
    }

    return response;
} 