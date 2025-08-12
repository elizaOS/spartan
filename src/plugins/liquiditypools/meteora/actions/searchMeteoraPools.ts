import {
    type Action,
    type ActionExample,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    logger,
} from '@elizaos/core';
import { MeteoraService } from '../services/meteoraService';

/**
 * Search Meteora liquidity pools action
 */
export const searchMeteoraPoolsAction: Action = {
    name: 'SEARCH_METEORA_POOLS',
    description: 'Search for Meteora liquidity pools with various filters and criteria',
    similes: [
        'search meteora pools',
        'find meteora pools',
        'meteora pool search',
        'meteora pool discovery',
        'meteora pool explorer',
        'meteora pool finder',
        'meteora pool list',
        'meteora pool browse',
        'meteora pool research',
        'meteora pool analysis'
    ],
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Find high APY Meteora pools',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll search for high APY Meteora liquidity pools",
                    actions: ['SEARCH_METEORA_POOLS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Show me SOL/USDC pools on Meteora',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll search for SOL/USDC pools on Meteora",
                    actions: ['SEARCH_METEORA_POOLS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Find stable pools with low fees on Meteora',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: "I'll search for stable pools with low fees on Meteora",
                    actions: ['SEARCH_METEORA_POOLS'],
                },
            },
        ],
    ] as ActionExample[][],
    validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        try {
            // Check if Meteora service is available
            const meteoraService = runtime.getService('METEORA_SERVICE') as unknown as MeteoraService;
            if (!meteoraService) {
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error validating SEARCH_METEORA_POOLS:', error);
            return false;
        }
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: Memory[] = []
    ): Promise<void> => {
        try {
            logger.log('SEARCH_METEORA_POOLS handler starting...');

            const meteoraService = runtime.getService('METEORA_SERVICE') as unknown as MeteoraService;
            if (!meteoraService) {
                callback?.({ text: 'Meteora service not available. Please try again later.' });
                return;
            }

            // Parse search criteria from message
            const searchCriteria = parseSearchCriteria(message.content.text || '');

            // Get pools based on search criteria
            let pools: any[] = [];

            if (searchCriteria.tokenPair) {
                // Search for specific token pair
                const [tokenA, tokenB] = searchCriteria.tokenPair.split('/');
                pools = await meteoraService.getPoolsFromAPI({ asset: tokenA, assetB: tokenB });
            } else {
                // Get all pools
                pools = await meteoraService.getPools();
            }

            if (pools.length === 0) {
                callback?.({
                    text: 'No Meteora pools found matching your criteria. Try adjusting your search parameters.',
                });
                return;
            }

            // Apply additional filters
            pools = applyFilters(pools, searchCriteria);

            // Format response
            const responseText = formatPoolsResponse(pools, searchCriteria);

            callback?.({
                text: responseText,
                actions: ['SEARCH_METEORA_POOLS'],
            });

        } catch (error) {
            console.error('Error in SEARCH_METEORA_POOLS handler:', error);
            callback?.({
                text: 'An error occurred while searching Meteora pools. Please try again later.',
            });
        }
    },
} as Action;

/**
 * Parse search criteria from message text
 */
function parseSearchCriteria(messageText: string): any {
    const criteria: any = {};
    const text = messageText.toLowerCase();

    // Parse token symbols/addresses
    const tokenPatterns = [
        { pattern: /sol\s*\/\s*usdc/i, tokenA: 'SOL', tokenB: 'USDC' },
        { pattern: /usdc\s*\/\s*sol/i, tokenA: 'USDC', tokenB: 'SOL' },
        { pattern: /usdc\s*\/\s*usdt/i, tokenA: 'USDC', tokenB: 'USDT' },
        { pattern: /usdt\s*\/\s*usdc/i, tokenA: 'USDT', tokenB: 'USDC' },
        { pattern: /eth\s*\/\s*usdc/i, tokenA: 'ETH', tokenB: 'USDC' },
        { pattern: /usdc\s*\/\s*eth/i, tokenA: 'USDC', tokenB: 'ETH' },
        { pattern: /btc\s*\/\s*usdc/i, tokenA: 'BTC', tokenB: 'USDC' },
        { pattern: /usdc\s*\/\s*btc/i, tokenA: 'USDC', tokenB: 'BTC' },
    ];

    for (const pattern of tokenPatterns) {
        if (pattern.pattern.test(text)) {
            criteria.tokenPair = `${pattern.tokenA}/${pattern.tokenB}`;
            break;
        }
    }

    // Parse pool type
    if (text.includes('concentrated') || text.includes('clmm')) {
        criteria.poolType = 'concentrated';
    } else if (text.includes('stable') || text.includes('stable swap')) {
        criteria.poolType = 'stable';
    } else if (text.includes('weighted') || text.includes('weighted pool')) {
        criteria.poolType = 'weighted';
    }

    // Parse APY/APR requirements
    if (text.includes('high apy') || text.includes('high yield') || text.includes('high return')) {
        criteria.minApr = 10; // 10% minimum
    } else if (text.includes('low apy') || text.includes('low yield')) {
        criteria.maxApr = 5; // 5% maximum
    }

    // Parse TVL requirements
    if (text.includes('high liquidity') || text.includes('high tvl') || text.includes('deep liquidity')) {
        criteria.minTvl = 1000000; // $1M minimum
    } else if (text.includes('low liquidity') || text.includes('low tvl')) {
        criteria.maxTvl = 100000; // $100K maximum
    }

    // Parse fee requirements
    if (text.includes('low fee') || text.includes('low fees') || text.includes('cheap')) {
        criteria.maxFee = 0.001; // 0.1% maximum
    } else if (text.includes('high fee') || text.includes('high fees')) {
        criteria.minFee = 0.005; // 0.5% minimum
    }

    // Parse active status
    if (text.includes('active') || text.includes('live')) {
        criteria.isActive = true;
    }

    return criteria;
}

/**
 * Apply filters to pools
 */
function applyFilters(pools: any[], criteria: any): any[] {
    return pools.filter(pool => {
        // Filter by pool type
        if (criteria.poolType && pool.metadata?.poolType !== criteria.poolType) {
            return false;
        }

        // Filter by APR
        if (criteria.minApr && (pool.apr || 0) < criteria.minApr) {
            return false;
        }
        if (criteria.maxApr && (pool.apr || 0) > criteria.maxApr) {
            return false;
        }

        // Filter by TVL
        if (criteria.minTvl && (pool.tvl || 0) < criteria.minTvl) {
            return false;
        }
        if (criteria.maxTvl && (pool.tvl || 0) > criteria.maxTvl) {
            return false;
        }

        // Filter by fee
        if (criteria.maxFee && (pool.fee || 0) > criteria.maxFee) {
            return false;
        }
        if (criteria.minFee && (pool.fee || 0) < criteria.minFee) {
            return false;
        }

        // Filter by active status
        if (criteria.isActive !== undefined && pool.metadata?.isActive !== criteria.isActive) {
            return false;
        }

        return true;
    });
}

/**
 * Format pools response
 */
function formatPoolsResponse(pools: any[], searchCriteria: any): string {
    let responseText = '🔍 **METEORA POOLS SEARCH RESULTS**\n\n';

    // Add search criteria summary
    if (Object.keys(searchCriteria).length > 0) {
        responseText += '**Search Criteria:**\n';
        if (searchCriteria.tokenPair) responseText += `• Token Pair: ${searchCriteria.tokenPair}\n`;
        if (searchCriteria.poolType) responseText += `• Pool Type: ${searchCriteria.poolType}\n`;
        if (searchCriteria.minApr) responseText += `• Minimum APR: ${searchCriteria.minApr}%\n`;
        if (searchCriteria.maxApr) responseText += `• Maximum APR: ${searchCriteria.maxApr}%\n`;
        if (searchCriteria.minTvl) responseText += `• Minimum TVL: $${searchCriteria.minTvl.toLocaleString()}\n`;
        if (searchCriteria.maxTvl) responseText += `• Maximum TVL: $${searchCriteria.maxTvl.toLocaleString()}\n`;
        if (searchCriteria.maxFee) responseText += `• Maximum Fee: ${(searchCriteria.maxFee * 100).toFixed(2)}%\n`;
        if (searchCriteria.minFee) responseText += `• Minimum Fee: ${(searchCriteria.minFee * 100).toFixed(2)}%\n`;
        if (searchCriteria.isActive !== undefined) responseText += `• Active Only: ${searchCriteria.isActive ? 'Yes' : 'No'}\n`;
        responseText += '\n';
    }

    responseText += `Found **${pools.length}** pool(s):\n\n`;

    // Sort pools by TVL (highest first)
    const sortedPools = [...pools].sort((a, b) => (b.tvl || 0) - (a.tvl || 0));

    for (let i = 0; i < sortedPools.length; i++) {
        const pool = sortedPools[i];
        responseText += `**${i + 1}. ${pool.displayName || `${pool.tokenA?.symbol || 'Unknown'}/${pool.tokenB?.symbol || 'Unknown'}`}**\n`;

        // Pool details
        responseText += `   **Pool ID:** \`${pool.id || pool.address}\`\n`;
        responseText += `   **Type:** ${pool.metadata?.poolType || 'Unknown'}\n`;
        responseText += `   **Status:** 🟢 Active\n`;

        // Token information
        if (pool.tokenA && pool.tokenB) {
            responseText += `   **Tokens:** ${pool.tokenA.symbol} / ${pool.tokenB.symbol}\n`;
            if (pool.tokenA.decimals && pool.tokenB.decimals) {
                responseText += `   **Decimals:** ${pool.tokenA.decimals} / ${pool.tokenB.decimals}\n`;
            }
        }

        // Financial metrics
        if (pool.apr) responseText += `   **APR:** ${pool.apr.toFixed(2)}%\n`;
        if (pool.apy) responseText += `   **APY:** ${pool.apy.toFixed(2)}%\n`;
        if (pool.tvl) responseText += `   **TVL:** $${pool.tvl.toLocaleString()}\n`;
        if (pool.fee) responseText += `   **Fee:** ${(pool.fee * 100).toFixed(2)}%\n`;

        // Meteora-specific details
        if (pool.metadata?.binStep) responseText += `   **Bin Step:** ${pool.metadata.binStep}\n`;

        responseText += '\n';
    }

    // Add summary statistics
    if (pools.length > 0) {
        const totalTvl = pools.reduce((sum, pool) => sum + (pool.tvl || 0), 0);
        const avgApr = pools.reduce((sum, pool) => sum + (pool.apr || 0), 0) / pools.length;
        const avgFee = pools.reduce((sum, pool) => sum + (pool.fee || 0), 0) / pools.length;

        responseText += '📊 **SUMMARY STATISTICS**\n';
        responseText += `**Total TVL:** $${totalTvl.toLocaleString()}\n`;
        responseText += `**Average APR:** ${avgApr.toFixed(2)}%\n`;
        responseText += `**Average Fee:** ${(avgFee * 100).toFixed(2)}%\n`;
        responseText += `**Pool Types:** ${[...new Set(pools.map(p => p.metadata?.poolType || 'Unknown'))].join(', ')}\n\n`;
    }

    return responseText;
}

// Export the action as default
export default searchMeteoraPoolsAction; 