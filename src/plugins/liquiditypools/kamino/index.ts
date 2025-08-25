import type { Plugin } from '@elizaos/core';

// Providers
import { kaminoProvider } from './providers/kaminoProvider';
import { kaminoLiquidityProvider } from './providers/kaminoLiquidityProvider';

// Services
import { KaminoService } from './services/kaminoService';
import { KaminoLiquidityService } from './services/kaminoLiquidityService';



/**
 * Kamino Protocol Plugin
 * Provides comprehensive access to Kamino lending and liquidity protocols
 */
export const kaminoPlugin: Plugin = {
    name: 'kamino-protocol',
    description: 'Comprehensive Kamino protocol integration for viewing lending positions, liquidity pools, and market analytics. Supports position tracking and yield optimization.',
    evaluators: [],
    providers: [
        kaminoProvider,
        kaminoLiquidityProvider
    ],
    actions: [],
    services: [
        KaminoService,
        KaminoLiquidityService
    ],
};

export default kaminoPlugin;
