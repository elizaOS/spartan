import { type IAgentRuntime, logger } from '@elizaos/core';

// Get token info function implementation
async function getTokenInfo(runtime: IAgentRuntime, tokenMint: string) {
    try {
        const cachedTokens = await runtime.getCache('tokens_solana') || [];
        const cachedToken = (cachedTokens as any[]).find((t: any) => t.address === tokenMint);

        if (cachedToken) {
            return {
                symbol: cachedToken.symbol,
                name: cachedToken.name,
                decimals: cachedToken.decimals || 9,
            };
        }

        const dataProviderService = runtime.getService('TRADER_DATAPROVIDER') as any;
        if (dataProviderService && dataProviderService.getTokenInfo) {
            return await dataProviderService.getTokenInfo('solana', tokenMint);
        }

        return {
            symbol: tokenMint.slice(0, 6),
            name: `Token ${tokenMint.slice(0, 8)}`,
            decimals: 9,
        };
    } catch (error) {
        console.error("Error getting token info:", error);
        return null;
    }
}

export const rt_getTokenInfo = async (req: any, res: any, runtime: IAgentRuntime) => {
    try {
        const { tokenMint } = req.body || {};

        if (!tokenMint) {
            return res.status(400).json({
                success: false,
                message: 'tokenMint is required'
            });
        }

        logger.info('Getting token info for:', tokenMint);

        const tokenInfo = await getTokenInfo(runtime, tokenMint);

        if (tokenInfo) {
            res.json({
                success: true,
                tokenInfo,
                message: `Retrieved info for ${tokenInfo.symbol}`,
                tokenMint
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to get token info',
                tokenMint
            });
        }
    } catch (error) {
        logger.error('Error in rt_getTokenInfo route:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting token info',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}; 