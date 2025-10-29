# DegenIntel Plugin

A comprehensive cryptocurrency intelligence and payment gateway plugin for ElizaOS.

## Overview

DegenIntel provides:
- **Token Intelligence**: Real-time token data, trending analysis, and market sentiment
- **X402 Payment Gateway**: Monetize API endpoints with multiple payment options
- **Wallet Management**: Track and analyze cryptocurrency wallets
- **Trading Signals**: Automated buy/sell signals based on market conditions

## Quick Start

### Installation

```bash
bun install
```

### Environment Setup

```env
# Birdeye API
BIRDEYE_API_KEY=your_birdeye_key

# CoinMarketCap
CMC_API_KEY=your_cmc_key

# X402 Payment Configuration
SOLANA_PUBLIC_KEY=YourSolanaWalletAddress
BASE_PUBLIC_KEY=0xYourBaseWalletAddress
ETHEREUM_PUBLIC_KEY=0xYourEthereumWalletAddress

# Optional: Payment Facilitator
X402_FACILITATOR_URL=https://facilitator.x402.ai
```

## Features

### 1. Token Intelligence APIs

**Trending Tokens** (`/api/trending`)
- Get top trending tokens across networks
- Customizable time ranges and limits
- Includes price, volume, and social metrics

**Token Information** (`/api/token-info`)
- Detailed token metadata
- Price history and charts
- Liquidity pool information

**Wallet Analysis** (`/api/wallet-balance`)
- Multi-chain wallet tracking
- Token balance aggregation
- Portfolio analytics

### 2. X402 Payment Gateway

Monetize your API endpoints with automatic payment protection supporting:
- Ethereum/Base EIP-712 signatures
- Solana payments
- Facilitator payment IDs

#### Enabling X402 on a Route

```typescript
import type { Route } from '@elizaos/core';

const myRoute: Route = {
    type: 'GET',
    path: '/api/my-endpoint',
    public: true,
    x402: true,                              // Enable payment
    price: '$0.10',                          // Set price in USD
    supportedNetworks: ['BASE', 'SOLANA'],   // Supported networks
    config: {
        description: 'My API endpoint',
        queryParams: {
            'param1': {
                type: 'string',
                required: true,
                description: 'Parameter description'
            }
        }
    },
    handler: async (req, res, runtime) => {
        res.json({ data: 'your response' });
    }
};
```

#### Payment Methods

**1. EIP-712 Signatures (Ethereum/Base)**

```javascript
const domain = {
  name: 'USD Coin',
  version: '2',
  chainId: 8453,  // Base mainnet
  verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
};

const types = {
  ReceiveWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' }
  ]
};

const authorization = {
  from: userAddress,
  to: paymentRecipient,
  value: '100000',  // 0.10 USDC
  validAfter: Math.floor(Date.now() / 1000),
  validBefore: Math.floor(Date.now() / 1000) + 900,
  nonce: ethers.utils.hexlify(ethers.utils.randomBytes(32))
};

const signature = await signer._signTypedData(domain, types, authorization);

// Send with X-Payment-Proof header
const paymentProof = {
  domain,
  message: authorization,
  primaryType: 'ReceiveWithAuthorization',
  types,
  signature
};

fetch(url, {
  headers: {
    'X-Payment-Proof': Buffer.from(JSON.stringify(paymentProof)).toString('base64')
  }
});
```

**2. Payment Facilitator**

```javascript
// Get payment ID from facilitator, then:
fetch(url, {
  headers: {
    'X-Payment-Id': 'pay_1234567890abcdef'
  }
});
```

### 3. Market Intelligence Providers

- **birdeyeTrending**: Real-time trending tokens
- **birdeyeWallet**: Wallet balance tracking
- **cmcMarket**: CoinMarketCap market data
- **sentiment**: Social sentiment analysis

### 4. Trading Signals

Automated tasks monitor market conditions and generate trading signals:
- Price delta signals
- Sentiment-based signals
- Trending token alerts

## Architecture

```
degenIntel/
├── apis.ts              # Core API implementations
├── routes/              # HTTP route handlers
├── providers/           # Data providers for agent context
├── services/            # Blockchain and data services
├── tasks/               # Background tasks and signals
├── actions/             # Agent actions
├── interfaces/          # Database interfaces
└── frontend/            # Web UI components
```

## Network Configuration

| Network | Chain ID | USDC Address |
|---------|----------|--------------|
| Base | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Ethereum | 1 | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Polygon | 137 | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` |

## Testing

```bash
# Run all tests
elizaos test

# Run specific test suite
elizaos test --name "facilitator"
```

## Troubleshooting

### Payment Verification Issues

**EIP-712 Signature Errors**
- Ensure you're using `ReceiveWithAuthorization` (not `TransferWithAuthorization`)
- Verify domain fields match the network (name: 'USD Coin', version: '2')
- Check that `from` address matches the signing wallet

**Facilitator Verification**
- Ensure `X402_FACILITATOR_URL` is set in environment
- Verify payment ID is valid and not expired
- Check facilitator service is reachable

### Debug Logging

The plugin provides detailed debug output for payment verification. Look for:
- Strategy selection logs
- Signature verification details
- Facilitator API responses
- Contract interaction logs

## Contributing

When adding new features:
1. Add tests in `__tests__/`
2. Update route configurations
3. Document environment variables
4. Test payment protection if applicable

## License

See root LICENSE file.

