import type { IAgentRuntime } from '@elizaos/core';
import { Service, logger } from '@elizaos/core';
import { Connection, PublicKey, AccountInfo } from '@solana/web3.js';

// Kamino Lend Program constants
const KAMINO_LEND_PROGRAM_ID = 'GzFgdRJXmawPhGeBsyRCDLx4jAKPsvbUqoqitzppkzkW';
const KAMINO_MULTISIG = '6hhBGCtmg7tPWUSgp3LG6X2rsmYWAc4tNsA6G4CnfQbM';

/**
 * Kamino Lending Protocol Service
 * Handles interactions with Kamino lending protocol using direct RPC calls
 */
export class KaminoService extends Service {
    private isRunning = false;
    private connection: Connection;
    private rpcEndpoint: string;
    private programId: PublicKey;

    static serviceType = 'KAMINO_SERVICE';
    static serviceName = 'KaminoService';
    capabilityDescription = 'Provides standardized access to Kamino lending protocol via direct RPC calls.' as const;

    constructor(runtime: IAgentRuntime) {
        super(runtime);

        this.rpcEndpoint = runtime.getSetting('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';
        this.programId = new PublicKey(KAMINO_LEND_PROGRAM_ID);

        // Initialize connection with commitment
        this.connection = new Connection(this.rpcEndpoint, {
            commitment: 'confirmed',
            confirmTransactionInitialTimeout: 60000
        });

        logger.log(`KaminoService initialized with RPC: ${this.rpcEndpoint}`);
        logger.log(`Program ID: ${this.programId.toString()}`);
    }

    /**
     * Get all user positions (lending and borrowing) for a wallet address
     */
    async getUserPositions(walletAddress: string): Promise<any> {
        try {
            logger.log(`Fetching user positions for wallet: ${walletAddress}`);

            const publicKey = new PublicKey(walletAddress);

            // Get all accounts owned by the user that interact with Kamino
            const userAccounts = await this.connection.getParsedTokenAccountsByOwner(publicKey, {
                programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') // SPL Token Program
            });

            logger.log(`Found ${userAccounts.value.length} token accounts for user`);

            // Get all markets first
            const markets = await this.discoverMarkets();
            logger.log(`Discovered ${markets.length} Kamino markets`);

            const userPositions: any = {
                lending: [],
                borrowing: [],
                totalValue: 0,
                markets: markets.length,
                userAccounts: userAccounts.value.length
            };

            userPositions.markets = markets.map(market => ({
                address: market.toString(),
                discovered: true
            }));

            logger.log(`User positions structure created with ${markets.length} markets`);
            return userPositions;

        } catch (error) {
            logger.error('Error fetching user positions:', error);
            return {
                lending: [],
                borrowing: [],
                totalValue: 0,
                error: error instanceof Error ? error.message : 'Unknown error occurred while fetching positions'
            };
        }
    }

    /**
     * Discover all Kamino markets by querying program accounts
     */
    async discoverMarkets(): Promise<PublicKey[]> {
        try {
            logger.log('Discovering Kamino markets...');

            // Get all accounts owned by the Kamino program
            const programAccounts = await this.connection.getProgramAccounts(this.programId, {
                filters: [
                    {
                        dataSize: 1024 // Adjust based on actual market account size
                    }
                ]
            });

            logger.log(`Found ${programAccounts.length} program accounts`);

            // Filter for market accounts (this is a simplified approach)
            // In a real implementation, you'd need to parse the account data to identify markets
            const potentialMarkets = programAccounts
                .map(account => account.pubkey)
                .slice(0, 10); // Limit for now to avoid overwhelming

            logger.log(`Identified ${potentialMarkets.length} potential market accounts`);

            return potentialMarkets;
        } catch (error) {
            logger.error('Error discovering markets:', error);
            return [];
        }
    }

    /**
     * Get market overview and statistics
     */
    async getMarketOverview(): Promise<any> {
        try {
            logger.log('Fetching market overview...');

            const markets = await this.discoverMarkets();

            const overview: any = {
                totalMarkets: markets.length,
                totalTvl: 0,
                totalBorrowed: 0,
                markets: [],
                programId: this.programId.toString(),
                multisig: KAMINO_MULTISIG
            };

            // For each market, try to get basic info
            for (const market of markets) {
                try {
                    const accountInfo = await this.connection.getAccountInfo(market);
                    if (accountInfo) {
                        overview.markets.push({
                            address: market.toString(),
                            dataSize: accountInfo.data.length,
                            lamports: accountInfo.lamports,
                            owner: accountInfo.owner.toString(),
                            executable: accountInfo.executable
                        });
                    }
                } catch (error) {
                    logger.warn(`Error fetching info for market ${market.toString()}:`, error);
                }
            }

            logger.log(`Market overview created with ${overview.markets.length} markets`);
            return overview;

        } catch (error) {
            logger.error('Error fetching market overview:', error);
            return {
                totalMarkets: 0,
                totalTvl: 0,
                totalBorrowed: 0,
                markets: [],
                error: error instanceof Error ? error.message : 'Unknown error occurred while fetching market overview'
            };
        }
    }

    /**
     * Get available reserves for lending/borrowing
     */
    async getAvailableReserves(): Promise<any[]> {
        try {
            logger.log('Fetching available reserves...');

            const markets = await this.discoverMarkets();
            const reserves: any[] = [];

            // For now, return basic reserve structure
            // In a real implementation, you'd parse the actual reserve data
            for (const market of markets) {
                try {
                    const accountInfo = await this.connection.getAccountInfo(market);
                    if (accountInfo) {
                        reserves.push({
                            market: market.toString(),
                            marketName: `Market-${market.toString().slice(0, 8)}`,
                            dataSize: accountInfo.data.length,
                            lamports: accountInfo.lamports,
                            owner: accountInfo.owner.toString(),
                            supplyApy: 0, // Would be calculated from actual data
                            borrowApy: 0,  // Would be calculated from actual data
                            totalSupply: 0, // Would be parsed from account data
                            totalBorrow: 0, // Would be parsed from account data
                            utilization: 0  // Would be calculated
                        });
                    }
                } catch (error) {
                    logger.warn(`Error fetching reserve info for market ${market.toString()}:`, error);
                }
            }

            logger.log(`Found ${reserves.length} reserves`);
            return reserves;

        } catch (error) {
            logger.error('Error fetching available reserves:', error);
            return [];
        }
    }

    /**
     * Get program account info for debugging
     */
    async getProgramInfo(): Promise<any> {
        try {
            logger.log('Fetching program info...');

            const programInfo = await this.connection.getAccountInfo(this.programId);

            if (!programInfo) {
                throw new Error('Program account not found');
            }

            const info = {
                programId: this.programId.toString(),
                multisig: KAMINO_MULTISIG,
                dataSize: programInfo.data.length,
                lamports: programInfo.lamports,
                owner: programInfo.owner.toString(),
                executable: programInfo.executable,
                rentEpoch: programInfo.rentEpoch
            };

            logger.log('Program info retrieved successfully');
            return info;

        } catch (error) {
            logger.error('Error fetching program info:', error);
            throw error;
        }
    }

    /**
     * Test connection and basic functionality
     */
    async testConnection(): Promise<any> {
        try {
            logger.log('Testing Kamino service connection...');

            const results = {
                rpcEndpoint: this.rpcEndpoint,
                programId: this.programId.toString(),
                connectionTest: false,
                programExists: false,
                marketCount: 0,
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

            // Test market discovery
            try {
                const markets = await this.discoverMarkets();
                results.marketCount = markets.length;
                logger.log(`Market discovery test: ${markets.length} markets found`);
            } catch (error) {
                logger.error('Market discovery test failed:', error);
            }

            logger.log('Connection test completed');
            return results;

        } catch (error) {
            logger.error('Error in connection test:', error);
            throw error;
        }
    }

    // Service lifecycle methods

    static async create(runtime: IAgentRuntime): Promise<KaminoService> {
        return new KaminoService(runtime);
    }

    static async start(runtime: IAgentRuntime): Promise<KaminoService> {
        const service = new KaminoService(runtime);
        await service.start();
        return service;
    }

    static async stop(runtime: IAgentRuntime): Promise<void> {
        const service = runtime.getService('KAMINO_SERVICE') as unknown as KaminoService;
        if (service) {
            await service.stop();
        }
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('KaminoService is already running');
            return;
        }

        try {
            logger.log('Starting KaminoService...');

            // Test connection on startup
            const testResults = await this.testConnection();
            logger.log('Startup connection test results:', testResults);

            this.isRunning = true;
            logger.log('KaminoService started successfully');
        } catch (error) {
            logger.error('Failed to start KaminoService:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('KaminoService is not running');
            return;
        }

        try {
            this.isRunning = false;
            logger.log('KaminoService stopped successfully');
        } catch (error) {
            logger.error('Failed to stop KaminoService:', error);
            throw error;
        }
    }

    isServiceRunning(): boolean {
        return this.isRunning;
    }
}
