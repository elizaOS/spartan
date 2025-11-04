# Spartan Plugins Documentation

Complete reference for all Spartan plugins, their features, and usage.

## Table of Contents

1. [Account Registration Plugin](#account-registration-plugin)
2. [Analytics Plugin](#analytics-plugin)
3. [Autonomous Trader Plugin](#autonomous-trader-plugin)
4. [Trading Plugin](#trading-plugin)
5. [Multiwallet Plugin](#multiwallet-plugin)
6. [DegenIntel Plugin](#degenintel-plugin)
7. [Community Investor Plugin](#community-investor-plugin)
8. [Autofun Trader Plugin](#autofun-trader-plugin)
9. [KOL Plugin](#kol-plugin)
10. [Coin Marketing Plugin](#coin-marketing-plugin)

---

## Account Registration Plugin

**Name:** `account`  
**Purpose:** User account management and registration system for ElizaOS

### Features

- User registration with email verification
- Account settings management
- Notification preferences
- Multi-tenant account support
- User verification codes

### Actions

#### `userRegistration`
Register a new user account.

**Usage:**
```
User: I want to sign up
User: Register my account
User: Create an account for me
```

**Process:**
1. Collects user email
2. Generates verification code
3. Sends confirmation email
4. Creates user record in database

#### `checkRegistrationCode`
Verify email with confirmation code.

**Usage:**
```
User: Confirm email with code: 123456
User: Verify my registration: ABC123
```

#### `deleteRegistration`
Remove user registration.

**Usage:**
```
User: Delete my signup
User: Remove my registration
```

#### `turnOnNotifications`
Enable notifications for user.

**Usage:**
```
User: Turn on notifications
User: Enable alerts
```

#### `turnOffNotifications`
Disable notifications for user.

**Usage:**
```
User: Turn off notifications
User: Disable alerts
```

### Providers

#### `accountProvider`
Provides account information in context:
- Notification settings
- Account status
- User preferences

#### `userProvider`
Provides user information in context:
- Email address
- Verification status
- Registration date

### Services

#### `InterfaceUserService`
Manages user operations:
- `createUser()`
- `updateUser()`
- `getUser()`
- `verifyUser()`

#### `InterfaceAccountService`
Manages account operations:
- `createAccount()`
- `updateAccount()`
- `getAccountSettings()`

### Database Schema

```sql
-- users table
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  verified BOOLEAN DEFAULT FALSE,
  verification_code VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- accounts table
CREATE TABLE accounts (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  notifications_enabled BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## Analytics Plugin

**Name:** `analytics`  
**Purpose:** Comprehensive analytics platform integrating Birdeye, CoinMarketCap, and Codex

### Features

- Token analytics with 14+ technical indicators
- Portfolio performance tracking
- Market overview and trends
- Historical data analysis
- Risk assessment
- Trading recommendations

### Actions

#### `getTokenAnalytics`
Get comprehensive token analysis.

**Parameters:**
- `tokenAddress` (required): Token contract address
- `chain` (optional): solana, ethereum, base (default: solana)
- `timeframe` (optional): 1h, 4h, 1d, 1w, 1m (default: 1d)
- `includeHistorical` (optional): boolean (default: true)
- `includeHolders` (optional): boolean (default: true)
- `includeSnipers` (optional): boolean (default: true)

**Usage:**
```
User: Analyze token So11111111111111111111111111111111111111112
User: Get analytics for BONK with historical data
User: Show me technical indicators for this token
```

**Returns:**
- Price data (current, 24h change, volume, market cap)
- Technical indicators (MACD, RSI, Bollinger Bands, etc.)
- Holder analytics (distribution, top holders, concentration)
- Sniper analytics (early buyers, profits)
- Risk assessment
- Trading recommendation (buy/sell/hold with confidence)

#### `getAccountAnalytics`
Get portfolio analytics for a wallet.

**Parameters:**
- `walletAddress` (optional): Wallet address (uses current user if not provided)
- `chain` (optional): blockchain (default: solana)

**Usage:**
```
User: Analyze my portfolio
User: Show portfolio performance
User: Get my account analytics
```

**Returns:**
- Total portfolio value
- Profit/Loss (PnL)
- Best/worst performers
- Risk metrics (Sharpe ratio, max drawdown, volatility)
- Trading history
- Win rate
- Portfolio allocation

#### `getMarketAnalytics`
Get market overview and trends.

**Parameters:**
- `chain` (optional): blockchain (default: solana)

**Usage:**
```
User: Show market overview
User: What are top gainers and losers?
User: Get trending tokens
```

**Returns:**
- Total market cap
- 24h volume
- Market sentiment
- Top gainers (24h)
- Top losers (24h)
- Trending tokens

#### `getHistoricalAnalytics`
Get historical data and trends.

**Parameters:**
- `tokenAddress` (required): Token address
- `chain` (optional): blockchain (default: solana)
- `timeframe` (optional): 1h, 4h, 1d, 1w, 1m (default: 1d)

**Usage:**
```
User: Show historical data for last 30 days
User: Analyze price trends over the past week
```

**Returns:**
- Price trends
- Volume analysis
- Technical trends
- Moving average crossovers

#### `getTechnicalIndicators`
Get detailed technical indicators.

**Parameters:**
- `tokenAddress` (required): Token address
- `chain` (optional): blockchain (default: solana)
- `timeframe` (optional): 1h, 4h, 1d, 1w, 1m (default: 1d)

**Usage:**
```
User: Show RSI and MACD
User: Get technical indicators for 1h timeframe
```

**Returns:**
- MACD (signal, histogram, crossovers)
- RSI (current, overbought/oversold)
- Bollinger Bands (upper, middle, lower)
- Moving Averages (SMA 20/50/200, EMA 12/26)
- Volume indicators
- Stochastic Oscillator
- ATR, Williams %R, CCI, MFI, Parabolic SAR, ADX

### Technical Indicators Explained

#### MACD (Moving Average Convergence Divergence)
- **Signal**: Buy when MACD crosses above signal line
- **Values**: Positive = bullish, Negative = bearish

#### RSI (Relative Strength Index)
- **Range**: 0-100
- **Overbought**: > 70
- **Oversold**: < 30
- **Signal**: Potential reversal at extremes

#### Bollinger Bands
- **Upper Band**: Resistance level
- **Lower Band**: Support level
- **Width**: Volatility indicator

#### Moving Averages
- **SMA 20**: Short-term trend
- **SMA 50**: Medium-term trend
- **SMA 200**: Long-term trend
- **Golden Cross**: SMA 50 crosses above SMA 200 (bullish)
- **Death Cross**: SMA 50 crosses below SMA 200 (bearish)

### Providers

#### `analyticsProvider`
Main analytics data provider with comprehensive token and market analysis.

#### `marketDataProvider`
Real-time market data including gainers, losers, trending tokens.

#### `technicalIndicatorsProvider`
Real-time technical indicators and trading signals.

#### `historicalDataProvider`
Historical price and volume data for trend analysis.

### Services

#### `AnalyticsService`
Main orchestration service:
- `getTokenAnalytics(params)`
- `getAccountAnalytics(params)`
- `getMarketAnalytics(params)`
- Integrates data from multiple providers
- Performs risk assessment
- Generates trading recommendations

#### `MarketDataService`
Market data aggregation:
- `fetchBirdeyeData()`
- `fetchCoinMarketCapData()`
- `getTopGainers()`
- `getTopLosers()`
- `getTrendingTokens()`

#### `TechnicalAnalysisService`
Technical indicator calculations:
- `calculateMACD(prices)`
- `calculateRSI(prices)`
- `calculateBollingerBands(prices)`
- `calculateMovingAverages(prices)`
- `generateSignals(indicators)`

### Configuration

```env
# Required
BIRDEYE_API_KEY=your_birdeye_api_key
COINMARKETCAP_API_KEY=your_cmc_api_key

# Optional
CODEX_API_KEY=your_codex_api_key

# Cache settings (optional)
ANALYTICS_CACHE_TTL=300  # 5 minutes
MARKET_DATA_CACHE_TTL=60  # 1 minute
```

### Rate Limits

- **Birdeye Free**: 100 requests/minute
- **CoinMarketCap Basic**: 333 requests/day
- **Codex**: Varies by plan

Spartan implements intelligent caching to minimize API usage.

---

## Autonomous Trader Plugin

**Name:** `autonomous-trader`  
**Purpose:** Core Spartan utilities and holder verification

### Features

- Token holder verification
- Spartan product instructions
- Common utilities for trading
- Links and resources

### Actions

#### `verifyHolder`
Verify token holder status.

**Usage:**
```
User: Verify holder
User: Check if I'm a holder
```

**Process:**
1. Gets user's wallet address
2. Checks token balance
3. Verifies minimum holding requirement
4. Grants access if verified

### Providers

#### `holderProvider`
Provides holder verification status in context.

#### `instructionsProvider`
Provides Spartan usage instructions and help text.

#### `linksProvider`
Provides useful links and resources.

### Utilities

#### `util_matcher.ts`
Non-LLM option matcher for faster response times on common queries.

### Constants

Shared constants used across Spartan products:
- Token addresses
- Minimum holder requirements
- Chain configurations

---

## Trading Plugin

**Name:** `trading`  
**Purpose:** Multi-strategy trading engine with position management

### Features

- Multiple trading strategies (LLM, Copy, Manual)
- Position tracking and management
- Automated trading execution
- Risk management
- Performance analytics

### Actions

#### `setStrategy`
Set trading strategy for a wallet.

**Usage:**
```
User: Set my trading strategy to LLM
User: Use AI trading strategy
```

**Strategies:**
- `llm`: LLM-based decision making
- `copy`: Copy trading from elite wallets
- `none`: Manual trading only

#### `changeStrategy`
Change existing trading strategy.

**Usage:**
```
User: Change strategy to copy trading
User: Switch to manual strategy
```

#### `positionSettings`
Configure position settings.

**Usage:**
```
User: Update position settings
User: Set stop loss and take profit
```

**Settings:**
- Stop loss percentage
- Take profit percentage
- Position size limits
- Risk per trade

#### `openPosition`
Manually open a trading position.

**Usage:**
```
User: Open position on SOL
User: Buy 1 SOL for trading
```

### Providers

#### `positionProvider`
Provides current position data:
- Open positions
- Position PnL
- Entry/exit prices
- Position sizes

#### `marketProvider`
Provides market analysis data:
- Trending tokens
- Market sentiment
- Recent trading signals

### Services

#### `InterfacePositionsService`
Manages trading positions:
- `createPosition(params)`
- `updatePosition(id, params)`
- `closePosition(id)`
- `getPositions(userId)`
- `calculatePnL(position)`

### Strategies

#### LLM Strategy
Uses AI to make trading decisions based on:
- Technical indicators
- Market sentiment
- News and social media
- Historical patterns

**Configuration:**
```typescript
{
  model: "gpt-4",
  temperature: 0.7,
  riskTolerance: "medium",
  maxPositions: 5
}
```

#### Copy Strategy
Mirrors trades from successful wallets:
- Monitors target wallets
- Copies buy/sell actions
- Applies position sizing rules
- Manages risk independently

**Configuration:**
```typescript
{
  targetWallets: ["address1", "address2"],
  copyRatio: 0.1,  // Copy 10% of target position size
  minLiquidity: 100000  // Only copy tokens with sufficient liquidity
}
```

#### None Strategy
Manual trading only:
- User initiates all trades
- No automated execution
- Full control

### Database Schema

```sql
CREATE TABLE positions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  wallet_id VARCHAR(36),
  token_address VARCHAR(44),
  entry_price DECIMAL(20,8),
  current_price DECIMAL(20,8),
  size DECIMAL(20,8),
  stop_loss DECIMAL(20,8),
  take_profit DECIMAL(20,8),
  status ENUM('open', 'closed'),
  pnl DECIMAL(20,8),
  created_at TIMESTAMP,
  closed_at TIMESTAMP
);
```

---

## Multiwallet Plugin

**Name:** `multiwallet`  
**Purpose:** Multi-tenant wallet management system

### Features

- Create unlimited wallets per user
- Import existing wallets
- Secure key storage
- Token swaps via Jupiter
- Wallet sweeping (consolidate tokens)
- Cross-wallet transfers
- Balance tracking

### Actions

#### `walletCreate`
Create a new Solana wallet.

**Usage:**
```
User: Create a new wallet
User: Generate wallet for me
```

**Returns:**
- Wallet address
- Private key (encrypted, shown once)

#### `walletImport`
Import existing wallet.

**Usage:**
```
User: Import wallet with private key: [key]
User: Add my existing wallet
```

**Parameters:**
- Private key (base58 encoded)
- Optional: Wallet name

#### `userMetawalletList`
List all user wallets with balances.

**Usage:**
```
User: List my wallets
User: Show all my accounts
```

**Returns:**
- Wallet addresses
- SOL balances
- Token balances
- Total USD value

#### `userMetawalletSwap`
Swap tokens using Jupiter.

**Usage:**
```
User: Swap 1 SOL to USDC
User: Exchange 100 USDC for BONK
```

**Parameters:**
- From token
- To token
- Amount
- Slippage tolerance (optional)

#### `userMetawalletSweep`
Consolidate all tokens to one token.

**Usage:**
```
User: Sweep all tokens to SOL
User: Convert everything to USDC
```

#### `userMetawalletXfer`
Transfer between user's wallets.

**Usage:**
```
User: Transfer 0.5 SOL from wallet A to wallet B
User: Move tokens between my wallets
```

### Providers

#### `multiwalletProvider`
Provides overview of all user wallets.

#### `walletProvider`
Provides details about specific wallet:
- Address
- Balances
- Recent transactions

#### `tokenProvider`
Provides token information:
- Token metadata
- Price data
- User holdings

### Services

#### `InterfaceWalletService`
Core wallet management:
- `createWallet(userId)`
- `importWallet(userId, privateKey)`
- `getWallets(userId)`
- `getBalance(walletId, tokenMint)`
- `swap(params)`
- `sweep(walletId, targetToken)`
- `transfer(fromWallet, toWallet, amount)`

### Security

- Private keys encrypted at rest
- Keys never logged or exposed in responses
- Secure key derivation
- Rate limiting on wallet operations
- Transaction signing happens server-side

### Database Schema

```sql
CREATE TABLE wallets (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  address VARCHAR(44) UNIQUE,
  private_key_encrypted TEXT,
  name VARCHAR(100),
  created_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE wallet_balances (
  wallet_id VARCHAR(36),
  token_mint VARCHAR(44),
  balance DECIMAL(20,8),
  last_updated TIMESTAMP,
  PRIMARY KEY (wallet_id, token_mint),
  FOREIGN KEY (wallet_id) REFERENCES wallets(id)
);
```

---

## DegenIntel Plugin

**Name:** `degenIntel` (spartan-intel)  
**Purpose:** Market intelligence, sentiment analysis, and data aggregation

### Features

- Twitter sentiment analysis
- Birdeye trending tokens
- CoinMarketCap market data
- Token research and security analysis
- Buy/sell signal generation
- Whale activity tracking
- React frontend for visualization
- API endpoints for MCP agents

### Providers

#### `tokenResearchProvider`
Deep token analysis:
- Token metadata
- Security score
- Holder distribution
- Liquidity analysis
- Contract verification

#### `sentimentProvider`
Sentiment analysis from social media:
- Twitter mentions
- Sentiment score (bullish/bearish/neutral)
- Trending topics
- Influencer activity

### Services

#### `TradeChainService`
Blockchain interaction service:
- `getTokenInfo(address)`
- `getTransactions(wallet)`
- `executeSwap(params)`
- `getGasEstimate(transaction)`

#### `TradeDataProviderService`
Aggregates data from multiple sources:
- `getBirdeyeData(token)`
- `getCMCData(token)`
- `getHistoricalPrices(token, timeframe)`
- `getTrendingTokens(chain)`

#### `TradeStrategyService`
Trading strategy logic:
- `analyzeBuySignal(token)`
- `analyzeSellSignal(position)`
- `calculateRisk(params)`
- `generateRecommendation(analysis)`

#### `TradeLpService`
Liquidity pool management:
- `getLPPositions(wallet)`
- `calculateAPR(pool)`
- `getImpermanentLoss(position)`

### Evaluators

#### `tokenSnifferEvaluator`
Evaluates token safety:
- Contract audit status
- Liquidity locked
- Mint/freeze authority
- Top holder concentration
- Honeypot detection

**Returns:**
- Safety score (0-100)
- Risk factors
- Warnings

### Tasks

#### Twitter Scraping Task
Monitors Twitter for crypto mentions:
- Runs every 5 minutes
- Tracks specific keywords
- Analyzes sentiment
- Stores in database

#### Birdeye Sync Task
Syncs trending tokens from Birdeye:
- Runs every 10 minutes
- Updates trending list
- Caches token data

#### CoinMarketCap Sync Task
Updates CMC market data:
- Runs every 15 minutes
- Top 100 tokens
- Market cap changes
- Volume updates

#### Buy Signal Task
Generates buy signals:
- Analyzes trending tokens
- Checks technical indicators
- Evaluates sentiment
- Generates signals every 5 minutes

#### Sell Signal Task
Generates sell signals for positions:
- Monitors open positions
- Checks take profit/stop loss
- Evaluates market conditions
- Runs every 5 minutes

### Frontend

React-based visualization dashboard:
- **Sentiment View**: Social sentiment analysis
- **Trending View**: Trending tokens with metrics
- **Wallet View**: Wallet tracking and analysis
- **Statistics View**: Market statistics

**Running:**
```bash
cd src/plugins/degenIntel/frontend
npm install
npm run dev
```

### API Endpoints

See `spartan-mcp/INTEGRATION.md` for complete API documentation.

**Key endpoints:**
- `GET /api/analytics/market-overview`
- `GET /api/analytics/trending`
- `GET /api/analytics/sentiment`
- `POST /api/analytics/analyze-token`
- `GET /api/charting/ohlcv`
- `POST /api/charting/indicators`

---

## Community Investor Plugin

**Name:** `communityInvestor`  
**Purpose:** Community-driven investment with trust scoring

### Features

- Trust-based recommendation system
- Performance tracking
- Community leaderboard
- Scam detection with penalties
- Trade decision processing
- React frontend

### Services

#### `CommunityInvestorService`
Main service managing:
- User trust scores
- Recommendations
- Trade execution
- Performance metrics

**Methods:**
- `getLeaderboard()`
- `getUserTrustScore(userId)`
- `submitRecommendation(params)`
- `processTradeDecisions()`
- `updateMetrics()`

### Events

#### Trade Execution Event
Fired when a community trade is executed:
```typescript
{
  event: 'trade_executed',
  data: {
    userId: string,
    tokenAddress: string,
    action: 'buy' | 'sell',
    amount: number,
    price: number
  }
}
```

#### Recommendation Update Event
Fired when new recommendation is submitted:
```typescript
{
  event: 'recommendation_updated',
  data: {
    userId: string,
    tokenAddress: string,
    recommendation: 'buy' | 'sell' | 'hold',
    confidence: number
  }
}
```

### Routes

#### `GET /api/community/leaderboard`
Returns community leaderboard with trust scores.

#### `GET /api/community/recommendations`
Returns current active recommendations.

#### `GET /api/community/user/:userId/score`
Returns specific user's trust score and stats.

### Configuration

```env
PROCESS_TRADE_DECISION_INTERVAL_HOURS=1
METRIC_REFRESH_INTERVAL_HOURS=24
USER_TRADE_COOLDOWN_HOURS=12
SCAM_PENALTY=-100
SCAM_CORRECT_CALL_BONUS=100
MAX_RECOMMENDATIONS_IN_PROFILE=50
```

### Trust Score Calculation

```
Trust Score = Base Score + Performance Bonus - Penalties

Performance Bonus:
- Winning trades: +10 per trade
- Accurate scam calls: +100
- Consistent performance: +50

Penalties:
- Losing trades: -5 per trade
- Incorrect scam calls: -100
- Inactivity: -10 per month
```

---

## Autofun Trader Plugin

**Name:** `autofunTrader`  
**Purpose:** Autonomous trading for auto.fun platform

### Features

- Automated buy signal generation
- Position monitoring
- Auto.fun IDL integration
- Raydium vault support

### Services

#### `DegenTradingService`
Main trading orchestration:
- `buyService.generateSignal()`
- `sellService.generateSignal()`
- Position tracking
- Risk management

### Tasks

#### `AFTRADER_GOTO_MARKET`
Generates buy signals every 5 minutes:
- Analyzes market conditions
- Identifies opportunities
- Executes buy orders

#### `AFTRADER_CHECK_POSITIONS`
Monitors positions every 5 minutes:
- Checks take profit levels
- Monitors stop loss
- Executes sell orders

### Configuration

Tasks are automatically registered on plugin initialization and run continuously.

---

## KOL Plugin

**Name:** `kol`  
**Purpose:** Key Opinion Leader features

### Status

Minimal implementation - framework ready for custom KOL features.

### Potential Features

- Influencer tracking
- Signal aggregation
- Performance monitoring
- Follower management

---

## Coin Marketing Plugin

**Name:** `coin_marketing`  
**Purpose:** Coin marketing and promotion tools

### Features

- Coin data provider
- Marketing campaign support

### Providers

#### `coinProvider`
Provides coin marketing data:
- Campaign status
- Promotion metrics
- Engagement stats

### Future Enhancements

- Automated social posting
- Campaign analytics
- ROI tracking
- Multi-platform management

---

## Plugin Integration

### Loading Plugins

Plugins are loaded in `src/index.ts`:

```typescript
export const spartan: ProjectAgent = {
  plugins: [
    accountRegPlugin,
    autonomousTraderPlugin,
    degenIntelPlugin,
    multiwalletPlugin,
    traderPlugin,
    // ... other plugins
  ],
  character,
  init: async (runtime) => await initCharacter({ runtime, config }),
};
```

### Plugin Dependencies

```
account → (base)
autonomous-trader → account
degenIntel → account
multiwallet → degenIntel, account
trading → multiwallet, degenIntel, account
analytics → (standalone or enhanced by others)
communityInvestor → account, degenIntel
autofunTrader → degenIntel
```

### Inter-Plugin Communication

Plugins communicate via services:

```typescript
// In any plugin
const dataProvider = runtime.getService('TRADER_DATAPROVIDER');
const chainService = runtime.getService('TRADER_CHAIN');
```

---

## Best Practices

### Plugin Development

1. **Follow ElizaOS conventions**
2. **Use TypeScript strict mode**
3. **Implement proper error handling**
4. **Add comprehensive tests**
5. **Document all public APIs**

### Performance

1. **Implement caching where appropriate**
2. **Use rate limiting for external APIs**
3. **Optimize database queries**
4. **Monitor memory usage**
5. **Use connection pooling**

### Security

1. **Validate all inputs**
2. **Encrypt sensitive data**
3. **Use environment variables for secrets**
4. **Implement proper authentication**
5. **Rate limit user actions**

---

For more information, see:
- [Main README](../README.md)
- [Architecture Documentation](./ARCHITECTURE.md)
- [API Documentation](./API.md)
- [Deployment Guide](./DEPLOYMENT.md)

