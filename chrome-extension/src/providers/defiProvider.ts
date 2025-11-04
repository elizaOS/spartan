import { Provider, IAgentRuntime, Memory, State, logger } from "@elizaos/core";

export const defiProvider: Provider = {
    name: "spartan-defi",
    description: "Provides DeFi context including wallet balances, market data, and trading insights using degenIntel services",

    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        try {
            // Get degenIntel services
            const dataProviderService = runtime.getService("TRADER_DATAPROVIDER");
            const chainService = runtime.getService("TRADER_CHAIN");
            const solanaService = runtime.getService("chain_solana");

            // Build context text
            let contextText = "**DeFi Context (via degenIntel):**\n";

            // Add service availability info
            contextText += `- Data Provider Service: ${dataProviderService ? '✅' : '❌'}\n`;
            contextText += `- Chain Service: ${chainService ? '✅' : '❌'}\n`;
            contextText += `- Solana Service: ${solanaService ? '✅' : '❌'}\n`;

            // Get market data from cache
            try {
                const cachedTokens = await runtime.getCache('tokens_solana') || [];
                if (cachedTokens.length > 0) {
                    contextText += `- Cached Tokens: ${cachedTokens.length}\n`;

                    // Show top tokens
                    const topTokens = cachedTokens.slice(0, 3);
                    contextText += `- Top Tokens: ${topTokens.map((t: any) => `${t.symbol}: $${t.price?.toFixed(4) || 'N/A'}`).join(', ')}\n`;
                }
            } catch (error) {
                contextText += `- Market Data: Not available\n`;
            }

            // Get portfolio data
            try {
                const portfolioData = await runtime.getCache('portfolio');
                if (portfolioData?.data) {
                    contextText += `- Portfolio Value: $${portfolioData.data.totalUsd?.toFixed(2) || 'N/A'}\n`;
                    contextText += `- Portfolio Tokens: ${portfolioData.data.items?.length || 0}\n`;
                }
            } catch (error) {
                contextText += `- Portfolio: Not available\n`;
            }

            // Get transaction history
            try {
                const transactionHistory = await runtime.getCache('transaction_history') || [];
                if (transactionHistory.length > 0) {
                    contextText += `- Recent Transactions: ${transactionHistory.length}\n`;
                }
            } catch (error) {
                contextText += `- Transaction History: Not available\n`;
            }

            // Add available actions
            contextText += `\n**Available Actions:**\n`;
            contextText += `- Get wallet balances\n`;
            contextText += `- Check token balances\n`;
            contextText += `- Get swap quotes\n`;
            contextText += `- Chat with Spartan AI\n`;
            contextText += `- View market trends\n`;
            contextText += `- Analyze portfolio\n`;

            return { text: contextText };
        } catch (error) {
            logger.error("Error in DeFi provider:", error);
            return { text: "DeFi context temporarily unavailable" };
        }
    },
}; 