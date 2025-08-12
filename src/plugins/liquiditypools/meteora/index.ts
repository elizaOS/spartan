import type { Plugin } from '@elizaos/core';

// Actions
import getMeteoraPositions from './actions/getMeteoraPositions';
import searchMeteoraPools from './actions/searchMeteoraPools';
import addMeteoraLiquidityAction from './actions/addMeteoraLiquidity';
import removeMeteoraLiquidityAction from './actions/removeMeteoraLiquidity';

// Providers
import { meteoraProvider } from './providers/meteoraProvider';

// Services
import { MeteoraService } from './services/meteoraService';

/**
 * Meteora Liquidity Pool Plugin
 * Provides comprehensive access to Meteora DEX liquidity pools and concentrated liquidity positions
 */
export const meteoraPlugin: Plugin = {
    name: 'meteora-liquidity-pools',
    description: 'Comprehensive Meteora DEX integration for liquidity pools, concentrated liquidity positions, and pool analytics. Supports pool discovery, position management, and yield optimization.',
    evaluators: [],
    providers: [
        meteoraProvider
    ],
    actions: [
        getMeteoraPositions,
        searchMeteoraPools,
        addMeteoraLiquidityAction,
        removeMeteoraLiquidityAction
    ],
    services: [
        MeteoraService
    ],
};

export default meteoraPlugin;