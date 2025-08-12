import { type IAgentRuntime, logger } from '@elizaos/core';
import { PublicKey } from '@solana/web3.js';

// Get wallet balances function implementation
async function getWalletBalancesFromServices(runtime: IAgentRuntime, walletAddress: string, includePrices: boolean) {
    try {
        const solanaService = runtime.getService('chain_solana') as any;

        if (!solanaService) {
            throw new Error("Solana service not available");
        }

        const balances = await solanaService.getBalancesByAddrs([walletAddress]);
        const solBalance = balances[walletAddress];
        const tokenAccounts = await solanaService.getTokenAccountsByKeypair(new PublicKey(walletAddress));

        const tokens: any[] = [];
        // solBalance / 1e9;
        let totalValueUsd = 0

        const cachedTokens = await runtime.getCache('tokens_solana') || [];
        const dataProviderService = runtime.getService('TRADER_DATAPROVIDER') as any;

        for (const account of tokenAccounts) {
            const accountInfo = account.account.data.parsed.info;
            const tokenMint = accountInfo.mint;

            if (accountInfo.tokenAmount.uiAmount === 0) continue;

            let tokenInfo: any = null;
            if (includePrices && dataProviderService && dataProviderService.getTokenInfo) {
                tokenInfo = await dataProviderService.getTokenInfo('solana', tokenMint);
                //console.log('tokenInfo', tokenInfo)
            }

            const cachedToken = (cachedTokens as any[]).find((t: any) => t.address === tokenMint);
            //const price = includePrices && cachedToken ? cachedToken.price : undefined;
            const price = includePrices ? tokenInfo.priceUsd : undefined;
            const valueUsd = price ? parseFloat(accountInfo.tokenAmount.uiAmount) * price : undefined;
            console.log(tokenMint, 'price', price, 'valueUsd', valueUsd, 'uiAmount', accountInfo.tokenAmount.uiAmount)

            if (valueUsd) {
                totalValueUsd += valueUsd;
            }

            // Get token symbol from Solana service
            let symbol = cachedToken?.symbol || tokenMint.slice(0, 6);
            try {
                const tokenSymbol = await solanaService.getTokenSymbol(new PublicKey(tokenMint));
                if (tokenSymbol) {
                    symbol = tokenSymbol;
                }
            } catch (symbolError) {
                console.warn(`Failed to get symbol for token ${tokenMint}:`, symbolError);
            }

            tokens.push({
                mint: tokenMint,
                symbol,
                name: symbol,
                balance: accountInfo.tokenAmount.uiAmount,
                decimals: accountInfo.tokenAmount.decimals,
                uiAmount: accountInfo.tokenAmount.uiAmount,
                priceUsd: price,
                valueUsd,
            });
        }

        return {
            solBalance: solBalance,
            tokens,
            totalValueUsd,
        };
    } catch (error) {
        console.error("Error getting wallet balances from services:", error);
        return {
            solBalance: 0,
            tokens: [],
            totalValueUsd: 0,
        };
    }
}

export const rt_getWalletBalancesFromServices = async (req: any, res: any, runtime: IAgentRuntime) => {
    try {
        const { walletAddress } = req.params || {};
        const { includePrices = true } = req.query || {};

        if (!walletAddress) {
            return res.status(400).json({
                success: false,
                message: 'walletAddress is required'
            });
        }

        logger.info('Getting wallet balances for:', walletAddress, 'includePrices', includePrices);

        const balances = await getWalletBalancesFromServices(runtime, walletAddress, includePrices);

        res.json({
            success: true,
            walletAddress,
            solBalance: balances.solBalance,
            tokens: balances.tokens,
            totalValueUsd: balances.totalValueUsd,
            message: `Retrieved balances for ${balances.tokens.length} tokens`,
            tokenCount: balances.tokens.length
        });
    } catch (error) {
        logger.error('Error in rt_getWalletBalancesFromServices route:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting wallet balances',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};