# Route Organization Pattern

Following the ElizaOS server package pattern, routes are organized into logical groups.

## Structure

```
routes/
├── shared/                          # Shared utilities (like server/src/api/shared/)
│   ├── index.ts                    # Re-exports all shared utilities
│   └── template-utils.ts           # HTML/template utilities + paths
│
├── frontend.routes.ts              # Frontend/UI routes (18 routes) - includes inlined getAccountType()
├── legacy-data.routes.ts           # Legacy data routes (6 routes)
├── spartan-defi.routes.ts          # Spartan DeFi API routes (14 routes - uses rt_* handlers)
├── analytics.routes.ts             # Analytics API routes (7 routes)
├── charting.routes.ts              # Charting API routes (5 routes)
├── birdeye.routes.ts               # Birdeye API routes (5 routes)
├── coingecko.routes.ts             # CoinGecko API routes (6 routes)
└── facilitator.routes.ts           # x402 payment facilitator routes (6 routes)

Total: 67 routes across 8 groups
```

## Pattern

Each route file:
1. Imports what it needs from `./shared`
2. Defines route handlers inline (unless already modularized like spartan-defi)
3. Exports a routes array
4. Co-locates route definition with handler logic for easy maintenance

**Note**: Specific utilities are inlined where used. For example, `getAccountType()` is inlined in `frontend.routes.ts` since it's only needed there. This keeps the codebase clean and avoids over-abstraction.

## Benefits

- **Single source of truth**: Route definition + handler in one place
- **Easy to modify**: Change functionality without hunting through multiple files
- **Clear organization**: Routes grouped by purpose/domain
- **Follows ElizaOS patterns**: Matches server package structure
- **Minimal abstractions**: Shared code only when truly shared across multiple files
