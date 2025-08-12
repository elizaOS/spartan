import { type IAgentRuntime, logger } from '@elizaos/core';

// Get token info function implementation (needed for swap quote)
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

// Get swap quote function implementation
async function getSwapQuoteFromServices(runtime: IAgentRuntime, params: any) {
    try {
        const jupiterApiUrl = runtime.getSetting("JUPITER_API_URL") || "https://quote-api.jup.ag/v6";

        const solanaService = runtime.getService('chain_solana') as any;
        if (!solanaService) {
            throw new Error("Solana service not available");
        }

        const inputTokenInfo = await getTokenInfo(runtime, params.inputMint);
        const outputTokenInfo = await getTokenInfo(runtime, params.outputMint);

        const inputDecimals = inputTokenInfo?.decimals || 9;
        const rawAmount = Math.floor(params.amount * Math.pow(10, inputDecimals));

        const response = await fetch(
            `${jupiterApiUrl}/quote?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${rawAmount}&slippageBps=${params.slippageBps}`
        );

        if (!response.ok) {
            throw new Error(`Jupiter API error: ${response.statusText}`);
        }

        const quote = await response.json();

        return quote;
    } catch (error) {
        console.error("Error getting swap quote from services:", error);
        return null;
    }
}

export const rt_getSwapQuoteFromServices = async (req: any, res: any, runtime: IAgentRuntime) => {
    try {
        const { inputMint, outputMint, amount, slippageBps = 50 } = req.body || {};

        if (!inputMint || !outputMint || !amount) {
            return res.status(400).json({
                success: false,
                message: 'inputMint, outputMint, and amount are required'
            });
        }

        logger.info('Getting swap quote for:', inputMint, 'to', outputMint, 'amount:', amount);

        const quote = await getSwapQuoteFromServices(runtime, {
            inputMint,
            outputMint,
            amount,
            slippageBps
        });

        if (quote) {
            res.json({
                success: true,
                quote,
                message: 'Successfully retrieved swap quote',
                inputMint,
                outputMint,
                amount,
                slippageBps
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to get swap quote',
                inputMint,
                outputMint,
                amount
            });
        }
    } catch (error) {
        logger.error('Error in rt_getSwapQuoteFromServices route:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting swap quote',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}; 