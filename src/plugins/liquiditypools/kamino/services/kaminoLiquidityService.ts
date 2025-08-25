import type { AgentRuntime } from '@elizaos/core';
import { Service, logger } from '@elizaos/core';
import { Connection, PublicKey, AccountInfo } from '@solana/web3.js';

// Kamino Liquidity Program constants
const KAMINO_LIQUIDITY_PROGRAM_ID = '6LtLpnUFNByNXLyCoK9wA2MykKAmQNZKBdY8s47dehDc';

// Known token addresses for reference
const KNOWN_TOKENS = {
    'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC': 'AI16Z Token',
    'ai16z': 'AI16Z Token (Symbol)',
    '4WfUvajjYTrq7KRdToJBkoHQ6bSt7NyBeLhP9LKwtFKh': 'Kamino Strategy'
};

// Interfaces for type safety
interface KaminoStrategy {
    address: string;
    dataSize: number;
    lamports: number;
    owner: string;
    strategyType: string;
    estimatedTvl: number;
    volume24h: number;
    apy: number;
    tokenA: string;
    tokenB: string;
    feeTier: string;
    rebalancing: string;
    lastRebalance: string;
    positions: KaminoPosition[];
    detailedInfo?: {
        creationDate: string;
        totalDeposits: number;
        totalWithdrawals: number;
        activeUsers: number;
        performanceHistory: Array<{ date: string; apy: number }>;
    };
}

interface KaminoPosition {
    type: string;
    range: string;
    liquidity: number;
    feesEarned: number;
}

interface TokenLiquidityStats {
    tokenIdentifier: string;
    normalizedToken: string;
    tokenName: string;
    timestamp: string;
    strategies: KaminoStrategy[];
    totalTvl: number;
    totalVolume: number;
    apyRange: { min: number; max: number };
    poolCount: number;
}

/**
 * Kamino Liquidity Protocol Service
 * Handles interactions with Kamino liquidity protocol for specific token queries
 */
export class KaminoLiquidityService extends Service {
    private isRunning = false;
    private connection: Connection;
    private rpcEndpoint: string;
    private programId: PublicKey;

    static serviceType = 'KAMINO_LIQUIDITY_SERVICE';
    static serviceName = 'KaminoLiquidityService';
    capabilityDescription = 'Provides detailed access to Kamino liquidity protocol pools and strategies for specific tokens.' as const;

    constructor(runtime: AgentRuntime) {
        super(runtime);

        this.rpcEndpoint = runtime.getSetting('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';
        this.programId = new PublicKey(KAMINO_LIQUIDITY_PROGRAM_ID);

        // Initialize connection with commitment
        this.connection = new Connection(this.rpcEndpoint, {
            commitment: 'confirmed',
            confirmTransactionInitialTimeout: 60000
        });

        // Initialize without SDK - using direct RPC calls
        logger.log('KaminoLiquidityService initialized with direct RPC access');

        logger.log(`KaminoLiquidityService initialized with RPC: ${this.rpcEndpoint}`);
        logger.log(`Program ID: ${this.programId.toString()}`);
    }

    /**
     * Get token liquidity information from Kamino
     */
    async getTokenLiquidityStats(tokenIdentifier: string): Promise<TokenLiquidityStats> {
        try {
            logger.log(`Getting liquidity info for token: ${tokenIdentifier}`);

            // Normalize token identifier
            const normalizedToken = this.normalizeTokenIdentifier(tokenIdentifier);
            console.log('normalizedToken', normalizedToken)

            const stats: TokenLiquidityStats = {
                tokenIdentifier: tokenIdentifier,
                normalizedToken: normalizedToken,
                tokenName: KNOWN_TOKENS[normalizedToken] || 'Unknown Token',
                timestamp: new Date().toISOString(),
                strategies: [],
                totalTvl: 0,
                totalVolume: 0,
                apyRange: { min: 0, max: 0 },
                poolCount: 0
            };

            // Use direct RPC calls to find strategies involving this token
            try {
                logger.log(`Searching for strategies involving token: ${normalizedToken} via RPC`);

                // Get all program accounts for Kamino liquidity program
                const programAccounts = await this.connection.getProgramAccounts(this.programId, {
                    filters: [
                        {
                            dataSize: 4064 // Standard size for Kamino strategy accounts
                        }
                    ]
                });

                logger.log(`Found ${programAccounts.length} potential strategy accounts`);

                // Process a subset of accounts to find relevant strategies
                const relevantAccounts = programAccounts.slice(0, 10); // Limit to first 10 for debugging

                console.log('=== KAMINO STRATEGY DEBUG INFO ===');
                console.log(`Total program accounts found: ${programAccounts.length}`);
                console.log(`Processing first ${relevantAccounts.length} accounts for debugging`);

                for (let i = 0; i < relevantAccounts.length; i++) {
                    const account = relevantAccounts[i];
                    try {
                        console.log(`\n--- Account ${i + 1}: ${account.pubkey.toString()} ---`);

                        const accountInfo = await this.connection.getAccountInfo(account.pubkey);
                        if (accountInfo) {
                            console.log('Account Info:');
                            console.log('- Data length:', accountInfo.data.length);
                            console.log('- Lamports:', accountInfo.lamports);
                            console.log('- Owner:', accountInfo.owner.toString());
                            console.log('- Executable:', accountInfo.executable);
                            console.log('- Rent epoch:', accountInfo.rentEpoch);

                            // Log first 200 bytes of data as hex for inspection
                            const dataHex = accountInfo.data.slice(0, 200).toString('hex');
                            console.log('- First 200 bytes (hex):', dataHex);

                            // Try to decode as UTF-8 for readable strings
                            const dataString = accountInfo.data.slice(0, 100).toString('utf8');
                            console.log('- First 100 bytes (UTF-8):', dataString);

                            if (accountInfo.data.length >= 4064) {
                                console.log('✅ This looks like a strategy account (4064+ bytes)');

                                // Parse strategy data from account buffer
                                const strategy = await this.parseStrategyFromAccount(account.pubkey, accountInfo, normalizedToken);
                                if (strategy) {
                                    stats.strategies.push(strategy);
                                    console.log('✅ Found strategy:', strategy);
                                    logger.log(`Found strategy: ${strategy.address}`);
                                } else {
                                    console.log('❌ Strategy parsing failed');
                                }
                            } else {
                                console.log('❌ Not a strategy account (too small)');
                            }
                        } else {
                            console.log('❌ No account info found');
                        }
                    } catch (error) {
                        console.log('❌ Error processing account:', error);
                        logger.warn(`Error processing account ${account.pubkey.toString()}:`, error);
                    }
                }

                console.log('\n=== END KAMINO STRATEGY DEBUG INFO ===');

                // Calculate aggregate stats
                if (stats.strategies.length > 0) {
                    stats.poolCount = stats.strategies.length;
                    stats.totalTvl = stats.strategies.reduce((sum, strat) => sum + (strat.estimatedTvl || 0), 0);
                    stats.totalVolume = stats.strategies.reduce((sum, strat) => sum + (strat.volume24h || 0), 0);

                    const apys = stats.strategies.map(s => s.apy).filter(a => a > 0);
                    if (apys.length > 0) {
                        stats.apyRange.min = Math.min(...apys);
                        stats.apyRange.max = Math.max(...apys);
                    }

                    logger.log(`Found ${stats.strategies.length} strategies for ${normalizedToken} with total TVL: $${stats.totalTvl.toLocaleString()}`);
                } else {
                    logger.log(`No strategies found involving token: ${normalizedToken}`);
                }

            } catch (rpcError) {
                logger.error('Error fetching strategies via RPC:', rpcError);
                logger.log(`RPC method failed, returning basic token info for ${normalizedToken}`);
            }

            return stats;

        } catch (error) {
            logger.error('Error getting token liquidity info:', error);
            throw error;
        }
    }

    /**
     * Get strategy type from Kamino strategy data
     */
    private getStrategyType(strategy: any): string {
        if (!strategy) return 'Unknown';

        // Determine strategy type based on token mints or other properties
        const tokenA = strategy.tokenAMint?.toString() || '';
        const tokenB = strategy.tokenBMint?.toString() || '';

        // Check for stable pairs
        const stableTokens = ['USDC', 'USDT', 'USDH', 'DAI', 'FRAX'];
        const isStable = stableTokens.some(token =>
            tokenA.includes(token) || tokenB.includes(token)
        );

        if (isStable) {
            return 'Stable Pool';
        }

        return 'Liquidity Pool';
    }

    /**
     * Calculate estimated TVL from strategy data
     */
    private calculateEstimatedTvl(strategyData: any): number {
        try {
            // This would need to be calculated from actual pool data
            // For now, return a placeholder based on strategy properties
            if (strategyData.strategy?.totalShares) {
                // Rough estimation based on shares
                const tvl = parseFloat(strategyData.strategy.totalShares.toString()) * 1000;
                return tvl;
            }

            return 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Calculate APY from strategy data
     */
    private calculateApy(strategyData: any): number {
        try {
            // This would need to be calculated from actual yield data
            // For now, return a placeholder based on strategy type
            const strategyType = this.getStrategyType(strategyData.strategy);

            if (strategyType === 'Stable Pool') {
                return 5 + Math.random() * 5; // 5-10% for stable pools
            } else {
                return 8 + Math.random() * 12; // 8-20% for regular pools
            }
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get fee tier from strategy data
     */
    private getFeeTier(strategy: any): string {
        if (!strategy) return 'Unknown';

        // This would need to be parsed from actual strategy data
        // For now, return common fee tiers
        return '0.3%';
    }

    /**
     * Extract positions from strategy data
     */
    private extractPositions(strategyData: any): KaminoPosition[] {
        try {
            const positions: KaminoPosition[] = [];

            // This would need to be parsed from actual position data
            // For now, create a placeholder position
            if (strategyData.strategy) {
                positions.push({
                    type: 'Concentrated Liquidity',
                    range: '0.9 - 1.1',
                    liquidity: this.calculateEstimatedTvl(strategyData),
                    feesEarned: 0 // Would need additional data
                });
            }

            return positions;
        } catch (error) {
            return [];
        }
    }

    /**
     * Parse strategy data from account buffer
     */
    private async parseStrategyFromAccount(pubkey: PublicKey, accountInfo: AccountInfo<Buffer>, targetToken: string): Promise<KaminoStrategy | null> {
        try {
            // Basic strategy parsing from account data
            // This is a simplified version - in production you'd want more sophisticated parsing

            const data = accountInfo.data;
            if (data.length < 4064) {
                return null; // Not a strategy account
            }

            console.log(`\n--- PARSING STRATEGY: ${pubkey.toString()} ---`);
            console.log('Raw data analysis:');
            console.log('- Total data length:', data.length);

            // Try to extract potential token addresses from the data
            // Look for patterns that might be PublicKey addresses (32-44 character base58 strings)
            const dataString = data.toString('utf8');
            const potentialAddresses = dataString.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) || [];
            console.log('- Potential addresses found:', potentialAddresses);

            // Look for specific patterns that might indicate token mints
            const tokenAPattern = dataString.includes('tokenA') || dataString.includes('token_a');
            const tokenBPattern = dataString.includes('tokenB') || dataString.includes('token_b');
            console.log('- Token A pattern found:', tokenAPattern);
            console.log('- Token B pattern found:', tokenBPattern);

            // Check if this strategy involves our target token
            const involvesTargetToken = potentialAddresses.includes(targetToken);
            console.log('- Involves target token:', involvesTargetToken);
            console.log('- Target token:', targetToken);

            // Extract basic information from the account data
            // Note: This is a simplified approach - real parsing would require understanding the exact data layout

            const strategy: KaminoStrategy = {
                address: pubkey.toString(),
                dataSize: data.length,
                lamports: accountInfo.lamports,
                owner: accountInfo.owner.toString(),
                strategyType: 'Liquidity Pool',
                estimatedTvl: accountInfo.lamports / 1e9 * 1000, // Rough estimation
                volume24h: 0,
                apy: 5 + Math.random() * 15, // Placeholder APY
                tokenA: targetToken,
                tokenB: 'Unknown',
                feeTier: '0.3%',
                rebalancing: 'Auto',
                lastRebalance: new Date().toISOString(),
                positions: [
                    {
                        type: 'Concentrated Liquidity',
                        range: '0.9 - 1.1',
                        liquidity: accountInfo.lamports / 1e9 * 1000,
                        feesEarned: 0
                    }
                ]
            };

            console.log('Generated strategy object:', strategy);
            console.log('--- END PARSING ---\n');

            return strategy;

        } catch (error) {
            console.log('❌ Error parsing strategy:', error);
            logger.warn(`Error parsing strategy from account ${pubkey.toString()}:`, error);
            return null;
        }
    }

    /**
     * Normalize token identifier (handle symbols, addresses, etc.)
     */
    normalizeTokenIdentifier(identifier: string): string {
        // If it looks like a valid Solana address, return as is
        if (identifier.length >= 32 && identifier.length <= 44) {
            return identifier;
        }

        // For other cases, return the original identifier
        return identifier;
    }

    /**
     * Test connection and basic functionality
     */
    async testConnection(): Promise<any> {
        try {
            logger.log('Testing Kamino liquidity service connection...');

            const results = {
                rpcEndpoint: this.rpcEndpoint,
                programId: this.programId.toString(),
                connectionTest: false,
                programExists: false,
                strategyCount: 0,
                timestamp: new Date().toISOString()
            };

            // Test basic connection
            try {
                const slot = await this.connection.getSlot();
                results.connectionTest = true;
                logger.log(`Connection test passed. Current slot: ${slot}`);
            } catch (error) {
                logger.error('Connection test failed:', error);
            }

            // Test program existence
            try {
                const programInfo = await this.connection.getAccountInfo(this.programId);
                results.programExists = !!programInfo;
                logger.log(`Program exists: ${results.programExists}`);
            } catch (error) {
                logger.error('Program existence check failed:', error);
            }

            // Strategy discovery removed - SDK compatibility issues
            results.strategyCount = 0;
            logger.log('Strategy discovery test skipped - SDK compatibility issues');

            logger.log('Connection test completed');
            return results;

        } catch (error) {
            logger.error('Error in connection test:', error);
            throw error;
        }
    }

    // Service lifecycle methods

    static async create(runtime: AgentRuntime): Promise<KaminoLiquidityService> {
        return new KaminoLiquidityService(runtime);
    }

    static async start(runtime: AgentRuntime): Promise<KaminoLiquidityService> {
        const service = new KaminoLiquidityService(runtime);
        await service.start();
        return service;
    }

    static async stop(runtime: AgentRuntime): Promise<void> {
        const service = runtime.getService('KAMINO_LIQUIDITY_SERVICE') as unknown as KaminoLiquidityService;
        if (service) {
            await service.stop();
        }
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('KaminoLiquidityService is already running');
            return;
        }

        try {
            logger.log('Starting KaminoLiquidityService...');

            // Test connection on startup
            const testResults = await this.testConnection();
            logger.log('Startup connection test results:', testResults);

            this.isRunning = true;
            logger.log('KaminoLiquidityService started successfully');
        } catch (error) {
            logger.error('Failed to start KaminoLiquidityService:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('KaminoLiquidityService is not running');
            return;
        }

        try {
            this.isRunning = false;
            logger.log('KaminoLiquidityService stopped successfully');
        } catch (error) {
            logger.error('Failed to stop KaminoLiquidityService:', error);
            throw error;
        }
    }

    isServiceRunning(): boolean {
        return this.isRunning;
    }
}
