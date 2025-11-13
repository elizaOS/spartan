# Route Organization - Complete Structure

## Overview
Routes refactored from a single 2,444-line apis.ts into organized, maintainable route groups following the ElizaOS server package pattern (`packages/server/src/api/`).

## Directory Structure

```
routes/
├── shared/                          # Shared utilities (follows server/src/api/shared/)
│   ├── index.ts                    # Exports all shared utilities
│   ├── template-utils.ts           # HTML/template utilities + path resolution
│   └── solana-utils.ts             # Service-based blockchain utilities
│
├── *.routes.ts                      # Route group files (definition + handler together)
│   ├── frontend.routes.ts          # 18 routes - UI pages and static assets
│   ├── legacy-data.routes.ts       #  6 routes - Original data endpoints
│   ├── spartan-defi.routes.ts      # 14 routes - Token management and AI chat
│   ├── analytics.routes.ts         #  7 routes - Market analytics
│   ├── charting.routes.ts          #  5 routes - Technical analysis
│   ├── birdeye.routes.ts           #  5 routes - Birdeye Solana data
│   ├── coingecko.routes.ts         #  6 routes - CoinGecko market data
│   └── facilitator.routes.ts       #  6 routes - x402 payment processing
│
├── rt_*.ts                          # Legacy handler files (still used by spartan-defi)
│   ├── rt_chatWithSpartanAI.ts
│   ├── rt_getSwapQuoteFromServices.ts
│   ├── rt_getTokenBalanceFromServices.ts
│   ├── rt_getTokenInfo.ts
│   ├── rt_getWalletBalancesFromServices.ts
│   ├── rt_requestEmailVerification.ts
│   ├── rt_validateAuthToken.ts
│   └── rt_verifyEmailToken.ts
│
├── index.ts                         # Route index (can be used for re-exports)
└── README.md                        # This file

Total: 67 routes across 8 groups
```

## Usage Pattern

### In Route Files
```typescript
// Each route file has everything it needs
import type { Route, IAgentRuntime } from '@elizaos/core';
import { getIndexTemplate, injectBase, frontendDist } from './shared';

export const myRoutes: Route[] = [
  {
    type: 'GET',
    path: '/my-route',
    public: true,
    name: 'My Route',
    handler: async (req, res, runtime) => {
      // Handler logic here - inline with route definition
      // Easy to understand and modify
    }
  },
];
```

### In apis.ts
```typescript
// apis.ts just assembles all route groups
import { frontendRoutes } from './routes/frontend.routes';
import { analyticsRoutes } from './routes/analytics.routes';
// ... etc

export const routes = [
  ...frontendRoutes,
  ...analyticsRoutes,
  // ... etc
];

export default applyPaymentProtection(routes);
```

## Benefits

### 1. Single Source of Truth
- Route definition and handler in the same file
- No hunting through multiple files to understand a route
- Easy to modify behavior

### 2. Logical Organization
- Routes grouped by domain/purpose
- Clear separation of concerns
- Easy to find what you need

### 3. Follows ElizaOS Patterns
- Matches `packages/server/src/api/` structure
- Uses `shared/` directory for utilities
- Consistent with project conventions

### 4. Service-Based Architecture
- `solana-utils.ts` uses `chain_solana` service, not direct blockchain calls
- Proper abstraction layer
- Easier to test and mock

### 5. Maintainability
- Small, focused files (171-498 lines)
- Clear purpose per file
- Easy code review
- Simple to add new routes to a group

## Route Group Details

### Frontend Routes (18 routes, 498 lines)
UI pages, static assets, and templates
- `/degen-intel`, `/spartan`, `/new/*`, `/assets/*`, etc.
- **Handler Style**: Inline
- **Dependencies**: template-utils, solana-utils

### Legacy Data Routes (6 routes, 224 lines)
Original data endpoints from early codebase
- `/trending`, `/wallet`, `/tweets`, `/sentiment`, `/signal`, `/statistics`
- **Handler Style**: Inline
- **Dependencies**: None (just uses runtime cache and memories)

### Spartan DeFi Routes (14 routes, 171 lines)
Token management, swaps, AI chat, verification
- `/spartan-defi/*`
- **Handler Style**: Modular (uses rt_*.ts handlers)
- **Dependencies**: rt_* handler files

### Analytics Routes (7 routes, 391 lines)
Market analytics, sentiment, trending, whale activity
- `/api/analytics/*`
- **Handler Style**: Inline
- **Dependencies**: ANALYTICS_SERVICE
- **Payment**: Some routes have x402 payment

### Charting Routes (5 routes, 257 lines)
OHLCV data, technical indicators, patterns
- `/api/charting/*`
- **Handler Style**: Inline
- **Dependencies**: BirdeyeProvider, ANALYTICS_SERVICE

### Birdeye Routes (5 routes, 220 lines)
Solana token data via Birdeye
- `/api/birdeye/*`
- **Handler Style**: Inline
- **Dependencies**: Runtime cache
- **Payment**: Trending route has x402 payment

### CoinGecko Routes (6 routes, 270 lines)
Cryptocurrency market data
- `/api/coingecko/*`
- **Handler Style**: Inline
- **Dependencies**: Runtime cache
- **Payment**: Trending and global routes have x402 payment

### Facilitator Routes (6 routes, 369 lines)
x402 payment protocol implementation
- `/api/facilitator/*`
- **Handler Style**: Inline
- **Dependencies**: payment-config.ts

## Modification Guide

### Adding a New Route to Existing Group

1. Open the appropriate route group file
2. Add route object to the array
3. Write handler inline

```typescript
// Example: Add new analytics route
export const analyticsRoutes: PaymentEnabledRoute[] = [
  // ... existing routes ...
  
  // New route
  {
    type: 'GET',
    path: '/api/analytics/my-new-endpoint',
    public: true,
    name: 'My New Analytics Endpoint',
    handler: async (req, res, runtime) => {
      // Implementation here
      res.json({ success: true, data: {} });
    }
  },
];
```

### Creating a New Route Group

1. Create `routes/my-group.routes.ts`
2. Define routes with handlers
3. Export as `myGroupRoutes` array
4. Import in `apis.ts` and add to routes array

```typescript
// routes/my-group.routes.ts
export const myGroupRoutes: Route[] = [
  { type: 'GET', path: '/api/mygroup/endpoint', handler: async ... },
];

// apis.ts
import { myGroupRoutes } from './routes/my-group.routes';
export const routes = [
  ...frontendRoutes,
  ...myGroupRoutes,  // Add here
  ...analyticsRoutes,
];
```

### Modifying Existing Route

1. Find the route group file (e.g., `analytics.routes.ts`)
2. Locate the route by path
3. Modify handler inline
4. Done! No need to find separate handler file

## Testing

Each route group can be tested independently:

```typescript
import { analyticsRoutes } from './routes/analytics.routes';

describe('Analytics Routes', () => {
  test('trending endpoint', async () => {
    const route = analyticsRoutes.find(r => r.path === '/api/analytics/trending');
    // Test route...
  });
});
```

## Migration Notes

### What Changed
- ✅ apis.ts: 2,444 lines → 54 lines
- ✅ Route definitions co-located with handlers
- ✅ Follows ElizaOS server package pattern
- ✅ Service-based blockchain interactions

### What Stayed the Same
- ✅ All 67 routes preserved
- ✅ rt_* handler files still used by spartan-defi routes
- ✅ Payment protection still applied
- ✅ Route behavior unchanged

### Backups
- `apis.ts.backup` - Original 2,444-line version
- `utils.ts.backup` - Original utils before merge

---

**Pattern**: Following `packages/server/src/api/` structure

**Status**: ✅ Complete - All 67 routes refactored and building successfully

**Maintainability**: Significantly improved - route logic co-located in logical groups
