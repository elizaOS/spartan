# Meteora Liquidity Pool Plugin

A comprehensive ElizaOS plugin for interacting with Meteora DEX liquidity pools and concentrated liquidity positions on Solana.

## Overview

The Meteora Liquidity Pool Plugin provides ElizaOS agents with the ability to:
- View and manage Meteora liquidity pool positions
- Search and discover available pools
- Monitor pool performance and analytics
- Access concentrated liquidity features
- Track fees earned and impermanent loss

## Current Status

**🚧 Plugin Foundation Complete - Integration in Progress**

This plugin provides a complete foundation for Meteora integration with:
- ✅ Full plugin architecture and structure
- ✅ Service implementing ILpService interface
- ✅ Provider for agent context integration
- ✅ Actions for user interactions
- ✅ Comprehensive TypeScript interfaces
- ✅ Real API calls to Meteora endpoints
- ✅ Real-time data fetching from Meteora APIs
- 🔄 Full Meteora SDK integration (in progress)

## Features

### 🏊 **Pool Management**
- **Pool Discovery**: Search for pools by token pairs, pool type, and performance metrics
- **Pool Analytics**: View TVL, APY, fees, and other key metrics from real Meteora data
- **Pool Types**: Support for concentrated, stable, and weighted pools

### 📊 **Position Tracking**
- **User Positions**: View all Meteora positions across connected wallets
- **Position Details**: Detailed information including price ranges, liquidity, and fees earned
- **Performance Metrics**: Track impermanent loss and yield performance

### 🔍 **Advanced Search**
- **Token Pair Search**: Find pools by specific token combinations
- **Performance Filters**: Search by APY, TVL, and fee ranges
- **Pool Type Filters**: Filter by concentrated, stable, or weighted pools

### 💰 **Financial Analytics**
- **Fee Tracking**: Monitor fees earned from liquidity provision
- **Value Calculation**: Real-time position value in USD
- **Yield Analysis**: APR and APY calculations for pools

## Architecture

### Services
- **MeteoraService**: Core service implementing the ILpService interface
- **Pool Management**: Fetch, search, and analyze pools from Meteora APIs
- **Position Tracking**: User position management and analytics from blockchain data

### Providers
- **meteoraProvider**: Supplies pool and position information to agent context
- **Dynamic Data**: Real-time pool and position updates from Meteora
- **Context Integration**: Seamless integration with agent memory and state

### Actions
- **GET_METEORA_POSITIONS**: Retrieve user's Meteora positions from blockchain
- **SEARCH_METEORA_POOLS**: Search for pools with various criteria from Meteora APIs

## Configuration

### Environment Variables
```env
# Solana RPC endpoint
SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com

# Meteora API endpoint
METEORA_API_ENDPOINT=https://dlmm-api.meteora.ag

# Meteora program ID
METEORA_PROGRAM_ID=LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo
```

### Runtime Settings
The plugin automatically configures itself using runtime settings:
- `SOLANA_RPC_ENDPOINT`: Solana RPC endpoint for blockchain interactions
- `METEORA_API_ENDPOINT`: Meteora API endpoint for pool data
- `METEORA_PROGRAM_ID`: Meteora program ID on Solana

## Usage Examples

### View User Positions
```
User: "Show me my Meteora positions"
Agent: [Executes GET_METEORA_POSITIONS action, fetches real data from blockchain]
```

### Search for Pools
```
User: "Find high APY SOL/USDC pools on Meteora"
Agent: [Executes SEARCH_METEORA_POOLS action, fetches real data from Meteora APIs]
```

### Pool Discovery
```
User: "What stable pools are available on Meteora?"
Agent: [Executes SEARCH_METEORA_POOLS action with stable pool filter, fetches real data]
```

## Data Models

### MeteoraPool
```typescript
interface MeteoraPool {
  address: string;
  name: string;
  bin_step: number;
  base_fee_percentage: string;
  max_fee_percentage: string;
  protocol_fee_percentage: string;
  liquidity: string;
  fees_24h: number;
  trade_volume_24h: number;
  current_price: number;
  apr: number;
}
```

### MeteoraAddLiquidityParams
```typescript
interface MeteoraAddLiquidityParams {
  amount: string;
  amountB: string;
  poolAddress: string;
  rangeInterval?: number | null;
}
```

## Integration

### With Other Plugins
- **Multiwallet Plugin**: Access to user wallet addresses and accounts
- **Analytics Plugin**: Enhanced pool and position analytics
- **Core LP System**: Standardized liquidity pool interface

### With Meteora DEX
- **Concentrated Liquidity**: Full support for CLMM positions
- **Stable Pools**: Stable swap pool integration
- **Weighted Pools**: Traditional AMM pool support

## Development

### Current Implementation
The plugin currently provides:
- Complete plugin structure and architecture
- Real-time data fetching from Meteora APIs
- Real blockchain position data
- All necessary interfaces and types
- Service lifecycle management
- Provider and action implementations

### Next Steps for Full Integration
1. **Install Dependencies**: Add `@meteora-ag/dlmm` and `@coral-xyz/anchor`
2. **Enhance SDK Integration**: Complete integration with Meteora DLMM SDK
3. **Add Transaction Handling**: Implement real liquidity operations
4. **Add Error Handling**: Comprehensive error handling for production use
5. **Add Caching**: Implement data caching for better performance

### Adding New Features
1. **Extend Interfaces**: Add new fields to existing interfaces
2. **Enhance Service**: Implement new methods in MeteoraService
3. **Create Actions**: Add new actions for additional functionality
4. **Update Provider**: Enhance provider with new data sources

### Testing
```bash
# Run unit tests
bun test

# Run E2E tests
elizaos test --e2e
```

### Real Data Sources
The plugin now fetches real data from:
- **Meteora API**: Pool information, market data, and analytics
- **Solana Blockchain**: User positions and transaction data
- **Real-time Updates**: Live pool performance and metrics

## Roadmap

### Phase 1 (Current) ✅
- ✅ Basic plugin architecture and structure
- ✅ Service implementing ILpService interface
- ✅ Provider and actions with real data
- ✅ Comprehensive TypeScript interfaces
- ✅ Real API calls to Meteora endpoints
- ✅ Real-time data fetching
- ✅ Unit tests and documentation

### Phase 2 (Next)
- 🔄 Full Meteora SDK integration
- 🔄 Enhanced transaction handling
- 🔄 Advanced error handling and retry logic
- 🔄 Data caching and performance optimization

### Phase 3 (Future)
- 📋 Yield optimization recommendations
- 📋 Risk assessment tools
- 📋 Portfolio rebalancing strategies
- 📋 Advanced analytics and charts

## Contributing

1. **Fork the repository**
2. **Create a feature branch**
3. **Implement your changes**
4. **Add tests for new functionality**
5. **Submit a pull request**

## License

MIT License - see LICENSE file for details

## Support

For questions and support:
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Check the main ElizaOS documentation
- **Community**: Join the ElizaOS Discord community

## Changelog

### v1.0.0 (Current)
- Initial release with complete plugin foundation
- Real-time data fetching from Meteora APIs
- Real blockchain position data
- Comprehensive TypeScript interfaces
- Full test coverage
- Real API integration (no more mock data)

### v1.1.0 (Planned)
- Full Meteora SDK integration
- Enhanced transaction handling
- Advanced error handling and retry logic
- Data caching and performance optimization 