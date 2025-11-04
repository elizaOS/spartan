# Spartan Architecture Documentation

Comprehensive overview of Spartan's system architecture, design patterns, and data flow.

## Table of Contents

1. [System Overview](#system-overview)
2. [Plugin Architecture](#plugin-architecture)
3. [Data Flow](#data-flow)
4. [Service Layer](#service-layer)
5. [Database Design](#database-design)
6. [Frontend Architecture](#frontend-architecture)
7. [MCP Integration](#mcp-integration)
8. [Security Architecture](#security-architecture)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interfaces                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Discord  │  │ Telegram │  │  Chrome  │  │   Web    │        │
│  │   Bot    │  │   Bot    │  │Extension │  │ Frontend │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
└───────┼─────────────┼─────────────┼─────────────┼──────────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                          │
        ┌─────────────────▼─────────────────┐
        │     ElizaOS Runtime Engine        │
        │  ┌─────────────────────────────┐  │
        │  │  Character & Personality    │  │
        │  └─────────────────────────────┘  │
        └─────────────────┬─────────────────┘
                          │
        ┌─────────────────▼─────────────────┐
        │        Plugin Ecosystem           │
        │  ┌──────────┬──────────────────┐  │
        │  │ Account  │  Autonomous      │  │
        │  │ Registry │  Trader          │  │
        │  ├──────────┼──────────────────┤  │
        │  │Analytics │  DegenIntel      │  │
        │  ├──────────┼──────────────────┤  │
        │  │Multiwallet│ Trading         │  │
        │  ├──────────┼──────────────────┤  │
        │  │Community │  Autofun         │  │
        │  │Investor  │  Trader          │  │
        │  └──────────┴──────────────────┘  │
        └─────────────────┬─────────────────┘
                          │
        ┌─────────────────▼─────────────────┐
        │       Service Layer               │
        │  ┌────────────────────────────┐   │
        │  │ Wallet  │ Chain  │ Data   │   │
        │  │ Service │Service │Provider│   │
        │  └────────────────────────────┘   │
        └─────────────────┬─────────────────┘
                          │
        ┌─────────────────▼─────────────────┐
        │     External Integrations         │
        │  ┌──────────┬──────────┬───────┐  │
        │  │Blockchain│  APIs    │  AI   │  │
        │  │  Solana  │ Birdeye  │Claude │  │
        │  │   EVM    │   CMC    │  GPT  │  │
        │  │          │ Jupiter  │       │  │
        │  └──────────┴──────────┴───────┘  │
        └───────────────────────────────────┘
                          │
        ┌─────────────────▼─────────────────┐
        │      Data Persistence             │
        │  ┌──────────┬───────────────────┐ │
        │  │  MySQL   │  Cache (Memory)   │ │
        │  │ Database │  Redis (optional) │ │
        │  └──────────┴───────────────────┘ │
        └───────────────────────────────────┘
```

### Core Components

#### 1. ElizaOS Runtime
- Agent lifecycle management
- Plugin orchestration
- Memory and state management
- Event handling
- Task scheduling

#### 2. Plugin System
- Modular, self-contained functionality
- Hot-swappable components
- Independent or interdependent
- Event-driven communication

#### 3. Service Layer
- Business logic implementation
- External API abstraction
- Data aggregation
- State management

#### 4. Data Layer
- Persistent storage (MySQL)
- Caching (in-memory/Redis)
- Real-time data streams

---

## Plugin Architecture

### Plugin Structure

Each plugin follows a standard structure:

```
plugin-name/
├── index.ts              # Plugin definition & exports
├── README.md             # Plugin documentation
├── types.ts              # TypeScript type definitions
├── actions/              # User-triggered commands
│   ├── act_*.ts
│   └── index.ts
├── providers/            # Context data providers
│   ├── provider_*.ts
│   └── index.ts
├── evaluators/           # Scoring & filtering logic
│   ├── evl_*.ts
│   └── index.ts
├── services/             # Background processing
│   ├── srv_*.ts
│   └── index.ts
├── routes/               # HTTP API endpoints
│   └── index.ts
├── events/               # Event handlers
│   └── index.ts
├── tasks/                # Scheduled operations
│   └── tsk_*.ts
├── interfaces/           # Interface definitions
│   └── int_*.ts
├── utils/                # Utility functions
│   └── util_*.ts
└── frontend/             # React frontend (if applicable)
    ├── index.tsx
    ├── components/
    └── ui/
```

### Plugin Components

#### Actions
Handle user commands and interactions.

```typescript
import type { Action } from '@elizaos/core';

export const myAction: Action = {
  name: 'MY_ACTION',
  description: 'Description of what this action does',
  
  // Validation: Should this action run?
  validate: async (runtime, message, state) => {
    // Check if message matches this action
    return shouldHandle;
  },
  
  // Handler: Execute the action
  handler: async (runtime, message, state, options, callback) => {
    // Perform action
    // Return response
  },
  
  // Examples for LLM to learn from
  examples: [
    [
      { user: "{{user1}}", content: { text: "Example input" }},
      { user: "Agent", content: { text: "Example response" }}
    ]
  ]
};
```

#### Providers
Supply context data to actions and the LLM.

```typescript
import type { Provider } from '@elizaos/core';

export const myProvider: Provider = {
  name: 'MY_PROVIDER',
  description: 'Provides specific context data',
  
  get: async (runtime, message, state) => {
    // Fetch and return context data
    const data = await fetchData();
    return formatContext(data);
  }
};
```

#### Evaluators
Score and filter data or decisions.

```typescript
import type { Evaluator } from '@elizaos/core';

export const myEvaluator: Evaluator = {
  name: 'MY_EVALUATOR',
  description: 'Evaluates data quality',
  
  validate: async (runtime, message, state) => {
    // Should this evaluator run?
    return true;
  },
  
  handler: async (runtime, message, state) => {
    // Evaluate and return score
    return {
      score: 0.85,
      reasoning: "High quality based on criteria",
      data: evaluatedData
    };
  }
};
```

#### Services
Background processing and business logic.

```typescript
import type { Service } from '@elizaos/core';

export class MyService implements Service {
  static serviceType = 'MY_SERVICE';
  
  async initialize(runtime: IAgentRuntime): Promise<void> {
    // Setup service
  }
  
  async processData(params): Promise<Result> {
    // Business logic
  }
}
```

---

## Data Flow

### Request-Response Flow

```
1. User Input
   │
   ├─> Discord/Telegram/Web
   │
   └─> ElizaOS Runtime
       │
       ├─> Message Parsing
       │
       ├─> State Loading (from memory/DB)
       │
       ├─> Provider Execution (gather context)
       │   │
       │   ├─> accountProvider
       │   ├─> walletProvider
       │   └─> marketProvider
       │
       ├─> Action Validation (which action to run?)
       │   │
       │   └─> Match highest scoring action
       │
       ├─> Action Execution
       │   │
       │   ├─> Call Services
       │   │   │
       │   │   ├─> WalletService
       │   │   ├─> DataProviderService
       │   │   └─> ChainService
       │   │
       │   └─> Generate Response
       │
       ├─> Evaluator Execution (optional)
       │   │
       │   └─> Score/filter results
       │
       ├─> State Update (save to memory/DB)
       │
       └─> Response Delivery
           │
           └─> User receives response
```

### Background Task Flow

```
Task Scheduler
│
├─> Task Queue (priority-based)
│
├─> Task Worker Pool
│   │
│   ├─> Worker 1: Twitter Scraping
│   │   │
│   │   ├─> Fetch tweets
│   │   ├─> Analyze sentiment
│   │   └─> Store in DB/Cache
│   │
│   ├─> Worker 2: Birdeye Sync
│   │   │
│   │   ├─> Fetch trending tokens
│   │   ├─> Update cache
│   │   └─> Trigger events
│   │
│   └─> Worker 3: Signal Generation
│       │
│       ├─> Analyze market data
│       ├─> Generate buy/sell signals
│       └─> Notify users
│
└─> Task Completion
    │
    └─> Reschedule if repeating
```

---

## Service Layer

### Service Architecture

Services are singleton instances registered with the runtime:

```typescript
// Service registration
runtime.registerService(MyService);

// Service access from any plugin
const service = runtime.getService('MY_SERVICE');
```

### Core Services

#### WalletService
```typescript
interface IWalletService {
  createWallet(userId: string): Promise<Wallet>;
  importWallet(userId: string, privateKey: string): Promise<Wallet>;
  getBalance(walletId: string, tokenMint?: string): Promise<Balance>;
  swap(params: SwapParams): Promise<Transaction>;
  transfer(params: TransferParams): Promise<Transaction>;
}
```

#### DataProviderService
```typescript
interface IDataProviderService {
  getTokenPrice(address: string, chain: string): Promise<Price>;
  getTrendingTokens(chain: string): Promise<Token[]>;
  getWalletBalance(address: string): Promise<Balance>;
  getHistoricalPrices(address: string, timeframe: string): Promise<OHLCV[]>;
}
```

#### ChainService
```typescript
interface IChainService {
  getTransaction(hash: string): Promise<Transaction>;
  sendTransaction(tx: Transaction): Promise<string>;
  getTokenInfo(address: string): Promise<TokenInfo>;
  estimateGas(tx: Transaction): Promise<number>;
}
```

### Service Communication

```typescript
// Cross-service communication
class TradingService {
  async executeTrade(params: TradeParams) {
    // Get wallet service
    const walletService = this.runtime.getService('WALLET_SERVICE');
    
    // Get data provider
    const dataProvider = this.runtime.getService('DATA_PROVIDER');
    
    // Get current price
    const price = await dataProvider.getTokenPrice(params.token);
    
    // Execute swap
    const tx = await walletService.swap({
      fromToken: params.fromToken,
      toToken: params.toToken,
      amount: params.amount,
      slippage: params.slippage
    });
    
    return tx;
  }
}
```

---

## Database Design

### Schema Overview

#### Users & Accounts
```sql
-- Core user table
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Account settings
CREATE TABLE accounts (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  settings JSON,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### Wallets & Balances
```sql
-- User wallets
CREATE TABLE wallets (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  address VARCHAR(44) UNIQUE NOT NULL,
  private_key_encrypted TEXT NOT NULL,
  name VARCHAR(100),
  chain VARCHAR(20) DEFAULT 'solana',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_wallets (user_id)
);

-- Wallet balances cache
CREATE TABLE wallet_balances (
  wallet_id VARCHAR(36),
  token_mint VARCHAR(44),
  balance DECIMAL(30,18),
  usd_value DECIMAL(20,2),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (wallet_id, token_mint),
  FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
);
```

#### Positions & Trades
```sql
-- Trading positions
CREATE TABLE positions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  wallet_id VARCHAR(36) NOT NULL,
  token_address VARCHAR(44) NOT NULL,
  entry_price DECIMAL(30,18),
  current_price DECIMAL(30,18),
  size DECIMAL(30,18),
  stop_loss DECIMAL(30,18),
  take_profit DECIMAL(30,18),
  status ENUM('open', 'closed') DEFAULT 'open',
  pnl DECIMAL(20,8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (wallet_id) REFERENCES wallets(id),
  INDEX idx_user_positions (user_id, status)
);

-- Trade history
CREATE TABLE trades (
  id VARCHAR(36) PRIMARY KEY,
  position_id VARCHAR(36),
  wallet_id VARCHAR(36) NOT NULL,
  action ENUM('buy', 'sell'),
  token_address VARCHAR(44) NOT NULL,
  amount DECIMAL(30,18),
  price DECIMAL(30,18),
  tx_hash VARCHAR(88),
  gas_fee DECIMAL(20,18),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (position_id) REFERENCES positions(id),
  FOREIGN KEY (wallet_id) REFERENCES wallets(id),
  INDEX idx_wallet_trades (wallet_id, created_at DESC)
);
```

#### Community Investment
```sql
-- Trust scores
CREATE TABLE trust_scores (
  user_id VARCHAR(36) PRIMARY KEY,
  score INT DEFAULT 0,
  total_recommendations INT DEFAULT 0,
  successful_trades INT DEFAULT 0,
  failed_trades INT DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Recommendations
CREATE TABLE recommendations (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token_address VARCHAR(44) NOT NULL,
  recommendation ENUM('buy', 'sell', 'hold'),
  confidence DECIMAL(3,2),
  reasoning TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  executed BOOLEAN DEFAULT FALSE,
  result ENUM('success', 'failure', 'pending') DEFAULT 'pending',
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_active_recommendations (executed, created_at DESC)
);
```

### Caching Strategy

#### Cache Layers

1. **Memory Cache** (ElizaOS built-in)
   - User sessions
   - Recent conversations
   - Temporary computation results
   - TTL: varies by data type

2. **Redis Cache** (optional)
   - Market data
   - Token prices
   - Trending lists
   - TTL: 1-5 minutes

3. **Database Cache**
   - Wallet balances
   - Position data
   - User preferences
   - Updated on transactions

#### Cache Invalidation

```typescript
// Time-based
cache.set('token_price_SOL', price, { ttl: 60 }); // 1 minute

// Event-based
onTransactionComplete((tx) => {
  cache.invalidate(`wallet_balance_${tx.walletId}`);
});

// Manual
await cache.clear('market_data_*');
```

---

## Frontend Architecture

### React Frontend Structure

```
frontend/
├── index.tsx           # Entry point
├── index.css           # Global styles
├── components/         # Feature components
│   ├── Sentiment.tsx
│   ├── Trending.tsx
│   ├── Wallet.tsx
│   └── Statistics.tsx
├── ui/                 # UI components (shadcn/ui)
│   ├── button.tsx
│   ├── card.tsx
│   ├── table.tsx
│   └── tabs.tsx
└── utils.ts            # Utility functions
```

### State Management

Using React Query for server state:

```typescript
// API queries
const { data, isLoading } = useQuery({
  queryKey: ['trending', chain],
  queryFn: () => fetchTrending(chain),
  refetchInterval: 30000  // 30 seconds
});

// Mutations
const mutation = useMutation({
  mutationFn: (params) => executeSwap(params),
  onSuccess: () => {
    queryClient.invalidateQueries(['wallet-balance']);
  }
});
```

### API Integration

```typescript
// API client
class SpartanAPI {
  private baseUrl: string;
  
  async getTrending(chain: string) {
    const response = await fetch(
      `${this.baseUrl}/api/analytics/trending?chain=${chain}`
    );
    return response.json();
  }
  
  async getWalletBalance(address: string) {
    const response = await fetch(
      `${this.baseUrl}/api/wallet/${address}/balance`
    );
    return response.json();
  }
}
```

---

## MCP Integration

### Architecture

```
┌──────────────────────────────────────┐
│      AI Client (Claude/GPT)          │
│  ┌────────────────────────────────┐  │
│  │  Anthropic SDK + x402          │  │
│  └────────────┬───────────────────┘  │
└───────────────┼──────────────────────┘
                │ HTTP + x402 Payment
┌───────────────▼──────────────────────┐
│    Spartan Backend (localhost:2096)  │
│  ┌────────────────────────────────┐  │
│  │  Analytics Plugin              │  │
│  │  - /api/analytics/*            │  │
│  │  - /api/charting/*             │  │
│  └────────────────────────────────┘  │
└───────────────┬──────────────────────┘
                │
┌───────────────▼──────────────────────┐
│  External APIs                       │
│  - Birdeye                           │
│  - CoinMarketCap                     │
│  - TAAPI                             │
└──────────────────────────────────────┘
```

### Payment Protocol Flow

```typescript
// 1. Setup x402-enabled fetch
import { wrapFetchWithPayment } from 'x402-fetch';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(walletKey);
const paymentFetch = wrapFetchWithPayment(fetch, account);

// 2. Use in Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  fetch: paymentFetch
});

// 3. API calls include payment headers automatically
const response = await paymentFetch(
  `${SPARTAN_API_BASE}/api/analytics/market-overview`
);
```

---

## Security Architecture

### Authentication & Authorization

```
User Request
  │
  ├─> API Key Validation
  │   ├─> Check API key in database
  │   └─> Verify rate limits
  │
  ├─> User Session Validation
  │   ├─> Check JWT token
  │   └─> Validate user permissions
  │
  ├─> Request Authorization
  │   ├─> Check user owns resource
  │   └─> Verify action permissions
  │
  └─> Execute Request
```

### Data Encryption

#### At Rest
- Database: AES-256 encryption for sensitive columns
- Private keys: Encrypted with user-specific keys
- Environment variables: Never stored in database

#### In Transit
- HTTPS/TLS for all API communication
- WebSocket connections use WSS
- RPC connections use secure endpoints

### Key Management

```typescript
// Key encryption
class KeyManager {
  encrypt(privateKey: string, userId: string): string {
    const userKey = this.deriveUserKey(userId);
    return crypto.encrypt(privateKey, userKey);
  }
  
  decrypt(encryptedKey: string, userId: string): string {
    const userKey = this.deriveUserKey(userId);
    return crypto.decrypt(encryptedKey, userKey);
  }
  
  private deriveUserKey(userId: string): string {
    return pbkdf2(userId, process.env.MASTER_SALT, 100000);
  }
}
```

### Rate Limiting

```typescript
// Per user
const userLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  keyGenerator: (req) => req.user.id
});

// Per IP
const ipLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.ip
});

// Per endpoint
app.use('/api/swap', userLimiter, swapEndpoint);
```

### Input Validation

```typescript
// Zod schemas for validation
import { z } from 'zod';

const swapSchema = z.object({
  fromToken: z.string().length(44), // Solana address
  toToken: z.string().length(44),
  amount: z.number().positive(),
  slippage: z.number().min(0).max(100).optional()
});

// Use in endpoint
app.post('/api/swap', async (req, res) => {
  try {
    const params = swapSchema.parse(req.body);
    const result = await executeSwap(params);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

---

## Performance Optimization

### Database Optimization

```sql
-- Indexes for common queries
CREATE INDEX idx_user_wallets ON wallets(user_id, created_at DESC);
CREATE INDEX idx_wallet_balances ON wallet_balances(wallet_id, last_updated DESC);
CREATE INDEX idx_open_positions ON positions(user_id, status) WHERE status = 'open';
CREATE INDEX idx_recent_trades ON trades(wallet_id, created_at DESC);

-- Partitioning for large tables
CREATE TABLE trades (...)
PARTITION BY RANGE (YEAR(created_at)) (
  PARTITION p2024 VALUES LESS THAN (2025),
  PARTITION p2025 VALUES LESS THAN (2026)
);
```

### Caching Strategy

```typescript
// Multi-layer caching
class CacheManager {
  private memory = new Map();
  private redis?: RedisClient;
  
  async get(key: string) {
    // L1: Memory
    if (this.memory.has(key)) {
      return this.memory.get(key);
    }
    
    // L2: Redis
    if (this.redis) {
      const value = await this.redis.get(key);
      if (value) {
        this.memory.set(key, value);
        return value;
      }
    }
    
    // L3: Database
    return null;
  }
}
```

### Load Balancing

```
               ┌──────────────┐
               │ Load Balancer│
               └──────┬───────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼────┐   ┌───▼────┐   ┌───▼────┐
   │ Spartan │   │Spartan │   │Spartan │
   │Instance1│   │Instance2│   │Instance3│
   └────┬────┘   └───┬────┘   └───┬────┘
        │            │            │
        └────────────┴────────────┘
                     │
            ┌────────▼────────┐
            │ Shared Database │
            │  & Cache Layer  │
            └─────────────────┘
```

---

## Monitoring & Observability

### Logging

```typescript
// Structured logging
logger.info('Swap executed', {
  userId: user.id,
  walletId: wallet.id,
  fromToken: params.fromToken,
  toToken: params.toToken,
  amount: params.amount,
  txHash: result.hash,
  duration: Date.now() - startTime
});
```

### Metrics

- Request latency (p50, p95, p99)
- Error rates
- Active users
- Transaction success rate
- API usage per user
- Cache hit rates

### Health Checks

```typescript
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    blockchain: await checkRPC(),
    apis: await checkExternalAPIs()
  };
  
  const healthy = Object.values(checks).every(c => c.status === 'ok');
  res.status(healthy ? 200 : 503).json(checks);
});
```

---

For more information, see:
- [Plugin Documentation](./PLUGINS.md)
- [API Documentation](./API.md)
- [Deployment Guide](./DEPLOYMENT.md)

