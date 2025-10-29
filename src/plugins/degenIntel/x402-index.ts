/**
 * x402scan Integration - Central Exports
 * 
 * Import everything you need for x402scan-compliant payment protection from here:
 * 
 * import { applyPaymentProtection, createX402Response, validateX402Response } from './x402-index';
 */

// Core types
export type {
    X402Response,
    Accepts,
    OutputSchema,
    FieldDef,
    ValidationResult
} from './x402-types';

// Validation and creation functions
export {
    validateX402Response,
    validateAccepts,
    createX402Response,
    createAccepts
} from './x402-types';

// Network configuration
export type {
    Network,
    X402Network,
    RoutePaymentConfig
} from './payment-config';

export {
    DEFAULT_NETWORK,
    PAYMENT_ADDRESSES,
    NETWORK_ASSETS,
    SOLANA_TOKENS,
    TOKEN_PRICES_USD,
    getPaymentAddress,
    getNetworkAddresses,
    parsePrice,
    getNetworkAsset,
    getNetworkAssets,
    getSolanaTokenAddress,
    toX402Network
} from './payment-config';

// Route protection
export {
    createPaymentAwareHandler,
    applyPaymentProtection
} from './payment-wrapper';

/**
 * Quick Start Example:
 * 
 * ```typescript
 * import type { Route } from '@elizaos/core';
 * import { applyPaymentProtection } from './x402-index';
 * 
 * const routes: Route[] = [
 *   {
 *     type: 'GET',
 *     path: '/api/endpoint',
 *     public: true,
 *     x402: true,
 *     price: '$0.10',
 *     supportedNetworks: ['BASE', 'SOLANA'],
 *     config: {
 *       description: 'My endpoint',
 *       queryParams: {
 *         'param': { type: 'string', required: true }
 *       }
 *     },
 *     handler: async (req, res) => res.json({ data: 'response' })
 *   }
 * ];
 * 
 * const protectedRoutes = applyPaymentProtection(routes);
 * ```
 * 
 * See x402-example.ts for more examples.
 * See X402_INTEGRATION.md for complete documentation.
 */

