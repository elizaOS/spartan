import { type IAgentRuntime, logger } from '@elizaos/core';
import { PublicKey } from '@solana/web3.js';

// Get token balance function implementation
async function getTokenBalanceFromServices(runtime: IAgentRuntime, walletAddress: string, tokenMint: string) {
    try {
        const solanaService = runtime.getService('chain_solana') as any;

        if (!solanaService) {
            throw new Error("Solana service not available");
        }

        const tokenAccounts = await solanaService.getTokenAccountsByKeypair(new PublicKey(walletAddress));

        const tokenAccount = tokenAccounts.find((account: any) =>
            account.account.data.parsed.info.mint === tokenMint
        );

        if (!tokenAccount) {
            return null;
        }

        const accountInfo = tokenAccount.account.data.parsed.info;

        const dataProviderService = runtime.getService('TRADER_DATAPROVIDER') as any;
        let tokenInfo: any = null;

        if (dataProviderService && dataProviderService.getTokenInfo) {
            tokenInfo = await dataProviderService.getTokenInfo('solana', tokenMint);
        }

        let price = undefined;
        const cachedTokens = await runtime.getCache('tokens_solana');
        if (cachedTokens) {
            const token = (cachedTokens as any[]).find((t: any) => t.address === tokenMint);
            if (token) {
                price = token.price;
            }
        }

        // Get token symbol from Solana service
        let symbol = tokenInfo?.symbol || tokenMint.slice(0, 6);
        try {
            const tokenSymbol = await solanaService.getTokenSymbol(new PublicKey(tokenMint));
            if (tokenSymbol) {
                symbol = tokenSymbol;
            }
        } catch (symbolError) {
            console.warn(`Failed to get symbol for token ${tokenMint}:`, symbolError);
        }

        return {
            mint: tokenMint,
            symbol,
            name: symbol,
            balance: accountInfo.tokenAmount.uiAmount,
            decimals: accountInfo.tokenAmount.decimals,
            uiAmount: accountInfo.tokenAmount.uiAmount,
            valueUsd: price ? accountInfo.tokenAmount.uiAmount * price : undefined,
        };
    } catch (error) {
        console.error("Error getting token balance from services:", error);
        return null;
    }
}

export const rt_getTokenBalanceFromServices = async (req: any, res: any, runtime: IAgentRuntime) => {
    try {
        const { walletAddress, tokenMint } = req.body || {};

        if (!walletAddress || !tokenMint) {
            return res.status(400).json({
                success: false,
                message: 'walletAddress and tokenMint are required'
            });
        }

        logger.info('Getting token balance for:', tokenMint, 'in wallet:', walletAddress);

        const tokenBalance = await getTokenBalanceFromServices(runtime, walletAddress, tokenMint);

        if (tokenBalance) {
            res.json({
                success: true,
                walletAddress,
                tokenBalance,
                message: `Retrieved balance for ${tokenBalance.symbol}`,
                hasBalance: tokenBalance.balance > 0
            });
        } else {
            res.json({
                success: true,
                walletAddress,
                tokenMint,
                message: 'No token account found for this mint',
                hasBalance: false
            });
        }
    } catch (error) {
        logger.error('Error in rt_getTokenBalanceFromServices route:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting token balance',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};