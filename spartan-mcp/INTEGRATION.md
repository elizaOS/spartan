# Spartan MCP Integration Guide

This document explains how the Spartan MCP agents integrate with the Spartan backend plugins using the x402 payment protocol.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Agent (Claude)                         │
│              Using Anthropic SDK + x402                      │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTP + x402 Payment Protocol
                   │
┌──────────────────▼──────────────────────────────────────────┐
│              Spartan Backend (localhost:2096)                │
│  ┌──────────────────────┬─────────────────────────────┐    │
│  │  Analytics Plugin    │  Chart Plugin                │    │
│  │  - Market Analytics  │  - OHLCV Data               │    │
│  │  - News Feed         │  - Technical Indicators      │    │
│  │  - Sentiment Analysis│  - Pattern Detection         │    │
│  │  - Whale Tracking    │  - Support/Resistance        │    │
│  │  - Token Analysis    │  - Volume Profile            │    │
│  └──────────────────────┴─────────────────────────────┘    │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
   ┌────▼───┐ ┌───▼────┐ ┌──▼─────┐
   │Birdeye │ │CoinGecko│ │ TAAPI │
   └────────┘ └─────────┘ └────────┘
```

## Agent Types

### 1. Analytics Agent (`analytics-agent.ts`)
Connects to Spartan Analytics Plugin for market intelligence.

**Personality:** spartan, defi warlord with full market intelligence access

**Tools:**
- `spartan_get_market_analytics` - Market overview, gainers, losers
- `spartan_get_news_feed` - DeFi news aggregation
- `spartan_get_sentiment_analysis` - Market sentiment
- `spartan_get_trending_tokens` - Trending analysis
- `spartan_get_whale_activity` - Whale wallet tracking
- `spartan_get_token_analysis` - Deep token analysis

**API Endpoints:**
- `GET /api/analytics/market-overview`
- `GET /api/analytics/news`
- `GET /api/analytics/sentiment`
- `GET /api/analytics/trending`
- `GET /api/analytics/whale-activity`
- `POST /api/analytics/analyze-token`

### 2. Charting Agent (`charting-agent.ts`)
Connects to Spartan Chart Plugin for technical analysis.

**Personality:** spartan, technical analyst who reads charts like battlefield maps

**Tools:**
- `charting_get_ohlcv` - OHLCV candle data
- `charting_get_technical_indicators` - RSI, MACD, EMA, SMA
- `charting_detect_patterns` - Chart pattern detection
- `charting_get_support_resistance` - Key levels
- `charting_get_volume_profile` - Volume analysis

**API Endpoints:**
- `GET /api/charting/ohlcv`
- `POST /api/charting/indicators`
- `GET /api/charting/patterns`
- `GET /api/charting/support-resistance`
- `GET /api/charting/volume-profile`

### 3. CoinGecko Agent (`coingecko-agent.ts`)
Direct CoinGecko API integration (no Spartan backend required).

**Personality:** spartan, no-bs defi warlord with coingecko data

**Tools:**
- `crypto_get_price` - Current prices
- `crypto_search_coins` - Search cryptocurrencies
- `crypto_get_coin_data` - Detailed token info
- `crypto_get_market_chart` - Historical data
- `crypto_get_trending` - Trending tokens
- `crypto_get_global_data` - Global market stats

### 4. Birdeye Agent (`birdeye-agent.ts`)
Direct Birdeye API integration for Solana (no Spartan backend required).

**Personality:** spartan, solana defi tactician with birdeye access

**Tools:**
- `birdeye_get_token_overview` - Token overview
- `birdeye_get_token_security` - Security analysis
- `birdeye_get_trending_tokens` - Solana trending
- `birdeye_get_wallet_portfolio` - Wallet holdings
- `birdeye_get_token_trades` - Recent trades
- And more...

## x402 Payment Protocol Integration

All agents use the x402 payment protocol for API calls:

```typescript
import { wrapFetchWithPayment } from 'x402-fetch';
import { privateKeyToAccount } from 'viem/accounts';

// Setup wallet
const account = privateKeyToAccount(walletKey);

// Wrap fetch with payment capability
const paymentFetch = wrapFetchWithPayment(fetch, account);

// Use in Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  fetch: paymentFetch  // x402-enabled fetch
});

// Make API calls (automatically includes payment headers)
const response = await paymentFetch(
  `${SPARTAN_API_BASE}/api/analytics/market-overview`
);
```

## Usage Examples

### Running Analytics Agent

```bash
# Set environment variables
export ANTHROPIC_API_KEY=your_anthropic_key
export WALLET_PRIVATE_KEY=your_wallet_private_key  # Optional
export SPARTAN_BACKEND_URL=http://localhost:2096   # Default

# Run the agent
bun run agents/analytics-agent.ts
```

**Example Query:**
```
"Give me comprehensive market analysis including:
1. Latest DeFi news
2. Market sentiment
3. Trending tokens
4. Whale activity
5. Trading signals"
```

### Running Charting Agent

```bash
# Set environment variables
export ANTHROPIC_API_KEY=your_anthropic_key
export WALLET_PRIVATE_KEY=your_wallet_private_key

# Run the agent
bun run agents/charting-agent.ts
```

**Example Query:**
```
"Perform technical analysis on Wrapped SOL including:
1. OHLCV data (1-hour)
2. RSI, MACD, moving averages
3. Chart patterns
4. Support/resistance levels
5. Volume profile"
```

### Running CoinGecko Agent

```bash
# Set environment variables
export ANTHROPIC_API_KEY=your_anthropic_key
export COINGECKO_API_KEY=your_coingecko_key  # Optional for Pro

# Run the agent
bun run agents/coingecko-agent.ts
```

**Example Query:**
```
"What are the current prices of Bitcoin, Ethereum, and AI16Z?
Also show me trending cryptocurrencies."
```

### Running Birdeye Agent

```bash
# Set environment variables
export ANTHROPIC_API_KEY=your_anthropic_key
export BIRDEYE_API_KEY=your_birdeye_key  # Required

# Run the agent
bun run agents/birdeye-agent.ts
```

**Example Query:**
```
"Show me trending tokens on Solana.
For the top token, analyze security and recent trades."
```

## API Call Flow

### Analytics/Charting Agents (Spartan Backend)

1. **User Query** → Claude receives request
2. **Tool Selection** → Claude selects appropriate tool
3. **API Call** → Agent makes HTTP request to Spartan backend
   ```typescript
   const response = await paymentFetch(
     `${SPARTAN_API_BASE}/api/analytics/trending?chain=solana&limit=20`
   );
   ```
4. **x402 Payment** → Payment headers automatically included
5. **Data Response** → Spartan backend returns data
6. **Claude Processing** → Claude formats response for user
7. **User Response** → Formatted analysis delivered

### CoinGecko/Birdeye Agents (Direct API)

1. **User Query** → Claude receives request
2. **Tool Selection** → Claude selects appropriate tool
3. **MCP Gateway** → Agent calls MCP gateway with config
4. **API Call** → Gateway makes request to external API
5. **Data Response** → External API returns data
6. **Claude Processing** → Claude formats response
7. **User Response** → Formatted analysis delivered

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key | Yes | - |
| `WALLET_PRIVATE_KEY` | Wallet for x402 payments | No | Test wallet |
| `SPARTAN_BACKEND_URL` | Spartan backend URL | No | `http://localhost:2096` |
| `COINGECKO_API_KEY` | CoinGecko Pro API key | No | - |
| `BIRDEYE_API_KEY` | Birdeye API key | Yes (for Birdeye) | - |
| `SPARTAN_API_KEY` | Spartan API key | No | - |

## Payment Protocol

The x402 payment protocol enables:

1. **Micropayments** - Pay per API call
2. **Automatic Billing** - No manual payment handling
3. **Usage Tracking** - Track API usage and costs
4. **Access Control** - Pay-gated API endpoints

**How it works:**
- Agent wraps `fetch` with payment capability
- Each API call includes payment headers
- Backend validates and processes payment
- Access granted upon successful payment

## Plugin Integration

### Analytics Plugin Integration

The Analytics Agent leverages these plugin actions:
- `GET_MARKET_ANALYTICS`
- `GET_TOKEN_ANALYTICS`
- `GET_TECHNICAL_INDICATORS`
- News data services
- Sentiment analysis providers

### Chart Plugin Integration

The Charting Agent leverages these plugin actions:
- `GENERATE_TECHNICAL_CHART`
- `GENERATE_PRICE_CHART`
- Chart service
- Technical analysis service

## Spartan Personality

All agents embody Spartan's personality:

**Communication Style:**
- Direct and brief
- No emojis, no exclamations, no question marks
- No crypto jargon or shill BS
- No metaphors or analogies
- Say the quiet part out loud
- Never apologize
- Separate statements with double newlines

**Analysis Approach:**
- Data-driven, not opinion-based
- Security first, always
- Call out risks immediately
- Admit when uncertain
- Recommendations are actionable or worthless

## Development

### Adding New Tools

1. Define tool schema in agent:
```typescript
{
  name: 'spartan_new_tool',
  description: 'Tool description',
  input_schema: {
    type: 'object' as const,
    properties: {
      param: { type: 'string', description: 'Parameter description' }
    },
    required: ['param']
  }
}
```

2. Add API route handler:
```typescript
case 'spartan_new_tool': {
  apiResponse = await paymentFetch(
    `${SPARTAN_API_BASE}/api/new-endpoint?param=${args.param}`
  );
  break;
}
```

3. Implement backend endpoint in Spartan plugin

### Testing

```bash
# Test analytics agent
ANTHROPIC_API_KEY=test bun run agents/analytics-agent.ts

# Test charting agent  
ANTHROPIC_API_KEY=test bun run agents/charting-agent.ts

# Test coingecko agent
ANTHROPIC_API_KEY=test bun run agents/coingecko-agent.ts

# Test birdeye agent
ANTHROPIC_API_KEY=test BIRDEYE_API_KEY=test bun run agents/birdeye-agent.ts
```

## Troubleshooting

### "Connection refused to localhost:2096"
- Ensure Spartan backend is running
- Check `SPARTAN_BACKEND_URL` environment variable
- Or use CoinGecko/Birdeye agents which don't require backend

### "ANTHROPIC_API_KEY required"
```bash
export ANTHROPIC_API_KEY=your_key_here
```

### "Payment failed"
- Check wallet has sufficient funds
- Verify wallet private key is correct
- Check x402 payment headers are included

### "API rate limit exceeded"
- Reduce request frequency
- Upgrade API tier (CoinGecko Pro, Birdeye Pro)
- Implement caching

## Next Steps

1. **Deploy Spartan Backend** - Run plugins on production server
2. **Configure Payment** - Setup x402 payment processor
3. **Monitor Usage** - Track API calls and costs
4. **Scale Agents** - Deploy multiple agent instances
5. **Custom Tools** - Add domain-specific tools

## API Routes Implementation

The following routes have been added to `/root/spartan-07-22-neo/packages/spartan/src/plugins/degenIntel/apis.ts` to support the MCP agents:

### Analytics Routes (6 endpoints)

| Method | Path | Query Params | Service Used | Description |
|--------|------|--------------|--------------|-------------|
| GET | `/api/analytics/market-overview` | `chain='solana'` | `ANALYTICS_SERVICE` | Market cap, volume, sentiment, gainers/losers |
| GET | `/api/analytics/news` | `category='defi'`, `limit=10`, `since` | Mock data | Latest DeFi news articles |
| GET | `/api/analytics/sentiment` | `token_address`, `timeframe='24h'` | Runtime cache | Bullish/bearish/neutral sentiment |
| GET | `/api/analytics/trending` | `timeframe='24h'`, `chain='solana'`, `limit=20` | Runtime cache | Trending tokens by rank |
| GET | `/api/analytics/whale-activity` | `min_value_usd=100000`, `token_address`, `limit=20` | Runtime cache | Large transactions |
| POST | `/api/analytics/analyze-token` | Body: `token_address`, `depth` | `ANALYTICS_SERVICE` | Comprehensive token analysis |

### Charting Routes (5 endpoints)

| Method | Path | Query Params | Service Used | Description |
|--------|------|--------------|--------------|-------------|
| GET | `/api/charting/ohlcv` | `token_address`, `interval='1h'`, `limit=500` | Birdeye service | OHLCV candlestick data |
| POST | `/api/charting/indicators` | Body: `token_address`, `indicators`, `interval` | `TECHNICAL_ANALYSIS_SERVICE` | RSI, MACD, EMA, SMA, BB |
| GET | `/api/charting/patterns` | `token_address`, `interval='1h'`, `lookback_periods=200` | To be implemented | Chart pattern detection |
| GET | `/api/charting/support-resistance` | `token_address`, `interval='1h'`, `sensitivity='medium'` | To be implemented | Support/resistance levels |
| GET | `/api/charting/volume-profile` | `token_address`, `interval='1h'`, `bins=50` | To be implemented | Volume profile with POC |

### Service Dependencies

The API routes leverage the following Spartan services:

1. **ANALYTICS_SERVICE** - From `analytics` plugin
   - `getMarketAnalytics({ chain })`
   - `getTokenAnalytics({ tokenAddress, chain, timeframe, ... })`

2. **TECHNICAL_ANALYSIS_SERVICE** - From `analytics` plugin
   - `calculateIndicators({ tokenAddress, indicators, timeframe })`

3. **Birdeye Service** - From runtime services
   - `getTokenMarketData(token_address)`

4. **Runtime Cache** - For faster access
   - `tokens_solana` - Trending token data
   - `transaction_history` - Whale activity tracking
   - `sentiment-analysis` - Market sentiment memories

### Implementation Status

✅ **Fully Implemented:**
- Market analytics
- Token analysis
- Sentiment analysis
- Trending tokens
- Whale activity
- OHLCV data
- Technical indicators

⚠️ **Partially Implemented:**
- News feed (returns mock data, needs integration)

🚧 **To Be Implemented:**
- Chart pattern detection
- Support/resistance calculation
- Volume profile analysis

## Resources

- [Anthropic MCP Documentation](https://docs.anthropic.com/en/docs/build-with-claude/mcp)
- [x402 Payment Protocol](https://github.com/x402/x402-fetch)
- [Spartan Analytics Plugin](../src/plugins/analytics)
- [Spartan Chart Plugin](../src/plugins/chart)
- [API Routes Implementation](../src/plugins/degenIntel/apis.ts)

---

**Built with Spartan's tactical precision. No fluff, just execution.**

