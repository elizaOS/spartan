/**
 * Spartan Intelligence API Routes
 * 
 * This file assembles all route groups into a single routes array.
 * Route definitions and handlers are co-located in routes/ directory.
 * 
 * Pattern follows packages/server/src/api/ structure:
 * - routes/shared/ - Shared utilities (like server/src/api/shared/)
 * - routes/*.routes.ts - Route groups with definitions and handlers together
 */

import type { Route } from '@elizaos/core';
import { applyPaymentProtection, type PaymentEnabledRoute } from './payment-wrapper';

// Import route groups
import { frontendRoutes } from './routes/frontend.routes';
import { spartanOsRoutes } from './routes/spartan-os.routes';
import { legacyDataRoutes } from './routes/legacy-data.routes';
import { walletRoutes } from './routes/wallet.routes';
import { analyticsRoutes } from './routes/analytics.routes';
import { chartingRoutes } from './routes/charting.routes';
import { birdeyeRoutes } from './routes/birdeye.routes';
import { coingeckoRoutes } from './routes/coingecko.routes';
import { facilitatorRoutes } from './routes/facilitator.routes';

/**
 * Combine all route groups
 * 
 * Route Organization:
 * 1. Frontend Routes (4) - Main UI pages (/degen-intel, /spartan, etc.)
 * 2. Spartan OS Routes (11) - New interface (/new/*)
 * 3. Legacy Data Routes (6) - Original data endpoints (/trending, /tweets, etc.)
 * 4. Wallet Routes (11) - Token management, swaps, AI chat, verification
 * 5. Analytics Routes (7) - Market analytics and sentiment
 * 6. Charting Routes (5) - Technical analysis and charts
 * 7. Birdeye Routes (5) - Solana token data
 * 8. CoinGecko Routes (6) - Crypto market data
 * 9. Facilitator Routes (6) - x402 payment processing
 */
export const routes: (Route | PaymentEnabledRoute)[] = [
  ...frontendRoutes,
  ...spartanOsRoutes,
  ...legacyDataRoutes,
  ...walletRoutes,
  ...analyticsRoutes,
  ...chartingRoutes,
  ...birdeyeRoutes,
  ...coingeckoRoutes,
  ...facilitatorRoutes,
];

// Apply x402 payment protection to routes
const protectedRoutes = applyPaymentProtection(routes);

console.log('protectedRoutes', protectedRoutes.length, 'total routes');

export default protectedRoutes;
