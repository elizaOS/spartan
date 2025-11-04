# Spartan Documentation

Welcome to the comprehensive Spartan documentation! This directory contains detailed guides for understanding, deploying, and extending Spartan.

## 📚 Documentation Index

### Getting Started

- **[Quick Start Guide](./QUICKSTART.md)** - Get Spartan running in 10 minutes
- **[Main README](../README.md)** - Project overview and features

### Core Documentation

- **[Plugin Documentation](./PLUGINS.md)** - Complete reference for all 10+ plugins
  - Account Registration
  - Analytics with 14+ technical indicators
  - Multi-tenant Wallet Management
  - Trading Strategies
  - Market Intelligence
  - Community Investment
  - And more...

- **[Architecture Guide](./ARCHITECTURE.md)** - System design and data flow
  - Plugin architecture
  - Service layer
  - Database design
  - Frontend architecture
  - Security architecture

- **[API Reference](./API.md)** - Complete HTTP API documentation
  - Analytics API
  - Charting API
  - Wallet API
  - Trading API
  - Community API
  - Error handling
  - Rate limiting

- **[Deployment Guide](./DEPLOYMENT.md)** - Production deployment instructions
  - Development setup
  - Traditional server deployment
  - Docker deployment
  - Cloud platforms (AWS, GCP, Digital Ocean)
  - Database setup
  - Monitoring & logging
  - Backup & recovery

### Additional Resources

- **[Chrome Extension README](../chrome-extension/README.md)** - Browser extension guide
- **[MCP Integration Guide](../spartan-mcp/INTEGRATION.md)** - AI agents and MCP protocol
- **[Chrome Extension Troubleshooting](../chrome-extension/TROUBLESHOOTING.md)** - Extension issues

## 🎯 Quick Navigation

### I want to...

**...understand what Spartan can do**
→ Start with the [Main README](../README.md#core-features)

**...get Spartan running quickly**
→ Follow the [Quick Start Guide](./QUICKSTART.md)

**...learn about specific plugins**
→ Check the [Plugin Documentation](./PLUGINS.md)

**...integrate Spartan into my app**
→ Read the [API Reference](./API.md)

**...deploy to production**
→ Follow the [Deployment Guide](./DEPLOYMENT.md)

**...understand the architecture**
→ Read the [Architecture Guide](./ARCHITECTURE.md)

**...build a custom plugin**
→ See [Plugin Documentation](./PLUGINS.md#plugin-integration) and [Architecture](./ARCHITECTURE.md#plugin-architecture)

**...use the Chrome extension**
→ Check [Chrome Extension README](../chrome-extension/README.md)

**...integrate MCP agents**
→ Read [MCP Integration Guide](../spartan-mcp/INTEGRATION.md)

## 🔧 Plugin Overview

Spartan includes 10+ specialized plugins:

| Plugin | Purpose | Key Features |
|--------|---------|--------------|
| **Account** | User management | Registration, verification, notifications |
| **Analytics** | Market analysis | 14+ technical indicators, risk assessment |
| **Autonomous Trader** | Core utilities | Holder verification, common utilities |
| **Trading** | Position management | LLM/copy/manual strategies |
| **Multiwallet** | Wallet operations | Create, import, swap, transfer |
| **DegenIntel** | Market intelligence | Sentiment analysis, trending tokens |
| **Community Investor** | Trust scoring | Leaderboards, recommendations |
| **Autofun Trader** | Auto.fun trading | Automated buy/sell signals |
| **KOL** | Influencer features | Ready for extension |
| **Coin Marketing** | Marketing tools | Campaign support |

[View detailed plugin documentation →](./PLUGINS.md)

## 🏗️ Architecture Highlights

### System Layers

```
User Interfaces (Discord, Telegram, Web, Extension)
            ↓
    ElizaOS Runtime Engine
            ↓
      Plugin Ecosystem
            ↓
       Service Layer
            ↓
  External Integrations
            ↓
    Data Persistence
```

### Key Technologies

- **Framework**: ElizaOS
- **Language**: TypeScript
- **Database**: MySQL / PostgreSQL
- **Cache**: Redis (optional)
- **AI**: Anthropic Claude, OpenAI GPT
- **Blockchain**: Solana, EVM chains
- **APIs**: Birdeye, CoinMarketCap, Jupiter

[View detailed architecture →](./ARCHITECTURE.md)

## 🚀 Deployment Options

### Development
```bash
npm run dev
```

### Docker
```bash
docker-compose up -d
```

### Cloud Platforms
- AWS (EC2, ECS, RDS)
- Google Cloud (Cloud Run, Cloud SQL)
- Digital Ocean (App Platform, Droplets)

[View deployment guide →](./DEPLOYMENT.md)

## 📡 API Endpoints

### Analytics
- `GET /api/analytics/market-overview` - Market overview
- `GET /api/analytics/trending` - Trending tokens
- `POST /api/analytics/analyze-token` - Token analysis

### Wallet
- `POST /api/wallet/create` - Create wallet
- `POST /api/wallet/swap` - Execute swap
- `GET /api/wallet/list` - List wallets

### Trading
- `POST /api/trading/position/open` - Open position
- `GET /api/trading/positions` - List positions
- `POST /api/trading/strategy/set` - Set strategy

[View full API reference →](./API.md)

## 🔒 Security Best Practices

- ✅ Use environment variables for secrets
- ✅ Enable SSL/TLS in production
- ✅ Implement rate limiting
- ✅ Encrypt sensitive data at rest
- ✅ Use secure RPC endpoints
- ✅ Regular security updates
- ✅ Monitor for suspicious activity

[View security architecture →](./ARCHITECTURE.md#security-architecture)

## 📊 Monitoring

### Key Metrics to Track

- Request latency (p50, p95, p99)
- Error rates
- Active users
- Transaction success rate
- API usage per user
- Cache hit rates
- Database query performance

[View monitoring guide →](./DEPLOYMENT.md#monitoring--logging)

## 🤝 Contributing

Contributions are welcome! Please:

1. Read the [Architecture Guide](./ARCHITECTURE.md) to understand the system
2. Check [Plugin Documentation](./PLUGINS.md) for plugin structure
3. Follow TypeScript and ElizaOS conventions
4. Write tests for new features
5. Update documentation

## 📝 Documentation Maintenance

### For Contributors

When adding new features:
1. Update relevant plugin README
2. Add API endpoints to API.md
3. Update architecture diagrams if needed
4. Include usage examples
5. Update this index

### Documentation Structure

```
docs/
├── README.md           # This file (index)
├── QUICKSTART.md       # 10-minute quick start
├── PLUGINS.md          # Complete plugin reference
├── ARCHITECTURE.md     # System architecture
├── API.md              # API reference
└── DEPLOYMENT.md       # Deployment guide
```

## 🆘 Getting Help

- **Documentation**: You're reading it!
- **GitHub Issues**: Report bugs or request features
- **Discord**: Join the ElizaOS community
- **Twitter**: Follow @SpartanVersus

## 📜 License

MIT License - see [LICENSE](../LICENSE) file for details

---

## Quick Links

- [ElizaOS Framework](https://github.com/elizaos/eliza)
- [Spartan Token ($degenai)](https://solscan.io/token/Gu3LDkn7Vx3bmCzLafYNKcDxv2mH7YN44NJZFXnypump)
- [Eliza Labs Token ($ai16z)](https://solscan.io/token/HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC)

---

**Built with ❤️ using ElizaOS. No BS, just results. Deploy, trade, win. ⚔️**

