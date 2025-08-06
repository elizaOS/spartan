/**
 * Basic usage example for the Spartan DeFi plugin
 * 
 * This plugin provides DeFi functionality by integrating with existing degenIntel services:
 * - Token balance checking via chain_solana service
 * - Wallet portfolio management via TRADER_DATAPROVIDER
 * - Token swapping via Jupiter API
 * - AI-powered trading insights via Spartan
 * - Market data from degenIntel cache
 * 
 * API routes are available through the degenIntel plugin at port 2096
 */

import { AgentRuntime } from "@elizaos/core";
import { spartanDefiPlugin } from "../src/index";

// Example character configuration
const character = {
  name: "Spartan",
  bio: "A DeFi expert AI assistant that helps with token management and trading insights using degenIntel services",
  plugins: ["spartan-intel", "plugin-spartan-defi"], // Note: depends on spartan-intel
};

// Example usage in your agent
async function setupAgent() {
  // Initialize your agent runtime
  const runtime = new AgentRuntime({
    character,
    // ... other configuration
  });

  // The plugin will be automatically loaded and available

  // Example: Get wallet balances programmatically
  // This would typically be triggered by a user message
  const walletAddress = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

  // The plugin provides actions that can be triggered:
  // - GET_TOKEN_BALANCE: Get balance of a specific token (uses chain_solana service)
  // - GET_WALLET_BALANCES: Get all balances in a wallet (uses chain_solana + cache)
  // - SWAP_TOKENS: Get swap quotes and execute swaps (uses Jupiter API)
  // - CHAT_WITH_SPARTAN: Get AI-powered DeFi insights (uses degenIntel cache + LLM)
}

// Environment variables needed:
// SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
// JUPITER_API_URL=https://quote-api.jup.ag/v6
// BIRDEYE_API_KEY=your-birdeye-api-key (optional, for enhanced price data)
// SPARTAN_CHAT_MODEL=gpt-4 (optional)

// Example prompts that trigger the plugin:
// - "Show my wallet balances for 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
// - "What's my SOL balance?"
// - "Get a swap quote for 1 SOL to USDC"
// - "Spartan, what's your analysis of the current market?"

// API Endpoints (available through degenIntel plugin on port 2096):
// GET /spartan-defi/balances/:walletAddress
// GET /spartan-defi/token/:walletAddress/:tokenMint
// POST /spartan-defi/swap/quote
// POST /spartan-defi/swap/execute
// POST /spartan-defi/chat
// GET /spartan-defi/market-data
// GET /spartan-defi/portfolio
// GET /spartan-defi/transactions
// GET /spartan-defi/status

console.log(`
Spartan DeFi Plugin - Basic Usage Example

This plugin provides comprehensive DeFi functionality by integrating with existing degenIntel services:

🔹 Service Integration:
- Uses chain_solana service for blockchain interactions
- Leverages TRADER_DATAPROVIDER for market data
- Integrates with TRADER_CHAIN for multi-chain support
- Accesses degenIntel cache for real-time data

🔹 Token Management:
- Check individual token balances via Solana RPC
- Get complete wallet portfolios with USD values
- Real-time price data from degenIntel cache
- Token metadata from data provider services

🔹 Trading Features:
- Jupiter swap quotes with proper decimal handling
- Token exchange execution (simulated)
- Slippage protection and route optimization
- Integration with existing trading infrastructure

🔹 AI-Powered Insights:
- Spartan AI chat for trading advice
- Market analysis using degenIntel data
- Portfolio optimization suggestions
- Context-aware responses with real market data

🔹 API Integration:
- RESTful API endpoints available through degenIntel plugin
- Real-time market data from cache
- Portfolio and transaction history
- Service status and dependency monitoring

🔹 Dependencies:
- spartan-intel plugin (required)
- chain_solana service
- TRADER_DATAPROVIDER service
- TRADER_CHAIN service

The plugin integrates with:
- Solana blockchain (mainnet)
- Jupiter aggregator for swaps
- degenIntel cache for market data
- Birdeye for price data (optional)
- OpenAI for AI insights

Example API calls (via degenIntel plugin):
curl http://localhost:2096/spartan-defi/balances/9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
curl -X POST http://localhost:2096/spartan-defi/chat -H "Content-Type: application/json" -d '{"message": "What's the current market sentiment?"}'
curl http://localhost:2096/spartan-defi/market-data
curl http://localhost:2096/spartan-defi/portfolio

Note: This plugin extends the existing degenIntel functionality rather than replacing it.
All DeFi operations are built on top of the robust degenIntel infrastructure.
API routes are hosted by the degenIntel plugin, not this plugin directly.
`); 