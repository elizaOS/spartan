import { type IAgentRuntime, logger, Service } from '@elizaos/core';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
// import { calculateDynamicSlippage } from '../utils/analyzeTrade'; // Assuming slippage calc moves or is handled by Solana plugin
import bs58 from 'bs58';

// Define an interface for the expected Solana Plugin Service
// This is an assumption of what @elizaos/plugin-solana might provide.
interface ISolanaPluginService extends Service {
  executeSwap: (params: {
    inputMint: string;
    outputMint: string;
    amount: string; // Amount in base units
    slippageBps: number;
    payerAddress: string; // Public key of the payer
    priorityFeeMicroLamports?: number;
    // Potentially other options like specific DEX, wrap/unwrap SOL etc.
  }) => Promise<{
    success: boolean;
    signature?: string;
    error?: string;
    outAmount?: string;
    inAmount?: string;
    swapUsdValue?: string;
  }>; // Extended to include more details
  getSolBalance: (publicKey: string) => Promise<number>; // Returns SOL balance
  getTokenBalance: (
    publicKey: string,
    mintAddress: string
  ) => Promise<{ amount: string; decimals: number; uiAmount: number } | null>;
  getPublicKey: () => Promise<string>; // Gets the public key managed by the Solana plugin
}

export interface WalletOperationResult {
  success: boolean;
  signature?: string;
  error?: string;
  outAmount?: string; // Amount of token received by the user
  inAmount?: string; // Amount of token sent by the user
  swapUsdValue?: string; // USD value of the swap
}

export class WalletService {
  public static readonly serviceType = 'wallet'; // Matches ServiceTypes.WALLET
  public capabilityDescription = 'Manages wallet operations via the Solana Plugin';
  private runtime: IAgentRuntime;
  private solanaPluginService: ISolanaPluginService | null = null;
  private walletPublicKey: string | null = null;

  // Removed: connection, keypair, CONFIRMATION_CONFIG as these should be managed by Solana Plugin

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  async initialize(): Promise<void> {
    try {
      // Attempt to get the Solana service from the runtime.
      // The actual service name ('solana' or similar) depends on how @elizaos/plugin-solana registers itself.
      const service = this.runtime.getService<ISolanaPluginService>('solana');
      if (!service) {
        throw new Error(
          '@elizaos/plugin-solana service not found. Ensure it is registered and started.'
        );
      }
      this.solanaPluginService = service;

      // Get and store the public key from the Solana plugin
      this.walletPublicKey = await this.solanaPluginService.getPublicKey();
      if (!this.walletPublicKey) {
        throw new Error('Failed to retrieve public key from Solana plugin service.');
      }

      logger.info(
        `WalletService initialized. Using Solana Plugin for wallet: ${this.walletPublicKey}`
      );
    } catch (error) {
      logger.error('Failed to initialize WalletService with Solana Plugin:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    // No direct connections or keypairs to clear here.
    // SolanaPluginService would manage its own lifecycle.
    this.solanaPluginService = null;
    this.walletPublicKey = null;
    logger.info('WalletService stopped.');
  }

  private ensureSolanaService(): ISolanaPluginService {
    if (!this.solanaPluginService) {
      throw new Error('Solana Plugin Service not initialized or available.');
    }
    return this.solanaPluginService;
  }

  private async ensurePublicKey(): Promise<string> {
    if (!this.walletPublicKey) {
      // Attempt to re-fetch if null, though initialize should have set it.
      this.walletPublicKey = await this.ensureSolanaService().getPublicKey();
      if (!this.walletPublicKey) {
        throw new Error('Wallet public key could not be determined via Solana Plugin.');
      }
    }
    return this.walletPublicKey;
  }

  // This method now provides access to operations that use the SolanaPluginService
  async getWallet() {
    const solService = this.ensureSolanaService();
    const payerAddress = await this.ensurePublicKey(); // Use the public key from the plugin

    return {
      publicKey: payerAddress, // Provide the public key obtained from the plugin

      // executeTrade is now a direct call to solanaPluginService.executeSwap
      // The internal Jupiter logic is removed.
      async buy({
        tokenAddress,
        amountInSol,
        slippageBps,
      }: {
        tokenAddress: string;
        amountInSol: number;
        slippageBps: number;
      }): Promise<WalletOperationResult> {
        const SOL_MINT = 'So11111111111111111111111111111111111111112';
        try {
          const result = await solService.executeSwap({
            inputMint: SOL_MINT,
            outputMint: tokenAddress,
            amount: Math.floor(amountInSol * 1e9).toString(), // Convert SOL to lamports
            slippageBps,
            payerAddress,
          });
          return result;
        } catch (error) {
          logger.error('WalletService Buy Error (via Solana Plugin):', error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      },

      async sell({
        tokenAddress,
        tokenAmount,
        slippageBps,
      }: {
        tokenAddress: string;
        tokenAmount: string;
        slippageBps: number;
      }): Promise<WalletOperationResult> {
        const SOL_MINT = 'So11111111111111111111111111111111111111112';
        try {
          // tokenAmount is expected to be in base units of the token
          const result = await solService.executeSwap({
            inputMint: tokenAddress,
            outputMint: SOL_MINT,
            amount: tokenAmount, // Already in base units
            slippageBps,
            payerAddress,
          });
          return result;
        } catch (error) {
          logger.error('WalletService Sell Error (via Solana Plugin):', error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
    };
  }

  // Uses SolanaPluginService for getting SOL balance
  async getBalance(): Promise<number> {
    const solService = this.ensureSolanaService();
    const publicKey = await this.ensurePublicKey();
    try {
      const balance = await solService.getSolBalance(publicKey); // Returns SOL
      return balance;
    } catch (error) {
      logger.error(`Error getting wallet balance for ${publicKey} via Solana Plugin:`, error);
      throw error;
    }
  }

  // Optional: Expose a way to get SPL token balances if needed directly by DegenTrader plugin
  async getTokenBalance(
    tokenMintAddress: string
  ): Promise<{ amount: string; decimals: number; uiAmount: number } | null> {
    const solService = this.ensureSolanaService();
    const publicKey = await this.ensurePublicKey();
    try {
      const balanceInfo = await solService.getTokenBalance(publicKey, tokenMintAddress);
      return balanceInfo;
    } catch (error) {
      logger.error(
        `Error getting token balance for ${tokenMintAddress} for wallet ${publicKey} via Solana Plugin:`,
        error
      );
      throw error; // or return null based on desired error handling
    }
  }

  // Added to provide direct access to the public key
  async getPublicKey(): Promise<string> {
    return this.ensurePublicKey();
  }
}
