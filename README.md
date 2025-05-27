# Spartan

<center>
<img src="./docs/spartan.jpg" style="width:100%">
</center>

## Overview

Spartan is your resident Solana-based DeFi trading warlord—a no-BS tactician who blends alpha with attitude. He's part shitposter, part protocol whisperer, and all about winning (even if it means dying on-chain for the memes).

Spartan is a sophisticated DeFi agent with a range of capabilities, including:

- Managing shared trading pools.
- Executing trades across Solana DEXs (e.g., Orca, Raydium, Meteora).
- Tracking token data and market trends using sources like Defined.fi.
- Optional copy trading from specified elite wallets.
- Managing LP positions with optimal strategies.
- Deploying autonomous trading tactics.

Spartan always demands explicit confirmation before executing critical actions.

## Features

- **Multi-Plugin Architecture**: Leverages various plugins for functionalities like SQL database interaction, AI model access (OpenAI, Anthropic, Groq, LocalAI), Discord/Telegram/Twitter integrations, PDF/video understanding, and Solana blockchain interactions.
- **Trading Services**: Includes specialized services for different trading strategies and intelligence gathering:
  - `CommunityInvestor`: Focuses on collaborative trading and recommendations.
  - `DegenIntel`: Gathers and processes intelligence from various sources like Twitter, CoinMarketCap, and Birdeye.
  - `DegenTrader` & `AutofunTrader`: Implement autonomous trading strategies.
  - `Autofun`: Provides data from the auto.fun platform.
- **Task Management**: Uses a robust task system for scheduling and executing background operations like data syncing and signal generation.
- **Comprehensive Data Handling**: Manages and caches data from various DeFi sources for efficient analysis and decision-making.
- **Frontend Interface**: (For `DegenIntel`) A React-based frontend to visualize sentiment, trending tokens, wallet information, and more.

## Project Structure

The project is organized into several main plugins, each with its own set of services, tasks, and utilities:

```
src
├── init.ts                     # Character initialization logic
├── plugins.test.ts             # Main test suite for plugins
├── vite-env.d.ts               # Vite environment type definitions
├── index.ts                    # Main project export, character definition
├── assets                      # Static assets (logos, images)
│   ├── portrait.jpg
│   └── logos
│       └── ... (various logos)
└── plugins                     # Core feature modules
    ├── socialAlpha       # Manages community-based investment strategies
    │   ├── clients.ts
    │   ├── config.ts
    │   ├── constants.ts
    │   ├── index.ts
    │   ├── performanceScore.ts
    │   ├── providers
    │   │   ├── data.ts
    │   │   └── recommendations.ts
    │   ├── recommendations
    │   │   ├── agentPositions.ts
    │   │   ├── analysis.ts
    │   │   ├── confirm.ts
    │   │   ├── evaluator.ts
    │   │   ├── examples.ts
    │   │   ├── positions.ts
    │   │   ├── report.ts
    │   │   ├── schema.ts
    │   │   └── simulatedPositions.ts
    │   ├── reports.ts
    │   ├── schemas.ts
    │   ├── tokenProvider.ts
    │   ├── service.ts
    │   ├── types.ts
    │   ├── utils.ts
    │   └── wallets
    │       ├── jitoBundle.ts
    │       └── solana.ts
    ├── autofunTrader             # Autonomous trading strategies (AutoFun specific)
    │   ├── config
    │   │   └── ... (configuration files)
    │   ├── idl
    │   │   ├── autofun.json
    │   │   └── raydium_vault.json
    │   ├── index.ts
    │   ├── services
    │   │   └── ... (various trading and data services)
    │   ├── service.ts
    │   ├── types
    │   │   └── ... (type definitions)
    │   └── utils
    │       └── ... (utility functions)
    ├── degenIntel                # Degenerate intelligence gathering and analysis
    │   ├── apis.ts
    │   ├── frontend              # React frontend for DegenIntel
    │   │   └── ... (tsx, css components)
    │   ├── index.ts
    │   ├── providers
    │   │   └── ... (data providers for Birdeye, CMC)
    │   ├── schemas.ts
    │   ├── tasks
    │   │   └── ... (tasks for syncing data from Twitter, Birdeye, CMC)
    │   └── types.ts
    ├── degenTrader               # Core autonomous trading logic
    │   ├── config
    │   │   └── ...
    │   ├── index.ts
    │   ├── services
    │   │   └── ...
    │   ├── service.ts
    │   ├── types
    │   │   └── ...
    │   └── utils
    │       └── ...
    └── autofun                   # Plugin for auto.fun platform integration
        ├── apis.ts
        ├── index.ts
        ├── providers
        │   └── ...
        ├── schemas.ts
        ├── tasks
        │   └── ...
        └── types.ts
```

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

## Setup

1.  **Clone the repository:**

    ```bash
    git clone <your-repository-url>
    cd spartan # Or your project's root directory
    ```

2.  **Install dependencies:**
    Navigate to the `packages/spartan` directory (or the root of this specific package if it's part of a monorepo like Eliza OS).
    ```bash
    npm install
    # OR
    yarn install
    ```

## Environment Variables

Create a `.env` file in the root of the project (e.g., `packages/spartan/.env` or potentially at the monorepo root `../../.env` relative to `src/index.ts`). Add the following environment variables as needed. Not all variables are required for all functionalities; refer to the specific plugin or service documentation for exact requirements.

```env
# General API Keys for AI Models
GROQ_API_KEY=your_groq_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key

# Discord Bot Credentials (for Investment Manager / Spartan)
INVESTMENT_MANAGER_DISCORD_APPLICATION_ID=your_discord_app_id
INVESTMENT_MANAGER_DISCORD_API_TOKEN=your_discord_bot_token

# Telegram Bot Credentials (for Investment Manager / Spartan)
INVESTMENT_MANAGER_TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHANNEL_ID=your_telegram_channel_id_for_recommendations

# Twitter Credentials (for Investment Manager / Spartan)
INVESTMENT_MANAGER_TWITTER_EMAIL=your_twitter_email
INVESTMENT_MANAGER_TWITTER_USERNAME=your_twitter_username
INVESTMENT_MANAGER_TWITTER_PASSWORD=your_twitter_password
INVESTMENT_MANAGER_TWITTER_ENABLE_POST_GENERATION=true # or false

# DeFi Data Providers & Services
JUPITER_API_KEY=your_jupiter_api_key       # For Jupiter swaps
HELIUS_API_KEY=your_helius_api_key         # For Helius RPC (Solana data)
COINGECKO_API_KEY=your_coingecko_api_key   # For CoinGecko data
BIRDEYE_API_KEY=your_birdeye_api_key       # For Birdeye data
ZEROEX_API_KEY=your_0x_api_key             # For 0x Protocol (EVM swaps)

# Blockchain Connection Details
SOLANA_RPC_URL=your_solana_rpc_endpoint    # e.g., from Helius, QuickNode, or Alchemy
EVM_PROVIDER_URL=your_base_rpc_endpoint    # For Base chain, (aka RPC_URL in some configs)

# Wallet Configuration
SOLANA_PUBLIC_KEY=your_spartan_solana_public_key
SOLANA_PRIVATE_KEY=your_spartan_solana_private_key_base58_encoded
# Alternatively, some plugins might use these generic names:
# WALLET_PUBLIC_KEY=your_spartan_solana_public_key
# WALLET_PRIVATE_KEY=your_spartan_solana_private_key_base58_encoded

# Webhooks / Notifications
TRADER_SELL_KUMA=your_kuma_webhook_url_for_sell_notifications

# PostgreSQL Database (Optional, for @elizaos/plugin-sql)
POSTGRES_URL=postgresql://user:password@host:port/database
```

**Note on Wallet Keys:**

- `SOLANA_PRIVATE_KEY` should be the base58 encoded string of your wallet's secret key.
- Ensure the corresponding `SOLANA_PUBLIC_KEY` matches the public key derived from your private key.

## Running Tests

The project uses `vitest` for testing. You can run tests using npm or yarn:

```bash
npm test
# OR
yarn test
```

This will execute the test suites defined in `plugins.test.ts` and any other test files within the project. The tests initialize an `AgentRuntime` and run plugin-specific test cases. Refer to the `TEST_TIMEOUT` in `plugins.test.ts` if tests are timing out.

## Running the Project

As Spartan is designed as an agent within the Eliza OS framework, it's typically run as part of a larger Eliza OS deployment. The `src/index.ts` exports the `spartan` agent configuration which can be imported and used by an Eliza OS runtime.

If you are developing a specific plugin or service, you might run parts of it in isolation or using the test environment provided in `plugins.test.ts`.

For the `DegenIntel` frontend:

1.  Ensure you have the necessary API endpoints running or configured.
2.  Navigate to `src/plugins/degenIntel/frontend`.
3.  Install dependencies if any are specific to this frontend (usually covered by the main install).
4.  Run the development server (e.g., `npm run dev` or `yarn dev`, depending on how the `vite` project is set up).
    The `VITE_API_URL` environment variable should be set in a `.env` file within the `frontend` directory (or project root if Vite is configured to pick it up) to point to your backend API.

## Plugins Overview

The Spartan agent is composed of several key plugins:

- **`@elizaos/plugin-sql`**: Handles database interactions.
- **AI Model Plugins** (`@elizaos/plugin-groq`, `@elizaos/plugin-anthropic`, `@elizaos/plugin-openai`, `@elizaos/plugin-local-ai`): Provide access to various large language models.
- **Platform Plugins** (`@elizaos/plugin-discord`, `@elizaos/plugin-telegram`, `@elizaos/plugin-twitter`): Integrate with social and messaging platforms.
- **Utility Plugins** (`@elizaos/plugin-pdf`, `@elizaos/plugin-video-understanding`, `@elizaos/plugin-bootstrap`): Offer various utility functions.
- **`@elizaos/plugin-solana`**: Provides core Solana blockchain interaction capabilities.

Custom plugins specific to Spartan include:

- **`communityInvestorPlugin`**: Manages community-driven investment strategies, recommendations, and performance tracking.
- **`degenIntelPlugin`**: Focuses on gathering and analyzing market intelligence from sources like Twitter, CoinMarketCap, and Birdeye. It also includes a frontend for data visualization.
- **`degenTraderPlugin`**: Implements core autonomous trading logic and strategies.
- **`autofunPlugin`**: Integrates with the auto.fun platform for data and potentially trading.
- **`autofunTraderPlugin`**: Specialized trading service for strategies related to the auto.fun platform.

Each of these custom plugins further breaks down into services for specific tasks like data fetching, trade execution, analytics, and task management.
