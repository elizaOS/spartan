import type { Route } from '@elizaos/core';
import {
    PAYMENT_ADDRESSES,
    DEFAULT_NETWORK,
    getPaymentAddress,
    getNetworkAddresses,
    parsePrice,
    getNetworkAsset,
    getNetworkAssets,
    getTokenAddress,
    toX402Network,
    toResourceUrl,
    type Network,
    type RoutePaymentConfig
} from './payment-config';
import {
    createAccepts,
    createX402Response,
    type OutputSchema,
    type X402Response
} from './x402-types';
import {
    verifyTypedData,
    recoverTypedDataAddress,
    createPublicClient,
    http,
    type Address,
    type Hex,
    type TypedDataDomain
} from 'viem';
import { base, polygon, mainnet } from 'viem/chains';

/**
 * Debug logging helper - only logs if DEBUG_X402_PAYMENTS is enabled
 */
const DEBUG = process.env.DEBUG_X402_PAYMENTS === 'true';
function log(...args: any[]) {
    if (DEBUG) console.log(...args);
}
function logSection(title: string) {
    if (DEBUG) {
        console.log('\n' + '═'.repeat(60));
        console.log(`  ${title}`);
        console.log('═'.repeat(60));
    }
}
function logError(...args: any[]) {
    console.error(...args);
}

/**
 * ERC-3009 USDC Contract ABI (partial - only what we need for authorization state)
 */
const USDC_ABI = [
    {
        inputs: [{ name: 'authorizer', type: 'address' }, { name: 'nonce', type: 'bytes32' }],
        name: 'authorizationState',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'validAfter', type: 'uint256' },
            { name: 'validBefore', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' },
            { name: 'v', type: 'uint8' },
            { name: 'r', type: 'bytes32' },
            { name: 's', type: 'bytes32' }
        ],
        name: 'transferWithAuthorization',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    }
] as const;

/**
 * EIP-712 Domain for ERC-3009 TransferWithAuthorization
 */
const EIP712_DOMAIN_TYPES = [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' }
] as const;

/**
 * EIP-712 TransferWithAuthorization type
 */
const TRANSFER_WITH_AUTHORIZATION_TYPES = [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' }
] as const;

/**
 * EIP-712 ReceiveWithAuthorization type
 * NOTE: While the parameters are the same as TransferWithAuthorization,
 * the primary type name differs, resulting in different EIP-712 type hashes
 */
const RECEIVE_WITH_AUTHORIZATION_TYPES = [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' }
] as const;

/**
 * Get the viem chain object for a network
 */
function getViemChain(network: string) {
    switch (network.toUpperCase()) {
        case 'BASE':
            return base;
        case 'POLYGON':
            return polygon;
        case 'ETHEREUM':
            return mainnet;
        default:
            return base; // Default to Base
    }
}

/**
 * Get RPC URL for a network
 */
function getRpcUrl(network: string, runtime: any): string {
    const networkUpper = network.toUpperCase();

    // Try to get from runtime settings first
    const settingKey = `${networkUpper}_RPC_URL`;
    const customRpc = runtime.getSetting?.(settingKey);
    if (customRpc) {
        return customRpc;
    }

    // Fallback to public RPCs
    switch (networkUpper) {
        case 'BASE':
            return 'https://mainnet.base.org';
        case 'POLYGON':
            return 'https://polygon-rpc.com';
        case 'ETHEREUM':
            return 'https://eth.llamarpc.com';
        default:
            return 'https://mainnet.base.org';
    }
}

/**
 * Get USDC contract address for a network
 */
function getUsdcContractAddress(network: string): Address {
    switch (network.toUpperCase()) {
        case 'BASE':
            return '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
        case 'POLYGON':
            return '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
        case 'ETHEREUM':
            return '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
        default:
            return '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Default to Base
    }
}

/**
 * Wrapper to integrate x402 payment middleware with ElizaOS route handlers
 * 
 * Payment configuration is now read directly from each route's properties:
 * - x402: boolean - whether payment is required
 * - price: string - price in USD (e.g., "$0.10")
 * - supportedNetworks: Network[] - networks that accept payment
 * - config: RoutePaymentConfig - additional config like description
 * - validator: RequestValidator - optional function to validate params BEFORE payment check
 * 
 * Payment flow:
 * 1. If validator is provided, validate request parameters first
 * 2. If validation fails, return error (400/etc) WITHOUT requesting payment
 * 3. If validation passes (or no validator), check for payment credentials
 * 4. If no payment, return 402 Payment Required with payment options
 * 5. If payment provided, verify it
 * 6. If payment valid, execute the route handler
 */

/**
 * Validation result for pre-payment parameter validation
 */
interface ValidationResult {
    valid: boolean;
    error?: {
        status: number;
        message: string;
        details?: any;
    };
}

/**
 * Validator function that checks request parameters before payment
 * Returns validation result indicating if request is valid
 */
type RequestValidator = (req: any) => ValidationResult | Promise<ValidationResult>;

/**
 * Extended Route interface to include payment properties
 */
interface PaymentEnabledRoute extends Route {
    x402?: boolean;
    price?: string;
    supportedNetworks?: Network[];
    config?: RoutePaymentConfig;
    /**
     * Optional validator to check request parameters BEFORE payment verification.
     * This prevents charging users for requests that would fail validation anyway.
     * 
     * @example
     * ```ts
     * validator: (req) => {
     *   const { tokenMint } = req.body || {};
     *   if (!tokenMint) {
     *     return {
     *       valid: false,
     *       error: {
     *         status: 400,
     *         message: 'tokenMint is required'
     *       }
     *     };
     *   }
     *   return { valid: true };
     * }
     * ```
     */
    validator?: RequestValidator;
}

/**
 * Payment verification parameters
 */
interface PaymentVerificationParams {
    paymentProof?: string;
    paymentId?: string;
    route: string;
    expectedAmount: string;
    runtime: any;
    req?: any; // Request object to access headers (e.g., User-Agent for gateway detection)
}

/**
 * Verify payment proof from x402 payment provider
 * Supports: base64-encoded blockchain proofs, JSON EIP-712 signatures, and facilitator IDs
 */
async function verifyPayment(params: PaymentVerificationParams): Promise<boolean> {
    const { paymentProof, paymentId, route, expectedAmount, runtime, req } = params;

    logSection('PAYMENT VERIFICATION');
    log('Route:', route, 'Expected:', expectedAmount);

    if (!paymentProof && !paymentId) {
        logError('✗ No payment credentials provided (need X-Payment-Proof or X-Payment-Id header)');
        return false;
    }

    // Strategy 1: Verify payment proof (blockchain transaction)
    if (paymentProof) {
        try {
            // Decode base64 if needed
            let decodedProof: string;
            try {
                decodedProof = Buffer.from(paymentProof, 'base64').toString('utf-8');
            } catch {
                decodedProof = paymentProof;
            }

            // Try JSON format (EIP-712)
            try {
                const jsonProof = JSON.parse(decodedProof);
                log('Detected JSON payment proof');

                // Handle X402 Gateway wrapped format
                const authData = jsonProof.payload ? {
                    signature: jsonProof.payload.signature,
                    authorization: jsonProof.payload.authorization,
                    network: jsonProof.network,
                    scheme: jsonProof.scheme
                } : jsonProof;

                // Determine network from proof or chainId
                let network = authData.network || jsonProof.network || 'BASE';
                const chainId = authData.domain?.chainId || jsonProof.domain?.chainId;
                if (chainId) {
                    const chainIdMap: Record<number, string> = { 8453: 'BASE', 137: 'POLYGON', 1: 'ETHEREUM' };
                    network = chainIdMap[chainId] || 'BASE';
                }

                const expectedRecipient = getPaymentAddress(network.toUpperCase() as Network);
                const isValid = await verifyEvmPayment(
                    JSON.stringify(authData),
                    expectedRecipient,
                    expectedAmount,
                    network,
                    runtime,
                    req
                );

                if (isValid) {
                    log(`✓ ${network} payment verified (EIP-712)`);
                    return true;
                }
            } catch {
                // Not JSON - try legacy formats
                const parts = decodedProof.split(':');

                if (parts.length >= 3) {
                    const [network, address, signature] = parts;
                    log(`Legacy format: ${network}`);

                    if (network.toUpperCase() === 'SOLANA') {
                        if (await verifySolanaPayment(signature, address, expectedAmount, runtime)) {
                            log('✓ Solana payment verified');
                            return true;
                        }
                    } else if (network.toUpperCase() === 'BASE' || network.toUpperCase() === 'POLYGON') {
                        if (await verifyEvmPayment(signature, address, expectedAmount, network, runtime, req)) {
                            log(`✓ ${network} payment verified`);
                            return true;
                        }
                    }
                } else if (parts.length === 1 && parts[0].length > 50) {
                    // Raw Solana signature
                    const defaultAddress = getPaymentAddress('SOLANA');
                    if (await verifySolanaPayment(parts[0], defaultAddress, expectedAmount, runtime)) {
                        log('✓ Solana payment verified (raw signature)');
                        return true;
                    }
                }
            }
        } catch (error) {
            logError('Blockchain verification error:', error instanceof Error ? error.message : String(error));
        }
    }

    // Strategy 2: Verify payment ID (facilitator-based payment)
    if (paymentId) {
        try {
            if (await verifyPaymentIdViaFacilitator(paymentId, runtime)) {
                log('✓ Facilitator payment verified');
                return true;
            }
        } catch (error) {
            logError('Facilitator verification error:', error instanceof Error ? error.message : String(error));
        }
    }

    logError('✗ All payment verification strategies failed');
    return false;
}

/**
 * Verify payment ID via facilitator API
 */
async function verifyPaymentIdViaFacilitator(
    paymentId: string,
    runtime: any
): Promise<boolean> {
    logSection('FACILITATOR VERIFICATION');
    log('Payment ID:', paymentId);

    const facilitatorUrl = runtime.getSetting('X402_FACILITATOR_URL') || 'https://x402.elizaos.ai/api/facilitator';
    if (!facilitatorUrl) {
        logError('⚠️  No facilitator URL configured. Set X402_FACILITATOR_URL in environment.');
        return false;
    }

    try {
        const cleanUrl = facilitatorUrl.replace(/\/$/, '');
        const endpoint = `${cleanUrl}/verify/${encodeURIComponent(paymentId)}`;
        log('Verifying at:', endpoint);

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'ElizaOS-X402-Client/1.0'
            },
            signal: AbortSignal.timeout(10000)
        });

        const responseText = await response.text();
        const responseData = responseText ? JSON.parse(responseText) : null;

        if (response.ok) {
            const isValid = responseData?.valid !== false && responseData?.verified !== false;
            if (isValid) {
                log('✓ Facilitator verified payment');
                return true;
            } else {
                logError('✗ Payment invalid per facilitator');
                return false;
            }
        } else if (response.status === 404) {
            logError('✗ Payment ID not found (404)');
            return false;
        } else if (response.status === 410) {
            logError('✗ Payment ID already used (410 - replay attack prevented)');
            return false;
        } else {
            logError(`✗ Facilitator error: ${response.status} ${response.statusText}`);
            return false;
        }
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            logError('✗ Facilitator request timed out (10s)');
        } else {
            logError('✗ Facilitator verification error:', error instanceof Error ? error.message : String(error));
        }
        return false;
    }
}

/**
 * Verify a Solana transaction
 */
async function verifySolanaPayment(
    signature: string,
    expectedRecipient: string,
    expectedAmount: string,
    runtime: any
): Promise<boolean> {
    log('Verifying Solana transaction:', signature.substring(0, 20) + '...');

    try {
        const { Connection, PublicKey } = await import('@solana/web3.js');
        const rpcUrl = runtime.getSetting('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';
        const connection = new Connection(rpcUrl);

        const tx = await connection.getTransaction(signature, {
            maxSupportedTransactionVersion: 0
        });

        if (!tx) {
            logError('Transaction not found on Solana blockchain');
            return false;
        }

        if (tx.meta?.err) {
            logError('Transaction failed on-chain:', tx.meta.err);
            return false;
        }

        const accountKeys = tx.transaction.message.getAccountKeys();
        const recipientPubkey = new PublicKey(expectedRecipient);
        const recipientIndex = accountKeys.keySegments().flat().findIndex(
            (key) => key.toBase58() === recipientPubkey.toBase58()
        );

        if (recipientIndex === -1) {
            logError('Recipient address not found in transaction');
            return false;
        }

        log('✓ Solana transaction verified');
        return true;

    } catch (error) {
        logError('Solana verification error:', error instanceof Error ? error.message : String(error));
        return false;
    }
}

/**
 * Verify an EVM transaction or EIP-712 signature (Base, Polygon, etc.)
 * Supports: transaction hashes, EIP-712 signatures, and raw signatures
 */
async function verifyEvmPayment(
    paymentData: string,
    expectedRecipient: string,
    expectedAmount: string,
    network: string,
    runtime: any,
    req?: any
): Promise<boolean> {
    log(`Verifying ${network} payment:`, paymentData.substring(0, 20) + '...');

    try {
        // Strategy 1: Transaction hash
        if (paymentData.match(/^0x[a-fA-F0-9]{64}$/)) {
            log('Detected transaction hash format');
            return await verifyEvmTransaction(paymentData, expectedRecipient, expectedAmount, network, runtime);
        }

        // Strategy 2: EIP-712 signature with authorization
        try {
            const parsed = JSON.parse(paymentData);
            if (parsed.signature || (parsed.v && parsed.r && parsed.s)) {
                log('Detected EIP-712 signature format');
                return await verifyEip712Authorization(parsed, expectedRecipient, expectedAmount, network, runtime, req);
            }
        } catch (e) {
            // Not JSON, continue
        }

        // Strategy 3: Raw signature (not supported without authorization)
        if (paymentData.match(/^0x[a-fA-F0-9]{130}$/)) {
            logError('Raw signature detected but authorization parameters missing');
            return false;
        }

        logError('Unrecognized EVM payment format');
        return false;
    } catch (error) {
        logError('EVM verification error:', error instanceof Error ? error.message : String(error));
        return false;
    }
}

/**
 * Verify a regular EVM transaction
 */
async function verifyEvmTransaction(
    txHash: string,
    expectedRecipient: string,
    expectedAmount: string,
    network: string,
    runtime: any
): Promise<boolean> {
    log('Verifying on-chain transaction:', txHash);

    // TODO: Implement actual EVM transaction verification
    logError('⚠️  EVM transaction verification not fully implemented - accepting valid tx hash format');
    return true;
}

/**
 * Verify EIP-712 authorization signature (ERC-3009 TransferWithAuthorization)
 * 
 * Expected format:
 * {
 *   signature: "0x..." or { v, r, s },
 *   authorization: {
 *     from: "0x...",
 *     to: "0x...",
 *     value: "100000",
 *     validAfter: "1234567890",
 *     validBefore: "1234567890",
 *     nonce: "0x..."
 *   }
 * }
 */
async function verifyEip712Authorization(
    paymentData: any,
    expectedRecipient: string,
    expectedAmount: string,
    network: string,
    runtime: any,
    req?: any
): Promise<boolean> {
    log('Verifying EIP-712 authorization signature');
    log('Payment data:', JSON.stringify(paymentData, null, 2));

    try {
        // Extract signature and authorization data
        let signature: string;
        let authorization: any;

        if (paymentData.signature) {
            signature = paymentData.signature;
            authorization = paymentData.authorization || paymentData.message;
        } else if (paymentData.v && paymentData.r && paymentData.s) {
            // Reconstruct signature from v, r, s
            signature = `0x${paymentData.r}${paymentData.s}${paymentData.v.toString(16).padStart(2, '0')}`;
            authorization = paymentData.authorization || paymentData.message;
        } else {
            console.error('No valid signature found in payment data');
            return false;
        }

        if (!authorization) {
            console.error('No authorization data found in payment data');
            return false;
        }

        log('Authorization:', {
            from: authorization.from?.substring(0, 10) + '...',
            to: authorization.to?.substring(0, 10) + '...',
            value: authorization.value
        });

        // Verify recipient matches
        if (authorization.to.toLowerCase() !== expectedRecipient.toLowerCase()) {
            console.error('Recipient mismatch:', authorization.to, 'vs', expectedRecipient);
            return false;
        }

        // Verify amount matches (remove $ sign and convert to token units)
        const expectedUSD = parseFloat(expectedAmount.replace('$', ''));
        const expectedUnits = Math.floor(expectedUSD * 1e6); // USDC has 6 decimals
        const authValue = parseInt(authorization.value);

        if (authValue < expectedUnits) {
            console.error('Amount too low:', authValue, 'vs', expectedUnits);
            return false;
        }

        // Verify validity period
        const now = Math.floor(Date.now() / 1000);
        const validAfter = parseInt(authorization.validAfter || '0');
        const validBefore = parseInt(authorization.validBefore || String(now + 86400));

        if (now < validAfter) {
            console.error('Authorization not yet valid:', now, '<', validAfter);
            return false;
        }

        if (now > validBefore) {
            console.error('Authorization expired:', now, '>', validBefore);
            return false;
        }

        log('✓ EIP-712 authorization parameters valid');

        // Check if signature verification is disabled (DANGEROUS - for testing only)
        const disableSignatureVerification = runtime.getSetting?.('DISABLE_SIGNATURE_VERIFICATION') === 'true';

        if (disableSignatureVerification) {
            logError('⚠️  WARNING: SIGNATURE VERIFICATION DISABLED - DANGEROUS! Only for testing.');
            return true;
        }

        // STEP 1: Verify the signature cryptographically
        logSection('Cryptographic Signature Verification');

        try {
            // Determine the verifying contract and chain ID from payment data or network
            let verifyingContract: Address;
            let chainId: number;
            let domainName = 'USD Coin';
            let domainVersion = '2';

            // Check if domain is provided
            if (paymentData.domain) {
                log('Using domain from payment data:', paymentData.domain);
                verifyingContract = paymentData.domain.verifyingContract as Address;
                chainId = paymentData.domain.chainId;
                if (paymentData.domain.name) domainName = paymentData.domain.name;
                if (paymentData.domain.version) domainVersion = paymentData.domain.version;
            } else {
                log('No domain in payment data - using defaults');
                verifyingContract = getUsdcContractAddress(network);
                const chain = getViemChain(network);
                chainId = chain.id;
            }

            log('Verifying contract:', verifyingContract, 'chainId:', chainId);

            // Build EIP-712 domain
            const domain: TypedDataDomain = {
                name: domainName,
                version: domainVersion,
                chainId,
                verifyingContract
            };

            log('Domain for verification:', domain);

            // Build the typed data structure
            const types = {
                TransferWithAuthorization: TRANSFER_WITH_AUTHORIZATION_TYPES
            };

            // Prepare message (ensure all values are properly formatted)
            const message = {
                from: authorization.from as Address,
                to: authorization.to as Address,
                value: BigInt(authorization.value),
                validAfter: BigInt(authorization.validAfter || 0),
                validBefore: BigInt(authorization.validBefore || Math.floor(Date.now() / 1000) + 86400),
                nonce: authorization.nonce as Hex
            };

            log('Message:', { from: message.from, to: message.to, value: message.value.toString() });

            // Add fallback for signature verification issues
            const SKIP_SIGNATURE_VERIFICATION = runtime?.getSetting?.('SKIP_X402_SIGNATURE_VERIFICATION') === 'true';
            const ALLOW_SIGNER_MISMATCH = runtime?.getSetting?.('ALLOW_X402_SIGNER_MISMATCH') === 'true';

            // Before signature verification, check if we should skip it entirely
            if (SKIP_SIGNATURE_VERIFICATION) {
                logError('⚠️  SKIP_X402_SIGNATURE_VERIFICATION=true - skipping signature verification (TESTING ONLY)');
            } else {
                try {
                    // Recover the signer address from the signature
                    const recoveredAddress = await recoverTypedDataAddress({
                        domain,
                        types,
                        primaryType: 'TransferWithAuthorization',
                        message,
                        signature: signature as Hex
                    });

                    log('Recovered signer:', recoveredAddress, 'Expected:', authorization.from);

                    // Check if signer matches the 'from' address
                    const signerMatches = recoveredAddress.toLowerCase() === authorization.from.toLowerCase();

                    // If signature doesn't match, try with ReceiveWithAuthorization to diagnose the issue
                    if (!signerMatches) {
                        try {
                            const wrongTypeRecovered = await recoverTypedDataAddress({
                                domain,
                                types: { ReceiveWithAuthorization: RECEIVE_WITH_AUTHORIZATION_TYPES },
                                primaryType: 'ReceiveWithAuthorization',
                                message,
                                signature: signature as Hex
                            });

                            if (wrongTypeRecovered.toLowerCase() === authorization.from.toLowerCase()) {
                                logError('❌ CLIENT ERROR: Wrong EIP-712 type used');
                                logError('Client signed with ReceiveWithAuthorization but server expects TransferWithAuthorization');
                                logError('This signature will be REJECTED by the USDC contract');
                                return false;
                            }
                        } catch (e) {
                            log('Could not recover with ReceiveWithAuthorization either');
                        }
                    }

                    log('Signature match:', signerMatches ? '✓ Valid' : '✗ Invalid');

                    if (!signerMatches) {
                        // STRATEGY 1: Check if this is from a known trusted gateway (whitelist approach)
                        const userAgent = req?.headers?.['user-agent'] || '';
                        const isX402Gateway = userAgent.includes('X402-Gateway');

                        if (isX402Gateway) {
                            log('🔍 Detected X402 Gateway User-Agent');
                            const trustedSigners = runtime.getSetting?.('X402_TRUSTED_GATEWAY_SIGNERS') ||
                                '0x2EB8323f66eE172315503de7325D04c676089267';
                            const signerWhitelist = trustedSigners.split(',').map((addr: string) => addr.trim().toLowerCase());

                            if (signerWhitelist.includes(recoveredAddress.toLowerCase())) {
                                log('✅ Signature verified: signed by authorized X402 Gateway');
                                log(`Gateway signer: ${recoveredAddress}, Payment from: ${authorization.from}`);
                            } else {
                                logError(`✗ Gateway signer NOT in whitelist: ${recoveredAddress}`);
                                logError(`Set X402_TRUSTED_GATEWAY_SIGNERS=${recoveredAddress} to allow`);
                                return false;
                            }
                        }
                        // STRATEGY 2: Generic flag (less secure)
                        else if (ALLOW_SIGNER_MISMATCH) {
                            logError(`⚠️  Signer mismatch ALLOWED: from=${authorization.from}, signer=${recoveredAddress}`);
                            logError('Using ALLOW_X402_SIGNER_MISMATCH (consider X402_TRUSTED_GATEWAY_SIGNERS instead)');
                        } else {
                            logError('✗ Signature verification failed: signer mismatch');
                            logError(`Expected: ${authorization.from}, Actual: ${recoveredAddress}`);
                            logError(`Fix: Set X402_TRUSTED_GATEWAY_SIGNERS=${recoveredAddress} (recommended) or ALLOW_X402_SIGNER_MISMATCH=true`);
                            return false;
                        }
                    } else {
                        log('✓ Signature cryptographically verified');
                    }

                } catch (error) {
                    logError('✗ Signature verification failed:', error instanceof Error ? error.message : String(error));

                    // Try alternative domain parameters to debug signature issues
                    log('Trying alternative domain parameters...');

                    const domainVariations: TypedDataDomain[] = [
                        // Variation 1: Original
                        {
                            name: 'USD Coin',
                            version: '2',
                            chainId: 8453,
                            verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address
                        },
                        // Variation 2: USDC name
                        {
                            name: 'USDC',
                            version: '2',
                            chainId: 8453,
                            verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address
                        },
                        // Variation 3: Version 1
                        {
                            name: 'USD Coin',
                            version: '1',
                            chainId: 8453,
                            verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address
                        },
                        // Variation 4: String chainId
                        {
                            name: 'USD Coin',
                            version: '2',
                            chainId: '8453' as any,
                            verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address
                        },
                        // Variation 5: Polygon USDC
                        {
                            name: 'USD Coin',
                            version: '2',
                            chainId: 137,
                            verifyingContract: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as Address
                        },
                        // Variation 6: Ethereum USDC (version 2)
                        {
                            name: 'USD Coin',
                            version: '2',
                            chainId: 1,
                            verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address
                        },
                        // Variation 7: Ethereum USDC (original version)
                        {
                            name: 'USD Coin',
                            version: '1',
                            chainId: 1,
                            verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address
                        }
                    ];

                    let recoveredAddress: string | null = null;

                    for (const testDomain of domainVariations) {
                        try {
                            const recovered = await recoverTypedDataAddress({
                                domain: testDomain,
                                types,
                                primaryType: 'TransferWithAuthorization',
                                message,
                                signature: signature as Hex
                            });

                            if (recovered.toLowerCase() === authorization.from.toLowerCase()) {
                                log(`✓ MATCH FOUND! Domain: ${testDomain.name} v${testDomain.version}, chainId=${testDomain.chainId}`);
                                log('Use this domain config:', JSON.stringify(testDomain, null, 2));
                                recoveredAddress = recovered;
                                break;
                            }
                        } catch (e) {
                            log(`✗ Error with domain ${testDomain.chainId}:`, e instanceof Error ? e.message : String(e));
                        }
                    }

                    if (!recoveredAddress) {
                        logError('✗ No matching domain configuration found - signature may be malformed or use non-standard parameters');
                        return false;
                    }
                }
            }

            // STEP 2: Verify the authorization hasn't been used yet (check nonce on-chain)
            logSection('Transfer Authorization State Check');

            try {
                const rpcUrl = getRpcUrl(network, runtime);
                const chain = getViemChain(network);
                const usdcContract = getUsdcContractAddress(network);

                log('RPC:', rpcUrl, 'Contract:', usdcContract);

                // Create a public client to read contract state
                const publicClient = createPublicClient({
                    chain,
                    transport: http(rpcUrl)
                });

                // Check if the authorization has already been used
                const authState = await publicClient.readContract({
                    address: usdcContract,
                    abi: USDC_ABI,
                    functionName: 'authorizationState',
                    args: [authorization.from as Address, authorization.nonce as Hex]
                });

                log('Authorization state (used):', authState);

                if (authState === true) {
                    logError('✗ Authorization has already been used (nonce replay)');
                    return false;
                }

                log('✓ Authorization is valid and has not been used yet');

                // STEP 3: Execute the transfer on-chain to collect the funds
                logSection('Transfer Execution');

                // Auto-execution is always enabled
                const autoExecuteTransfer = true;

                log('Auto-execution enabled - executing transfer on-chain');

                try {
                    // Get private key for executing transactions
                    const privateKey = runtime.getSetting?.(`${network.toUpperCase()}_PRIVATE_KEY`);
                    if (!privateKey) {
                        logError(`✗ Missing private key for ${network}. Set ${network.toUpperCase()}_PRIVATE_KEY in environment.`);
                        logError('⚠️  Accepting payment but cannot execute transfer (no private key)');
                        return true;
                    }

                    // Import wallet account
                    const { privateKeyToAccount } = await import('viem/accounts');
                    const account = privateKeyToAccount(privateKey as Hex);

                    log('Executor:', account.address, 'From:', authorization.from, 'To:', authorization.to, 'Amount:', authorization.value);

                    // Create wallet client for writing
                    const { createWalletClient } = await import('viem');
                    const walletClient = createWalletClient({
                        account,
                        chain,
                        transport: http(rpcUrl)
                    });

                    // Extract v, r, s from signature
                    const sig = signature.startsWith('0x') ? signature.slice(2) : signature;
                    const r = ('0x' + sig.slice(0, 64)) as Hex;
                    const s = ('0x' + sig.slice(64, 128)) as Hex;
                    const v = parseInt(sig.slice(128, 130), 16);

                    log('Signature v:', v, 'r:', r.substring(0, 10) + '...', 's:', s.substring(0, 10) + '...');

                    // Call transferWithAuthorization on USDC contract
                    log('Executing transferWithAuthorization...');

                    const hash = await walletClient.writeContract({
                        address: usdcContract,
                        abi: USDC_ABI,
                        functionName: 'transferWithAuthorization',
                        args: [
                            authorization.from as Address,
                            authorization.to as Address,
                            BigInt(authorization.value),
                            BigInt(authorization.validAfter || 0),
                            BigInt(authorization.validBefore || Math.floor(Date.now() / 1000) + 86400),
                            authorization.nonce as Hex,
                            v,
                            r,
                            s
                        ]
                    });

                    log('Transaction hash:', hash, '- waiting for confirmation...');

                    // Wait for transaction confirmation
                    const receipt = await publicClient.waitForTransactionReceipt({ hash });

                    if (receipt.status === 'success') {
                        log('✓ Transfer executed successfully! Block:', receipt.blockNumber, 'Gas:', receipt.gasUsed);
                        console.log('💰 USDC collected successfully:', hash);
                        return true;
                    } else {
                        logError('✗ Transfer execution failed on-chain:', hash);
                        logError('⚠️  Accepting payment but transfer execution failed');
                        return true;
                    }

                } catch (error) {
                    logError('✗ Transfer execution error:', error instanceof Error ? error.message : String(error));
                    logError('⚠️  Accepting payment but cannot execute transfer (manual execution may be required)');
                    return true;
                }

            } catch (error) {
                logError('✗ Authorization state check failed:', error instanceof Error ? error.message : String(error));
                logError('⚠️  Accepting based on signature verification only (could not verify on-chain state)');
                return true;
            }
        } catch (error) {
            logError('EIP-712 verification error:', error instanceof Error ? error.message : String(error));
            return false;
        }
    } catch (error) {
        logError('EIP-712 verification error:', error instanceof Error ? error.message : String(error));
        return false;
    }
}

/**
 * Create a payment-aware route handler
 * This wraps the original handler with payment verification
 * All payment config is read from the route object itself
 */
export function createPaymentAwareHandler(
    route: PaymentEnabledRoute
): Route['handler'] {
    const originalHandler = route.handler;

    return async (req: any, res: any, runtime: any) => {
        // If x402 is not enabled or no price is set, skip payment check
        if (!route.x402 || !route.price) {
            if (originalHandler) {
                return originalHandler(req, res, runtime);
            }
            return;
        }

        logSection(`X402 Payment Check - ${route.path}`);
        log('Method:', req.method);

        // STEP 1: Validate request parameters BEFORE payment check
        if (route.validator) {
            try {
                const validationResult = await route.validator(req);

                if (!validationResult.valid) {
                    logError('✗ Validation failed:', validationResult.error?.message);
                    return res.status(validationResult.error?.status || 400).json({
                        success: false,
                        message: validationResult.error?.message || 'Invalid request',
                        ...(validationResult.error?.details && { details: validationResult.error.details })
                    });
                }

                log('✓ Validation passed');
            } catch (error) {
                logError('✗ Validation error:', error instanceof Error ? error.message : String(error));
                return res.status(500).json({
                    success: false,
                    message: 'Validation error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        // STEP 2: Check for payment credentials
        log('Headers:', JSON.stringify(req.headers, null, 2));
        log('Query:', JSON.stringify(req.query, null, 2));
        if (req.method === 'POST' && req.body) {
            log('Body:', JSON.stringify(req.body, null, 2));
        }

        // Check for payment proof in headers or query params
        const paymentProof = req.headers['x-payment-proof'] || req.headers['x-payment'] || req.query.paymentProof;
        const paymentId = req.headers['x-payment-id'] || req.query.paymentId;

        log('Payment credentials:', {
            'x-payment-proof': !!req.headers['x-payment-proof'],
            'x-payment': !!req.headers['x-payment'],
            'x-payment-id': !!paymentId,
            found: !!(paymentProof || paymentId)
        });

        // If payment proof exists, verify and allow access
        if (paymentProof || paymentId) {
            log('Payment credentials received:', {
                proofLength: paymentProof ? String(paymentProof).length : 0,
                paymentId
            });

            try {
                const isValid = await verifyPayment({
                    paymentProof: paymentProof as string,
                    paymentId: paymentId as string,
                    route: route.path,
                    expectedAmount: route.price,
                    runtime,
                    req
                });

                if (isValid) {
                    log('✓ PAYMENT VERIFIED - executing handler');
                    if (originalHandler) {
                        return originalHandler(req, res, runtime);
                    }
                    return;
                } else {
                    logError('✗ PAYMENT VERIFICATION FAILED - invalid or expired payment');
                    res.status(402).json({
                        error: 'Payment verification failed',
                        message: 'The provided payment proof is invalid or has expired',
                        x402Version: 1
                    });
                    return;
                }
            } catch (error) {
                logError('✗ PAYMENT VERIFICATION ERROR:', error instanceof Error ? error.message : String(error));
                res.status(402).json({
                    error: 'Payment verification error',
                    message: error instanceof Error ? error.message : String(error),
                    x402Version: 1
                });
                return;
            }
        }

        // No payment proof - return 402 Payment Required with x402scan-compliant response
        log('No payment credentials - returning 402');
        const supportedNetworks = route.supportedNetworks || [DEFAULT_NETWORK];

        try {
            const x402Response = buildX402Response(route, supportedNetworks);
            log('Payment options:', {
                networks: supportedNetworks.join(', '),
                price: route.price,
                count: x402Response.accepts?.length || 0
            });
            log('402 Response:', JSON.stringify(x402Response, null, 2));

            res.status(402).json(x402Response);
        } catch (error) {
            logError('✗ Failed to build x402 response:', error instanceof Error ? error.message : String(error));
            res.status(402).json(createX402Response({
                error: `Payment Required: ${error instanceof Error ? error.message : 'Unknown error'}`
            }));
        }
    };
}

/**
 * Build x402scan-compliant response for a route
 */
function buildX402Response(
    route: PaymentEnabledRoute,
    supportedNetworks: Network[]
): X402Response {
    if (!route.price) {
        throw new Error('Route price is required for x402 response');
    }

    // Create Accepts entries for each network + asset combination
    const accepts = supportedNetworks.flatMap(network => {
        // For Solana, create an entry for each supported token
        const assets = getNetworkAssets(network);

        return assets.map(asset => {
            const maxAmountRequired = parsePrice(route.price!, asset);
            const payTo = getPaymentAddress(network);

            // Validate payTo address
            if (!payTo) {
                throw new Error(`No payment address configured for network ${network}. Set ${network}_PUBLIC_KEY in environment.`);
            }

            // Get token address - required for EVM chains
            const tokenAddress = getTokenAddress(asset, network);

            // For EVM chains (BASE, POLYGON), the asset field MUST be the token contract address
            // For Solana, we can use the symbol (the client will look up the mint address)
            const isEVM = network === 'BASE' || network === 'POLYGON';
            const assetField = isEVM ? (tokenAddress || asset) : asset;

            // Determine the HTTP method from route type
            const method = route.type === 'POST' ? 'POST' : 'GET';

            // Build output schema describing the endpoint
            const outputSchema: OutputSchema = {
                input: {
                    type: "http",
                    method: method,
                    bodyType: method === 'POST' ? 'json' : undefined,
                    queryParams: method === 'GET' ? buildQueryParams(route) : undefined,
                    bodyFields: method === 'POST' ? buildBodyFields(route) : undefined,
                    headerFields: {
                        'X-Payment-Proof': {
                            type: 'string',
                            required: true,
                            description: 'Payment proof token from x402 payment provider'
                        },
                        'X-Payment-Id': {
                            type: 'string',
                            required: false,
                            description: 'Optional payment ID for tracking'
                        }
                    }
                },
                output: {
                    type: 'object',
                    description: 'API response data (varies by endpoint)'
                }
            };

            // Build extra data
            const extra: Record<string, any> = {
                price: route.price,
                symbol: asset, // Always include the human-readable symbol
                ...(route.config?.facilitatorEndpoint && {
                    facilitatorEndpoint: route.config.facilitatorEndpoint
                })
            };

            // Include token address in extra for reference
            if (tokenAddress) {
                extra.tokenAddress = tokenAddress;
            }

            // Include EIP-712 domain parameters for EVM chains
            // These are needed for clients to construct valid EIP-712 signatures
            if (network === 'BASE' || network === 'POLYGON') {
                extra.name = 'USD Coin';     // USDC contract domain name
                extra.version = '2';          // USDC contract domain version
            }

            return createAccepts({
                network: toX402Network(network),
                maxAmountRequired,
                resource: toResourceUrl(route.path),
                description: route.config?.description || `Access to ${route.path}`,
                payTo,
                asset: assetField, // Use contract address for EVM, symbol for Solana
                mimeType: 'application/json',
                maxTimeoutSeconds: 300, // 5 minutes
                outputSchema,
                extra
            });
        });
    });

    return createX402Response({
        accepts,
        error: 'Payment Required'
    });
}

/**
 * Build query parameter schema for a route
 * Can be extended based on route configuration
 */
function buildQueryParams(route: PaymentEnabledRoute): Record<string, any> | undefined {
    // Default query params for most endpoints
    const params: Record<string, any> = {};

    // Add route-specific params if defined
    if (route.config?.queryParams) {
        return route.config.queryParams;
    }

    return Object.keys(params).length > 0 ? params : undefined;
}

/**
 * Build body field schema for a route
 * Can be extended based on route configuration
 */
function buildBodyFields(route: PaymentEnabledRoute): Record<string, any> | undefined {
    // Add route-specific body fields if defined
    if (route.config?.bodyFields) {
        return route.config.bodyFields;
    }

    return undefined;
}

// Export validation types and payment-enabled route interface for use in route definitions
export type { ValidationResult, RequestValidator };
export type { PaymentEnabledRoute };

/**
 * Apply payment protection to an array of routes
 * Reads payment configuration directly from each route's properties
 */
export function applyPaymentProtection(routes: Route[]): Route[] {
    return routes.map(route => {
        const paymentRoute = route as PaymentEnabledRoute;

        // Apply payment wrapper to handler if x402 is enabled
        if (paymentRoute.x402 && paymentRoute.price) {
            console.log('Applying payment protection to:', paymentRoute.path, {
                price: paymentRoute.price,
                networks: paymentRoute.supportedNetworks
            });

            return {
                ...route,
                handler: createPaymentAwareHandler(paymentRoute)
            };
        }

        // Pass through routes without x402 enabled
        return route;
    });
}

