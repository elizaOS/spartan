# Steer Finance Plugin

A comprehensive ElizaOS plugin for interacting with Steer Finance protocol, providing access to vaults, staking pools, and liquidity pool analytics across multiple EVM chains.

## Overview

The Steer Finance plugin enables agents to query and analyze liquidity pools, vaults, and staking pools on the Steer Finance protocol. It supports multiple chains including Ethereum Mainnet, Polygon, Arbitrum, and Optimism.

## Features

### 🏦 Vault Analytics
- Query vault information by token address
- View TVL, volume, APY, and strategy details
- Multi-chain vault discovery
- Position tracking and fee analysis
- Single-asset deposit functionality with automatic balancing
- Preview transactions before execution
- Slippage protection and error handling

### 🔒 Staking Pool Information
- Discover staking pools for specific tokens
- View APR, total staked amounts, and reward rates
- Track staking pool performance across chains

### 🌐 Multi-Chain Support
- Ethereum Mainnet (Chain ID: 1)
- Polygon (Chain ID: 137)
- Arbitrum One (Chain ID: 42161)
- Optimism (Chain ID: 10)

### 📊 Comprehensive Analytics
- Token-specific liquidity statistics
- Cross-chain aggregation of TVL and volume
- APY range calculations
- Real-time pool status monitoring

## Installation

The plugin requires the Steer Finance SDK and Viem for blockchain interactions:

```bash
npm install @steer-finance/sdk @steerprotocol/sdk viem
```

## Usage

### Provider Integration

The plugin provides a dynamic provider that automatically detects 0x token addresses in messages and returns comprehensive Steer Finance analytics:

```typescript
// The provider will automatically trigger when a 0x token address is mentioned
// Example: "Show me Steer Finance pools for 0xA0b86a33E6441b8c4C8C1C1B8c4C8C1C1B8c4C8C1"
```

### Service Access

Access the Steer Liquidity Service directly for programmatic queries:

```typescript
const steerService = runtime.getService('STEER_LIQUIDITY_SERVICE') as SteerLiquidityService;

// Get comprehensive stats for a token
const stats = await steerService.getTokenLiquidityStats('0xA0b86a33E6441b8c4C8C1C1B8c4C8C1C1B8c4C8C1');

// Test connection to all supported chains
const connectionTest = await steerService.testConnection();
```

## API Reference

### SteerLiquidityService

#### Methods

##### `getTokenLiquidityStats(tokenIdentifier: string): Promise<TokenLiquidityStats>`
Retrieves comprehensive liquidity statistics for a given token across all supported chains.

**Parameters:**
- `tokenIdentifier`: 0x token address or token symbol

**Returns:**
```typescript
interface TokenLiquidityStats {
    tokenIdentifier: string;
    normalizedToken: string;
    tokenName: string;
    timestamp: string;
    vaults: SteerVault[];
    stakingPools: SteerStakingPool[];
    totalTvl: number;
    totalVolume: number;
    apyRange: { min: number; max: number };
    vaultCount: number;
    stakingPoolCount: number;
}
```

##### `previewSingleAssetDeposit(vaultAddress: string, chainId: number, assets: bigint, isToken0: boolean, depositSlippagePercent?: bigint, swapSlippageBP?: number): Promise<any>`
Previews a single-asset deposit transaction without executing it.

**Parameters:**
- `vaultAddress`: The vault contract address
- `chainId`: The blockchain chain ID
- `assets`: Amount of tokens to deposit (in wei)
- `isToken0`: Whether depositing token0 (true) or token1 (false)
- `depositSlippagePercent`: Maximum slippage for deposit (default: 5%)
- `swapSlippageBP`: Slippage for internal swap in basis points (default: 500)

##### `executeSingleAssetDeposit(vaultAddress: string, chainId: number, assets: bigint, receiver: string, isToken0: boolean, depositSlippagePercent?: bigint, swapSlippageBP?: number): Promise<any>`
Executes a single-asset deposit transaction.

**Parameters:**
- `vaultAddress`: The vault contract address
- `chainId`: The blockchain chain ID
- `assets`: Amount of tokens to deposit (in wei)
- `receiver`: Address to receive LP tokens
- `isToken0`: Whether depositing token0 (true) or token1 (false)
- `depositSlippagePercent`: Maximum slippage for deposit (default: 5%)
- `swapSlippageBP`: Slippage for internal swap in basis points (default: 500)

##### `getEarnedRewards(poolAddress: string, accountAddress: string, chainId: number): Promise<any>`
Gets earned rewards for a specific account in a staking pool.

##### `getStakingPoolTotalSupply(poolAddress: string, chainId: number): Promise<any>`
Gets the total supply of a staking pool.

##### `getStakingPoolBalance(poolAddress: string, accountAddress: string, chainId: number): Promise<any>`
Gets the balance of a specific account in a staking pool.

##### `testConnection(): Promise<ConnectionTestResult>`
Tests connectivity to Steer Finance services across all supported chains.

**Returns:**
```typescript
interface ConnectionTestResult {
    connectionTest: boolean;
    supportedChains: number[];
    vaultCount: number;
    stakingPoolCount: number;
    error?: string;
}
```

### Data Structures

#### SteerVault
```typescript
interface SteerVault {
    address: string;
    name: string;
    chainId: number;
    token0: string;
    token1: string;
    fee: number;
    tvl: number;
    volume24h: number;
    apy: number;
    isActive: boolean;
    createdAt: string;
    strategyType: string;
    positions?: SteerPosition[];
}
```

#### SteerStakingPool
```typescript
interface SteerStakingPool {
    address: string;
    name: string;
    chainId: number;
    stakingToken: string;
    rewardToken: string;
    totalStaked: number;
    totalStakedUSD: number;
    apr: number;
    isActive: boolean;
    rewardRate: number;
    periodFinish: string;
}
```

## Configuration

### Environment Variables

The plugin uses the following environment variables for configuration:

- `STEER_RPC_URL_MAINNET`: Custom RPC URL for Ethereum Mainnet (optional)
- `STEER_RPC_URL_POLYGON`: Custom RPC URL for Polygon (optional)
- `STEER_RPC_URL_ARBITRUM`: Custom RPC URL for Arbitrum (optional)
- `STEER_RPC_URL_OPTIMISM`: Custom RPC URL for Optimism (optional)

If not provided, the plugin will use default public RPC endpoints.

## Error Handling

The plugin implements comprehensive error handling:

- **Connection Failures**: Graceful degradation when RPC endpoints are unavailable
- **Invalid Token Addresses**: Proper validation and normalization of token identifiers
- **SDK Errors**: Detailed error logging and fallback mechanisms
- **Rate Limiting**: Built-in retry logic for API rate limits

## Examples

### Basic Token Query
```typescript
// Query Steer Finance pools for USDC
const usdcStats = await steerService.getTokenLiquidityStats('0xA0b86a33E6441b8c4C8C1C1B8c4C8C1C1B8c4C8C1');
console.log(`Found ${usdcStats.vaultCount} vaults and ${usdcStats.stakingPoolCount} staking pools`);
```

### Cross-Chain Analysis
```typescript
// Get comprehensive multi-chain statistics
const stats = await steerService.getTokenLiquidityStats('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');
console.log(`Total TVL across all chains: $${stats.totalTvl.toLocaleString()}`);
console.log(`APY range: ${stats.apyRange.min.toFixed(2)}% - ${stats.apyRange.max.toFixed(2)}%`);
```

### Connection Testing
```typescript
// Test connectivity to all supported chains
const test = await steerService.testConnection();
if (test.connectionTest) {
    console.log(`Connected to ${test.supportedChains.length} chains`);
    console.log(`Total vaults: ${test.vaultCount}, Total staking pools: ${test.stakingPoolCount}`);
} else {
    console.error(`Connection failed: ${test.error}`);
}
```

## Integration with ElizaOS

### Plugin Registration
The plugin is automatically registered when imported into an ElizaOS project:

```typescript
import { steerPlugin } from './plugins/liquiditypools/steer';

// The plugin will be available to the agent runtime
```

### Provider Usage
The provider automatically triggers when 0x token addresses are detected in messages:

```
User: "Show me Steer Finance pools for 0xA0b86a33E6441b8c4C8C1C1B8c4C8C1C1B8c4C8C1"
Agent: [Automatically provides comprehensive Steer Finance analytics]
```

## Development

### Adding New Chains
To add support for additional chains:

1. Update the `SUPPORTED_CHAINS` constant in `steerLiquidityService.ts`
2. Add the chain configuration to the `initializeClients()` method
3. Update the `getChainName()` function in the provider

### Extending Functionality
The plugin is designed to be easily extensible:

- Add new service methods for specific use cases
- Extend the provider with additional data sources
- Implement caching for improved performance
- Add more detailed analytics and metrics

## Troubleshooting

### Common Issues

1. **SDK Import Errors**: Ensure `@steer-finance/sdk` and `viem` are properly installed
2. **RPC Connection Failures**: Check network connectivity and RPC endpoint availability
3. **Token Address Validation**: Verify that provided addresses are valid 0x format
4. **Rate Limiting**: Implement appropriate delays between requests for high-frequency usage

### Debug Mode
Enable detailed logging by setting the log level in your ElizaOS configuration:

```typescript
// The service includes comprehensive logging for debugging
logger.log('SteerLiquidityService initialized with multi-chain support');
```

## Contributing

When contributing to the Steer Finance plugin:

1. Follow the existing code patterns and architecture
2. Add comprehensive error handling for new features
3. Include unit tests for new functionality
4. Update documentation for any API changes
5. Test across multiple chains to ensure compatibility

## License

This plugin is part of the ElizaOS ecosystem and follows the same licensing terms as the main project.
