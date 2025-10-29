/**
 * Configuration for x402 micropayment system
 * Route-specific pricing is now defined locally in each route definition
 * 
 * Payment Verification Methods:
 * 
 * 1. Direct Blockchain Proof (X-Payment-Proof header)
 *    - User sends payment transaction on-chain
 *    - Transaction signature is verified against blockchain
 *    - Supports: Solana, Base, Polygon
 *    - Format: base64-encoded JSON with signature and authorization
 * 
 * 2. Facilitator Payment ID (X-Payment-Id header)
 *    - Third-party service handles payment
 *    - Service returns payment ID after successful payment
 *    - ID is verified through facilitator API
 *    - Configured via X402_FACILITATOR_URL environment variable
 *    - Example: X402_FACILITATOR_URL=https://facilitator.x402.ai
 * 
 * The facilitator endpoint should implement:
 *   GET /verify/{paymentId}
 *     - 200 OK: Payment is valid (with optional { valid: true } JSON body)
 *     - 404 Not Found: Payment ID doesn't exist
 *     - 410 Gone: Payment already used (prevents replay attacks)
 */

import type { X402ScanNetwork } from './x402-types';

// Network configuration - supports multiple chains
export type Network = 'BASE' | 'SOLANA' | 'POLYGON';

// Default network configuration
export const DEFAULT_NETWORK: Network = 'SOLANA';

/**
 * Convert our Network type to x402scan-compliant network names
 */
export function toX402Network(network: Network): X402ScanNetwork {
    const networkMap: Record<Network, X402ScanNetwork> = {
        'BASE': 'base',
        'SOLANA': 'solana',
        'POLYGON': 'polygon'
    };
    return networkMap[network];
}

/**
 * Network-specific wallet addresses
 * Uses existing environment variables from your project configuration
 */
export const PAYMENT_ADDRESSES: Record<Network, string> = {
    BASE: process.env.BASE_PUBLIC_KEY || process.env.PAYMENT_WALLET_BASE,
    SOLANA: process.env.SOLANA_PUBLIC_KEY || process.env.PAYMENT_WALLET_SOLANA,
    POLYGON: process.env.POLYGON_PUBLIC_KEY || process.env.PAYMENT_WALLET_POLYGON,
};

/**
 * Get the base URL for the current server
 * Used to construct full resource URLs for x402 responses
 */
export function getBaseUrl(): string {
    // Check for explicit base URL setting
    if (process.env.X402_BASE_URL) {
        return process.env.X402_BASE_URL.replace(/\/$/, ''); // Remove trailing slash
    }

    return 'https://x402.elizaos.ai'

    // Construct from server settings
    const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';
    const host = process.env.SERVER_HOST || 'localhost';
    const port = process.env.SERVER_PORT || '3000';

    // Don't include port 80 for http or port 443 for https
    if ((protocol === 'http' && port === '80') || (protocol === 'https' && port === '443')) {
        return `${protocol}://${host}`;
    }

    return `${protocol}://${host}:${port}`;
}

/**
 * Convert a route path to a full resource URL
 */
export function toResourceUrl(path: string): string {
    const baseUrl = getBaseUrl();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
}

/**
 * Token configuration for Solana
 */
export const SOLANA_TOKENS = {
    USDC: {
        symbol: 'USDC',
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 6
    },
    AI16Z: {
        symbol: 'ai16z',
        address: 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC',
        decimals: 6
    },
    DEGENAI: {
        symbol: 'degenai',
        address: 'Gu3LDkn7Vx3bmCzLafYNKcDxv2mH7YN44NJZFXnypump',
        decimals: 6
    }
} as const;

/**
 * Token configuration for Base (EVM)
 */
export const BASE_TOKENS = {
    USDC: {
        symbol: 'USDC',
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        decimals: 6
    }
} as const;

/**
 * Token configuration for Polygon (EVM)
 */
export const POLYGON_TOKENS = {
    USDC: {
        symbol: 'USDC',
        address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        decimals: 6
    }
} as const;

/**
 * Default asset for each network (used in x402 responses)
 */
export const NETWORK_ASSETS: Record<Network, string> = {
    BASE: 'USDC',      // USDC on Base
    SOLANA: 'USDC',    // USDC on Solana (default, but also supports ai16z and degenai)
    POLYGON: 'USDC',   // USDC on Polygon
};

/**
 * Get all accepted assets for a network
 */
export function getNetworkAssets(network: Network): string[] {
    if (network === 'SOLANA') {
        return Object.values(SOLANA_TOKENS).map(t => t.symbol);
    }
    if (network === 'BASE') {
        return Object.values(BASE_TOKENS).map(t => t.symbol);
    }
    if (network === 'POLYGON') {
        return Object.values(POLYGON_TOKENS).map(t => t.symbol);
    }
    return [NETWORK_ASSETS[network]];
}

// Default/legacy wallet address (uses default network)
export const PAYMENT_RECEIVER_ADDRESS = PAYMENT_ADDRESSES[DEFAULT_NETWORK];

/**
 * Payment configuration interface - should be defined on each route
 * Example route definition:
 * {
 *   type: 'GET',
 *   path: '/api/example',
 *   public: true,
 *   x402: true,
 *   price: '$0.10',
 *   supportedNetworks: ['BASE', 'POLYGON', 'SOLANA'],
 *   config: {
 *     description: 'Example endpoint',
 *     facilitatorEndpoint: 'https://facilitator.example.com',
 *     queryParams: {
 *       'symbol': { type: 'string', required: true, description: 'Token symbol' }
 *     }
 *   }
 * }
 */
export interface RoutePaymentConfig {
    description?: string;
    facilitatorEndpoint?: string; // For EVM networks like Ethereum
    queryParams?: Record<string, any>; // Query parameter schema for x402scan
    bodyFields?: Record<string, any>; // Body field schema for x402scan
}

/**
 * Get the payment address for a specific network
 */
export function getPaymentAddress(network: Network): string {
    return PAYMENT_ADDRESSES[network] || PAYMENT_RECEIVER_ADDRESS;
}

/**
 * Get all network addresses with metadata
 */
export function getNetworkAddresses(networks: Network[]): Array<{
    name: Network;
    address: string;
    facilitatorEndpoint?: string;
}> {
    return networks.map(network => ({
        name: network,
        address: PAYMENT_ADDRESSES[network],
        // Add facilitator endpoint for EVM chains if configured
        ...((network === 'BASE' || network === 'POLYGON') && process.env.EVM_FACILITATOR && {
            facilitatorEndpoint: process.env.EVM_FACILITATOR
        })
    }));
}

/**
 * Token price configuration (USD per token)
 * In production, these should be fetched from an API like Birdeye or Jupiter
 */
export const TOKEN_PRICES_USD: Record<string, number> = {
    'USDC': 1.0,
    'ai16z': parseFloat(process.env.AI16Z_PRICE_USD || '0.50'),  // Default $0.50, set in .env
    'degenai': parseFloat(process.env.DEGENAI_PRICE_USD || '0.01'), // Default $0.01, set in .env
    'ETH': 2000.0 // Simplified, should be fetched dynamically
};

/**
 * Get token decimals for an asset
 */
function getTokenDecimals(asset: string, network?: Network): number {
    // Check network-specific tokens if network is provided
    if (network === 'SOLANA') {
        const solanaToken = Object.values(SOLANA_TOKENS).find(t => t.symbol === asset);
        if (solanaToken) return solanaToken.decimals;
    }
    if (network === 'BASE') {
        const baseToken = Object.values(BASE_TOKENS).find(t => t.symbol === asset);
        if (baseToken) return baseToken.decimals;
    }
    if (network === 'POLYGON') {
        const polygonToken = Object.values(POLYGON_TOKENS).find(t => t.symbol === asset);
        if (polygonToken) return polygonToken.decimals;
    }

    // Check all token configs if no network specified
    const solanaToken = Object.values(SOLANA_TOKENS).find(t => t.symbol === asset);
    if (solanaToken) return solanaToken.decimals;

    const baseToken = Object.values(BASE_TOKENS).find(t => t.symbol === asset);
    if (baseToken) return baseToken.decimals;

    const polygonToken = Object.values(POLYGON_TOKENS).find(t => t.symbol === asset);
    if (polygonToken) return polygonToken.decimals;

    // Defaults
    if (asset === 'USDC') return 6;
    if (asset === 'ETH') return 18;

    return 6; // Default to 6 decimals
}

/**
 * Parse price string (e.g., "$0.10") and convert to asset amount
 * For USDC, this is 1:1 with USD (6 decimals)
 * For other tokens, converts based on TOKEN_PRICES_USD
 * Returns the amount as a string in the smallest unit
 */
export function parsePrice(price: string, asset: string = 'USDC'): string {
    // Remove $ sign and parse as float
    const usdAmount = parseFloat(price.replace('$', ''));

    if (isNaN(usdAmount)) {
        throw new Error(`Invalid price format: ${price}`);
    }

    // Get token price in USD
    const tokenPriceUSD = TOKEN_PRICES_USD[asset] || 1.0;

    // Calculate amount of tokens needed
    const tokenAmount = usdAmount / tokenPriceUSD;

    // Get decimals for this token
    const decimals = getTokenDecimals(asset);

    // Convert to smallest unit
    const smallestUnit = Math.ceil(tokenAmount * Math.pow(10, decimals));

    return smallestUnit.toString();
}

/**
 * Get token address for a Solana token
 * @deprecated Use getTokenAddress instead
 */
export function getSolanaTokenAddress(asset: string): string | undefined {
    const token = Object.values(SOLANA_TOKENS).find(t => t.symbol === asset);
    return token?.address;
}

/**
 * Get token address for any network and asset
 */
export function getTokenAddress(asset: string, network: Network): string | undefined {
    if (network === 'SOLANA') {
        const token = Object.values(SOLANA_TOKENS).find(t => t.symbol === asset);
        return token?.address;
    }
    if (network === 'BASE') {
        const token = Object.values(BASE_TOKENS).find(t => t.symbol === asset);
        return token?.address;
    }
    if (network === 'POLYGON') {
        const token = Object.values(POLYGON_TOKENS).find(t => t.symbol === asset);
        return token?.address;
    }
    return undefined;
}

/**
 * Get the asset for a specific network
 */
export function getNetworkAsset(network: Network): string {
    return NETWORK_ASSETS[network];
}

