# Spartan Quick Start Guide

Get Spartan up and running in 10 minutes.

## Prerequisites

### Docker (Recommended - Easiest)
- Docker Desktop or Docker Engine
- Docker Compose v2.0+

### Standalone (Alternative)
- Node.js 18+ installed
- MySQL or PostgreSQL database
- API keys (at minimum: Anthropic or OpenAI, Birdeye)

## Choose Your Path

### Path A: Docker (Fastest) ⚡

```bash
# Clone the repository
git clone https://github.com/your-org/spartan.git
cd spartan

# Create .env file with your API keys
cp .env.example .env
nano .env  # Add your keys

# Start everything with one command
docker-compose up -d
```

That's it! Spartan is running on http://localhost:3002

Skip to [Step 5: Try It Out](#step-5-try-it-out)

---

### Path B: Standalone with ElizaOS CLI

```bash
# Install ElizaOS CLI
npm install -g @elizaos/cli

# Clone the repository
git clone https://github.com/your-org/spartan.git
cd spartan

# Install dependencies
npm install
```

## Step 2: Configure

Create `.env` file with minimal configuration:

```env
# AI Model (choose one)
ANTHROPIC_API_KEY=your_anthropic_key
# OR
OPENAI_API_KEY=your_openai_key

# Database
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=spartan_dev

# Blockchain
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Market Data
BIRDEYE_API_KEY=your_birdeye_key
```

## Step 3: Setup Database

```bash
# Create database
mysql -u root -p -e "CREATE DATABASE spartan_dev;"

# Run migrations (if applicable)
npm run migrate
```

## Step 4: Start Spartan

**Using ElizaOS CLI:**
```bash
elizaos start
# or
npx @elizaos/cli start
```

**Using npm:**
```bash
npm run dev
```

Visit `http://localhost:3000` to see Spartan running!

## Step 5: Try It Out

### Via Discord (Optional)

1. Create Discord bot at https://discord.com/developers
2. Add bot token to `.env`:
   ```env
   DISCORD_APPLICATION_ID=your_app_id
   DISCORD_API_TOKEN=your_bot_token
   ```
3. Invite bot to your server
4. Chat with Spartan!

### Via API

```bash
# Get market overview
curl http://localhost:3000/api/analytics/market-overview?chain=solana

# Get trending tokens
curl http://localhost:3000/api/analytics/trending?chain=solana&limit=10
```

## Development from ElizaOS Monorepo

For contributing to ElizaOS core or deeper development:

```bash
# Clone the full ElizaOS monorepo
git clone https://github.com/elizaos/eliza
cd eliza

# Install dependencies
npm install

# Navigate to Spartan
cd packages/spartan

# Run in development mode
npm run dev
```

This approach is best for:
- Contributing to ElizaOS core
- Developing multiple packages simultaneously
- Testing cross-package changes

## What's Next?

- [Read the full README](../README.md) for detailed features
- [Explore Plugins](./PLUGINS.md) to understand capabilities
- [Check the API docs](./API.md) for integration
- [Deploy to production](./DEPLOYMENT.md) when ready

## Common Commands

```bash
# Start development
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production
npm start

# View logs
pm2 logs spartan
```

## Need Help?

- Check [Troubleshooting section](../README.md#troubleshooting)
- Join the Discord community
- Open an issue on GitHub

---

**Ready to trade smarter? Let Spartan guide you! ⚔️**

