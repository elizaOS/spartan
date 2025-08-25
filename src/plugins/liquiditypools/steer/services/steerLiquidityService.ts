import type { IAgentRuntime } from '@elizaos/core';
import { Service, logger } from '@elizaos/core';
import { createPublicClient, createWalletClient, http } from 'viem';
import { mainnet, polygon, arbitrum, optimism } from 'viem/chains';

// Handle missing Steer SDK dependency gracefully
let VaultClient: any = null;
let StakingClient: any = null;
let AMMType: any = null;

try {
    // Try to import Steer SDK - this will fail gracefully if not installed
    const steerModule = require('@steer-finance/sdk');
    VaultClient = steerModule.VaultClient;
    StakingClient = steerModule.StakingClient;
    AMMType = steerModule.AMMType;
} catch (error) {
    logger.warn('Steer SDK not available, using fallback functionality');
}

// Steer Finance constants
const SUPPORTED_CHAINS = {
    1: mainnet,
    137: polygon,
    42161: arbitrum,
    10: optimism
};

// Known token addresses for reference
const KNOWN_TOKENS = {
    '0xA0b86a33E6441b8c4C8C1C1B8c4C8C1C1B8c4C8C1': 'USDC',
    '0x6B175474E89094C44Da98b954EedeAC495271d0F': 'DAI',
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 'WETH',
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': 'WBTC'
};

// SteerResponse interface based on SDK
interface SteerResponse<T> {
    data: T | null;
    status: number;
    success: boolean;
    error?: string;
}

// Interfaces for type safety
interface SteerVault {
    address: string;
    name: string;
    chainId: number;
    token0: string;
    token1: string;
    fee: number;
    tvl: number;
    volume24h: number;
    apy: number;
    isActive: boolean;
    createdAt: string;
    strategyType: string;
    positions?: SteerPosition[];
    poolAddress?: string;
    ammType?: string;
    singleAssetDepositContract?: string;
}

interface SteerPosition {
    type: string;
    range: string;
    liquidity: number;
    feesEarned: number;
    isActive: boolean;
}

interface SteerStakingPool {
    address: string;
    name: string;
    chainId: number;
    stakingToken: string;
    rewardToken: string;
    totalStaked: number;
    totalStakedUSD: number;
    apr: number;
    isActive: boolean;
    rewardRate: number;
    periodFinish: string;
}

interface TokenLiquidityStats {
    tokenIdentifier: string;
    normalizedToken: string;
    tokenName: string;
    timestamp: string;
    vaults: SteerVault[];
    stakingPools: SteerStakingPool[];
    totalTvl: number;
    totalVolume: number;
    apyRange: { min: number; max: number };
    vaultCount: number;
    stakingPoolCount: number;
}

interface ConnectionTestResult {
    connectionTest: boolean;
    supportedChains: number[];
    vaultCount: number;
    stakingPoolCount: number;
    error?: string;
}

/**
 * Steer Finance Liquidity Protocol Service
 * Handles interactions with Steer Finance protocol for specific token queries
 */
export class SteerLiquidityService extends Service {
    private isRunning = false;
    private vaultClients: Map<number, any> = new Map();
    private stakingClients: Map<number, any> = new Map();
    private supportedChains: number[];

    static serviceType = 'STEER_LIQUIDITY_SERVICE';
    static serviceName = 'SteerLiquidityService';
    capabilityDescription = 'Provides detailed access to Steer Finance vaults and staking pools for specific tokens.' as const;

    constructor(runtime: IAgentRuntime) {
        super(runtime);

        // Initialize supported chains
        this.supportedChains = [1, 137, 42161, 10]; // mainnet, polygon, arbitrum, optimism

        // Initialize clients for each supported chain
        this.initializeClients();

        logger.log('SteerLiquidityService initialized with multi-chain support');
        logger.log(`Supported chains: ${this.supportedChains.join(', ')}`);
    }

    /**
     * Initialize Steer clients for all supported chains
     */
    private initializeClients(): void {
        if (!VaultClient || !StakingClient) {
            logger.warn('Steer SDK not available, skipping client initialization');
            return;
        }

        for (const chainId of this.supportedChains) {
            try {
                const chain = SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS];
                if (!chain) continue;

                const publicClient = createPublicClient({
                    chain,
                    transport: http()
                });

                const walletClient = createWalletClient({
                    chain,
                    transport: http()
                });

                // Initialize vault client with proper parameters
                const vaultClient = new VaultClient(publicClient, walletClient, 'production');
                this.vaultClients.set(chainId, vaultClient);

                // Initialize staking client
                const stakingClient = new StakingClient(publicClient, walletClient);
                this.stakingClients.set(chainId, stakingClient);

                logger.log(`Initialized Steer clients for chain ${chainId}`);
            } catch (error) {
                logger.error(`Failed to initialize Steer clients for chain ${chainId}:`, error);
            }
        }
    }

    /**
     * Get token liquidity information from Steer Finance across all supported chains
     */
    async getTokenLiquidityStats(tokenIdentifier: string): Promise<TokenLiquidityStats> {
        try {
            logger.log(`Getting Steer liquidity info for token: ${tokenIdentifier}`);

            // Normalize token identifier
            const normalizedToken = this.normalizeTokenIdentifier(tokenIdentifier);
            const tokenName = this.getTokenName(normalizedToken);

            const allVaults: SteerVault[] = [];
            const allStakingPools: SteerStakingPool[] = [];

            // Fetch data from all supported chains
            for (const chainId of this.supportedChains) {
                try {
                    const chainVaults = await this.getVaultsForToken(chainId, normalizedToken);
                    const chainStakingPools = await this.getStakingPoolsForToken(chainId, normalizedToken);

                    allVaults.push(...chainVaults);
                    allStakingPools.push(...chainStakingPools);

                    logger.log(`Found ${chainVaults.length} vaults and ${chainStakingPools.length} staking pools on chain ${chainId}`);
                } catch (error) {
                    logger.error(`Error fetching data for chain ${chainId}:`, error);
                }
            }

            // Calculate aggregate statistics
            const totalTvl = allVaults.reduce((sum, vault) => sum + vault.tvl, 0);
            const totalVolume = allVaults.reduce((sum, vault) => sum + vault.volume24h, 0);
            const apyValues = allVaults.map(vault => vault.apy).filter(apy => apy > 0);
            const apyRange = {
                min: apyValues.length > 0 ? Math.min(...apyValues) : 0,
                max: apyValues.length > 0 ? Math.max(...apyValues) : 0
            };

            const stats: TokenLiquidityStats = {
                tokenIdentifier,
                normalizedToken,
                tokenName,
                timestamp: new Date().toISOString(),
                vaults: allVaults,
                stakingPools: allStakingPools,
                totalTvl,
                totalVolume,
                apyRange,
                vaultCount: allVaults.length,
                stakingPoolCount: allStakingPools.length
            };

            logger.log(`Found ${stats.vaultCount} vaults and ${stats.stakingPoolCount} staking pools for ${normalizedToken} with total TVL: $${stats.totalTvl.toLocaleString()}`);

            return stats;

        } catch (error) {
            logger.error('Error getting Steer liquidity stats:', error);
            throw new Error(`Failed to get Steer liquidity stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get vaults for a specific token on a specific chain
     */
    private async getVaultsForToken(chainId: number, tokenAddress: string): Promise<SteerVault[]> {
        const vaultClient = this.vaultClients.get(chainId);
        if (!vaultClient) {
            logger.warn(`No vault client available for chain ${chainId}`);
            return [];
        }

        try {
            const vaultsResponse: SteerResponse<any[]> = await vaultClient.getVaults({ chainId });

            if (!vaultsResponse.success || !vaultsResponse.data) {
                logger.warn(`Failed to get vaults for chain ${chainId}: ${vaultsResponse.error || 'Unknown error'}`);
                return [];
            }

            const vaults: SteerVault[] = [];
            const rawVaults = vaultsResponse.data;

            for (const vault of rawVaults) {
                // Check if the vault contains the target token
                if (vault.token0?.toLowerCase() === tokenAddress.toLowerCase() ||
                    vault.token1?.toLowerCase() === tokenAddress.toLowerCase()) {

                    const steerVault: SteerVault = {
                        address: vault.address || '',
                        name: vault.name || `Steer Vault ${vault.address?.slice(0, 8)}...`,
                        chainId,
                        token0: vault.token0 || '',
                        token1: vault.token1 || '',
                        fee: vault.fee || 0,
                        tvl: vault.tvl || 0,
                        volume24h: vault.volume24h || 0,
                        apy: vault.apy || 0,
                        isActive: vault.isActive || false,
                        createdAt: vault.createdAt || new Date().toISOString(),
                        strategyType: vault.strategyType || 'Unknown',
                        positions: [],
                        poolAddress: vault.poolAddress,
                        ammType: vault.ammType,
                        singleAssetDepositContract: vault.singleAssetDepositContract
                    };

                    vaults.push(steerVault);
                }
            }

            return vaults;

        } catch (error) {
            logger.error(`Error getting vaults for token ${tokenAddress} on chain ${chainId}:`, error);
            return [];
        }
    }

    /**
     * Get staking pools for a specific token on a specific chain
     */
    private async getStakingPoolsForToken(chainId: number, tokenAddress: string): Promise<SteerStakingPool[]> {
        const stakingClient = this.stakingClients.get(chainId);
        if (!stakingClient) {
            logger.warn(`No staking client available for chain ${chainId}`);
            return [];
        }

        try {
            const poolsResponse: SteerResponse<any[]> = await stakingClient.getStakingPools(chainId);

            if (!poolsResponse.success || !poolsResponse.data) {
                logger.warn(`Failed to get staking pools for chain ${chainId}: ${poolsResponse.error || 'Unknown error'}`);
                return [];
            }

            const stakingPools: SteerStakingPool[] = [];
            const rawPools = poolsResponse.data;

            for (const pool of rawPools) {
                // Check if the pool stakes the target token
                if (pool.stakingToken?.toLowerCase() === tokenAddress.toLowerCase() ||
                    pool.rewardToken?.toLowerCase() === tokenAddress.toLowerCase()) {

                    const steerPool: SteerStakingPool = {
                        address: pool.address || '',
                        name: pool.name || `Steer Staking Pool ${pool.address?.slice(0, 8)}...`,
                        chainId,
                        stakingToken: pool.stakingToken || '',
                        rewardToken: pool.rewardToken || '',
                        totalStaked: pool.totalStaked || 0,
                        totalStakedUSD: pool.totalStakedUSD || 0,
                        apr: pool.apr || 0,
                        isActive: pool.isActive || false,
                        rewardRate: pool.rewardRate || 0,
                        periodFinish: pool.periodFinish || new Date().toISOString()
                    };

                    stakingPools.push(steerPool);
                }
            }

            return stakingPools;

        } catch (error) {
            logger.error(`Error getting staking pools for token ${tokenAddress} on chain ${chainId}:`, error);
            return [];
        }
    }

    /**
     * Test connection to Steer Finance services
     */
    async testConnection(): Promise<ConnectionTestResult> {
        try {
            logger.log('Testing Steer Finance connection...');

            let totalVaultCount = 0;
            let totalStakingPoolCount = 0;
            const connectionErrors: string[] = [];

            for (const chainId of this.supportedChains) {
                try {
                    const vaultClient = this.vaultClients.get(chainId);
                    const stakingClient = this.stakingClients.get(chainId);

                    if (vaultClient) {
                        const vaultsResponse = await vaultClient.getVaults({ chainId });
                        if (vaultsResponse.success && vaultsResponse.data) {
                            totalVaultCount += vaultsResponse.data.length;
                        }
                    }

                    if (stakingClient) {
                        const poolsResponse = await stakingClient.getStakingPools(chainId);
                        if (poolsResponse.success && poolsResponse.data) {
                            totalStakingPoolCount += poolsResponse.data.length;
                        }
                    }

                } catch (error) {
                    const errorMsg = `Chain ${chainId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    connectionErrors.push(errorMsg);
                    logger.error(`Connection test failed for chain ${chainId}:`, error);
                }
            }

            const result: ConnectionTestResult = {
                connectionTest: connectionErrors.length === 0,
                supportedChains: this.supportedChains,
                vaultCount: totalVaultCount,
                stakingPoolCount: totalStakingPoolCount,
                error: connectionErrors.length > 0 ? connectionErrors.join('; ') : undefined
            };

            logger.log(`Steer connection test completed. Vaults: ${totalVaultCount}, Staking Pools: ${totalStakingPoolCount}`);
            return result;

        } catch (error) {
            logger.error('Error testing Steer connection:', error);
            return {
                connectionTest: false,
                supportedChains: this.supportedChains,
                vaultCount: 0,
                stakingPoolCount: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Normalize token identifier (handle different formats)
     */
    private normalizeTokenIdentifier(tokenIdentifier: string): string {
        // Remove common prefixes and normalize
        let normalized = tokenIdentifier.trim();

        // Handle Solana-style addresses (base58)
        if (normalized.length === 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(normalized)) {
            // This is likely a Solana address, but Steer is EVM-based
            logger.warn(`Token ${normalized} appears to be a Solana address, but Steer Finance is EVM-based`);
        }

        // Handle Ethereum-style addresses (0x...)
        if (normalized.startsWith('0x')) {
            return normalized.toLowerCase();
        }

        // Handle symbol-based lookups
        const knownToken = KNOWN_TOKENS[normalized as keyof typeof KNOWN_TOKENS];
        if (knownToken) {
            logger.log(`Resolved token symbol ${normalized} to ${knownToken}`);
            return normalized;
        }

        return normalized;
    }

    /**
     * Get token name from identifier
     */
    private getTokenName(tokenIdentifier: string): string {
        // Check known tokens first
        const knownToken = KNOWN_TOKENS[tokenIdentifier as keyof typeof KNOWN_TOKENS];
        if (knownToken) {
            return knownToken;
        }

        // For unknown tokens, return a formatted version
        if (tokenIdentifier.startsWith('0x')) {
            return `Token ${tokenIdentifier.slice(0, 8)}...${tokenIdentifier.slice(-6)}`;
        }

        return tokenIdentifier;
    }

    // Service lifecycle methods

    static async create(runtime: IAgentRuntime): Promise<SteerLiquidityService> {
        return new SteerLiquidityService(runtime);
    }

    static async start(runtime: IAgentRuntime): Promise<SteerLiquidityService> {
        const service = new SteerLiquidityService(runtime);
        await service.start();
        return service;
    }

    static async stop(runtime: IAgentRuntime): Promise<void> {
        const service = runtime.getService('STEER_LIQUIDITY_SERVICE') as unknown as SteerLiquidityService;
        if (service) {
            await service.stop();
        }
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('SteerLiquidityService is already running');
            return;
        }

        try {
            this.isRunning = true;
            logger.log('SteerLiquidityService started successfully');
        } catch (error) {
            logger.error('Failed to start SteerLiquidityService:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('SteerLiquidityService is not running');
            return;
        }

        try {
            this.isRunning = false;
            logger.log('SteerLiquidityService stopped successfully');
        } catch (error) {
            logger.error('Failed to stop SteerLiquidityService:', error);
            throw error;
        }
    }

    isServiceRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Get vault details by address
     */
    async getVaultDetails(vaultAddress: string, chainId: number): Promise<SteerVault | null> {
        try {
            const vaultClient = this.vaultClients.get(chainId);
            if (!vaultClient) {
                logger.warn(`No vault client available for chain ${chainId}`);
                return null;
            }

            // Get all vaults and find the specific one
            const vaultsResponse: SteerResponse<any[]> = await vaultClient.getVaults({ chainId });

            if (!vaultsResponse.success || !vaultsResponse.data) {
                logger.warn(`Failed to get vaults for chain ${chainId}: ${vaultsResponse.error || 'Unknown error'}`);
                return null;
            }

            const vault = vaultsResponse.data.find(v => v.address?.toLowerCase() === vaultAddress.toLowerCase());

            if (!vault) {
                logger.warn(`Vault ${vaultAddress} not found on chain ${chainId}`);
                return null;
            }

            return {
                address: vault.address || '',
                name: vault.name || `Steer Vault ${vault.address?.slice(0, 8)}...`,
                chainId,
                token0: vault.token0 || '',
                token1: vault.token1 || '',
                fee: vault.fee || 0,
                tvl: vault.tvl || 0,
                volume24h: vault.volume24h || 0,
                apy: vault.apy || 0,
                isActive: vault.isActive || false,
                createdAt: vault.createdAt || new Date().toISOString(),
                strategyType: vault.strategyType || 'Unknown',
                positions: [],
                poolAddress: vault.poolAddress,
                ammType: vault.ammType,
                singleAssetDepositContract: vault.singleAssetDepositContract
            };

        } catch (error) {
            logger.error(`Error getting vault details for ${vaultAddress} on chain ${chainId}:`, error);
            return null;
        }
    }

    /**
     * Get staking pool details by address
     */
    async getStakingPoolDetails(poolAddress: string, chainId: number): Promise<SteerStakingPool | null> {
        try {
            const stakingClient = this.stakingClients.get(chainId);
            if (!stakingClient) {
                logger.warn(`No staking client available for chain ${chainId}`);
                return null;
            }

            // Get all staking pools and find the specific one
            const poolsResponse: SteerResponse<any[]> = await stakingClient.getStakingPools(chainId);

            if (!poolsResponse.success || !poolsResponse.data) {
                logger.warn(`Failed to get staking pools for chain ${chainId}: ${poolsResponse.error || 'Unknown error'}`);
                return null;
            }

            const pool = poolsResponse.data.find(p => p.address?.toLowerCase() === poolAddress.toLowerCase());

            if (!pool) {
                logger.warn(`Staking pool ${poolAddress} not found on chain ${chainId}`);
                return null;
            }

            return {
                address: pool.address || '',
                name: pool.name || `Steer Staking Pool ${pool.address?.slice(0, 8)}...`,
                chainId,
                stakingToken: pool.stakingToken || '',
                rewardToken: pool.rewardToken || '',
                totalStaked: pool.totalStaked || 0,
                totalStakedUSD: pool.totalStakedUSD || 0,
                apr: pool.apr || 0,
                isActive: pool.isActive || false,
                rewardRate: pool.rewardRate || 0,
                periodFinish: pool.periodFinish || new Date().toISOString()
            };

        } catch (error) {
            logger.error(`Error getting staking pool details for ${poolAddress} on chain ${chainId}:`, error);
            return null;
        }
    }

    /**
     * Preview single-asset deposit for a vault
     */
    async previewSingleAssetDeposit(
        vaultAddress: string,
        chainId: number,
        assets: bigint,
        isToken0: boolean,
        depositSlippagePercent: bigint = 5n,
        swapSlippageBP: number = 500
    ): Promise<any> {
        try {
            const vaultClient = this.vaultClients.get(chainId);
            if (!vaultClient) {
                throw new Error(`No vault client available for chain ${chainId}`);
            }

            if (!AMMType) {
                throw new Error('Steer SDK AMMType not available');
            }

            // Get vault details to get the pool address and single asset deposit contract
            const vault = await this.getVaultDetails(vaultAddress, chainId);
            if (!vault) {
                throw new Error(`Vault ${vaultAddress} not found on chain ${chainId}`);
            }

            if (!vault.poolAddress || !vault.singleAssetDepositContract) {
                throw new Error(`Vault ${vaultAddress} does not support single-asset deposits`);
            }

            // Preview the single-asset deposit
            const preview = await vaultClient.previewSingleAssetDeposit({
                assets,
                receiver: '0x0000000000000000000000000000000000000000', // Placeholder
                vault: vaultAddress,
                isToken0,
                depositSlippagePercent,
                swapSlippageBP,
                ammType: AMMType.UniswapV3,
                singleAssetDepositContract: vault.singleAssetDepositContract
            }, vault.poolAddress);

            return preview;

        } catch (error) {
            logger.error(`Error previewing single-asset deposit for vault ${vaultAddress}:`, error);
            throw error;
        }
    }

    /**
     * Execute single-asset deposit for a vault
     */
    async executeSingleAssetDeposit(
        vaultAddress: string,
        chainId: number,
        assets: bigint,
        receiver: string,
        isToken0: boolean,
        depositSlippagePercent: bigint = 5n,
        swapSlippageBP: number = 500
    ): Promise<any> {
        try {
            const vaultClient = this.vaultClients.get(chainId);
            if (!vaultClient) {
                throw new Error(`No vault client available for chain ${chainId}`);
            }

            if (!AMMType) {
                throw new Error('Steer SDK AMMType not available');
            }

            // Get vault details to get the single asset deposit contract
            const vault = await this.getVaultDetails(vaultAddress, chainId);
            if (!vault) {
                throw new Error(`Vault ${vaultAddress} not found on chain ${chainId}`);
            }

            if (!vault.singleAssetDepositContract) {
                throw new Error(`Vault ${vaultAddress} does not support single-asset deposits`);
            }

            // Execute the single-asset deposit
            const result = await vaultClient.singleAssetDeposit({
                assets,
                receiver,
                vault: vaultAddress,
                isToken0,
                depositSlippagePercent,
                swapSlippageBP,
                ammType: AMMType.UniswapV3,
                singleAssetDepositContract: vault.singleAssetDepositContract
            });

            return result;

        } catch (error) {
            logger.error(`Error executing single-asset deposit for vault ${vaultAddress}:`, error);
            throw error;
        }
    }

    /**
     * Get earned rewards for a staking pool
     */
    async getEarnedRewards(poolAddress: string, accountAddress: string, chainId: number): Promise<any> {
        try {
            const stakingClient = this.stakingClients.get(chainId);
            if (!stakingClient) {
                throw new Error(`No staking client available for chain ${chainId}`);
            }

            const earned = await stakingClient.earned(poolAddress, accountAddress);
            return earned;

        } catch (error) {
            logger.error(`Error getting earned rewards for pool ${poolAddress}:`, error);
            throw error;
        }
    }

    /**
     * Get total supply of a staking pool
     */
    async getStakingPoolTotalSupply(poolAddress: string, chainId: number): Promise<any> {
        try {
            const stakingClient = this.stakingClients.get(chainId);
            if (!stakingClient) {
                throw new Error(`No staking client available for chain ${chainId}`);
            }

            const totalSupply = await stakingClient.totalSupply(poolAddress);
            return totalSupply;

        } catch (error) {
            logger.error(`Error getting total supply for pool ${poolAddress}:`, error);
            throw error;
        }
    }

    /**
     * Get balance of a user in a staking pool
     */
    async getStakingPoolBalance(poolAddress: string, accountAddress: string, chainId: number): Promise<any> {
        try {
            const stakingClient = this.stakingClients.get(chainId);
            if (!stakingClient) {
                throw new Error(`No staking client available for chain ${chainId}`);
            }

            const balance = await stakingClient.balanceOf(poolAddress, accountAddress);
            return balance;

        } catch (error) {
            logger.error(`Error getting balance for pool ${poolAddress}:`, error);
            throw error;
        }
    }
}
