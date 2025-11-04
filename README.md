# Spartan

<center>
<img src="./docs/spartan.jpg" style="width:100%">
</center>

## Overview

Spartan is your resident DeFi trading warlord—a no-BS tactician who blends alpha with attitude. Built on ElizaOS, Spartan is a sophisticated multi-chain DeFi agent with comprehensive capabilities for trading, analytics, market intelligence, and community engagement.

**Key Capabilities:**
- Multi-tenant wallet management with secure custody
- Autonomous trading strategies across Solana and EVM chains
- Advanced analytics with technical indicators and AI-powered insights
- Market intelligence gathering and sentiment analysis
- Community-driven investment with trust scoring
- Chrome extension for seamless browser integration
- MCP (Model Context Protocol) agents for AI integrations

Spartan is built with a modular plugin architecture, allowing you to use only the features you need.

## Core Features

- **🏦 Multi-Tenant Wallet System**: Secure, user-specific wallet management with import/export capabilities
- **📊 Advanced Analytics**: Comprehensive token analytics powered by Birdeye, CoinMarketCap, and Codex
- **🤖 Autonomous Trading**: AI-driven trading strategies with risk management and position tracking
- **🔍 Market Intelligence**: Real-time sentiment analysis, trending tokens, and whale activity monitoring
- **👥 Community Investment**: Trust-based recommendation system with performance tracking
- **🌐 Multi-Chain Support**: Solana, Ethereum, Base, and other EVM-compatible chains
- **🎯 Technical Analysis**: 14+ technical indicators including MACD, RSI, Bollinger Bands, and more
- **🔌 Browser Extension**: Chrome extension for DeFi interactions directly from your browser
- **🤝 MCP Integration**: AI agents for analytics, charting, and market data via Model Context Protocol

## Project Structure

```
spartan/
├── src/
│   ├── index.ts                    # Main Spartan agent export
│   ├── init.ts                     # Character initialization
│   ├── plugins/                    # All plugin modules
│   │   ├── account/                # Account registration system
│   │   ├── analytics/              # Advanced analytics & technical indicators
│   │   ├── autonomous-trader/      # Spartan product utilities
│   │   ├── trading/                # Trading strategies & position management
│   │   ├── multiwallet/            # Multi-tenant wallet system
│   │   ├── degenIntel/             # Market intelligence & sentiment
│   │   ├── communityInvestor/      # Community-driven investment
│   │   ├── autofunTrader/          # Auto.fun trading strategies
│   │   ├── kol/                    # KOL (Key Opinion Leader) features
│   │   └── coin_marketing/         # Coin marketing tools
│   ├── assets/                     # Images and logos
│   └── tasks/                      # Background task definitions
├── chrome-extension/               # Browser extension for DeFi
├── spartan-mcp/                    # MCP agents for AI integrations
│   ├── agents/                     # Analytics, charting, CoinGecko, Birdeye
│   ├── configs/                    # MCP configuration files
│   └── src/                        # MCP core services
├── docs/                           # Documentation
└── tests/                          # Test suites
```

## Prerequisites

### Local Development
- Node.js (v18 or higher recommended)
- npm or yarn

### Docker Deployment (Recommended)
- Docker Desktop or Docker Engine
- Docker Compose v2.0+

**For full Docker documentation, see [docker/README.md](./docker/README.md)**

## Setup

### Option 1: Standalone with ElizaOS CLI (Recommended)

The simplest way to run Spartan using the ElizaOS command-line utility:

```bash
# Install ElizaOS CLI globally
npm install -g @elizaos/cli
# or
npx @elizaos/cli

# Clone Spartan
git clone https://github.com/elizaOS/spartan.git
cd spartan

# Install dependencies
npm install

# Run with ElizaOS CLI
elizaos start
```

### Option 2: Development from Monorepo

For development and contributing to ElizaOS core:

```bash
# Clone the full ElizaOS monorepo
git clone https://github.com/elizaos/eliza
cd eliza/packages/spartan

# Install dependencies
npm install

# Run in development mode
npm run dev
```

## Environment Variables

Create a `.env` file in the root of the project (e.g., `packages/spartan/.env` or at the monorepo root `../../.env`). Not all variables are required for all functionalities—configure only what you need based on your enabled plugins.

```env
# ========================================
# AI Model Configuration
# ========================================
ANTHROPIC_API_KEY=your_anthropic_api_key          # Required for Claude models
OPENAI_API_KEY=your_openai_api_key                # Required for GPT models
GROQ_API_KEY=your_groq_api_key                    # Optional for Groq models
GROQ_LARGE_MODEL=meta-llama/llama-4-maverick-17b-128e-instruct
GROQ_SMALL_MODEL=meta-llama/llama-4-scout-17b-16e-instruct

# ========================================
# Database Configuration
# ========================================
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=spartan
# Or for PostgreSQL:
# POSTGRES_URL=postgresql://user:password@host:port/database

# ========================================
# Blockchain & RPC Configuration
# ========================================
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com  # Or Helius/QuickNode/Alchemy
HELIUS_API_KEY=your_helius_api_key                  # Optional for enhanced Solana RPC
EVM_PROVIDER_URL=https://mainnet.base.org           # For Base/EVM chains
RPC_URL=https://mainnet.base.org                    # Alternative EVM RPC config

# ========================================
# Wallet Configuration
# ========================================
SOLANA_PUBLIC_KEY=your_solana_public_key
SOLANA_PRIVATE_KEY=your_solana_private_key_base58   # Base58 encoded secret key
WALLET_PUBLIC_KEY=your_wallet_public_key            # Alternative naming
WALLET_PRIVATE_KEY=your_wallet_private_key          # Alternative naming

# ========================================
# DeFi Data Providers
# ========================================
# Analytics Plugin
BIRDEYE_API_KEY=your_birdeye_api_key               # Required for analytics & degenIntel
COINMARKETCAP_API_KEY=your_cmc_api_key             # Required for CMC data
CODEX_API_KEY=your_codex_api_key                   # Optional for holder analytics
COINGECKO_API_KEY=your_coingecko_api_key           # Optional for CoinGecko data
DEXSCREENER_API_KEY=your_dexscreener_api_key       # Optional for DEX data

# Trading & Swaps
JUPITER_API_KEY=your_jupiter_api_key               # For Jupiter DEX aggregator
JUPITER_API_URL=https://quote-api.jup.ag/v6        # Jupiter API endpoint
ZEROEX_API_KEY=your_0x_api_key                     # For 0x Protocol (EVM swaps)

# ========================================
# Social Platform Integration
# ========================================
# Discord
INVESTMENT_MANAGER_DISCORD_APPLICATION_ID=your_discord_app_id
INVESTMENT_MANAGER_DISCORD_API_TOKEN=your_discord_bot_token
DISCORD_VOICE_CHANNEL_ID=your_voice_channel_id
DISCORD_LISTEN_CHANNEL_IDS=["channel_id_1","channel_id_2"]  # Channels to monitor
DISCORD_POST_CHANNEL_IDS=["channel_id_3"]                   # Channels to post to
DISCORD_POST_IMMEDIATELY=false                              # Dev: post immediately
DISCORD_POST_INTERVAL_MIN=60                                # Minutes between posts
DISCORD_POST_INTERVAL_MAX=180                               # Max minutes

# Telegram
INVESTMENT_MANAGER_TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHANNEL_ID=your_telegram_channel_id

# Twitter
INVESTMENT_MANAGER_TWITTER_EMAIL=your_twitter_email
INVESTMENT_MANAGER_TWITTER_USERNAME=your_twitter_username
INVESTMENT_MANAGER_TWITTER_PASSWORD=your_twitter_password
INVESTMENT_MANAGER_TWITTER_ENABLE_POST_GENERATION=true

# ========================================
# Community Investor Plugin
# ========================================
PROCESS_TRADE_DECISION_INTERVAL_HOURS=1            # Trade processing interval
METRIC_REFRESH_INTERVAL_HOURS=24                   # Metrics refresh interval
USER_TRADE_COOLDOWN_HOURS=12                       # User cooldown between trades
SCAM_PENALTY=-100                                  # Penalty for scam calls
SCAM_CORRECT_CALL_BONUS=100                        # Bonus for correct scam detection
MAX_RECOMMENDATIONS_IN_PROFILE=50                   # Max recommendations per user

# ========================================
# Webhooks & Notifications
# ========================================
TRADER_SELL_KUMA=your_kuma_webhook_url             # Webhook for sell notifications

# ========================================
# Chrome Extension
# ========================================
SPARTAN_CHAT_MODEL=gpt-4                           # AI model for extension chat
VITE_API_URL=http://localhost:3000                 # Backend API for extension

# ========================================
# MCP (Model Context Protocol)
# ========================================
SPARTAN_BACKEND_URL=http://localhost:2096          # Spartan backend for MCP agents
SPARTAN_API_KEY=your_spartan_api_key               # Optional API key for Spartan
WALLET_PRIVATE_KEY=your_wallet_private_key         # For x402 payments

# ========================================
# Bootstrap & Core Settings
# ========================================
BOOTSTRAP_KEEP_RESP=true                           # Keep bootstrap responses
```

### Configuration Notes

**Wallet Keys:**
- `SOLANA_PRIVATE_KEY` should be base58 encoded (from Phantom/Solflare export)
- Ensure `SOLANA_PUBLIC_KEY` matches the derived public key
- Keep private keys secure and never commit to version control

**API Keys Priority:**
- **Essential**: `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`, `BIRDEYE_API_KEY`
- **Recommended**: `COINMARKETCAP_API_KEY`, `HELIUS_API_KEY`, `JUPITER_API_KEY`
- **Optional**: `COINGECKO_API_KEY`, `CODEX_API_KEY`, `DEXSCREENER_API_KEY`

**Database:**
- MySQL is currently the primary supported database
- PostgreSQL support available via `@elizaos/plugin-sql`

**Multi-Chain:**
- Configure `SOLANA_RPC_URL` for Solana operations
- Configure `EVM_PROVIDER_URL` for Base/Ethereum operations

## Running Tests

The project uses `vitest` for testing. You can run tests using npm or yarn:

```bash
npm test
# OR
yarn test
```

This will execute the test suites defined in `plugins.test.ts` and any other test files within the project. The tests initialize an `AgentRuntime` and run plugin-specific test cases. Refer to the `TEST_TIMEOUT` in `plugins.test.ts` if tests are timing out.

## Running the Project

### Quick Start with Docker (Recommended)

The fastest way to get Spartan running with all dependencies:

```bash
# Clone and navigate to directory
git clone https://github.com/elizaOS/spartan.git
cd spartan

# Start with Docker Compose
docker-compose up -d
```

This starts MySQL, Redis, and Spartan application with a single command. See **[docker/README.md](./docker/README.md)** for complete Docker documentation.

### Standalone with ElizaOS CLI

Run Spartan without Docker using the ElizaOS CLI:

```bash
# Install ElizaOS CLI globally (one time)
npm install -g @elizaos/cli

# Start Spartan
elizaos start

# Or use npx (no installation needed)
npx @elizaos/cli start
```

### Local Development

**Development Mode:**
```bash
npm run dev
# or
elizaos dev
```

**Production Mode:**
```bash
npm run start
# or
elizaos start
```

**Run Specific Tests:**
```bash
npm run test
# or
elizaos test --port 3001
```

### Running Frontend Interfaces

**DegenIntel Frontend:**
```bash
cd src/plugins/degenIntel/frontend
npm install  # if needed
npm run dev
```
Set `VITE_API_URL` in your `.env` to point to the Spartan backend.

**Community Investor Frontend:**
```bash
cd src/plugins/communityInvestor/frontend
npm install  # if needed
npm run dev
```

**Build Production Frontend:**
```bash
npm run build-frontend
```

### Running Chrome Extension

See **[Chrome Extension README](./chrome-extension/README.md)** for build and installation instructions.

### Running MCP Agents

See **[MCP Integration Guide](./spartan-mcp/INTEGRATION.md)** for setup and usage instructions.

## Available Plugins

Spartan includes 10+ specialized plugins for comprehensive DeFi functionality:

### 🔐 Account Registration Plugin (`account`)
User account management and registration system for ElizaOS.

**Features:**
- User registration and email verification
- Account settings management
- Notification preferences (turn on/off)
- Multi-tenant account support

**Actions:** `userRegistration`, `checkRegistrationCode`, `deleteRegistration`, `turnOnNotifications`, `turnOffNotifications`

**Providers:** `accountProvider`, `userProvider`

---

### 📊 Analytics Plugin (`analytics`)
Comprehensive analytics platform integrating Birdeye, CoinMarketCap, and Codex.

**Features:**
- Token analytics with price data, technical indicators, and holder metrics
- Account portfolio analytics with performance tracking and risk metrics
- Market analytics with top gainers/losers and trending tokens
- Historical analysis with price trends and volume patterns
- 14+ technical indicators (MACD, RSI, Bollinger Bands, Stochastic, ATR, Williams %R, CCI, MFI, Parabolic SAR, ADX)
- Risk assessment and trading recommendations

**Actions:** `getTokenAnalytics`, `getAccountAnalytics`, `getMarketAnalytics`, `getHistoricalAnalytics`, `getTechnicalIndicators`

**Providers:** `analyticsProvider`, `marketDataProvider`, `technicalIndicatorsProvider`, `historicalDataProvider`

**Services:** `AnalyticsService`, `MarketDataService`, `TechnicalAnalysisService`

---

### ⚔️ Autonomous Trader Plugin (`autonomous-trader`)
Core Spartan product utilities and holder verification.

**Features:**
- Holder verification for token access control
- Spartan product instructions and links
- Common utilities for trading operations

**Actions:** `verifyHolder`

**Providers:** `holderProvider`, `instructionsProvider`, `linksProvider`

---

### 📈 Trading Plugin (`trading`)
Multi-strategy trading engine with position management.

**Features:**
- Multiple trading strategies: LLM-based, copy trading, manual
- Position tracking and management
- Market data providers
- Automated position settings

**Actions:** `setStrategy`, `changeStrategy`, `positionSettings`, `openPosition`

**Providers:** `positionProvider`, `marketProvider`

**Services:** `InterfacePositionsService`

**Strategies:** `llmStrategy`, `copyStrategy`, `noneStrategy`

---

### 💼 Multiwallet Plugin (`multiwallet`)
Multi-tenant wallet management system.

**Features:**
- Create and import wallets per user
- Token swaps using Jupiter aggregator
- Wallet sweeping (consolidate all tokens)
- Cross-wallet transfers
- Balance tracking for all tokens

**Actions:** `walletCreate`, `walletImport`, `userMetawalletList`, `userMetawalletSwap`, `userMetawalletSweep`, `userMetawalletXfer`

**Providers:** `multiwalletProvider`, `walletProvider`, `tokenProvider`

**Services:** `InterfaceWalletService`

---

### 🔍 DegenIntel Plugin (`degenIntel`)
Market intelligence, sentiment analysis, and data aggregation.

**Features:**
- Twitter sentiment analysis and signal generation
- Birdeye trending tokens and wallet tracking
- CoinMarketCap market data
- Token research and sniffing
- Real-time buy/sell signal generation
- React frontend for data visualization
- API endpoints for MCP integration

**Providers:** `tokenResearchProvider`, `sentimentProvider`, `birdeyeTrendingProvider`, `birdeyeWalletProvider`, `cmcMarketProvider`

**Services:** `TradeChainService`, `TradeDataProviderService`, `TradeStrategyService`, `TradeLpService`

**Evaluators:** `tokenSnifferEvaluator`

**Tasks:** Twitter scraping, Birdeye sync, CoinMarketCap sync, buy/sell signal generation, sentiment analysis

---

### 👥 Community Investor Plugin (`communityInvestor`)
Community-driven investment with trust scoring and leaderboards.

**Features:**
- Trust-based recommendation system
- Performance tracking and scoring
- Community leaderboard
- Trade decision processing
- Scam detection with penalties/bonuses
- React frontend for leaderboard display

**Services:** `CommunityInvestorService`

**Routes:** Leaderboard API, trust scores, recommendations

**Events:** Trade execution, recommendation updates, trust score changes

---

### 🤖 Autofun Trader Plugin (`autofunTrader`)
Autonomous trading strategies for auto.fun platform.

**Features:**
- Automated buy signal generation (every 5 minutes)
- Position monitoring and sell signals
- Integration with auto.fun IDL contracts
- Raydium vault support

**Services:** `DegenTradingService`

**Tasks:** `AFTRADER_GOTO_MARKET` (buy signals), `AFTRADER_CHECK_POSITIONS` (sell signals)

---

### 📣 KOL Plugin (`kol`)
Key Opinion Leader features (minimal implementation, ready for extension).

**Status:** Initialized framework ready for custom KOL features

---

### 🪙 Coin Marketing Plugin (`coin_marketing`)
Coin marketing and promotion tools.

**Features:**
- Coin data provider
- Marketing campaign support

**Providers:** `coinProvider`

---

### 🌐 Chrome Extension

Browser extension for seamless DeFi integration with token balances, swaps, and AI-powered trading advice.

**📖 [View Chrome Extension Documentation](./chrome-extension/README.md)**

---

### 🤝 Spartan MCP (Model Context Protocol)

AI agents for analytics, charting, and market data using Model Context Protocol with x402 payment integration.

**📖 [View MCP Integration Guide](./spartan-mcp/INTEGRATION.md)**

---

## ElizaOS Core Plugins Used

- **`@elizaos/plugin-mysql`**: MySQL database support
- **`@elizaos/plugin-anthropic`**: Claude AI models
- **`@elizaos/plugin-openai`**: OpenAI GPT models and embeddings
- **`@elizaos/plugin-discord`**: Discord bot integration
- **`@elizaos/plugin-telegram`**: Telegram bot integration
- **`@elizaos/plugin-bootstrap`**: Core ElizaOS functionality
- **`@elizaos/plugin-solana`**: Solana blockchain interactions
- **`@elizaos/plugin-jupiter`**: Jupiter DEX aggregator (planned)
- **`@elizaos/plugin-evm`**: EVM chain support
- **`@elizaos/plugin-birdeye`**: Birdeye market data API
- **`@elizaos/plugin-coinmarketcap`**: CoinMarketCap data integration

---

## Plugin Customization

### Enabling/Disabling Plugins

To customize which plugins are loaded, edit `src/index.ts`:

```typescript
export const spartan: ProjectAgent = {
  plugins: [
    // Core plugins
    accountRegPlugin,           // Account management
    autonomousTraderPlugin,     // Spartan utilities
    
    // Optional: Comment out plugins you don't need
    // analyticsPlugin,         // Advanced analytics
    degenIntelPlugin,           // Market intelligence
    multiwalletPlugin,          // Wallet management
    traderPlugin,               // Trading strategies
    // communityInvestorPlugin, // Community investment
    // kolPlugin,               // KOL features
    // coinMarketingPlugin,     // Marketing tools
  ],
  character,
  init: async (runtime: IAgentRuntime) => await initCharacter({ runtime, config }),
};
```

### Plugin Dependencies

Some plugins depend on others:
- **Trading Plugin** requires **Multiwallet Plugin**
- **Multiwallet Plugin** requires **DegenIntel Plugin** (for market data)
- **Analytics Plugin** can work standalone but enhances Trading Plugin

### Creating Custom Plugins

Create a new plugin following this structure:

```typescript
import type { Plugin } from '@elizaos/core';

export const myCustomPlugin: Plugin = {
  name: 'my-custom-plugin',
  description: 'Description of your plugin',
  
  // Optional: Actions users can trigger
  actions: [],
  
  // Optional: Data providers for context
  providers: [],
  
  // Optional: Evaluators for scoring/filtering
  evaluators: [],
  
  // Optional: Background services
  services: [],
  
  // Optional: HTTP routes
  routes: [],
  
  // Optional: Event handlers
  events: {},
  
  // Optional: Initialization logic
  init: async (config, runtime) => {
    // Your initialization code
  },
};
```

---

## Usage Examples

### Analytics Plugin Examples

**Get Token Analytics:**
```
User: Analyze token So11111111111111111111111111111111111111112
Spartan: [Returns comprehensive analytics with price, technical indicators, holder data]

User: Show me RSI and MACD for this token
Spartan: [Returns technical indicators with trading signals]

User: Get token analytics for BONK with historical data
Spartan: [Returns full analysis including price trends]
```

**Account Analytics:**
```
User: Analyze my portfolio performance
Spartan: [Returns portfolio value, PnL, best/worst performers, risk metrics]

User: Show my trading history and win rate
Spartan: [Returns trading statistics and performance analysis]
```

**Market Analytics:**
```
User: Show me top gainers and losers on Solana
Spartan: [Returns market overview with top performers]

User: What are the trending tokens right now?
Spartan: [Returns trending tokens with volume and momentum data]
```

### Multiwallet Plugin Examples

**Wallet Management:**
```
User: Create a new wallet
Spartan: [Creates new Solana wallet and returns address]

User: Import wallet with private key: [key]
Spartan: [Imports wallet securely]

User: List my wallets
Spartan: [Shows all wallets with balances]
```

**Token Operations:**
```
User: Swap 1 SOL to USDC in my wallet
Spartan: [Gets Jupiter quote and executes swap]

User: Sweep all tokens to SOL
Spartan: [Consolidates all token balances to SOL]

User: Transfer 0.5 SOL from wallet A to wallet B
Spartan: [Executes transfer between user's wallets]
```

### Trading Plugin Examples

**Strategy Management:**
```
User: Set my trading strategy to LLM-based
Spartan: [Configures LLM trading strategy]

User: Change strategy to copy trading
Spartan: [Switches to copy trading strategy]

User: What's my current trading strategy?
Spartan: [Shows active strategy and settings]
```

**Position Management:**
```
User: Show my open positions
Spartan: [Lists all active positions with PnL]

User: Update position settings for risk management
Spartan: [Adjusts stop-loss, take-profit, etc.]
```

### DegenIntel Plugin Examples

**Market Intelligence:**
```
User: What's the sentiment for this token?
Spartan: [Returns sentiment analysis from Twitter and other sources]

User: Show me trending tokens on Birdeye
Spartan: [Returns trending Solana tokens with metrics]

User: What are whales doing right now?
Spartan: [Shows large transactions and whale activity]
```

**Token Research:**
```
User: Research token [address]
Spartan: [Provides comprehensive token analysis including security, holders, trading activity]
```

### Community Investor Plugin Examples

**Trust & Recommendations:**
```
User: Show community leaderboard
Spartan: [Displays trust scores and top performers]

User: What are the current recommendations?
Spartan: [Shows community investment recommendations]

User: Check my trust score
Spartan: [Returns user's trust score and performance]
```

### Chrome Extension

For usage examples and detailed instructions, see **[Chrome Extension README](./chrome-extension/README.md)**.

### MCP Agents

For usage examples and agent-specific instructions, see **[MCP Integration Guide](./spartan-mcp/INTEGRATION.md)**.

---

## Architecture & Design

### Plugin Architecture

Spartan uses a modular plugin architecture where each plugin is self-contained:

```
Plugin
├── Actions       # User-triggered commands
├── Providers     # Data sources for context
├── Evaluators    # Scoring and filtering logic
├── Services      # Background processing
├── Routes        # HTTP API endpoints
├── Events        # Event handlers
└── Tasks         # Scheduled operations
```

### Data Flow

```
User Input → Action → Provider (context) → Service (processing) → Response
                ↓
          Evaluator (filtering/scoring)
                ↓
            Memory/Cache
```

### Service Integration

Services can communicate across plugins:
```typescript
// Access another plugin's service
const dataProvider = runtime.getService('TRADER_DATAPROVIDER');
const chainService = runtime.getService('TRADER_CHAIN');
```

---

## Best Practices

### Security
- Never commit private keys to version control
- Use environment variables for all secrets
- Implement proper input validation
- Use secure RPC endpoints (Helius, QuickNode)
- Enable 2FA on all service accounts

### Performance
- Enable caching for frequently accessed data
- Use rate limiting for API calls
- Implement retry logic with exponential backoff
- Monitor memory usage for long-running tasks
- Use connection pooling for databases

### Development
- Write tests for all actions and services
- Use TypeScript strict mode
- Follow ElizaOS plugin conventions
- Document all public APIs
- Use semantic versioning

### Production
- Set up proper logging and monitoring
- Configure database backups
- Use production-grade RPC endpoints
- Implement error tracking (Sentry, etc.)
- Set up health check endpoints
- Use process managers (PM2, systemd)

---

## Troubleshooting

### Common Issues

**"Service not found" errors:**
- Ensure required plugins are loaded in correct order
- Check plugin dependencies in `src/index.ts`
- Verify service names match expected values

**RPC connection issues:**
- Verify `SOLANA_RPC_URL` is accessible
- Check rate limits on your RPC provider
- Consider upgrading to paid RPC tier
- Use multiple RPC endpoints for fallback

**Database connection errors:**
- Verify database credentials in `.env`
- Check database server is running
- Ensure proper network access
- Run database migrations if needed

**API key errors:**
- Verify all required API keys are set
- Check API key quotas and limits
- Ensure API keys are valid and active
- Monitor API usage dashboards

**Memory issues:**
- Clear cache periodically
- Limit concurrent operations
- Reduce data retention periods
- Monitor memory usage with tools

### Debug Mode

Enable debug logging:
```bash
DEBUG=elizaos:* npm run dev
```

Run specific plugin tests:
```bash
npm run test -- --grep "analytics"
```

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

1. Install dependencies: `npm install`
2. Set up environment variables (see `.env.example`)
3. Run tests: `npm test`
4. Start in dev mode: `npm run dev`

---

## License

MIT License - see LICENSE file for details

---

## Links & Resources

- **Spartan Homepage**: https://spartan.elizaos.ai
- **GitHub Repository**: https://github.com/elizaOS/spartan
- **ElizaOS Framework**: https://github.com/elizaos/eliza
- **Spartan Twitter**: @SpartanVersus
- **Token ($degenai)**: `Gu3LDkn7Vx3bmCzLafYNKcDxv2mH7YN44NJZFXnypump`
- **Eliza Labs Token ($ai16z)**: `HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC`
- **Documentation**: Check individual plugin README files
- **Discord**: Join the ElizaOS community

---

## Acknowledgments

Built with ❤️ using ElizaOS by ShawMakesMagic and the Eliza Labs team.

Special thanks to:
- DegenSpartan for the inspiration
- ElizaOS community for the framework
- All contributors and testers

---

**Spartan: No BS, just results. Deploy, trade, win.**