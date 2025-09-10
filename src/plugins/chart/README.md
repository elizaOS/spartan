# Chart Plugin

A comprehensive chart visualization plugin that consumes data from the analytics plugin to generate various types of charts and visualizations for cryptocurrency and DeFi data.

## Features

### 📊 Chart Types
- **Price Charts**: Candlestick and line charts with technical indicators
- **Portfolio Charts**: Pie charts and donut charts for token allocation
- **Technical Charts**: RSI, MACD, Bollinger Bands, and moving averages
- **Market Charts**: Top gainers, losers, and market sentiment
- **Performance Charts**: Portfolio value, PnL, and returns over time

### 🎨 Chart Themes
- **Crypto**: Vibrant colors optimized for cryptocurrency data
- **Light**: Clean, professional light theme
- **Dark**: Modern dark theme for low-light environments
- **Minimal**: Simple, distraction-free design
- **Professional**: Corporate-style charts

### 📈 Data Sources
- **Analytics Plugin**: Primary data source for all chart data
- **Real-time Data**: Live price and market data
- **Historical Data**: Time-series data for trend analysis
- **Technical Indicators**: Calculated technical analysis metrics

## Chart Types

### Price Charts
Generate candlestick or line charts showing:
- Token price movements over time
- Volume data
- Technical indicators overlay (RSI, MACD, Bollinger Bands)
- Moving averages (SMA 20, 50, 200)
- Support and resistance levels

### Portfolio Charts
Create allocation visualizations showing:
- Token distribution percentages
- Portfolio value breakdown
- Asset allocation by category
- Risk distribution analysis

### Technical Charts
Display technical analysis indicators:
- **RSI**: Relative Strength Index with overbought/oversold levels
- **MACD**: Moving Average Convergence Divergence with signal line
- **Bollinger Bands**: Upper, middle, and lower bands
- **Moving Averages**: SMA and EMA with different periods
- **Volume Analysis**: Volume trends and patterns

### Market Charts
Show market overview data:
- Top gainers and losers
- Market sentiment analysis
- Trending tokens
- Market cap and volume metrics
- Fear & Greed Index

### Performance Charts
Track portfolio performance:
- Total portfolio value over time
- Profit and Loss (PnL) tracking
- Daily and cumulative returns
- Drawdown analysis
- Risk-adjusted returns

## Actions

### `GENERATE_PRICE_CHART`
Generate price charts (candlestick or line) for specific tokens.

**Parameters:**
- `tokenAddress` (required): Token address or symbol
- `chain`: Blockchain chain (solana, ethereum, base) - default: solana
- `timeframe`: Chart timeframe (1h, 4h, 1d, 1w, 1m) - default: 1d
- `chartType`: Chart type (candlestick, line) - default: candlestick
- `includeIndicators`: Include technical indicators - default: true

**Examples:**
```
"Generate a price chart for SOL token"
"Show me a candlestick chart for token 0x1234... with technical indicators"
"Create a line chart for BONK with 1d timeframe"
```

### `GENERATE_PORTFOLIO_CHART`
Generate portfolio allocation charts showing token distribution.

**Parameters:**
- `walletAddress` (required): Wallet address to analyze
- `chain`: Blockchain chain - default: solana
- `chartType`: Chart type (pie, donut, bar) - default: pie

**Examples:**
```
"Show me my portfolio allocation chart"
"Generate a pie chart of my token holdings"
"Create a portfolio chart for wallet 0x1234..."
```

### `GENERATE_TECHNICAL_CHART`
Generate technical indicators charts with RSI, MACD, and other metrics.

**Parameters:**
- `tokenAddress` (required): Token address or symbol
- `chain`: Blockchain chain - default: solana
- `timeframe`: Analysis timeframe - default: 1d
- `indicators`: Specific indicators to include (rsi, macd, bollinger, sma)

**Examples:**
```
"Show me technical indicators for SOL token"
"Generate a technical chart with RSI and MACD for token 0x1234..."
"Create a technical analysis chart for BONK with 1d timeframe"
```

### `GENERATE_MARKET_CHART`
Generate market overview charts showing top gainers, losers, and sentiment.

**Parameters:**
- `chain`: Blockchain chain - default: solana
- `chartType`: Chart type (bar, pie, line, area) - default: bar

**Examples:**
```
"Show me the market overview chart"
"Generate a chart of top gainers and losers"
"Create a market sentiment chart for Solana"
```

### `GENERATE_PERFORMANCE_CHART`
Generate performance charts showing portfolio value, PnL, and returns.

**Parameters:**
- `walletAddress` (required): Wallet address to analyze
- `chain`: Blockchain chain - default: solana
- `timeframe`: Performance timeframe (1d, 1w, 1m, 3m, 6m, 1y) - default: 1m

**Examples:**
```
"Show me my portfolio performance chart"
"Generate a PnL chart for my wallet"
"Create a performance chart for wallet 0x1234..."
```

## Services

### `ChartService`
Main service that orchestrates chart generation and data consumption from the analytics plugin.

**Key Methods:**
- `generatePriceChart()`: Create price charts with technical indicators
- `generatePortfolioChart()`: Create portfolio allocation charts
- `generateTechnicalChart()`: Create technical analysis charts
- `generateMarketChart()`: Create market overview charts
- `generatePerformanceChart()`: Create performance tracking charts
- `generateCustomChart()`: Create custom charts from provided data
- `exportChart()`: Export charts to various formats

## Configuration

### Chart Settings
- **Default Theme**: crypto
- **Default Dimensions**: 800x400 (price charts), 600x400 (portfolio charts)
- **Responsive**: true
- **Animation**: true
- **Show Legend**: true
- **Show Grid**: true
- **Show Tooltip**: true

### Color Palettes
Each theme includes optimized color palettes:
- **Crypto**: Vibrant greens, reds, and blues
- **Light**: Professional blues and grays
- **Dark**: High-contrast colors for dark backgrounds
- **Minimal**: Monochromatic with accent colors
- **Professional**: Corporate color schemes

## Dependencies

### Required Plugins
- **Analytics Plugin**: Provides all data for chart generation
- **Core Services**: Runtime and service management

### Data Flow
1. User requests chart generation
2. Chart service calls analytics service
3. Analytics service fetches data from providers
4. Chart service processes data into chart format
5. Chart is generated and returned to user

## Usage Examples

### Price Analysis
```
"Generate a candlestick chart for SOL with RSI and MACD indicators"
"Show me a line chart for BONK token over the last week"
"Create a price chart for token 0x1234... with Bollinger Bands"
```

### Portfolio Analysis
```
"Show me my portfolio allocation as a pie chart"
"Generate a donut chart of my token holdings"
"Create a portfolio chart showing my asset distribution"
```

### Technical Analysis
```
"Display technical indicators for SOL token"
"Show me RSI and MACD for BONK with 4h timeframe"
"Generate a technical chart with all indicators"
```

### Market Analysis
```
"Show me the current market overview"
"Generate a chart of top gainers and losers"
"Display market sentiment for Solana ecosystem"
```

### Performance Tracking
```
"Show me my portfolio performance over the last month"
"Generate a PnL chart for my wallet"
"Create a performance chart with returns analysis"
```

## Architecture

The chart plugin follows a modular architecture:

1. **Interfaces**: Type definitions and data structures
2. **Services**: Business logic and chart generation
3. **Actions**: User-facing commands and interactions
4. **Utils**: Chart utilities and helper functions

## Error Handling

- Graceful degradation when analytics service is unavailable
- Comprehensive error messages for missing data
- Fallback chart generation with available data
- Validation of input parameters and data integrity

## Performance

- Efficient data processing from analytics plugin
- Optimized chart generation algorithms
- Caching of frequently requested charts
- Responsive chart rendering
