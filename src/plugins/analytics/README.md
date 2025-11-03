# Analytics Plugin

A comprehensive analytics platform that integrates data from multiple providers (Birdeye, CoinMarketCap, Codex) to provide advanced token analysis, technical indicators, historical data, and account insights.

## Features

### 🔍 Comprehensive Token Analytics
- **Price Analysis**: Real-time price data, 24h changes, volume, and market cap
- **Technical Indicators**: MACD, RSI, Bollinger Bands, Moving Averages, Volume analysis
- **Holder Analytics**: Token holder distribution, concentration risk, community growth (via Codex)
- **Sniper Analytics**: Sniper activity, profit analysis, top performers (via Codex)
- **Risk Assessment**: Volatility, liquidity, concentration, and technical risk evaluation
- **Trading Recommendations**: Buy/sell/hold signals with confidence levels and price targets

### 📊 Account Analytics
- **Portfolio Performance**: Total value, PnL, best/worst performers
- **Risk Metrics**: Sharpe ratio, max drawdown, volatility
- **Trading History**: Win rate, trade analysis, position sizing
- **Portfolio Allocation**: Token distribution and diversification analysis

### 🌍 Market Analytics
- **Market Overview**: Total market cap, volume, sentiment
- **Top Gainers/Losers**: 24h performance leaders
- **Trending Tokens**: High-volume tokens and market movers
- **Market Sentiment**: Bullish/bearish/neutral indicators

### 📈 Historical Analysis
- **Price Trends**: Historical price movement and patterns
- **Volume Analysis**: Volume trends and on-balance volume
- **Technical Trends**: Moving average crossovers and trend analysis
- **Timeframe Support**: 1h, 4h, 1d, 1w, 1m intervals

## Data Providers

### Birdeye (Solana)
- Token price data and market information
- Historical price data
- Account/wallet analytics
- Market trends and rankings

### CoinMarketCap (Multi-chain)
- Token price data across multiple chains
- Historical price data
- Market cap and volume information
- Global market metrics

### Codex (Solana)
- Token holder analytics and distribution
- Sniper activity and profit analysis
- Community growth metrics
- Wallet performance data

## Technical Indicators

### Core Indicators
- **MACD**: Moving Average Convergence Divergence
- **RSI**: Relative Strength Index
- **Bollinger Bands**: Volatility and trend analysis
- **Moving Averages**: SMA (20, 50, 200) and EMA (12, 26)

### Advanced Indicators
- **Volume Analysis**: Volume SMA, volume ratio, on-balance volume
- **Stochastic Oscillator**: Momentum and overbought/oversold conditions
- **ATR**: Average True Range for volatility measurement
- **Williams %R**: Momentum oscillator
- **CCI**: Commodity Channel Index
- **MFI**: Money Flow Index
- **Parabolic SAR**: Trend following indicator
- **ADX**: Average Directional Index

## Actions

### `GET_TOKEN_ANALYTICS`
Get comprehensive analytics for a specific token including price data, technical indicators, holder analytics, and trading recommendations.

**Parameters:**
- `tokenAddress` (required): The token address to analyze
- `chain`: Blockchain chain (solana, ethereum, base) - default: solana
- `timeframe`: Analysis timeframe (1h, 4h, 1d, 1w, 1m) - default: 1d
- `includeHistorical`: Include historical data - default: true
- `includeHolders`: Include holder analytics - default: true
- `includeSnipers`: Include sniper analytics - default: true

### `GET_ACCOUNT_ANALYTICS`
Get comprehensive analytics for a wallet account including portfolio performance, risk metrics, and trading history.

**Parameters:**
- `walletAddress` (optional): Wallet address (uses current user if not provided)
- `chain`: Blockchain chain - default: solana

### `GET_MARKET_ANALYTICS`
Get market analytics including top gainers, losers, trending tokens, and market sentiment.

**Parameters:**
- `chain`: Blockchain chain - default: solana

### `GET_HISTORICAL_ANALYTICS`
Get historical analytics for a token including price trends, volume analysis, and technical indicators over time.

**Parameters:**
- `tokenAddress` (required): The token address to analyze
- `chain`: Blockchain chain - default: solana
- `timeframe`: Analysis timeframe - default: 1d

### `GET_TECHNICAL_INDICATORS`
Get detailed technical indicators for a token including MACD, RSI, Bollinger Bands, moving averages, and trading signals.

**Parameters:**
- `tokenAddress` (required): The token address to analyze
- `chain`: Blockchain chain - default: solana
- `timeframe`: Analysis timeframe - default: 1d

## Providers

### `ANALYTICS`
Main analytics provider that provides comprehensive token analysis, portfolio insights, and market data.

### `MARKET_DATA`
Real-time market data including top gainers, losers, trending tokens, and market sentiment.

### `TECHNICAL_INDICATORS`
Real-time technical indicators including MACD, RSI, Bollinger Bands, moving averages, and trading signals.

### `HISTORICAL_DATA`
Historical price data and trend analysis for tokens across different timeframes.

## Services

### `AnalyticsService`
Main service that orchestrates data from multiple providers and provides comprehensive analytics.

### `MarketDataService`
Service for fetching market data from Birdeye and CoinMarketCap providers.

### `TechnicalAnalysisService`
Service for calculating technical indicators and generating trading signals.

## Usage Examples

### Token Analysis
```
"Analyze token 0x1234... with technical indicators and holder data"
"Get comprehensive analytics for SOL token"
"Show me RSI and MACD for this token"
```

### Account Analysis
```
"Analyze my portfolio performance"
"Show my account analytics with risk metrics"
"Get my trading history and win rate"
```

### Market Analysis
```
"Show me top gainers and losers"
"Get market overview for Solana"
"Display trending tokens"
```

### Historical Analysis
```
"Show historical data for the last 30 days"
"Analyze price trends over the past week"
"Get technical indicators for 1h timeframe"
```

## Configuration

### Required API Keys
- `BIRDEYE_API_KEY`: Birdeye API key for Solana data
- `COINMARKETCAP_API_KEY`: CoinMarketCap API key for multi-chain data
- `CODEX_API_KEY`: Codex API key for holder and sniper analytics

### Optional Settings
- Cache TTL settings for different data types
- Rate limiting configuration
- Default chain and timeframe preferences

## Architecture

The analytics plugin follows a modular architecture:

1. **Providers**: Data source integrations (Birdeye, CoinMarketCap, Codex)
2. **Services**: Business logic and data orchestration
3. **Actions**: User-facing commands and interactions
4. **Utils**: Technical analysis calculations and utilities
5. **Interfaces**: Type definitions and data structures

## Error Handling

- Graceful degradation when providers are unavailable
- Comprehensive error messages and fallback data
- Rate limiting and caching to prevent API abuse
- Validation of input parameters and data integrity

## Performance

- Intelligent caching with appropriate TTL values
- Rate limiting to respect API limits
- Parallel data fetching where possible
- Efficient technical indicator calculations

## Future Enhancements

- Additional technical indicators (Fibonacci retracements, Ichimoku, etc.)
- Machine learning-based price predictions
- Social sentiment analysis integration
- Advanced portfolio optimization recommendations
- Real-time alerts and notifications
- Chart generation and visualization
- Backtesting capabilities for trading strategies 