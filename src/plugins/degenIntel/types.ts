import type { Content, Service } from '@elizaos/core';
import type { Token, Sentiment as SchemaSentiment } from './schemas';

// ============================================================================
// Original Types (re-exports and custom types)
// ============================================================================

/**
 * Token information including market data and metadata.
 * Re-exported from schemas as IToken for backward compatibility.
 * 
 * @property {string} provider - The data provider for this token
 * @property {number} rank - Token ranking/position
 * @property {string} address - Token contract address
 * @property {string} chain - Blockchain identifier (e.g., "solana", "ethereum")
 * @property {string} name - Full token name
 * @property {string} symbol - Token ticker symbol
 * @property {number} decimals - Number of decimal places
 * @property {number} price - Current price in USD
 * @property {number} price24hChangePercent - 24-hour price change percentage
 * @property {number} volume24hUSD - 24-hour trading volume in USD
 * @property {number} marketcap - Market capitalization in USD
 * @property {number} liquidity - Token liquidity
 * @property {string} logoURI - URL to token logo image
 */
export type IToken = Token;

/**
 * Sentiment analysis result for a time period.
 * Re-exported from schemas.
 * 
 * @property {string} timeslot - ISO datetime string for the analysis period
 * @property {string} createdAt - ISO datetime when the sentiment was created
 * @property {Array} occuringTokens - Tokens mentioned with sentiment scores
 * @property {boolean} processed - Whether the sentiment has been processed
 * @property {string} updatedAt - ISO datetime of last update
 * @property {string} text - Original text that was analyzed
 */
export type Sentiment = SchemaSentiment;

/**
 * Twitter content with platform-specific metadata.
 * Extends the base Content interface with Twitter-specific fields.
 * 
 * @interface TwitterContent
 * @extends {Content}
 * @property {string} source - Always "twitter" for Twitter content
 * @property {string} text - Tweet text content
 * @property {Object} [metadata] - Optional Twitter-specific metadata
 * @property {string} [metadata.username] - Twitter username of author
 * @property {number} [metadata.retweets] - Number of retweets
 * @property {number} [metadata.likes] - Number of likes
 * @property {number} [metadata.timestamp] - Tweet timestamp
 * @property {any} [tweet] - Raw tweet object from Twitter API
 */
export interface TwitterContent extends Content {
  source: 'twitter';
  text: string;
  metadata?: {
    username?: string;
    retweets?: number;
    likes?: number;
    timestamp?: number;
  };
  tweet?: any;
}

// ============================================================================
// Intel Chain Service Types - Generic blockchain operations
// ============================================================================

/**
 * Token balance information for a specific wallet and token.
 * Used across all blockchain implementations for consistent balance reporting.
 * 
 * @property {string} caipAssetId - Full CAIP format identifier: chainNs:chainRef/assetNs:assetRef
 *                                  Example: "solana:mainnet/spl-token:So11111..."
 * @property {string} publicKey - Wallet public key/address holding this token
 * @property {string} symbol - Token ticker symbol (e.g., "USDC", "SOL")
 * @property {string} name - Full token name (e.g., "USD Coin", "Solana")
 * @property {number} decimals - Number of decimal places for the token
 * @property {string} balance - Raw balance in smallest units (e.g., lamports, wei)
 * @property {string} uiAmount - Human-readable balance (accounting for decimals)
 * @property {string} [priceUsd] - Optional current price in USD
 * @property {string} [valueUsd] - Optional total value in USD (balance * price)
 */
export type IntelTokenBalance = {
  caipAssetId: string;
  publicKey: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  uiAmount: string;
  priceUsd?: string;
  valueUsd?: string;
};

/**
 * Complete portfolio information for a wallet on a specific blockchain.
 * Includes native token balance and all held tokens.
 * 
 * @property {string} chain - Chain identifier (e.g., "solana", "ethereum")
 * @property {string} publicKey - Wallet public key/address
 * @property {Object} nativeBalance - Native blockchain token balance
 * @property {string} nativeBalance.caipAssetId - CAIP ID for native token (e.g., "solana:mainnet/native:SOL")
 * @property {string} nativeBalance.symbol - Native token symbol (e.g., "SOL", "ETH")
 * @property {string} nativeBalance.balance - Raw balance in smallest units
 * @property {string} nativeBalance.uiAmount - Human-readable balance
 * @property {string} [nativeBalance.valueUsd] - Optional USD value of native balance
 * @property {IntelTokenBalance[]} tokens - Array of token balances held in this wallet
 * @property {string} [totalValueUsd] - Optional total portfolio value in USD
 * @property {number} [lastUpdated] - Optional timestamp of last update (milliseconds since epoch)
 */
export type IntelPortfolio = {
  chain: string;
  publicKey: string;
  nativeBalance: {
    caipAssetId: string;
    symbol: string;
    balance: string;
    uiAmount: string;
    valueUsd?: string;
  };
  tokens: IntelTokenBalance[];
  totalValueUsd?: string;
  lastUpdated?: number;
};

/**
 * Parameters for executing a token transfer operation.
 * Works for both native tokens and standard tokens across all chains.
 * 
 * @property {string} from - Private key of sender wallet (base58, hex, etc.)
 * @property {string} to - Public key/address of recipient wallet
 * @property {string} amount - Transfer amount in smallest units (e.g., lamports, wei)
 * @property {string} caipAssetId - CAIP format asset identifier
 *                                  For native: "solana:mainnet/native:SOL"
 *                                  For token: "solana:mainnet/spl-token:So11111..."
 */
export type IntelTransferParams = {
  from: string;
  to: string;
  amount: string;
  caipAssetId: string;
};

/**
 * Result of a transfer operation.
 * Indicates success/failure and provides transaction details.
 * 
 * @property {boolean} success - Whether the transfer succeeded
 * @property {string} [txHash] - Transaction hash/signature if successful
 * @property {string} [error] - Error message if transfer failed
 * @property {string} [chain] - Chain where transfer was executed
 * @property {string} [from] - Sender public key (derived from private key)
 * @property {string} [to] - Recipient public key
 * @property {string} [caipAssetId] - Asset that was transferred
 */
export type IntelTransferResult = {
  success: boolean;
  txHash?: string;
  error?: string;
  chain?: string;
  from?: string;
  to?: string;
  caipAssetId?: string;
};

/**
 * Metadata information for a token.
 * Includes identifying information and supply metrics.
 * 
 * @property {string} caipAssetId - Full CAIP format identifier for this token
 * @property {string|null} symbol - Token ticker symbol, null if not available
 * @property {string|null} name - Full token name, null if not available
 * @property {number} decimals - Number of decimal places
 * @property {string} [supply] - Optional total token supply
 * @property {string} [circulatingSupply] - Optional circulating supply (excludes locked/burned)
 */
export type IntelTokenMetadata = {
  caipAssetId: string;
  symbol: string | null;
  name: string | null;
  decimals: number;
  supply?: string;
  circulatingSupply?: string;
};

/**
 * Detected private key from text parsing.
 * Identifies the key and its encoding format.
 * 
 * @property {string} key - The detected private key string
 * @property {string} format - Key encoding format (e.g., 'base58', 'hex', 'mnemonic')
 */
export type IntelDetectedKey = {
  key: string;
  format: string;
};

/**
 * Exchange/DEX information for trading operations.
 * Used to identify and select exchanges for swap operations.
 * 
 * @property {number} id - Unique exchange identifier
 * @property {string} name - Exchange name (e.g., "Jupiter", "Uniswap")
 * @property {string} chain - Chain this exchange operates on
 * @property {any} [key: string] - Additional exchange-specific properties
 */
export type IntelExchange = {
  id: number;
  name: string;
  chain: string;
  [key: string]: any;
};

// ============================================================================
// IChainService Interface - Contract that all chain plugins must implement
// ============================================================================

/**
 * Interface that all blockchain chain services must implement.
 * Provides a consistent, chain-agnostic API for blockchain operations.
 * 
 * All chain plugins (Solana, Ethereum, etc.) should implement this interface
 * to ensure compatibility with the TradeChainService orchestration layer.
 * 
 * Methods marked with `?` are optional - chains can implement them if supported.
 * Required methods must be implemented by all chains.
 * 
 * @interface IChainService
 * @extends {Service}
 * 
 * @example
 * ```typescript
 * class SolanaChainService extends Service implements IChainService {
 *   async createWallet() {
 *     const keypair = Keypair.generate();
 *     return {
 *       publicKey: keypair.publicKey.toBase58(),
 *       privateKey: bs58.encode(keypair.secretKey)
 *     };
 *   }
 *   // ... implement other required methods
 * }
 * ```
 */
export interface IChainService extends Service {
  // ========================================
  // Wallet & Key Management
  // ========================================

  /**
   * Creates a new wallet/keypair for this blockchain.
   * 
   * @returns {Promise<{publicKey: string, privateKey: string}>} New wallet credentials
   * @example
   * const wallet = await service.createWallet();
   * console.log(wallet.publicKey); // "9B5XszUG..."
   */
  createWallet(): Promise<{ publicKey: string; privateKey: string }>;

  /**
   * Derives public keys from an array of private keys (batch operation).
   * 
   * @param {string[]} privateKeys - Array of private keys in chain-specific format
   * @returns {string[]} Array of corresponding public keys
   * @example
   * const pubkeys = service.getPubkeysFromSecrets(["5Kd3N...", "L1aW3t..."]);
   */
  getPubkeysFromSecrets(privateKeys: string[]): string[];

  /**
   * Detects and extracts public keys/addresses from a text string.
   * 
   * @param {string} input - Text to search for addresses
   * @param {any} [options] - Chain-specific detection options
   * @returns {string[]} Array of detected public keys
   * @example
   * const addresses = service.detectPubkeysFromString("Send to 9B5XszUG...");
   */
  detectPubkeysFromString(input: string, options?: any): string[];

  /**
   * Detects and extracts private keys from a text string (optional).
   * Returns keys with their encoding format.
   * 
   * @param {string} input - Text to search for private keys
   * @returns {IntelDetectedKey[]} Array of detected keys with format information
   * @example
   * const keys = service.detectPrivateKeysFromString?.("My key: 5Kd3N...");
   */
  detectPrivateKeysFromString?(input: string): IntelDetectedKey[];

  // ========================================
  // Address Validation
  // ========================================

  /**
   * Validates whether a string is a valid address for this blockchain (optional).
   * 
   * @param {string} publicKey - Address to validate
   * @returns {boolean} True if valid address
   * @example
   * const valid = service.isValidAddress?.("9B5XszUG...");
   */
  isValidAddress?(publicKey: string): boolean;

  /**
   * Validates multiple addresses (batch operation, optional).
   * 
   * @param {string[]} publicKeys - Array of addresses to validate
   * @returns {boolean[]} Array of validation results (same order as input)
   * @example
   * const results = service.AreValidAddresses?.(["addr1", "addr2", "invalid"]);
   * // returns [true, true, false]
   */
  AreValidAddresses?(publicKeys: string[]): boolean[];

  /**
   * Determines the type of each address (optional).
   * E.g., "Wallet", "Token", "Token Account", "Program"
   * 
   * @param {string[]} publicKeys - Array of addresses to check
   * @returns {Record<string, string>} Map of address to type
   * @example
   * const types = service.getAddressesTypes?.(["addr1", "addr2"]);
   * // returns { "addr1": "Wallet", "addr2": "Token" }
   */
  getAddressesTypes?(publicKeys: string[]): Record<string, string>;

  // ========================================
  // Signature Operations
  // ========================================

  /**
   * Signs multiple messages with their respective private keys (batch, optional).
   * 
   * @param {Array<{privateKey: string, message: string}>} requests - Array of signing requests
   * @returns {Promise<Array<{signature: string, publicKey: string}>>} Array of signatures with public keys
   * @example
   * const sigs = await service.signMessages?.([
   *   { privateKey: "5Kd3N...", message: "Hello" }
   * ]);
   */
  signMessages?(requests: Array<{ privateKey: string; message: string }>): Promise<Array<{ signature: string; publicKey: string }>>;

  /**
   * Verifies a message signature (required).
   * 
   * @param {string} publicKey - Public key that allegedly signed the message
   * @param {string} message - Original message that was signed
   * @param {string} signature - Signature to verify
   * @returns {boolean} True if signature is valid
   * @example
   * const valid = service.verifySignature("9B5XszUG...", "Hello", "3Ag8...");
   */
  verifySignature(publicKey: string, message: string, signature: string): boolean;

  // ========================================
  // Balance & Portfolio (batch operations)
  // ========================================

  /**
   * Gets token balances for multiple wallets and tokens (batch, optional).
   * Returns the cross-product: each wallet × each token.
   * 
   * @param {string[]} publicKeys - Array of wallet addresses
   * @param {string[]} caipAssetIds - Array of CAIP asset identifiers
   * @returns {Promise<IntelTokenBalance[]>} Array of balance records
   * @example
   * const balances = await service.getBalances?.(
   *   ["wallet1", "wallet2"],
   *   ["solana:mainnet/spl-token:USDC..."]
   * );
   */
  getBalances?(publicKeys: string[], caipAssetIds: string[]): Promise<IntelTokenBalance[]>;

  /**
   * Gets complete portfolio for multiple wallets (batch, optional).
   * Includes native balance and all token holdings.
   * 
   * @param {string[]} publicKeys - Array of wallet addresses
   * @returns {Promise<IntelPortfolio[]>} Array of portfolio records
   * @example
   * const portfolios = await service.getPortfolio?.(["wallet1", "wallet2"]);
   */
  getPortfolio?(publicKeys: string[]): Promise<IntelPortfolio[]>;

  // ========================================
  // Token Metadata (batch operations)
  // ========================================

  /**
   * Gets detailed metadata for multiple tokens (batch, optional).
   * 
   * @param {string[]} caipAssetIds - Array of CAIP asset identifiers
   * @returns {Promise<Record<string, IntelTokenMetadata>>} Map of asset ID to metadata
   * @example
   * const metadata = await service.getTokenDetails?.(["solana:mainnet/spl-token:USDC..."]);
   */
  getTokenDetails?(caipAssetIds: string[]): Promise<Record<string, IntelTokenMetadata>>;

  /**
   * Gets symbols for multiple tokens (batch, optional).
   * Note: Takes raw token addresses, not CAIP format.
   * 
   * @param {string[]} tokenAddresses - Array of token contract addresses
   * @returns {Promise<Record<string, string|null>>} Map of address to symbol
   * @example
   * const symbols = await service.getTokensSymbols?.(["EPjFWdd5..."]);
   * // returns { "EPjFWdd5...": "USDC" }
   */
  getTokensSymbols?(tokenAddresses: string[]): Promise<Record<string, string | null>>;

  /**
   * Gets decimal places for multiple tokens (batch, optional).
   * Note: Takes raw token addresses, not CAIP format.
   * 
   * @param {string[]} tokenAddresses - Array of token contract addresses
   * @returns {Promise<number[]>} Array of decimal values (same order as input)
   * @example
   * const decimals = await service.getDecimals?.(["EPjFWdd5..."]);
   * // returns [6] for USDC
   */
  getDecimals?(tokenAddresses: string[]): Promise<number[]>;

  /**
   * Gets circulating supply for multiple tokens (batch, optional).
   * Note: Takes raw token addresses, not CAIP format.
   * 
   * @param {string[]} tokenAddresses - Array of token contract addresses
   * @returns {Promise<Record<string, string>>} Map of address to supply
   * @example
   * const supplies = await service.getCirculatingSupplies?.(["EPjFWdd5..."]);
   */
  getCirculatingSupplies?(tokenAddresses: string[]): Promise<Record<string, string>>;

  // ========================================
  // Transfers (batch operations)
  // ========================================

  /**
   * Executes multiple token transfers (batch, optional).
   * Handles both native tokens and standard tokens.
   * 
   * @param {IntelTransferParams[]} params - Array of transfer requests
   * @returns {Promise<IntelTransferResult[]>} Array of transfer results
   * @example
   * const results = await service.transfer?.([{
   *   from: "privateKey123",
   *   to: "recipient...",
   *   amount: "1000000",
   *   caipAssetId: "solana:mainnet/native:SOL"
   * }]);
   */
  transfer?(params: IntelTransferParams[]): Promise<IntelTransferResult[]>;

  // ========================================
  // Trading (for exchange integration)
  // ========================================

  /**
   * Lists all available exchanges/DEXs on this chain (optional).
   * 
   * @returns {Promise<IntelExchange[]>} Array of available exchanges
   * @example
   * const exchanges = await service.listExchanges?.();
   * // returns [{ id: 1, name: "Jupiter", chain: "solana" }, ...]
   */
  listExchanges?(): Promise<IntelExchange[]>;

  /**
   * Selects the best exchange for trading (optional).
   * Implementation-specific logic for choosing optimal DEX.
   * 
   * @returns {Promise<number>} Exchange ID
   * @example
   * const exchangeId = await service.selectExchange?.();
   */
  selectExchange?(): Promise<number>;

  /**
   * Executes a swap on a specific exchange (optional).
   * 
   * @param {number} exchangeId - ID of exchange to use
   * @param {any} params - Exchange-specific swap parameters
   * @returns {Promise<any>} Swap result (format varies by exchange)
   * @example
   * const result = await service.doSwapOnExchange?.(1, swapParams);
   */
  doSwapOnExchange?(exchangeId: number, params: any): Promise<any>;
}
