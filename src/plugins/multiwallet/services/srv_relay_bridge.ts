import { IAgentRuntime, logger, Service, type UUID } from '@elizaos/core';
import type { ProgressData } from '@relayprotocol/relay-sdk';
import {
    convertViemChainToRelayChain,
    createClient,
    getClient,
    MAINNET_RELAY_API,
    TESTNET_RELAY_API,
} from '@relayprotocol/relay-sdk';
import { type Address, type Chain, type WalletClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
    arbitrum,
    base,
    blast,
    linea,
    mainnet,
    optimism,
    polygon,
    scroll,
    zora,
} from 'viem/chains';
import { acquireService } from '../../autonomous-trader/utils';

interface QuoteRequest {
    user: string;
    chainId: number;
    toChainId: number;
    currency: string;
    toCurrency?: string;
    amount: string;
    recipient?: string;
    tradeType?: 'EXACT_INPUT' | 'EXACT_OUTPUT';
    referrer?: string;
}

interface BridgeRequest {
    user: string;
    originChainId: number;
    destinationChainId: number;
    currency: string;
    toCurrency?: string;
    amount: string;
    recipient?: string;
    useExactInput?: boolean;
    referrer?: string;
}

interface BridgeResult {
    requestId: string;
    txHash?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * MultiwalletRelayBridgeService integrates Relay Protocol cross-chain bridging
 * with the multiwallet system, enabling users to bridge tokens across chains
 * using their managed wallets.
 */
export class MultiwalletRelayBridgeService extends Service {
    static serviceType = 'MULTIWALLET_RELAY_BRIDGE' as const;

    private apiUrl: string = '';
    private apiKey?: string;
    private isTestnet: boolean = false;
    private isRunning: boolean = false;
    private intWalletService: any;
    private chainIdToChain: Map<number, Chain> = new Map();

    constructor(runtime: IAgentRuntime) {
        super(runtime);
        this.initializeChainMap();
    }

    get capabilityDescription(): string {
        return 'Cross-chain bridging service that integrates Relay Protocol with the multiwallet system. Enables seamless token bridging across multiple EVM chains (Ethereum, Base, Arbitrum, Polygon, Optimism, etc.) using user-managed wallets from the multiwallet system.';
    }

    /**
     * Initialize the chain ID to Chain mapping
     */
    private initializeChainMap(): void {
        const chains: Chain[] = [
            mainnet,
            base,
            arbitrum,
            polygon,
            optimism,
            zora,
            blast,
            scroll,
            linea,
        ];

        for (const chain of chains) {
            this.chainIdToChain.set(chain.id, chain);
        }
    }

    /**
     * Start the service
     */
    static async start(runtime: IAgentRuntime): Promise<MultiwalletRelayBridgeService> {
        logger.info('[MULTIWALLET_RELAY_BRIDGE] Starting Multiwallet Relay Bridge service');
        const service = new MultiwalletRelayBridgeService(runtime);
        await service.initialize(runtime);
        return service;
    }

    /**
     * Stop the service
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('Multiwallet Relay Bridge service is not running');
            return;
        }

        try {
            logger.info('Stopping Multiwallet Relay Bridge service...');
            this.isRunning = false;
            logger.info('Multiwallet Relay Bridge service stopped successfully');
        } catch (error) {
            const err = error as Error;
            logger.error(`Error stopping Multiwallet Relay Bridge service: ${err.message}`);
            throw error;
        }
    }

    /**
     * Initialize the service
     */
    async initialize(runtime: IAgentRuntime): Promise<void> {
        try {
            // Get Relay configuration
            const testnetSetting = runtime.getSetting('RELAY_ENABLE_TESTNET');
            this.isTestnet = typeof testnetSetting === 'string' && testnetSetting === 'true';
            this.apiUrl = this.isTestnet ? TESTNET_RELAY_API : MAINNET_RELAY_API;

            const apiKeySetting = runtime.getSetting('RELAY_API_KEY');
            this.apiKey = typeof apiKeySetting === 'string' ? apiKeySetting : undefined;

            // Acquire wallet service
            this.intWalletService = await acquireService(
                runtime,
                'AUTONOMOUS_TRADER_INTERFACE_WALLETS',
                'Multiwallet Relay Bridge'
            );

            // Define supported chains
            const supportedChains: Chain[] = [
                mainnet,
                base,
                arbitrum,
                polygon,
                optimism,
                zora,
                blast,
                scroll,
                linea,
            ];

            // Initialize Relay SDK client
            try {
                createClient({
                    baseApiUrl: this.apiUrl,
                    source: 'elizaos-multiwallet-agent',
                    chains: supportedChains.map((chain) => convertViemChainToRelayChain(chain)),
                    ...(this.apiKey ? { apiKey: this.apiKey } : {}),
                });
            } catch (error) {
                const err = error as Error;
                logger.debug(`Relay client already initialized: ${err.message}`);
            }

            this.isRunning = true;
            logger.info('Multiwallet Relay Bridge service initialized successfully');
        } catch (error) {
            const err = error as Error;
            logger.error(`Error initializing Multiwallet Relay Bridge service: ${err.message}`);
            throw error;
        }
    }

    /**
     * Get wallet client for a given public key and chain
     */
    private async getWalletClientForPubkey(
        pubKey: string,
        chainId: number
    ): Promise<WalletClient | null> {
        try {
            // Get accounts associated with this public key
            const res = await this.intWalletService.getAccountsByPubkey(pubKey);
            if (!res.accountComponents || res.accountComponents.length === 0) {
                logger.warn(`No accounts found for pubkey: ${pubKey}`);
                return null;
            }

            // Get the first account's wallet data
            const accountComponent = res.accountComponents[0];
            const accountId = accountComponent.accountEntityId;

            // Get metawallets for this account
            const metawallets = await this.intWalletService.getMetaWallets();

            // Find a metawallet that belongs to this account and has the chain we need
            let targetWallet: any = null;
            for (const mw of metawallets) {
                if (mw.entitiesId && mw.entitiesId.includes(accountId)) {
                    // Check if this metawallet has keypair for the chain
                    if (mw.keypairs && mw.keypairs[chainId]) {
                        targetWallet = mw.keypairs[chainId];
                        break;
                    }
                }
            }

            if (!targetWallet || !targetWallet.privateKey) {
                logger.warn(`No wallet found for pubkey ${pubKey} on chain ${chainId}`);
                return null;
            }

            // Get the chain configuration
            const chain = this.chainIdToChain.get(chainId);
            if (!chain) {
                throw new Error(`Unsupported chain ID: ${chainId}`);
            }

            // Create wallet client from private key
            const account = privateKeyToAccount(targetWallet.privateKey as `0x${string}`);
            const walletClient = createWalletClient({
                account,
                chain,
                transport: http(),
            });

            return walletClient;
        } catch (error) {
            const err = error as Error;
            logger.error(`Error getting wallet client: ${err.message}`);
            return null;
        }
    }

    /**
     * Get a quote for cross-chain bridging
     */
    async getQuote(request: QuoteRequest): Promise<any> {
        try {
            const client = getClient();
            if (!client) {
                throw new Error('Relay client not initialized');
            }

            // Validate request
            if (!request.user || !request.chainId || !request.toChainId) {
                throw new Error('Missing required fields: user, chainId, toChainId');
            }

            if (!request.amount || BigInt(request.amount) <= 0n) {
                throw new Error('Invalid amount: must be greater than 0');
            }

            const options = {
                user: request.user as Address,
                chainId: request.chainId,
                toChainId: request.toChainId,
                currency: request.currency as Address,
                toCurrency: (request.toCurrency || request.currency) as Address,
                amount: request.amount,
                recipient: (request.recipient || request.user) as Address,
                tradeType: request.tradeType || 'EXACT_INPUT',
                ...(request.referrer && { referrer: request.referrer as Address }),
            };

            const quote = await client.actions.getQuote(options);

            if (!quote) {
                throw new Error('No quote returned from Relay API');
            }

            return quote;
        } catch (error) {
            const err = error as Error;
            logger.error(`Failed to get quote: ${err.message}`);
            throw new Error(`Failed to get quote: ${err.message}`);
        }
    }

    /**
     * Execute a cross-chain bridge transaction using a multiwallet
     * @param pubKey - The public key of the wallet to use
     * @param request - The bridge request parameters
     * @param onProgress - Optional progress callback
     * @returns Bridge result with request ID and status
     */
    async executeBridgeWithMultiwallet(
        pubKey: string,
        request: BridgeRequest,
        onProgress?: (data: ProgressData) => void
    ): Promise<BridgeResult> {
        try {
            const client = getClient();
            if (!client) {
                throw new Error('Relay client not initialized');
            }

            // Validate request
            if (!request.user || !request.originChainId || !request.destinationChainId) {
                throw new Error('Missing required fields: user, originChainId, destinationChainId');
            }

            if (!request.amount || BigInt(request.amount) <= 0n) {
                throw new Error('Invalid amount: must be greater than 0');
            }

            // Get wallet client for the origin chain
            const walletClient = await this.getWalletClientForPubkey(pubKey, request.originChainId);
            if (!walletClient) {
                throw new Error(`Failed to get wallet client for pubkey ${pubKey} on chain ${request.originChainId}`);
            }

            logger.info(`Executing bridge from chain ${request.originChainId} to ${request.destinationChainId}`);

            // Get quote
            const quote = await this.getQuote({
                user: request.user,
                chainId: request.originChainId,
                toChainId: request.destinationChainId,
                currency: request.currency,
                toCurrency: request.toCurrency || request.currency,
                amount: request.amount,
                recipient: request.recipient,
                tradeType: request.useExactInput ? 'EXACT_INPUT' : 'EXACT_OUTPUT',
                referrer: request.referrer,
            });

            // Execute the bridge
            const result = await client.actions.execute({
                quote,
                wallet: walletClient,
                onProgress,
            });

            // Extract request ID
            const requestId =
                (result as any)?.data?.request?.id ||
                (result as any)?.requestId ||
                (result as any)?.id ||
                'pending';

            logger.info(`Bridge executed successfully. Request ID: ${requestId}`);

            // Notify the wallet owner
            await this.intWalletService.notifyWallet(
                pubKey,
                `Bridge transaction initiated: ${requestId}. Bridging from chain ${request.originChainId} to ${request.destinationChainId}`
            );

            return {
                requestId,
                status: 'pending',
            };
        } catch (error) {
            const err = error as Error;
            logger.error(`Failed to execute bridge: ${err.message}`);
            throw new Error(`Failed to execute bridge: ${err.message}`);
        }
    }

    /**
     * Execute a bridge for a user entity ID
     */
    async executeBridgeForUser(
        userEntityId: UUID,
        request: BridgeRequest,
        onProgress?: (data: ProgressData) => void
    ): Promise<BridgeResult> {
        try {
            // Get wallets for this user
            const wallets = await this.intWalletService.getWalletByUserEntityIds([userEntityId]);

            if (!wallets || !wallets[userEntityId] || wallets[userEntityId].length === 0) {
                throw new Error(`No wallets found for user ${userEntityId}`);
            }

            // Get the first metawallet
            const metawallet = wallets[userEntityId][0];

            // Check if the metawallet has a wallet for the origin chain
            if (!metawallet.keypairs || !metawallet.keypairs[request.originChainId]) {
                throw new Error(`User does not have a wallet on chain ${request.originChainId}`);
            }

            const pubKey = metawallet.keypairs[request.originChainId].publicKey;

            return await this.executeBridgeWithMultiwallet(pubKey, request, onProgress);
        } catch (error) {
            const err = error as Error;
            logger.error(`Failed to execute bridge for user: ${err.message}`);
            throw new Error(`Failed to execute bridge for user: ${err.message}`);
        }
    }

    /**
     * Get status of a bridge transaction
     */
    async getBridgeStatus(requestId: string): Promise<any> {
        try {
            const params = new URLSearchParams();
            params.append('id', requestId);

            const response = await fetch(`${this.apiUrl}/requests/v2?${params.toString()}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.apiKey && { 'x-api-key': this.apiKey }),
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to get status: ${response.status} ${errorText}`);
            }

            const data: any = await response.json();
            return data.requests?.[0] || null;
        } catch (error) {
            const err = error as Error;
            logger.error(`Failed to get bridge status: ${err.message}`);
            throw new Error(`Failed to get bridge status: ${err.message}`);
        }
    }

    /**
     * Get supported chains
     */
    async getSupportedChains(): Promise<any[]> {
        try {
            const response = await fetch(`${this.apiUrl}/chains`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.apiKey && { 'x-api-key': this.apiKey }),
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to get chains: ${response.status} ${errorText}`);
            }

            const data: any = await response.json();
            return data.chains || [];
        } catch (error) {
            const err = error as Error;
            logger.error(`Failed to get supported chains: ${err.message}`);
            throw new Error(`Failed to get supported chains: ${err.message}`);
        }
    }

    /**
     * Get supported currencies for a chain
     */
    async getSupportedCurrencies(chainId: number): Promise<any[]> {
        try {
            if (!chainId || chainId <= 0) {
                throw new Error('Invalid chainId provided');
            }

            const response = await fetch(`${this.apiUrl}/currencies?chainId=${chainId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.apiKey && { 'x-api-key': this.apiKey }),
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to get currencies: ${response.status} ${errorText}`);
            }

            const data: any = await response.json();
            return data.currencies || [];
        } catch (error) {
            const err = error as Error;
            logger.error(`Failed to get supported currencies: ${err.message}`);
            throw new Error(`Failed to get supported currencies: ${err.message}`);
        }
    }

    /**
     * Check if service is running
     */
    isServiceRunning(): boolean {
        return this.isRunning;
    }
}

export default MultiwalletRelayBridgeService;

