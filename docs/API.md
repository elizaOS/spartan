# Spartan API Documentation

Complete API reference for all HTTP endpoints exposed by Spartan plugins.

## Table of Contents

1. [Analytics API](#analytics-api)
2. [Charting API](#charting-api)
3. [Wallet API](#wallet-api)
4. [Trading API](#trading-api)
5. [Community API](#community-api)
6. [Authentication](#authentication)
7. [Rate Limiting](#rate-limiting)
8. [Error Handling](#error-handling)

---

## Base URL

```
Development: http://localhost:2096
Production: https://your-spartan-instance.com
```

## Authentication

Most endpoints require authentication. Include API key or JWT token in headers:

```http
Authorization: Bearer YOUR_API_KEY
# or
X-API-Key: YOUR_API_KEY
```

---

## Analytics API

Powered by the Analytics Plugin. Provides comprehensive market analytics, token analysis, and technical indicators.

### GET /api/analytics/market-overview

Get market overview with top gainers, losers, and market sentiment.

**Query Parameters:**
- `chain` (optional): solana | ethereum | base (default: solana)

**Response:**
```json
{
  "marketCap": "2.1T",
  "volume24h": "85.4B",
  "sentiment": "bullish",
  "topGainers": [
    {
      "address": "token_address",
      "symbol": "TOKEN",
      "name": "Token Name",
      "price": 1.234,
      "change24h": 45.6,
      "volume24h": 1234567
    }
  ],
  "topLosers": [...],
  "trending": [...]
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid chain parameter
- `500` - Server error

**Example:**
```bash
curl -X GET "http://localhost:2096/api/analytics/market-overview?chain=solana" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

### GET /api/analytics/trending

Get trending tokens by volume and momentum.

**Query Parameters:**
- `chain` (optional): solana | ethereum | base (default: solana)
- `timeframe` (optional): 1h | 4h | 24h (default: 24h)
- `limit` (optional): number (default: 20, max: 100)

**Response:**
```json
{
  "tokens": [
    {
      "address": "token_address",
      "symbol": "TOKEN",
      "name": "Token Name",
      "price": 1.234,
      "volume24h": 1234567,
      "volumeChange": 345.6,
      "priceChange24h": 12.3,
      "rank": 1,
      "marketCap": 12345678
    }
  ],
  "timestamp": "2025-01-01T00:00:00Z"
}
```

**Example:**
```bash
curl -X GET "http://localhost:2096/api/analytics/trending?chain=solana&limit=10"
```

---

### GET /api/analytics/sentiment

Get market sentiment analysis.

**Query Parameters:**
- `token_address` (optional): Specific token address
- `timeframe` (optional): 1h | 4h | 24h (default: 24h)

**Response:**
```json
{
  "overall": "bullish",
  "score": 0.75,
  "indicators": {
    "social": 0.8,
    "technical": 0.7,
    "onChain": 0.75
  },
  "sources": {
    "twitter": {
      "mentions": 1234,
      "sentiment": "positive",
      "score": 0.8
    },
    "news": {
      "articles": 45,
      "sentiment": "neutral",
      "score": 0.6
    }
  }
}
```

---

### GET /api/analytics/whale-activity

Get large transactions and whale activity.

**Query Parameters:**
- `min_value_usd` (optional): Minimum transaction value in USD (default: 100000)
- `token_address` (optional): Filter by token
- `limit` (optional): Number of results (default: 20, max: 100)

**Response:**
```json
{
  "transactions": [
    {
      "hash": "transaction_hash",
      "from": "wallet_address",
      "to": "wallet_address",
      "tokenAddress": "token_address",
      "amount": 1000000,
      "valueUSD": 123456,
      "timestamp": "2025-01-01T00:00:00Z",
      "type": "buy" | "sell" | "transfer"
    }
  ]
}
```

---

### POST /api/analytics/analyze-token

Get comprehensive token analysis.

**Request Body:**
```json
{
  "token_address": "string (required)",
  "chain": "solana | ethereum | base (optional, default: solana)",
  "depth": "basic | full (optional, default: full)",
  "include": {
    "technical": true,
    "holders": true,
    "snipers": true,
    "historical": true
  }
}
```

**Response:**
```json
{
  "token": {
    "address": "token_address",
    "symbol": "TOKEN",
    "name": "Token Name",
    "decimals": 9,
    "supply": 1000000000
  },
  "price": {
    "current": 1.234,
    "change1h": 2.3,
    "change24h": 12.4,
    "change7d": 45.6,
    "ath": 5.678,
    "atl": 0.123
  },
  "volume": {
    "24h": 1234567,
    "7d": 8901234
  },
  "marketCap": 12345678,
  "liquidity": 987654,
  "technicalIndicators": {
    "rsi": 65.4,
    "macd": {
      "value": 0.123,
      "signal": 0.098,
      "histogram": 0.025
    },
    "bollingerBands": {
      "upper": 1.456,
      "middle": 1.234,
      "lower": 1.012
    },
    "movingAverages": {
      "sma20": 1.2,
      "sma50": 1.15,
      "sma200": 1.0
    }
  },
  "holders": {
    "total": 12345,
    "top10Percentage": 45.6,
    "distribution": [...]
  },
  "risk": {
    "score": 7.5,
    "factors": [
      "High holder concentration",
      "Moderate liquidity"
    ]
  },
  "recommendation": {
    "action": "buy" | "sell" | "hold",
    "confidence": 0.75,
    "priceTarget": 1.5,
    "reasoning": "Strong technical indicators..."
  }
}
```

---

## Charting API

Provides OHLCV data and technical indicators for charting.

### GET /api/charting/ohlcv

Get OHLCV (Open, High, Low, Close, Volume) candlestick data.

**Query Parameters:**
- `token_address` (required): Token address
- `interval` (optional): 1m | 5m | 15m | 1h | 4h | 1d (default: 1h)
- `limit` (optional): Number of candles (default: 100, max: 1000)
- `from` (optional): Unix timestamp
- `to` (optional): Unix timestamp

**Response:**
```json
{
  "tokenAddress": "token_address",
  "interval": "1h",
  "data": [
    {
      "timestamp": 1704067200,
      "open": 1.234,
      "high": 1.256,
      "low": 1.223,
      "close": 1.245,
      "volume": 123456
    }
  ]
}
```

**Example:**
```bash
curl -X GET "http://localhost:2096/api/charting/ohlcv?token_address=So11111111111111111111111111111111111111112&interval=1h&limit=100"
```

---

### POST /api/charting/indicators

Calculate technical indicators for a token.

**Request Body:**
```json
{
  "token_address": "string (required)",
  "interval": "1m | 5m | 15m | 1h | 4h | 1d (optional, default: 1h)",
  "indicators": [
    "rsi",
    "macd",
    "bollinger_bands",
    "sma",
    "ema",
    "stochastic",
    "atr",
    "williams_r",
    "cci",
    "mfi"
  ],
  "params": {
    "rsi_period": 14,
    "macd_fast": 12,
    "macd_slow": 26,
    "macd_signal": 9
  }
}
```

**Response:**
```json
{
  "tokenAddress": "token_address",
  "timestamp": "2025-01-01T00:00:00Z",
  "indicators": {
    "rsi": {
      "value": 65.4,
      "signal": "neutral",
      "overbought": false,
      "oversold": false
    },
    "macd": {
      "value": 0.123,
      "signal": 0.098,
      "histogram": 0.025,
      "crossover": "bullish"
    },
    "bollingerBands": {
      "upper": 1.456,
      "middle": 1.234,
      "lower": 1.012,
      "bandwidth": 0.444
    },
    "sma": {
      "sma20": 1.2,
      "sma50": 1.15,
      "sma200": 1.0
    }
  },
  "signals": {
    "overall": "buy",
    "strength": 0.75,
    "confluence": 3
  }
}
```

---

## Wallet API

Manages user wallets and token operations.

### POST /api/wallet/create

Create a new wallet for the user.

**Request Body:**
```json
{
  "name": "string (optional)",
  "chain": "solana | ethereum | base (optional, default: solana)"
}
```

**Response:**
```json
{
  "walletId": "wallet_id",
  "address": "wallet_address",
  "chain": "solana",
  "name": "My Wallet",
  "createdAt": "2025-01-01T00:00:00Z",
  "privateKey": "SHOWN_ONCE_base58_encoded"
}
```

**Security Note:** Private key is only shown once. Store securely!

---

### POST /api/wallet/import

Import an existing wallet.

**Request Body:**
```json
{
  "privateKey": "string (required, base58 encoded)",
  "name": "string (optional)",
  "chain": "solana | ethereum | base (optional, default: solana)"
}
```

**Response:**
```json
{
  "walletId": "wallet_id",
  "address": "derived_address",
  "chain": "solana",
  "name": "Imported Wallet"
}
```

---

### GET /api/wallet/list

Get all wallets for the authenticated user.

**Response:**
```json
{
  "wallets": [
    {
      "id": "wallet_id",
      "address": "wallet_address",
      "name": "My Wallet",
      "chain": "solana",
      "balance": {
        "sol": 1.234,
        "usd": 123.45
      },
      "tokens": [
        {
          "mint": "token_address",
          "symbol": "TOKEN",
          "balance": 100,
          "usd": 12.34
        }
      ],
      "totalValue": 135.79
    }
  ]
}
```

---

### GET /api/wallet/:walletId/balance

Get balance for a specific wallet.

**Path Parameters:**
- `walletId`: Wallet ID

**Query Parameters:**
- `tokenMint` (optional): Specific token mint address

**Response:**
```json
{
  "walletAddress": "wallet_address",
  "sol": 1.234,
  "tokens": [
    {
      "mint": "token_address",
      "symbol": "TOKEN",
      "name": "Token Name",
      "balance": 100,
      "decimals": 9,
      "usd": 12.34
    }
  ],
  "totalValue": 135.79
}
```

---

### POST /api/wallet/swap

Execute a token swap using Jupiter.

**Request Body:**
```json
{
  "walletId": "string (required)",
  "fromToken": "token_address (required)",
  "toToken": "token_address (required)",
  "amount": "number (required)",
  "slippage": "number (optional, default: 1, max: 10)"
}
```

**Response:**
```json
{
  "txHash": "transaction_hash",
  "fromToken": "token_address",
  "toToken": "token_address",
  "fromAmount": 1.0,
  "toAmount": 123.45,
  "priceImpact": 0.5,
  "fee": 0.0001,
  "timestamp": "2025-01-01T00:00:00Z"
}
```

---

### POST /api/wallet/sweep

Consolidate all tokens to a single token.

**Request Body:**
```json
{
  "walletId": "string (required)",
  "targetToken": "token_address (required, e.g., SOL)",
  "slippage": "number (optional, default: 1)"
}
```

**Response:**
```json
{
  "transactions": [
    {
      "txHash": "hash",
      "fromToken": "token1",
      "toToken": "SOL",
      "amount": 100
    }
  ],
  "totalValue": 123.45,
  "fees": 0.01
}
```

---

### POST /api/wallet/transfer

Transfer tokens between user's wallets.

**Request Body:**
```json
{
  "fromWalletId": "string (required)",
  "toWalletId": "string (required)",
  "tokenMint": "token_address (required)",
  "amount": "number (required)"
}
```

**Response:**
```json
{
  "txHash": "transaction_hash",
  "from": "wallet_address",
  "to": "wallet_address",
  "tokenMint": "token_address",
  "amount": 1.0,
  "timestamp": "2025-01-01T00:00:00Z"
}
```

---

## Trading API

Manage trading positions and strategies.

### POST /api/trading/position/open

Open a new trading position.

**Request Body:**
```json
{
  "walletId": "string (required)",
  "tokenAddress": "string (required)",
  "size": "number (required)",
  "stopLoss": "number (optional)",
  "takeProfit": "number (optional)"
}
```

**Response:**
```json
{
  "positionId": "position_id",
  "walletId": "wallet_id",
  "tokenAddress": "token_address",
  "entryPrice": 1.234,
  "size": 100,
  "stopLoss": 1.1,
  "takeProfit": 1.5,
  "status": "open",
  "createdAt": "2025-01-01T00:00:00Z"
}
```

---

### GET /api/trading/positions

Get all positions for user.

**Query Parameters:**
- `status` (optional): open | closed | all (default: open)

**Response:**
```json
{
  "positions": [
    {
      "id": "position_id",
      "tokenAddress": "token_address",
      "symbol": "TOKEN",
      "entryPrice": 1.234,
      "currentPrice": 1.345,
      "size": 100,
      "pnl": 11.1,
      "pnlPercentage": 9.0,
      "status": "open",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

### POST /api/trading/position/:positionId/close

Close a trading position.

**Path Parameters:**
- `positionId`: Position ID

**Response:**
```json
{
  "positionId": "position_id",
  "entryPrice": 1.234,
  "exitPrice": 1.345,
  "pnl": 11.1,
  "pnlPercentage": 9.0,
  "closedAt": "2025-01-01T00:00:00Z"
}
```

---

### POST /api/trading/strategy/set

Set trading strategy for a wallet.

**Request Body:**
```json
{
  "walletId": "string (required)",
  "strategy": "llm | copy | none (required)",
  "config": {
    "model": "gpt-4",
    "riskTolerance": "low | medium | high",
    "maxPositions": 5,
    "targetWallets": ["address1", "address2"]
  }
}
```

**Response:**
```json
{
  "walletId": "wallet_id",
  "strategy": "llm",
  "config": {...},
  "active": true
}
```

---

## Community API

Community investment and trust scoring.

### GET /api/community/leaderboard

Get community leaderboard.

**Query Parameters:**
- `limit` (optional): Number of results (default: 50)

**Response:**
```json
{
  "leaderboard": [
    {
      "userId": "user_id",
      "username": "user123",
      "trustScore": 850,
      "totalRecommendations": 45,
      "successfulTrades": 32,
      "winRate": 71.1,
      "rank": 1
    }
  ],
  "timestamp": "2025-01-01T00:00:00Z"
}
```

---

### GET /api/community/recommendations

Get active community recommendations.

**Response:**
```json
{
  "recommendations": [
    {
      "id": "rec_id",
      "userId": "user_id",
      "username": "user123",
      "tokenAddress": "token_address",
      "symbol": "TOKEN",
      "recommendation": "buy",
      "confidence": 0.85,
      "reasoning": "Strong technical indicators...",
      "createdAt": "2025-01-01T00:00:00Z",
      "supporters": 12
    }
  ]
}
```

---

### GET /api/community/user/:userId/score

Get trust score for specific user.

**Path Parameters:**
- `userId`: User ID

**Response:**
```json
{
  "userId": "user_id",
  "username": "user123",
  "trustScore": 850,
  "rank": 5,
  "stats": {
    "totalRecommendations": 45,
    "successfulTrades": 32,
    "failedTrades": 13,
    "winRate": 71.1,
    "avgReturn": 12.5
  },
  "recentRecommendations": [...]
}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    }
  },
  "timestamp": "2025-01-01T00:00:00Z",
  "requestId": "req_123456"
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_REQUEST` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | External service unavailable |

---

## Rate Limiting

### Default Limits

| Tier | Requests/Minute | Requests/Day |
|------|-----------------|--------------|
| Free | 60 | 5,000 |
| Basic | 300 | 50,000 |
| Pro | 1,000 | 500,000 |

### Rate Limit Headers

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1704067200
```

### Rate Limit Exceeded

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Try again in 30 seconds.",
    "retryAfter": 30
  }
}
```

---

## Webhooks

Subscribe to events via webhooks.

### Available Events

- `position.opened`
- `position.closed`
- `trade.executed`
- `wallet.created`
- `recommendation.created`

### Webhook Payload

```json
{
  "event": "trade.executed",
  "timestamp": "2025-01-01T00:00:00Z",
  "data": {
    "userId": "user_id",
    "walletId": "wallet_id",
    "txHash": "transaction_hash",
    "action": "buy",
    "tokenAddress": "token_address",
    "amount": 100,
    "price": 1.234
  }
}
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { SpartanClient } from '@spartan/sdk';

const client = new SpartanClient({
  apiKey: 'YOUR_API_KEY',
  baseUrl: 'http://localhost:2096'
});

// Get market overview
const market = await client.analytics.getMarketOverview('solana');

// Create wallet
const wallet = await client.wallet.create({ name: 'My Wallet' });

// Execute swap
const tx = await client.wallet.swap({
  walletId: wallet.id,
  fromToken: 'SOL',
  toToken: 'USDC',
  amount: 1.0,
  slippage: 1
});
```

### Python

```python
from spartan_sdk import SpartanClient

client = SpartanClient(
    api_key='YOUR_API_KEY',
    base_url='http://localhost:2096'
)

# Get trending tokens
trending = client.analytics.get_trending(chain='solana', limit=10)

# Analyze token
analysis = client.analytics.analyze_token(
    token_address='So11111111111111111111111111111111111111112',
    depth='full'
)
```

---

For more information, see:
- [Plugin Documentation](./PLUGINS.md)
- [Architecture Documentation](./ARCHITECTURE.md)
- [Deployment Guide](./DEPLOYMENT.md)

