# @elizaos/plugin-spartan-defi

A powerful DeFi integration plugin for ElizaOS that enables token management, swaps, and AI-powered trading insights on Solana using degenIntel services.

## Features

- 💰 **Token Balance Management** - Check balances for any SPL token in your wallet
- 🔄 **Token Swaps** - Get quotes and execute swaps using Jupiter aggregator
- 🤖 **Spartan AI Chat** - AI-powered trading advice and market analysis
- 📊 **Portfolio Overview** - Complete wallet balance and portfolio tracking
- 🔗 **degenIntel Integration** - Leverages existing degenIntel services for data
- ⚡ **Real-time Market Data** - Live token prices and market information
- 🎯 **Smart Context** - AI understands your portfolio and trading history

## How It Works

This plugin integrates with ElizaOS and leverages existing degenIntel services to provide comprehensive DeFi functionality. It uses Jupiter for token swaps, Birdeye for market data, and OpenAI for AI-powered insights.

```
ElizaOS Agent ← Spartan DeFi Plugin ← degenIntel Services ← Solana Blockchain
```

## Quick Start

### 1. Install the Plugin

```bash
npm install @elizaos/plugin-spartan-defi
```

### 2. Configure Environment Variables

Create a `.env` file in your project root:

```bash
# Solana RPC Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Jupiter API for swaps
JUPITER_API_URL=https://quote-api.jup.ag/v6

# Birdeye API for market data (optional)
BIRDEYE_API_KEY=your-birdeye-api-key-here

# AI Model for Spartan chat
SPARTAN_CHAT_MODEL=gpt-4
```

### 3. Add Plugin to Your Agent

```javascript
import { spartanDefiPlugin } from '@elizaos/plugin-spartan-defi';

const character = {
  name: "MyAgent",
  plugins: [spartanDefiPlugin],
  // ... rest of your character config
};
```

### 4. Start Your Agent

```bash
elizaos start
```

The plugin will automatically initialize and connect to degenIntel services.

## Usage

### Check Token Balance

```
User: What's my SOL balance in wallet 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM?
User: Check token balance for mint EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v in my wallet
User: How much USDC do I have?
```

Returns detailed balance information including:
- Token name and symbol
- Current balance amount
- USD value (if available)
- Token mint address

### Get Wallet Portfolio

```
User: Show my wallet balances for 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
User: What's in my portfolio?
User: Get all token balances for my wallet
User: Show me everything in my account
```

Returns comprehensive portfolio overview:
- SOL balance with USD value
- All SPL token balances
- Total portfolio value
- Sorted by value (highest first)

### Get Swap Quotes

```
User: Swap 1 SOL to USDC
User: Get a quote for swapping 100 USDC to SOL
User: Exchange 0.5 SOL for USDT
User: Convert 50 USDC to another token
```

Provides detailed swap information:
- Input and output amounts
- Price impact percentage
- Slippage tolerance
- Route details
- Swap mode information

### Chat with Spartan AI

```
User: Spartan, what's your analysis of the current market?
User: What trading advice do you have for me?
User: How should I manage my DeFi portfolio?
User: Spartan, explain the current market sentiment
User: What are the risks of this token?
```

Returns AI-powered insights including:
- Market analysis and trends
- Trading recommendations
- Portfolio management advice
- Risk assessments
- Suggested actions

## Available Actions

| Action | Description | Example Command |
|--------|-------------|-----------------|
| `GET_TOKEN_BALANCE` | Check specific token balance | "What's my SOL balance?" |
| `GET_WALLET_BALANCES` | Get complete portfolio | "Show my wallet balances" |
| `SWAP_TOKENS` | Get swap quotes | "Swap 1 SOL to USDC" |
| `CHAT_WITH_SPARTAN` | AI trading advice | "Spartan, analyze the market" |

## Dependencies

This plugin requires the following degenIntel services to be available:

- **TRADER_DATAPROVIDER** - For market data and token information
- **TRADER_CHAIN** - For blockchain interactions
- **chain_solana** - For Solana-specific operations

The plugin will gracefully handle missing services and provide appropriate warnings.

## Configuration Options

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `SOLANA_RPC_URL` | Solana RPC endpoint | `https://api.mainnet-beta.solana.com` |
| `JUPITER_API_URL` | Jupiter API endpoint | `https://quote-api.jup.ag/v6` |
| `BIRDEYE_API_KEY` | Birdeye API key for market data | Optional |
| `SPARTAN_CHAT_MODEL` | AI model for Spartan chat | `gpt-4` |

## Architecture

```
┌─────────────────┐     degenIntel     ┌─────────────────┐
│                 │ ◄─────────────────► │                 │
│   ElizaOS       │                     │   degenIntel    │
│   Agent         │                     │   Services      │
│                 │                     │                 │
└────────┬────────┘                     └────────┬────────┘
         │                                       │
         │ Plugin Actions                       │ Data Sources
         │                                       │
┌────────▼────────┐                    ┌────────▼────────┐
│                 │                    │                 │
│  Spartan DeFi   │                    │  Jupiter API    │
│    Plugin       │                    │  Birdeye API    │
│                 │                    │  OpenAI API     │
└─────────────────┘                    └─────────────────┘
```

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/elizaos/plugin-spartan-defi
cd plugin-spartan-defi

# Install dependencies
npm install

# Build the plugin
npm run build
```

### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch
```

## Troubleshooting

### Service Dependencies

**Missing degenIntel services:**
- Ensure the degenIntel plugin is loaded before this plugin
- Check that required services are available in runtime
- Plugin will show warnings for missing services

**RPC connection issues:**
- Verify `SOLANA_RPC_URL` is accessible
- Consider using a different RPC provider
- Check network connectivity

### API Issues

**Jupiter API errors:**
- Verify `JUPITER_API_URL` is correct
- Check if tokens are supported by Jupiter
- Ensure wallet addresses are valid Solana addresses

**Birdeye API issues:**
- API key is optional but provides enhanced market data
- Free tier has rate limits
- Consider upgrading for production use

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT © ElizaOS

## Support

- [Documentation](https://elizaos.ai/docs)
- [Discord Community](https://discord.gg/ai16z)
- [GitHub Issues](https://github.com/elizaos/plugin-spartan-defi/issues)

---

Made with ❤️ by the ElizaOS community
