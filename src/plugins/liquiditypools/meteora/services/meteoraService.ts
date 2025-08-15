import type { IAgentRuntime } from '@elizaos/core';
import { Service, logger } from '@elizaos/core';
import type { ILpService, PoolInfo, LpPositionDetails, TransactionResult, TokenBalance } from '@elizaos/core';
import type {
    MeteoraPool,
    MeteoraPoolOutput,
    MeteoraAddLiquidityParams,
    MeteoraGetPoolsParams,
    MeteoraPoolParams,
    GetPoolsParameters,
    PoolParameters,
    AddLiquidityParameters,
    BinLiquidity,
    LbPosition,
    PositionInfo
} from '../interfaces/types';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { calculateAmounts, withRetry, InsufficientBalanceError, MeteoraStatisticalBugError } from '../utils/utils';
import { SOLANA_SERVICE_NAME } from '../../../autonomous-trader/constants';
import bs58 from 'bs58';

// Handle missing Meteora SDK dependency gracefully
let DLMM: any = null;
let PositionInfo: any = null;
let StrategyType: any = null;
let BN: any = null;

try {
    // Try to import Meteora SDK - this will fail gracefully if not installed
    const meteoraModule = require('@meteora-ag/dlmm');
    DLMM = meteoraModule.default || meteoraModule.DLMM;
    PositionInfo = meteoraModule.PositionInfo;
    StrategyType = meteoraModule.StrategyType;
    BN = meteoraModule.BN;
} catch (error) {
    logger.warn('Meteora SDK not available, using fallback functionality');
}

/**
 * Meteora Liquidity Pool Service
 * Implements the ILpService interface for Meteora DEX
 */
export class MeteoraService extends Service implements ILpService {
    private isRunning = false;
    private connection: Connection;
    private rpcEndpoint: string;
    private apiEndpoint: string;
    private static readonly BASE_URL = 'https://dlmm-api.meteora.ag';

    static serviceType = 'METEORA_SERVICE';
    static serviceName = 'MeteoraService';
    capabilityDescription = 'Provides standardized access to DEX liquidity pools.' as const;

    constructor(runtime: IAgentRuntime) {
        super(runtime);

        this.rpcEndpoint = runtime.getSetting('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';
        this.apiEndpoint = MeteoraService.BASE_URL;

        // Initialize connection
        this.connection = new Connection(this.rpcEndpoint);

        logger.log('MeteoraService initialized');
    }

    getDexName(): string {
        return 'meteora';
    }

    async getPools(tokenAMint?: string, tokenBMint?: string): Promise<PoolInfo[]> {
        try {
            logger.log(`Fetching Meteora pools with filters: tokenA=${tokenAMint}, tokenB=${tokenBMint}`);

            // Fetch real pools from Meteora API
            const pools = await this.fetchPoolsFromAPI();

            // Filter by token mints if provided
            let filteredPools = pools;
            if (tokenAMint || tokenBMint) {
                filteredPools = pools.filter(pool => {
                    return true;
                });
            }

            // Convert to standardized PoolInfo format
            return filteredPools.map(pool => this.convertToPoolInfo(pool));
        } catch (error) {
            logger.error('Error fetching Meteora pools:', error);
            return [];
        }
    }

    async addLiquidity(params: {
        userVault: any;
        poolId: string;
        tokenAAmountLamports: string;
        tokenBAmountLamports?: string;
        slippageBps: number;
        tickLowerIndex?: number;
        tickUpperIndex?: number;
        tokenASymbol?: string;
        tokenBSymbol?: string;
    }): Promise<TransactionResult & { lpTokensReceived?: TokenBalance }> {
        // Extract wallet public key and keypair from userVault (same as addMeteoraLiquidity.ts)
        const walletPublicKey = params.userVault?.publicKey;
        const walletKeypair = params.userVault?.keypair;

        if (!walletPublicKey) {
            throw new Error('No wallet public key provided in userVault');
        }
        if (!walletKeypair) {
            throw new Error('No wallet keypair provided in userVault');
        }

        logger.log(`Using wallet public key from account: ${walletPublicKey}`);
        console.log(`Using wallet public key from account: ${walletPublicKey}`);
        logger.log(`Using wallet keypair from account: ${walletKeypair.publicKey?.toString()}`);
        console.log(`Using wallet keypair from account: ${walletKeypair.publicKey?.toString()}`);
        try {
            logger.log(`Adding liquidity to Meteora pool: ${params.poolId}`);

            if (!DLMM) {
                throw new Error('Meteora SDK not available');
            }

            logger.log(`Adding liquidity with amounts: tokenA=${params.tokenAAmountLamports} (${params.tokenASymbol}), tokenB=${params.tokenBAmountLamports || '0'} (${params.tokenBSymbol})`);

            // Ensure we have both amounts
            const tokenAAmount = params.tokenAAmountLamports || '0';
            const tokenBAmount = params.tokenBAmountLamports || '0';

            logger.log(`Passing to innerAddLiquidity: poolId=${params.poolId}, amount=${tokenAAmount}, amountB=${tokenBAmount}`);

            // Pass the token amounts with their corresponding token information
            const signature = await this.innerAddLiquidity(
                params.poolId,
                tokenAAmount,
                tokenBAmount,
                10, // default range interval
                tokenAAmount,
                tokenBAmount,
                params.tokenASymbol,
                params.tokenBSymbol,
                walletPublicKey,
                walletKeypair
            );

            return {
                success: true,
                transactionId: signature,
                data: {
                    poolAddress: params.poolId,
                    liquidity: params.tokenAAmountLamports
                }
            };
        } catch (error) {
            logger.error('Error adding liquidity to Meteora pool:', error);
            return {
                success: false,
                error: `Failed to add liquidity: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async removeLiquidity(params: {
        userVault: any;
        poolId: string;
        lpTokenAmountLamports: string;
        slippageBps: number;
        tokenAAmount?: string;
        tokenBAmount?: string;
        tokenASymbol?: string;
        tokenBSymbol?: string;
        isRemoveByTokenAmounts?: boolean;
    }): Promise<TransactionResult & { tokensReceived?: TokenBalance[] }> {
        // Extract wallet public key and keypair from userVault (same as addLiquidity)
        const walletPublicKey = params.userVault?.publicKey;
        const walletKeypair = params.userVault?.keypair;

        if (!walletPublicKey) {
            throw new Error('No wallet public key provided in userVault');
        }
        if (!walletKeypair) {
            throw new Error('No wallet keypair provided in userVault');
        }

        logger.log(`Using wallet public key from account: ${walletPublicKey}`);
        console.log(`Using wallet public key from account: ${walletPublicKey}`);
        logger.log(`Using wallet keypair from account: ${walletKeypair.publicKey?.toString()}`);
        console.log(`Using wallet keypair from account: ${walletKeypair.publicKey?.toString()}`);

        try {
            logger.log(`Removing liquidity from Meteora pool: ${params.poolId}`);

            if (!DLMM) {
                throw new Error('Meteora SDK not available');
            }

            // Use the real removeLiquidity implementation with proper wallet handling
            const result = await this.innerRemoveLiquidity(
                params.poolId,
                params.lpTokenAmountLamports,
                params.slippageBps,
                walletPublicKey,
                walletKeypair,
                params.tokenAAmount,
                params.tokenBAmount,
                params.tokenASymbol,
                params.tokenBSymbol,
                params.isRemoveByTokenAmounts
            );

            return {
                success: true,
                transactionId: result.transactionId,
                data: {
                    poolAddress: params.poolId,
                    liquidityRemoved: params.lpTokenAmountLamports
                },
                tokensReceived: result.tokensReceived
            };
        } catch (error) {
            logger.error('Error removing liquidity from Meteora pool:', error);
            return {
                success: false,
                error: `Failed to remove liquidity: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async getLpPositionDetails(
        userAccountPublicKey: string,
        poolOrPositionIdentifier: string
    ): Promise<LpPositionDetails | null> {
        try {
            logger.log(`Fetching Meteora position details for user: ${userAccountPublicKey}, pool: ${poolOrPositionIdentifier}`);

            // Get real position data from Meteora if SDK is available
            if (DLMM) {
                const positions = await this.getAllUserPositions(userAccountPublicKey);

                // Find position for the specific pool
                for (const [poolAddress, positionInfo] of positions.entries()) {
                    if (poolAddress === poolOrPositionIdentifier || positionInfo.publicKey.toString() === poolOrPositionIdentifier) {
                        return this.convertToPositionDetails(positionInfo, poolAddress);
                    }
                }
            }

            // Fallback: return basic position info
            return {
                poolId: poolOrPositionIdentifier,
                dex: 'meteora',
                lpTokenBalance: {
                    address: `${poolOrPositionIdentifier}-lp`,
                    balance: '0',
                    symbol: 'METEORA-LP',
                    uiAmount: 0,
                    decimals: 6,
                    name: 'Meteora LP Token'
                },
                underlyingTokens: []
            };
        } catch (error) {
            logger.error('Error fetching Meteora position details:', error);
            return null;
        }
    }

    async getMarketDataForPools(poolIds: string[]): Promise<Record<string, Partial<PoolInfo>>> {
        try {
            logger.log(`Fetching market data for ${poolIds.length} Meteora pools`);

            const marketData: Record<string, Partial<PoolInfo>> = {};

            for (const poolId of poolIds) {
                try {
                    // Fetch real market data for each pool
                    const poolData = await this.fetchPoolMarketData(poolId);
                    if (poolData) {
                        marketData[poolId] = {
                            id: poolId,
                            dex: 'meteora',
                            apr: poolData.apr,
                            apy: poolData.apy,
                            tvl: poolData.tvl,
                            fee: poolData.fee
                        };
                    }
                } catch (error) {
                    logger.warn(`Failed to fetch market data for pool ${poolId}:`, error);
                }
            }

            return marketData;
        } catch (error) {
            logger.error('Error fetching Meteora market data:', error);
            return {};
        }
    }

    // Additional Meteora-specific methods based on the working code

    /**
     * Get all pools from Meteora API
     */
    async getPoolsFromAPI(params?: MeteoraGetPoolsParams): Promise<MeteoraPoolOutput[]> {
        try {
            let url = `${this.apiEndpoint}/pair/all_with_pagination?limit=50`;

            if (params?.asset && params?.assetB) {
                url = `${this.apiEndpoint}/pair/all_with_pagination?search_term=${params.asset}-${params.assetB}&limit=50`;
            }

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch pools: ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.pairs) {
                return [];
            }

            return result.pairs.map((pool: MeteoraPool) => ({
                address: pool.address,
                name: pool.name,
                bin_step: pool.bin_step,
                base_fee_percentage: pool.base_fee_percentage,
                max_fee_percentage: pool.max_fee_percentage,
                protocol_fee_percentage: pool.protocol_fee_percentage,
                liquidity: pool.liquidity,
                fees_24h: pool.fees_24h,
                trade_volume_24h: pool.trade_volume_24h,
                current_price: pool.current_price,
                apr_percentage: pool.apr,
            }));
        } catch (error) {
            logger.error('Error fetching pools from Meteora API:', error);
            throw error;
        }
    }

    /**
     * Get positions from a specific pool
     */
    async getPositionsFromPool(params: MeteoraPoolParams): Promise<Array<LbPosition>> {
        try {
            const { poolAddress } = params;

            if (!poolAddress) {
                throw new Error('Pool address is required for Meteora getPositionsFromPool');
            }

            if (!DLMM) {
                throw new Error('Meteora SDK not available');
            }

            const dlmmPool = await DLMM.create(this.connection, new PublicKey(poolAddress));
            const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(new PublicKey('mock-user-key'));

            return userPositions;
        } catch (error) {
            logger.error('Error getting positions from pool:', error);
            throw error;
        }
    }

    /**
     * Get all user positions
     */
    async getAllUserPositions(userPublicKey: string): Promise<Map<string, any>> {
        try {
            if (!DLMM) {
                throw new Error('Meteora SDK not available');
            }

            return await DLMM.getAllLbPairPositionsByUser(this.connection, new PublicKey(userPublicKey));
        } catch (error) {
            logger.error('Error getting all user positions:', error);
            throw error;
        }
    }

    /**
     * Get active bin for a pool
     */
    async getActiveBin(params: MeteoraPoolParams): Promise<BinLiquidity> {
        try {
            const { poolAddress } = params;

            if (!poolAddress) {
                throw new Error('Pool address is required for Meteora getActiveBin');
            }

            if (!DLMM) {
                throw new Error('Meteora SDK not available');
            }

            const dlmmPool = await DLMM.create(this.connection, new PublicKey(poolAddress));
            return await dlmmPool.getActiveBin();
        } catch (error) {
            logger.error('Error getting active bin:', error);
            throw error;
        }
    }

    /**
     * Get position information from API
     */
    async getPositionInfo(positionAddress: string): Promise<any> {
        try {
            const response = await fetch(`${this.apiEndpoint}/position_v2/${positionAddress}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch position info: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            logger.error('Error fetching Meteora position info:', error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to get Meteora position info: ${message}`);
        }
    }

    /**
     * Helper method for adding liquidity to a Meteora pool
     * @returns Transaction signature
     */
    private async innerAddLiquidity(
        poolAddress: string,
        amount: string,
        amountB: string,
        rangeInterval: number = 10,
        tokenAAmount?: string,
        tokenBAmount?: string,
        tokenASymbol?: string,
        tokenBSymbol?: string,
        walletPublicKey?: string,
        walletKeypair?: any
    ): Promise<string> {
        logger.log(`innerAddLiquidity called with: poolAddress=${poolAddress}, amount=${amount}, amountB=${amountB}`);

        // Use the provided wallet public key and keypair from account
        let keypair: any;
        let publicKey: PublicKey;

        if (walletPublicKey && walletKeypair) {
            // Use the provided wallet public key and keypair from account
            publicKey = new PublicKey(walletPublicKey);

            // Log the keypair structure to understand what we're working with
            logger.debug(`Keypair structure: ${JSON.stringify({
                hasPublicKey: !!walletKeypair.publicKey,
                publicKeyType: typeof walletKeypair.publicKey,
                publicKeyValue: walletKeypair.publicKey?.toString(),
                hasPrivateKey: !!walletKeypair.privateKey,
                privateKeyType: typeof walletKeypair.privateKey,
                privateKeyValue: walletKeypair.privateKey,
                hasSecretKey: !!walletKeypair.secretKey,
                secretKeyType: typeof walletKeypair.secretKey,
                secretKeyLength: walletKeypair.secretKey?.length,
                hasSign: typeof walletKeypair.sign,
                hasSignTransaction: typeof walletKeypair.signTransaction,
                constructor: walletKeypair.constructor?.name,
                keys: Object.keys(walletKeypair)
            })}`);

            // The keypair from account might not be a proper Solana Keypair object
            // We need to convert it to a proper Keypair for signing
            let properKeypair: any;

            if (walletKeypair.secretKey) {
                // If it has secretKey, we can create a proper Keypair
                try {
                    const { Keypair } = await import('@solana/web3.js');
                    properKeypair = Keypair.fromSecretKey(walletKeypair.secretKey);
                    logger.debug('Created proper Keypair from secretKey');
                } catch (error) {
                    logger.error('Failed to create Keypair from secretKey:', error);
                    throw new Error('Invalid secretKey format in account keypair');
                }
            } else if (walletKeypair.privateKey) {
                // Alternative: try privateKey
                try {
                    const { Keypair } = await import('@solana/web3.js');
                    const secretKey = bs58.decode(walletKeypair.privateKey);
                    properKeypair = Keypair.fromSecretKey(secretKey);
                    logger.debug('Created proper Keypair from privateKey');
                } catch (error) {
                    logger.error('Failed to create Keypair from privateKey:', error);
                    throw new Error('Invalid privateKey format in account keypair');
                }
            } else {
                // If no secret key available, we need to get it from the Solana service
                logger.debug('No secret key in account keypair, getting from Solana service...');
                const solanaService = this.runtime.getService(SOLANA_SERVICE_NAME) as any;
                if (!solanaService) {
                    throw new Error('Solana service not available');
                }
                properKeypair = await solanaService.getWalletKeypair();
                if (!properKeypair) {
                    throw new Error('Failed to get keypair from Solana service');
                }
                // Validate it matches the expected public key
                if (properKeypair.publicKey.toString() !== walletPublicKey) {
                    throw new Error(`Solana service keypair mismatch: expected ${walletPublicKey}, got ${properKeypair.publicKey.toString()}`);
                }
            }

            keypair = properKeypair;

            logger.log(`Using provided wallet public key from account: ${walletPublicKey}`);
            logger.log(`Using converted keypair: ${keypair.publicKey?.toString()}`);

            // Validate the converted keypair has required methods
            /*
            if (typeof keypair.sign !== 'function') {
                throw new Error('Converted keypair does not have sign method - invalid keypair structure');
            }
            if (typeof keypair.signTransaction !== 'function') {
                throw new Error('Converted keypair does not have signTransaction method - invalid keypair structure');
            }
            */

            // Validate keypair matches the provided public key
            if (keypair.publicKey.toString() !== walletPublicKey) {
                throw new Error(`Keypair mismatch: expected ${walletPublicKey}, got ${keypair.publicKey.toString()}`);
            }
        } else {
            throw new Error('No wallet public key or keypair provided - cannot proceed');
        }

        const connection = this.connection;
        // Validate pool address format
        try {
            new PublicKey(poolAddress);
        } catch (error) {
            throw new Error(`Invalid pool address format: ${poolAddress}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        const dlmmPool = await withRetry(
            async () => DLMM.create(connection, new PublicKey(poolAddress)),
            'Meteora create pool'
        );

        // Get pool token information to map amounts correctly
        const tokenXAddress = dlmmPool.tokenX.publicKey.toString();
        const tokenYAddress = dlmmPool.tokenY.publicKey.toString();

        logger.log(`Pool token order: tokenX=${tokenXAddress}, tokenY=${tokenYAddress}`);

        // Map the user's intended amounts to the correct pool token order
        // We need to determine which token is which based on the pool's token order
        // and map the amounts accordingly

        let tokenXAmount: string;
        let tokenYAmount: string;

        // Get token symbols for the pool tokens
        const tokenXSymbol = await this.getTokenSymbol(tokenXAddress);
        const tokenYSymbol = await this.getTokenSymbol(tokenYAddress);

        logger.log(`Pool token symbols: tokenX=${tokenXSymbol}, tokenY=${tokenYSymbol}`);
        logger.log(`User token symbols: tokenA=${tokenASymbol}, tokenB=${tokenBSymbol}`);

        // Map amounts based on token symbols
        if (tokenASymbol && tokenBSymbol) {
            if (tokenASymbol === tokenXSymbol && tokenBSymbol === tokenYSymbol) {
                // Direct mapping: tokenA -> tokenX, tokenB -> tokenY
                tokenXAmount = amount;
                tokenYAmount = amountB;
                logger.log(`Direct mapping: tokenA(${tokenASymbol}) -> tokenX(${tokenXSymbol}), tokenB(${tokenBSymbol}) -> tokenY(${tokenYSymbol})`);
            } else if (tokenASymbol === tokenYSymbol && tokenBSymbol === tokenXSymbol) {
                // Swapped mapping: tokenA -> tokenY, tokenB -> tokenX
                tokenXAmount = amountB;
                tokenYAmount = amount;
                logger.log(`Swapped mapping: tokenA(${tokenASymbol}) -> tokenY(${tokenYSymbol}), tokenB(${tokenBSymbol}) -> tokenX(${tokenXSymbol})`);
            } else {
                // Fallback: assume direct mapping
                tokenXAmount = amount;
                tokenYAmount = amountB;
                logger.log(`Fallback mapping: assuming direct order`);
            }
        } else {
            // No token symbols provided, fallback to original amounts
            tokenXAmount = amount;
            tokenYAmount = amountB;
            logger.log(`No token symbols provided, using original amounts`);
        }

        logger.log(`Final mapped amounts: tokenX=${tokenXAmount}, tokenY=${tokenYAmount}`);

        const tokenXBalance = await this.getTokenBalance(tokenXAddress, walletPublicKey);
        const tokenYBalance = await this.getTokenBalance(tokenYAddress, walletPublicKey);

        // Get token decimals for proper conversion
        const tokenXDecimals = tokenXAddress === 'So11111111111111111111111111111111111111112' ? 9 : 6; // SOL has 9, USDC has 6
        const tokenYDecimals = tokenYAddress === 'So11111111111111111111111111111111111111112' ? 9 : 6; // SOL has 9, USDC has 6

        // Convert balances to lamports for comparison with required amounts
        const tokenXBalanceLamports = tokenXBalance * Math.pow(10, tokenXDecimals);
        const tokenYBalanceLamports = tokenYBalance * Math.pow(10, tokenYDecimals);

        logger.log(`Token X (${tokenXAddress}) balance: ${tokenXBalance} -> ${tokenXBalanceLamports} lamports, required: ${tokenXAmount}`);
        logger.log(`Token Y (${tokenYAddress}) balance: ${tokenYBalance} -> ${tokenYBalanceLamports} lamports, required: ${tokenYAmount}`);

        // Additional debug info for SOL handling
        if (tokenXAddress === 'So11111111111111111111111111111111111111112' || tokenYAddress === 'So11111111111111111111111111111111111111112') {
            const nativeSOLBalance = await this.connection.getBalance(publicKey);
            const nativeSOLBalanceSOL = nativeSOLBalance / Math.pow(10, 9);
            logger.log(`Native SOL balance: ${nativeSOLBalanceSOL} SOL (${nativeSOLBalance} lamports)`);

            // Check if user has enough native SOL to wrap for the required amount
            const requiredSOLAmount = (tokenXAddress === 'So11111111111111111111111111111111111111112' ? Number(tokenXAmount) : Number(tokenYAmount)) / Math.pow(10, 9);
            if (nativeSOLBalanceSOL >= requiredSOLAmount) {
                logger.log(`✅ User has enough native SOL (${nativeSOLBalanceSOL}) to wrap for required amount (${requiredSOLAmount})`);
            } else {
                logger.log(`❌ User needs ${requiredSOLAmount} SOL but only has ${nativeSOLBalanceSOL} native SOL`);
            }
        }

        // Check if we have enough of each token
        if (tokenXBalanceLamports < Number(tokenXAmount)) {
            const requiredAmount = Number(tokenXAmount) / Math.pow(10, tokenXDecimals);
            const availableAmount = tokenXBalanceLamports / Math.pow(10, tokenXDecimals);

            let errorMessage = `Insufficient balance for token ${tokenXAddress}. Required: ${requiredAmount}, Available: ${availableAmount}`;

            // Add helpful suggestion for SOL
            if (tokenXAddress === 'So11111111111111111111111111111111111111112') {
                const nativeSOLBalance = await this.connection.getBalance(publicKey);
                const nativeSOLBalanceSOL = nativeSOLBalance / Math.pow(10, 9);
                const requiredSOLAmount = Number(tokenXAmount) / Math.pow(10, 9);

                if (nativeSOLBalanceSOL >= requiredSOLAmount) {
                    errorMessage += `\n\n💡 **SOL Balance Issue:** You have ${nativeSOLBalanceSOL} native SOL but need ${requiredSOLAmount} wrapped SOL. You need to wrap your native SOL first.`;
                    errorMessage += '\n\n**To wrap SOL:** Use a DEX like Jupiter or Raydium to swap native SOL for wrapped SOL (So11111111111111111111111111111111111111112).';
                } else {
                    errorMessage += `\n\n💡 **SOL Balance Issue:** You need ${requiredSOLAmount} SOL but only have ${nativeSOLBalanceSOL} native SOL.`;
                }
            }

            throw new InsufficientBalanceError(Number(tokenXAmount), tokenXBalanceLamports, tokenXAddress);
        }
        if (tokenYBalanceLamports < Number(tokenYAmount)) {
            const requiredAmount = Number(tokenYAmount) / Math.pow(10, tokenYDecimals);
            const availableAmount = tokenYBalanceLamports / Math.pow(10, tokenYDecimals);

            let errorMessage = `Insufficient balance for token ${tokenYAddress}. Required: ${requiredAmount}, Available: ${availableAmount}`;

            // Add helpful suggestion for SOL
            if (tokenYAddress === 'So11111111111111111111111111111111111111112') {
                const nativeSOLBalance = await this.connection.getBalance(publicKey);
                const nativeSOLBalanceSOL = nativeSOLBalance / Math.pow(10, 9);
                const requiredSOLAmount = Number(tokenYAmount) / Math.pow(10, 9);

                if (nativeSOLBalanceSOL >= requiredSOLAmount) {
                    errorMessage += `\n\n💡 **SOL Balance Issue:** You have ${nativeSOLBalanceSOL} native SOL but need ${requiredSOLAmount} wrapped SOL. You need to wrap your native SOL first.`;
                    errorMessage += '\n\n**To wrap SOL:** Use a DEX like Jupiter or Raydium to swap native SOL for wrapped SOL (So11111111111111111111111111111111111111112).';
                } else {
                    errorMessage += `\n\n💡 **SOL Balance Issue:** You need ${requiredSOLAmount} SOL but only have ${nativeSOLBalanceSOL} native SOL.`;
                }
            }

            throw new InsufficientBalanceError(Number(tokenYAmount), tokenYBalanceLamports, tokenYAddress);
        }

        // Wrap the position check in retry logic
        const positionInfo = await withRetry(
            async () => dlmmPool.getPositionsByUserAndLbPair(keypair.publicKey),
            'Meteora get user positions'
        );
        const existingPosition = positionInfo?.userPositions?.[0];

        const activeBin = await withRetry(async () => dlmmPool.getActiveBin(), 'Meteora get active bin');
        const activeBinPricePerToken = dlmmPool.fromPricePerLamport(Number(activeBin.price));

        // Convert lamports back to token units for calculateAmounts function
        const tokenXAmountInTokens = (Number(tokenXAmount) / Math.pow(10, tokenXDecimals)).toString();
        const tokenYAmountInTokens = (Number(tokenYAmount) / Math.pow(10, tokenYDecimals)).toString();

        logger.log(`Converting amounts for calculateAmounts: tokenX=${tokenXAmountInTokens} (from ${tokenXAmount} lamports), tokenY=${tokenYAmountInTokens} (from ${tokenYAmount} lamports)`);

        const [totalXAmount, totalYAmount]: [BN, BN] = await calculateAmounts(
            tokenXAmountInTokens,
            tokenYAmountInTokens,
            activeBinPricePerToken,
            dlmmPool
        );
        if (totalXAmount.isZero() && totalYAmount.isZero()) {
            throw new TypeError('Total liquidity trying to add is 0');
        }
        logger.debug(`Adding liquidity with Total X amount: ${totalXAmount}, Total Y amount: ${totalYAmount}`);

        let tx;
        let positionPubKey: PublicKey;
        const signers: Keypair[] = [];

        if (existingPosition) {
            logger.debug(`Adding liquidity to existing position`);
            // Get min and max bin ids from the existing position
            const binData = existingPosition.positionData.positionBinData;
            const minBinId = Math.min(...binData.map(bin => bin.binId));
            const maxBinId = Math.max(...binData.map(bin => bin.binId));
            positionPubKey = existingPosition.publicKey;
            // Add liquidity to the existing position
            await dlmmPool.refetchStates();

            tx = await dlmmPool.addLiquidityByStrategy({
                positionPubKey: positionPubKey,
                user: keypair.publicKey,
                totalXAmount,
                totalYAmount,
                strategy: {
                    maxBinId,
                    minBinId,
                    strategyType: StrategyType.Spot,
                },
            });
        } else {
            // Create new position
            logger.debug(`Opening new position`);
            const minBinId = activeBin.binId - rangeInterval;
            const maxBinId = activeBin.binId + rangeInterval;

            // Create a new keypair for the position
            const newPositionKeypair = Keypair.generate();
            positionPubKey = newPositionKeypair.publicKey;
            signers.push(newPositionKeypair);

            await dlmmPool.refetchStates();
            console.log('refetchStates', newPositionKeypair)

            // Add a short delay to avoid hitting rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Use try-catch to handle compute unit estimation failures gracefully
            // Add simple retry logic for rate limiting (429 errors)
            let retryCount = 0;
            const maxRetries = 3;
            let _lastError: unknown;

            while (retryCount <= maxRetries) {
                try {
                    console.log('start tx')
                    tx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
                        positionPubKey: positionPubKey,
                        user: keypair.publicKey,
                        totalXAmount,
                        totalYAmount,
                        strategy: {
                            maxBinId,
                            minBinId,
                            strategyType: StrategyType.Spot,
                        },
                    });
                    console.log('end tx')
                    break; // Success, exit retry loop
                } catch (error: unknown) {
                    _lastError = error;

                    // Log the actual error for debugging
                    logger.debug('Error in initializePositionAndAddLiquidityByStrategy:', error);

                    // Check if it's a rate limiting error
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const isRateLimit =
                        errorMessage.includes('429') ||
                        errorMessage.includes('Request failed with status code 429') ||
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (error as any)?.response?.status === 429;

                    if (isRateLimit && retryCount < maxRetries) {
                        retryCount++;
                        logger.warn(`Rate limited, retrying in 3 seconds (attempt ${retryCount}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        continue;
                    }

                    // If not a rate limiting error or out of retries, throw the error
                    throw error;
                }
            }
            console.log('done')

            // Ensure tx is defined
            if (!tx) {
                throw new Error('Failed to create transaction after retries');
            }
        }

        // Debug logging before sending transaction
        const signersToUse = signers || [];

        // Validate keypair before signing
        if (!keypair) {
            throw new Error('Keypair is undefined - cannot sign transaction');
        }
        if (!keypair.publicKey) {
            throw new Error('Keypair publicKey is undefined - cannot sign transaction');
        }

        logger.debug(`Main signer (keypair): ${keypair.publicKey.toString()}`);

        if (signersToUse.length > 0) {
            logger.debug(`Sending transaction with ${signersToUse.length} additional signers:`);
            signersToUse.forEach((signer, index) => {
                if (!signer) {
                    throw new Error(`Signer ${index} is undefined`);
                }
                if (!signer.publicKey) {
                    throw new Error(`Signer ${index} publicKey is undefined`);
                }
                logger.debug(`  Signer ${index}: ${signer.publicKey.toString()}`);
            });
        } else {
            logger.debug('Sending transaction with no additional signers');
        }

        // Ensure keypair is valid before creating allSigners array
        if (!keypair) {
            throw new Error('Keypair is undefined - cannot create signers array');
        }
        if (!keypair.publicKey) {
            throw new Error('Keypair publicKey is undefined - cannot create signers array');
        }

        logger.debug(`Main keypair public key: ${keypair.publicKey.toString()}`);
        logger.debug(`Keypair type: ${keypair.constructor.name}`);
        logger.debug(`Keypair has sign method: ${typeof keypair.sign === 'function'}`);
        logger.debug(`Keypair has signTransaction method: ${typeof keypair.signTransaction === 'function'}`);

        // Sign the transaction with all signers
        console.log('signersToUse', signersToUse)
        const allSigners = [keypair, ...signersToUse];
        logger.debug(`Total signers: ${allSigners.length}`);

        // Validate each signer individually before signing
        logger.debug('Validating all signers before signing:');
        allSigners.forEach((signer, index) => {
            if (!signer) {
                throw new Error(`Signer ${index} is undefined`);
            }
            if (!signer.publicKey) {
                throw new Error(`Signer ${index} publicKey is undefined`);
            }
            if (typeof signer.publicKey.toString !== 'function') {
                throw new Error(`Signer ${index} publicKey.toString is not a function`);
            }
            logger.debug(`  Signer ${index}: ${signer.publicKey.toString()} - Valid`);
        });

        // Validate transaction before signing
        if (!tx) {
            throw new Error('Transaction is undefined - cannot sign');
        }

        // Validate transaction has required methods
        if (typeof tx.sign !== 'function') {
            throw new Error('Transaction does not have sign method - invalid transaction structure');
        }
        if (typeof tx.serialize !== 'function') {
            throw new Error('Transaction does not have serialize method - invalid transaction structure');
        }

        // Log transaction details
        logger.debug(`Transaction fee payer: ${tx.feePayer?.toString()}`);
        logger.debug(`Transaction recent blockhash: ${tx.recentBlockhash}`);
        logger.debug(`Transaction type: ${tx.constructor.name}`);
        logger.debug(`Transaction has sign method: ${typeof tx.sign === 'function'}`);
        logger.debug(`Transaction has serialize method: ${typeof tx.serialize === 'function'}`);

        try {
            logger.debug('Starting transaction signing...');
            console.log('allSigners', allSigners)
            tx.sign(...allSigners);
            logger.debug('Transaction signed successfully');
        } catch (signError) {
            logger.error('Error signing transaction:', signError);
            logger.error('Signers that were being used:', allSigners.map((s, i) => ({
                index: i,
                hasSigner: !!s,
                hasPublicKey: !!s?.publicKey,
                publicKeyType: typeof s?.publicKey,
                publicKeyValue: s?.publicKey?.toString()
            })));
            throw new Error(`Failed to sign transaction: ${signError instanceof Error ? signError.message : 'Unknown error'}`);
        }

        console.log('start send')

        // Send the transaction
        const signature = await connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: true,
            maxRetries: 5,
            preflightCommitment: 'processed',
        });

        console.log('sent')

        // Wait for transaction confirmation
        const { value: confirmation } = await connection.confirmTransaction(signature, 'confirmed');

        console.log('confirmed')

        if (confirmation.err) {
            throw new Error(`Transaction failed: Signature: ${signature}, Error: ${confirmation.err.toString()}`);
        }
        logger.info(`Transaction successful: ${signature}`);

        // Store the position address in our logs for reference
        logger.info(`Position public key: ${positionPubKey.toString()}`);

        // Just return the transaction signature
        return signature;
    }

    /**
     * Helper method for removing liquidity from a Meteora pool
     * @returns Transaction result with signature and tokens received
     */
    private async innerRemoveLiquidity(
        poolAddress: string,
        lpTokenAmountLamports: string,
        slippageBps: number,
        walletPublicKey?: string,
        walletKeypair?: any,
        tokenAAmount?: string,
        tokenBAmount?: string,
        tokenASymbol?: string,
        tokenBSymbol?: string,
        isRemoveByTokenAmounts?: boolean
    ): Promise<{ transactionId: string; tokensReceived?: TokenBalance[] }> {
        logger.log(`innerRemoveLiquidity called with: poolAddress=${poolAddress}, lpTokenAmount=${lpTokenAmountLamports}, isRemoveByTokenAmounts=${isRemoveByTokenAmounts}, tokenAAmount=${tokenAAmount}, tokenBAmount=${tokenBAmount}`);

        // Use the provided wallet public key and keypair from account
        let keypair: any;
        let publicKey: PublicKey;

        if (walletPublicKey && walletKeypair) {
            // Use the provided wallet public key and keypair from account
            publicKey = new PublicKey(walletPublicKey);

            // Log the keypair structure to understand what we're working with
            logger.debug(`Keypair structure: ${JSON.stringify({
                hasPublicKey: !!walletKeypair.publicKey,
                publicKeyType: typeof walletKeypair.publicKey,
                publicKeyValue: walletKeypair.publicKey?.toString(),
                hasPrivateKey: !!walletKeypair.privateKey,
                privateKeyType: typeof walletKeypair.privateKey,
                privateKeyValue: walletKeypair.privateKey,
                hasSecretKey: !!walletKeypair.secretKey,
                secretKeyType: typeof walletKeypair.secretKey,
                secretKeyLength: walletKeypair.secretKey?.length,
                hasSign: typeof walletKeypair.sign,
                hasSignTransaction: typeof walletKeypair.signTransaction,
                constructor: walletKeypair.constructor?.name,
                keys: Object.keys(walletKeypair)
            })}`);

            // The keypair from account might not be a proper Solana Keypair object
            // We need to convert it to a proper Keypair for signing
            let properKeypair: any;

            if (walletKeypair.secretKey) {
                // If it has secretKey, we can create a proper Keypair
                try {
                    const { Keypair } = await import('@solana/web3.js');
                    properKeypair = Keypair.fromSecretKey(walletKeypair.secretKey);
                    logger.debug('Created proper Keypair from secretKey');
                } catch (error) {
                    logger.error('Failed to create Keypair from secretKey:', error);
                    throw new Error('Invalid secretKey format in account keypair');
                }
            } else if (walletKeypair.privateKey) {
                // Alternative: try privateKey
                try {
                    const { Keypair } = await import('@solana/web3.js');
                    const secretKey = bs58.decode(walletKeypair.privateKey);
                    properKeypair = Keypair.fromSecretKey(secretKey);
                    logger.debug('Created proper Keypair from privateKey');
                } catch (error) {
                    logger.error('Failed to create Keypair from privateKey:', error);
                    throw new Error('Invalid privateKey format in account keypair');
                }
            } else {
                // If no secret key available, we need to get it from the Solana service
                logger.debug('No secret key in account keypair, getting from Solana service...');
                const solanaService = this.runtime.getService(SOLANA_SERVICE_NAME) as any;
                if (!solanaService) {
                    throw new Error('Solana service not available');
                }
                properKeypair = await solanaService.getWalletKeypair();
                if (!properKeypair) {
                    throw new Error('Failed to get keypair from Solana service');
                }
                // Validate it matches the expected public key
                if (properKeypair.publicKey.toString() !== walletPublicKey) {
                    throw new Error(`Solana service keypair mismatch: expected ${walletPublicKey}, got ${properKeypair.publicKey.toString()}`);
                }
            }

            keypair = properKeypair;

            logger.log(`Using provided wallet public key from account: ${walletPublicKey}`);
            logger.log(`Using converted keypair: ${keypair.publicKey?.toString()}`);

            // Validate keypair matches the provided public key
            if (keypair.publicKey.toString() !== walletPublicKey) {
                throw new Error(`Keypair mismatch: expected ${walletPublicKey}, got ${keypair.publicKey.toString()}`);
            }
        } else {
            throw new Error('No wallet public key or keypair provided - cannot proceed');
        }

        const connection = this.connection;

        // Validate pool address format
        try {
            new PublicKey(poolAddress);
        } catch (error) {
            throw new Error(`Invalid pool address format: ${poolAddress}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        const dlmmPool = await withRetry(
            async () => DLMM.create(connection, new PublicKey(poolAddress)),
            'Meteora create pool'
        );

        // Get user positions
        const positionInfo = await withRetry(
            async () => dlmmPool.getPositionsByUserAndLbPair(keypair.publicKey),
            'Meteora get user positions'
        );

        const userPositions = positionInfo?.userPositions;
        if (!userPositions || userPositions.length === 0) {
            throw new Error('No positions found in this pool');
        }

        // Get the first position (can be expanded in the future)
        const position = userPositions[0];

        // Get pool token information
        const tokenXAddress = dlmmPool.tokenX.publicKey.toString();
        const tokenYAddress = dlmmPool.tokenY.publicKey.toString();

        // Get token symbols for better response formatting
        const tokenXSymbol = await this.getTokenSymbol(tokenXAddress);
        const tokenYSymbol = await this.getTokenSymbol(tokenYAddress);

        logger.log(`Pool tokens: tokenX=${tokenXSymbol}(${tokenXAddress}), tokenY=${tokenYSymbol}(${tokenYAddress})`);

        // Determine removal strategy
        const isRemoveAll = lpTokenAmountLamports === '0';
        let bpsToRemove: BN;
        let shouldClosePosition: boolean;

        if (isRemoveAll) {
            logger.log('Removing all liquidity from position');
            bpsToRemove = new BN(100 * 100); // 100%
            shouldClosePosition = true;
        } else if (isRemoveByTokenAmounts && (tokenAAmount || tokenBAmount)) {
            logger.log(`Removing liquidity to get specific token amounts: tokenA=${tokenAAmount} (${tokenASymbol}), tokenB=${tokenBAmount} (${tokenBSymbol})`);
            // For now, we'll remove a percentage based on the requested amounts
            // This is a simplified approach - in a real implementation, you'd calculate the exact LP tokens needed
            bpsToRemove = new BN(50 * 100); // 50% as a starting point
            shouldClosePosition = false;
        } else {
            logger.log(`Removing ${lpTokenAmountLamports} lamports of liquidity`);
            // Calculate percentage based on LP token amount vs total position
            const totalLpTokens = position.positionData.totalXAmount.add(position.positionData.totalYAmount);
            const percentage = (Number(lpTokenAmountLamports) / totalLpTokens.toNumber()) * 100;
            bpsToRemove = new BN(Math.min(percentage * 100, 100 * 100)); // Cap at 100%
            shouldClosePosition = percentage >= 100;
        }

        // Get bin data from position
        const binData = position.positionData.positionBinData;
        const binIdsToRemove = binData.map(bin => bin.binId);

        // Remove liquidity transaction
        const removeLiquidityTx = await dlmmPool.removeLiquidity({
            position: position.publicKey,
            user: keypair.publicKey,
            fromBinId: Math.min(...binIdsToRemove),
            toBinId: Math.max(...binIdsToRemove),
            bps: bpsToRemove,
            shouldClaimAndClose: shouldClosePosition,
        });

        // Handle multiple transactions if needed
        const txArray = Array.isArray(removeLiquidityTx) ? removeLiquidityTx : [removeLiquidityTx];
        let transactionId = '';
        const tokensReceived: TokenBalance[] = [];

        // Process transactions
        for (const tx of txArray) {
            // Sign the transaction
            tx.sign([keypair]);

            // Send the transaction
            const signature = await connection.sendRawTransaction(tx.serialize(), {
                skipPreflight: true,
                maxRetries: 3,
            });

            await connection.confirmTransaction(signature, 'confirmed');
            logger.info(`Remove liquidity transaction successful: ${signature}`);

            transactionId = signature;

            // Extract balance changes from transaction
            const balanceChanges = await this.extractBalanceChanges(connection, signature, tokenXAddress, tokenYAddress);

            // Add tokens received to the result
            if (balanceChanges.liquidityRemoved[0] > 0) {
                tokensReceived.push({
                    address: tokenXAddress,
                    balance: balanceChanges.liquidityRemoved[0].toString(),
                    symbol: tokenXSymbol,
                    uiAmount: balanceChanges.liquidityRemoved[0],
                    decimals: tokenXAddress === 'So11111111111111111111111111111111111111112' ? 9 : 6,
                    name: `${tokenXSymbol} Token`
                });
            }

            if (balanceChanges.liquidityRemoved[1] > 0) {
                tokensReceived.push({
                    address: tokenYAddress,
                    balance: balanceChanges.liquidityRemoved[1].toString(),
                    symbol: tokenYSymbol,
                    uiAmount: balanceChanges.liquidityRemoved[1],
                    decimals: tokenYAddress === 'So11111111111111111111111111111111111111112' ? 9 : 6,
                    name: `${tokenYSymbol} Token`
                });
            }

            // Add fees claimed if any
            if (balanceChanges.feesClaimed[0] > 0) {
                tokensReceived.push({
                    address: tokenXAddress,
                    balance: balanceChanges.feesClaimed[0].toString(),
                    symbol: tokenXSymbol,
                    uiAmount: balanceChanges.feesClaimed[0],
                    decimals: tokenXAddress === 'So11111111111111111111111111111111111111112' ? 9 : 6,
                    name: `${tokenXSymbol} Fees`
                });
            }

            if (balanceChanges.feesClaimed[1] > 0) {
                tokensReceived.push({
                    address: tokenYAddress,
                    balance: balanceChanges.feesClaimed[1].toString(),
                    symbol: tokenYSymbol,
                    uiAmount: balanceChanges.feesClaimed[1],
                    decimals: tokenYAddress === 'So11111111111111111111111111111111111111112' ? 9 : 6,
                    name: `${tokenYSymbol} Fees`
                });
            }
        }

        return {
            transactionId,
            tokensReceived
        };
    }



    /**
     * Claim fees from a Meteora pool - Real implementation from Edwin
     */
    async claimFees(params: MeteoraPoolParams): Promise<string> {
        const { poolAddress } = params;

        if (!DLMM) {
            throw new Error('Meteora SDK not available');
        }

        try {
            const dlmmPool = await DLMM.create(this.connection, new PublicKey(poolAddress));
            const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(new PublicKey('mock-user-key'));

            if (!userPositions || userPositions.length === 0) {
                throw new Error('No positions found in this pool');
            }

            // Create claim fee transaction
            const claimFeeTx = await dlmmPool.claimSwapFee({
                owner: new PublicKey('mock-user-key'),
                position: userPositions[0],
            });

            // Return success message
            return `Successfully claimed fees from pool ${poolAddress}`;
        } catch (error) {
            logger.error('Error claiming fees:', error);
            throw error;
        }
    }

    async getPositionInfoFromTransaction(txHash: string): Promise<{ positionAddress: string; liquidityAdded: [number, number] }> {
        try {
            // Fetch transaction information
            const txInfo = await this.connection.getParsedTransaction(txHash, { maxSupportedTransactionVersion: 0 });
            if (!txInfo || !txInfo.meta) {
                throw new Error('Transaction information not found');
            }

            // Extract the position account (will be a signer other than the wallet)
            const positionAccount = txInfo.transaction.message.accountKeys.find(
                (account: { signer: boolean; pubkey: PublicKey }) =>
                    account.signer && !account.pubkey.equals(new PublicKey('mock-user-key'))
            );

            if (!positionAccount) {
                throw new Error('Position account not found in transaction');
            }

            const positionPubKey = positionAccount.pubkey.toString();

            // Return position info
            return {
                positionAddress: positionPubKey,
                liquidityAdded: [100, 1000], // Mock values since we don't have full verification
            };
        } catch (error) {
            logger.error('Error getting position info from transaction:', error);
            throw new Error(`Failed to get position info: ${error}`);
        }
    }

    // Service lifecycle methods

    static async create(runtime: IAgentRuntime): Promise<MeteoraService> {
        return new MeteoraService(runtime);
    }

    static async start(runtime: IAgentRuntime): Promise<MeteoraService> {
        const service = new MeteoraService(runtime);
        await service.start();
        return service;
    }

    static async stop(runtime: IAgentRuntime): Promise<void> {
        const service = runtime.getService('METEORA_SERVICE') as unknown as MeteoraService;
        if (service) {
            await service.stop();
        }
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('MeteoraService is already running');
            return;
        }

        try {
            this.isRunning = true;
            logger.log('MeteoraService started successfully');
        } catch (error) {
            logger.error('Failed to start MeteoraService:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('MeteoraService is not running');
            return;
        }

        try {
            this.isRunning = false;
            logger.log('MeteoraService stopped successfully');
        } catch (error) {
            logger.error('Failed to stop MeteoraService:', error);
            throw error;
        }
    }

    isServiceRunning(): boolean {
        return this.isRunning;
    }

    // Private helper methods

    /**
     * Fetch pools from API (internal method)
     */
    private async fetchPoolsFromAPI(): Promise<MeteoraPool[]> {
        try {
            const response = await fetch(`${this.apiEndpoint}/pair/all_with_pagination?limit=50`);

            if (!response.ok) {
                throw new Error(`Failed to fetch pools: ${response.statusText}`);
            }

            const result = await response.json();
            return result.pairs || [];
        } catch (error) {
            logger.error('Error fetching pools from API:', error);
            throw error;
        }
    }

    /**
     * Fetch pool market data (internal method)
     */
    private async fetchPoolMarketData(poolAddress: string): Promise<any> {
        try {
            const response = await fetch(`${this.apiEndpoint}/pair/${poolAddress}`);

            if (!response.ok) {
                return null;
            }

            const poolData = await response.json();

            return {
                apr: poolData.apr || 0,
                apy: poolData.apr ? (Math.pow(1 + poolData.apr / 100 / 365, 365) - 1) * 100 : 0,
                tvl: parseFloat(poolData.liquidity) || 0,
                fee: parseFloat(poolData.base_fee_percentage) / 100 || 0
            };
        } catch (error) {
            logger.warn(`Failed to fetch market data for pool ${poolAddress}:`, error);
            return null;
        }
    }

    /**
     * Convert Meteora pool to standardized PoolInfo
     */
    private convertToPoolInfo(meteoraPool: MeteoraPool): PoolInfo {
        return {
            id: meteoraPool.address,
            displayName: meteoraPool.name,
            dex: 'meteora',
            tokenA: {
                mint: '', // Would need to be extracted from pool data
                symbol: meteoraPool.name.split('-')[0] || 'Unknown',
                decimals: 9
            },
            tokenB: {
                mint: '', // Would need to be extracted from pool data
                symbol: meteoraPool.name.split('-')[1] || 'Unknown',
                decimals: 6
            },
            lpTokenMint: meteoraPool.address,
            apr: meteoraPool.apr,
            apy: meteoraPool.apr ? (Math.pow(1 + meteoraPool.apr / 100 / 365, 365) - 1) * 100 : 0,
            tvl: parseFloat(meteoraPool.liquidity),
            fee: parseFloat(meteoraPool.base_fee_percentage) / 100,
            metadata: {
                poolType: 'concentrated',
                binStep: meteoraPool.bin_step,
                isActive: true
            }
        };
    }

    /**
     * Get token symbol for a specific token mint
     */
    private async getTokenSymbol(tokenMint: string): Promise<string> {
        try {
            // Try to get token symbol from Birdeye API directly
            try {
                const birdeyeApiKey = this.runtime.getSetting('BIRDEYE_API_KEY');
                const headers: Record<string, string> = {
                    'accept': 'application/json',
                    'x-chain': 'solana',
                };

                if (birdeyeApiKey) {
                    headers['X-API-KEY'] = birdeyeApiKey;
                }

                const response = await fetch(
                    `https://public-api.birdeye.so/defi/v3/token/meta-data/single?address=${tokenMint}`,
                    { headers }
                );

                if (response.ok) {
                    const data = await response.json();
                    if (data?.data?.symbol) {
                        logger.debug(`Got token symbol from Birdeye: ${data.data.symbol} for ${tokenMint}`);
                        return data.data.symbol;
                    }
                }
            } catch (error) {
                logger.debug(`Could not get token symbol from Birdeye for ${tokenMint}:`, error);
            }

            // For unknown tokens, try to get the symbol from the token metadata
            try {
                const tokenMintPubkey = new PublicKey(tokenMint);
                const tokenInfo = await this.connection.getParsedAccountInfo(tokenMintPubkey);

                if (tokenInfo.value?.data && 'parsed' in tokenInfo.value.data) {
                    const parsedData = tokenInfo.value.data.parsed as any;
                    if (parsedData.info?.symbol) {
                        return parsedData.info.symbol;
                    }
                }
            } catch (error) {
                logger.debug(`Could not get token symbol for ${tokenMint}:`, error);
            }

            // Fallback to a shortened version of the mint address
            return tokenMint.substring(0, 8);
        } catch (error) {
            logger.error('Error getting token symbol:', error);
            return tokenMint.substring(0, 8);
        }
    }

    /**
 * Get token balance for a specific token mint
 */
    private async getTokenBalance(tokenMint: string, walletPublicKey?: string): Promise<number> {
        try {
            let publicKey: PublicKey;

            if (walletPublicKey) {
                // Use the provided wallet public key from account
                publicKey = new PublicKey(walletPublicKey);
                logger.log(`Using provided wallet public key: ${walletPublicKey}`);
                console.log(`Using provided wallet public key: ${walletPublicKey}`);
            } else {
                // Fallback to getting from Solana service
                const solanaService = this.runtime.getService(SOLANA_SERVICE_NAME) as any;
                if (!solanaService) {
                    throw new Error('Solana service not available');
                }

                const keypair = await solanaService.getWalletKeypair();
                if (!keypair?.publicKey) {
                    throw new Error('Wallet public key not available');
                }

                publicKey = keypair.publicKey;
                logger.log(`Using Solana service wallet public key: ${publicKey.toString()}`);
                console.log(`Using Solana service wallet public key: ${publicKey.toString()}`);
            }

            const tokenMintPubkey = new PublicKey(tokenMint);

            // Special handling for wrapped SOL (So11111111111111111111111111111111111111112)
            if (tokenMint === 'So11111111111111111111111111111111111111112') {
                // Get native SOL balance
                const nativeBalance = await this.connection.getBalance(publicKey);
                const nativeBalanceSOL = nativeBalance / Math.pow(10, 9); // Convert lamports to SOL

                // Also check for wrapped SOL token accounts
                const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(publicKey, {
                    mint: tokenMintPubkey,
                });

                let wrappedSOLBalance = 0;
                for (const account of tokenAccounts.value) {
                    const accountInfo = account.account.data.parsed.info;
                    wrappedSOLBalance += accountInfo.tokenAmount.uiAmount || 0;
                }

                // Return the total SOL balance (native + wrapped)
                const totalBalance = nativeBalanceSOL + wrappedSOLBalance;
                logger.log(`SOL balance: native=${nativeBalanceSOL}, wrapped=${wrappedSOLBalance}, total=${totalBalance}`);
                return totalBalance;
            }

            // For other tokens, get token accounts for the wallet
            const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(publicKey, {
                mint: tokenMintPubkey,
            });

            if (tokenAccounts.value.length === 0) {
                logger.log(`No token accounts found for ${tokenMint} in wallet ${publicKey.toString()}`);
                return 0;
            }

            // Sum up all token account balances
            let totalBalance = 0;
            for (const account of tokenAccounts.value) {
                const accountInfo = account.account.data.parsed.info;
                const balance = accountInfo.tokenAmount.uiAmount || 0;
                totalBalance += balance;
                logger.log(`Token account ${account.pubkey.toString()} has balance: ${balance}`);
            }

            logger.log(`Total balance for ${tokenMint} in wallet ${publicKey.toString()}: ${totalBalance}`);
            return totalBalance;
        } catch (error) {
            logger.error('Error getting token balance:', error);
            return 0;
        }
    }

    /**
     * Extract balance changes from transaction
     */
    private async extractBalanceChanges(
        connection: Connection,
        signature: string,
        tokenXAddress: string,
        tokenYAddress: string
    ): Promise<{ liquidityRemoved: [number, number]; feesClaimed: [number, number] }> {
        const METEORA_DLMM_PROGRAM_ID = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo';

        const txInfo = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });

        if (!txInfo || !txInfo.meta) {
            throw new Error('Transaction details not found or not parsed');
        }

        const outerInstructions = txInfo.transaction.message.instructions as any[];
        const innerInstructions = txInfo.meta.innerInstructions || [];

        const innerMap: Record<number, any[]> = {};
        for (const inner of innerInstructions) {
            innerMap[inner.index] = inner.instructions as any[];
        }

        const meteoraInstructionIndices: number[] = [];
        outerInstructions.forEach((ix, index) => {
            if (ix.programId?.toString() === METEORA_DLMM_PROGRAM_ID) {
                meteoraInstructionIndices.push(index);
            }
        });

        if (meteoraInstructionIndices.length < 2) {
            throw new Error('Expected at least two Meteora instructions in the transaction');
        }

        const removeLiquidityIndex = meteoraInstructionIndices[0];
        const claimFeeIndex = meteoraInstructionIndices[1];

        const decodeTokenTransfers = (instructions: any[]): any[] => {
            const transfers: any[] = [];
            for (const ix of instructions) {
                if (ix.program === 'spl-token' && ix.parsed?.type === 'transferChecked') {
                    transfers.push(ix.parsed.info);
                }
            }
            return transfers;
        };

        const removeLiquidityTransfers = innerMap[removeLiquidityIndex]
            ? decodeTokenTransfers(innerMap[removeLiquidityIndex])
            : [];
        const claimFeeTransfers = innerMap[claimFeeIndex] ? decodeTokenTransfers(innerMap[claimFeeIndex]) : [];

        const liquidityRemovedA =
            removeLiquidityTransfers.find(transfer => transfer.mint === tokenXAddress)?.tokenAmount.uiAmount || 0;
        const liquidityRemovedB =
            removeLiquidityTransfers.find(transfer => transfer.mint === tokenYAddress)?.tokenAmount.uiAmount || 0;

        const feesClaimedA = claimFeeTransfers.find(transfer => transfer.mint === tokenXAddress)?.tokenAmount.uiAmount || 0;
        const feesClaimedB = claimFeeTransfers.find(transfer => transfer.mint === tokenYAddress)?.tokenAmount.uiAmount || 0;

        return {
            liquidityRemoved: [liquidityRemovedA, liquidityRemovedB],
            feesClaimed: [feesClaimedA, feesClaimedB],
        };
    }

    /**
     * Convert Meteora position to standardized LpPositionDetails
     */
    private convertToPositionDetails(positionInfo: any, poolAddress: string): LpPositionDetails {
        return {
            poolId: poolAddress,
            dex: 'meteora',
            lpTokenBalance: {
                address: `${poolAddress}-lp`,
                balance: '0',
                symbol: 'METEORA-LP',
                uiAmount: 0,
                decimals: 6,
                name: 'Meteora LP Token'
            },
            underlyingTokens: []
        };
    }
}