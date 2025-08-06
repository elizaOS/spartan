import {
    Action,
    IAgentRuntime,
    Memory,
    logger,
} from "@elizaos/core";
import { z } from "zod";
import { GetTokenBalanceParams } from "../types";
import { getTokenBalanceFromServices } from "../../../src/plugins/degenIntel/utils";

const getTokenBalanceSchema = z.object({
    walletAddress: z.string().min(32).max(44),
    tokenMint: z.string().min(32).max(44),
});

export const getTokenBalanceAction: Action = {
    name: "GET_TOKEN_BALANCE",
    description: "Get the balance of a specific token for a wallet address using degenIntel services",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase() || "";

        // Check if message contains balance checking intent
        const hasBalanceIntent = /balance|amount|holdings|tokens/.test(text);
        const hasWalletContext = /wallet|address|account/.test(text);
        const hasTokenContext = /token|coin|mint/.test(text);

        return hasBalanceIntent && (hasWalletContext || hasTokenContext);
    },

    handler: async (runtime: IAgentRuntime, message: Memory) => {
        try {
            // Extract wallet address and token mint from message
            const text = message.content.text || "";

            // Look for Solana addresses (base58 encoded, 32-44 characters)
            const addressMatches = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);

            if (!addressMatches || addressMatches.length < 2) {
                return {
                    success: false,
                    error: "Could not extract wallet address and token mint from message. Please provide both addresses.",
                };
            }

            const [walletAddress, tokenMint] = addressMatches;

            const params: GetTokenBalanceParams = {
                walletAddress,
                tokenMint,
            };

            // Validate parameters
            const validated = getTokenBalanceSchema.parse(params);

            // Get token balance using degenIntel services
            const balance = await getTokenBalanceFromServices(runtime, validated.walletAddress, validated.tokenMint);

            if (!balance) {
                return {
                    success: false,
                    error: "Token not found in wallet or invalid token mint address",
                };
            }

            logger.info(`Retrieved token balance: ${balance.symbol} - ${balance.uiAmount}`);

            const response = formatBalanceResponse(balance);

            return {
                success: true,
                data: {
                    balance,
                    walletAddress: validated.walletAddress,
                    tokenMint: validated.tokenMint,
                },
                message: response,
            };
        } catch (error) {
            logger.error("Failed to get token balance:", error);
            return {
                success: false,
                error:
                    error instanceof Error ? error.message : "Failed to get token balance",
            };
        }
    },

    examples: [
        [
            {
                name: "SOL Balance Check",
                content: { text: "What's my SOL balance in wallet 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM?" }
            },
            {
                name: "Token Balance Check",
                content: { text: "Check token balance for mint EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v in my wallet" }
            },
            {
                name: "USDC Balance",
                content: { text: "How much USDC do I have?" }
            },
        ]
    ],

    similes: [
        "CHECK_TOKEN_BALANCE",
        "GET_TOKEN_AMOUNT",
        "SHOW_TOKEN_HOLDINGS",
        "BALANCE_OF_TOKEN",
    ],
};

function formatBalanceResponse(balance: any): string {
    const valueText = balance.valueUsd
        ? ` ($${balance.valueUsd.toFixed(2)})`
        : "";

    return `💰 **Token Balance**

**Token:** ${balance.name} (${balance.symbol})
**Balance:** ${balance.uiAmount.toFixed(4)}${valueText}
**Mint Address:** \`${balance.mint}\`
**Decimals:** ${balance.decimals}`;
} 