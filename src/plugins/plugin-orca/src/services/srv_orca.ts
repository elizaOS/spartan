import { Service, IAgentRuntime, logger } from '@elizaos/core';
import { address, Address, Rpc, SignatureBytes, signTransaction, SolanaRpcApi, TransactionSigner } from '@solana/kit';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { FetchedPosition, OpenPositionParams } from '../types';
import { buildWhirlpoolClient, WhirlpoolContext } from '@orca-so/whirlpools-sdk';
import { closePositionInstructions, IncreaseLiquidityQuoteParam, openPositionInstructions } from '@orca-so/whirlpools';
import { getPositionAddress } from '@orca-so/whirlpools-client';
import { getMint } from '@solana/spl-token';
import { sendTransaction } from '../utils/sendTransaction';
import { fetchPositionsForOwner, HydratedPosition, setDefaultFunder } from "@orca-so/whirlpools";
import { fetchWhirlpool, Whirlpool } from "@orca-so/whirlpools-client";
import { fetchMint, Mint } from "@solana-program/token-2022";
import { sqrtPriceToPrice, tickIndexToPrice } from '@orca-so/whirlpools-core';
import bs58 from 'bs58';
import { SetDefaultBaseFeeRateInput } from "@orca-so/whirlpools-client";

// Change interface to match the one from positionProvider.ts
export interface FetchedPositionStatistics {
  whirlpoolAddress: string;  // Changed from Address
  positionMint: string;      // Changed from Address
  inRange: boolean;
  distanceCenterPositionFromPoolPriceBps: number;
  positionWidthBps: number;
}

export class OrcaService extends Service {
  private connection: Connection;
  private wallet: Keypair;
  private isRunning = false;
  private registeredPositions: Map<string, FetchedPosition> = new Map(); // For register_position

  static serviceType = 'ORCA_SERVICE'; // Changed back from 'POSITION_SERVICE'
  capabilityDescription = 'Provides Orca DEX integration and position management'; // Retaining updated description

  constructor(public runtime: IAgentRuntime) {
    super(runtime);
    this.connection = new Connection(runtime.getSetting('SOLANA_RPC_URL'));
    // You'll need to implement getting the wallet from runtime
    this.wallet = null; // Initialize this properly based on your needs
    console.log('ORCA_SERVICE cstr');
  }

  static async start(runtime: IAgentRuntime): Promise<Service> {
    console.log('ORCA_SERVICE trying to start');
    return new OrcaService(runtime);
  }

  async start() {
    console.log('ORCA_SERVICE trying to start'); // Updated log to reflect ORCA_SERVICE
  }

  async stop() {
    console.log('ORCA_SERVICE trying to stop'); // Updated log to reflect ORCA_SERVICE
  }

  private getWalletKeypair(): Keypair {
    try {
      const privateKeyString = this.runtime.getSetting('SOLANA_PRIVATE_KEY');
      if (!privateKeyString) {
        logger.error('Private key not found in settings');
        throw new Error('Private key not found');
      }

      const privateKeyBytes = bs58.decode(privateKeyString);
      return Keypair.fromSecretKey(privateKeyBytes);
    } catch (error) {
      logger.error('Failed to create keypair:', error);
      throw error;
    }
  }

  async register_position(position: FetchedPosition): Promise<string> {
    logger.debug('=== Registering Position ===');
    logger.debug('Position details:', {
      mint: position.positionMint,
      whirlpool: position.whirlpoolAddress,
      inRange: position.inRange,
      distanceFromCenter: position.distanceCenterPositionFromPoolPriceBps,
      width: position.positionWidthBps
    });

    this.registeredPositions.set(position.positionMint, position);

    logger.debug('Current registered positions:',
      Array.from(this.registeredPositions.entries()).map(([key, pos]) => ({
        mint: key,
        whirlpool: pos.whirlpoolAddress,
        inRange: pos.inRange
      }))
    );

    return position.positionMint;
  }

  private setupFeeCollection() {
    try {
      if (!this.wallet) {
        logger.error('Cannot setup fee collection - wallet not initialized');
        return false;
      }

      // Convert wallet public key to Address type
      const feeCollector = this.wallet.publicKey.toBase58() as Address;

      // Set up fee collection parameters
      const feeParams: SetDefaultBaseFeeRateInput = {
        whirlpoolsConfig: feeCollector,
        defaultBaseFeeRate: 100, // 1% fee
        feeAuthority: {
          address: this.wallet.publicKey.toBase58() as Address,
          signTransactions: async (txs) => {
            const signatures = await Promise.all(txs.map(tx => {
              const signature = this.wallet.secretKey.slice(0, 64);
              return { [this.wallet.publicKey.toBase58() as Address]: signature as SignatureBytes };
            }));
            return signatures;
          }
        },
        adaptiveFeeTier: feeCollector
      };

      logger.debug('Setting up fee collection:', {
        collector: feeCollector,
        params: feeParams
      });

      return true;
    } catch (error) {
      logger.error('Error setting up fee collection:', error);
      return false;
    }
  }

  async close_position(positionId: string): Promise<boolean> {
    try {
      logger.debug(`OrcaService: close_position called for ID ${positionId}`);

      // Get fresh keypair for this transaction
      this.wallet = this.getWalletKeypair();
      if (!this.wallet) {
        logger.error('Failed to initialize wallet keypair');
        return false;
      }

      // Setup fee collection
      //if (!this.setupFeeCollection()) {
      //  logger.warn('Failed to setup fee collection, proceeding with default fees');
      //}

      // Set the default funder to the wallet's public key
      setDefaultFunder(this.wallet.publicKey.toBase58() as Address);

      const positionData = this.registeredPositions.get(positionId);

      if (!positionData) {
        logger.warn(`OrcaService: Position ${positionId} not found in registered positions. Cannot close on-chain as its details (e.g., whirlpool address) are unknown.`);
        return false;
      }

      try {
        const positionMintPublicKey = new PublicKey(positionId);
        const whirlpoolAddress = positionData.whirlpoolAddress as Address;

        // Get the PDA for the position, which is required for closing.
        const positionMintAddress = address(positionId);
        const positionPda = getPositionAddress(positionMintAddress);
        const positionAddressForInstruction = positionPda[0];

        logger.info(`Attempting to close position on-chain: Mint ${positionId}, Whirlpool ${whirlpoolAddress}, PDA ${positionAddressForInstruction}`);

        const rpcAdapter: Rpc<SolanaRpcApi> = this.connection as unknown as Rpc<SolanaRpcApi>;

        const { instructions } = await closePositionInstructions(
          rpcAdapter,
          positionMintAddress,
        );

        if (!instructions || instructions.length === 0) {
          logger.error(`OrcaService: No instructions generated for closing position ${positionId}. This might happen if the position is already closed or invalid.`);
          return false;
        }

        logger.debug(`Generated ${instructions.length} instruction(s) for closing position ${positionId}.`);

        const txId = await sendTransaction(this.connection, instructions, this.wallet);

        if (txId) {
          logger.info(`OrcaService: Successfully closed position ${positionId} on-chain. Transaction ID: ${txId}`);
          this.registeredPositions.delete(positionId);
          logger.info(`OrcaService: Position ${positionId} unregistered locally.`);
          return true;
        } else {
          logger.error(`OrcaService: Failed to send transaction for closing position ${positionId}. No TxId received.`);
          return false;
        }

      } catch (error) {
        logger.error(`OrcaService: Error during on-chain closure of position ${positionId}:`, error);
        if (error instanceof Error && error.stack) {
          logger.error('Stack trace:', error.stack);
        }
        // Do not unregister locally if on-chain closure failed
        return false;
      }
    } catch (error) {
      logger.error('Error in close_position:', error);
      if (error instanceof Error && error.stack) {
        logger.error('Stack trace:', error.stack);
      }
      return false;
    }
  }

  async open_position(params: OpenPositionParams): Promise<string | null> {
    try {
      logger.info('OrcaService: open_position called.');
      logger.debug('Attempting to open position with params:', params);

      // Check if this.wallet is initialized
      if (!this.wallet) {
        logger.error('OrcaService: Wallet is not initialized. Cannot proceed with open_position.');
        throw new Error('Wallet not initialized in OrcaService.');
      }

      // 1. Fetch existing positions for the wallet
      const ownerAddress = toAddress(this.wallet.publicKey);
      logger.info(`Checking existing positions for wallet: ${ownerAddress}`);

      const existingPositions = await this.fetchPositions(
        this.connection as unknown as Rpc<SolanaRpcApi>,
        ownerAddress
      );

      if (existingPositions && existingPositions.length > 0) {
        logger.info(`Found ${existingPositions.length} existing position(s) for wallet ${ownerAddress}. Not opening a new one.`);
        existingPositions.forEach((pos, index) => {
          logger.info(`Existing position ${index + 1}: Mint: ${pos.positionMint}, Whirlpool: ${pos.whirlpoolAddress}, InRange: ${pos.inRange}`);
        });
        return null;
      }

      logger.info(`No existing positions found for wallet ${ownerAddress}. Proceeding to open a new position.`);

      const { instructions, positionMint } = await openPositionInstructions(
        this.connection as unknown as Rpc<any>,
        params.whirlpoolAddress as Address,
        {
          liquidity: BigInt(params.tokenAmount || 0),
        } as IncreaseLiquidityQuoteParam,
        params.lowerTick,
        params.upperTick
      );

      logger.info(`Attempting to send transaction to open position with mint: ${positionMint.toString()}`); // Assuming positionMint is PublicKey
      const openTxId = await sendTransaction(this.connection, instructions, this.wallet);

      if (!openTxId) {
        logger.error('Failed to open position: Transaction ID not received.');
        throw new Error('Failed to open position');
      }

      logger.info(`Successfully opened new position. Mint: ${positionMint.toString()}, Transaction ID: ${openTxId}`);
      return positionMint.toString();

    } catch (error) {
      logger.error('Error in open_position:', error);
      if (error instanceof Error && error.stack) {
        logger.error('Stack trace:', error.stack);
      }
      throw error;
    }
  }

  async fetchPositions(
    rpc: Rpc<SolanaRpcApi>,
    ownerAddress: Address
  ): Promise<FetchedPositionStatistics[]> {
    try {
      logger.debug('=== Starting fetchPositions ===');
      logger.debug('Owner address:', ownerAddress);

      const ownerAddressString = ownerAddress.toString();
      logger.debug('Owner address as string:', ownerAddressString);

      // Custom replacer for JSON.stringify to handle BigInt
      const jsonReplacer = (key: string, value: any) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      };

      const positions = await fetchPositionsForOwner(rpc, ownerAddressString as Address);
      logger.debug('Raw positions fetched:', JSON.stringify(positions, jsonReplacer, 2));

      if (!positions || positions.length === 0) {
        logger.debug('No positions found for owner');
        return [];
      }

      const fetchedWhirlpools: Map<string, Whirlpool> = new Map();
      const fetchedMints: Map<string, Mint> = new Map();

      const FetchedPositionsStatistics = await Promise.all(
        positions.map(async (position) => {
          const positionData = (position as HydratedPosition).data;
          logger.debug('Processing position:', {
            positionMint: positionData.positionMint,
            whirlpool: positionData.whirlpool
          });

          const positionMint = positionData.positionMint;
          const whirlpoolAddress = positionData.whirlpool;

          if (!fetchedWhirlpools.has(whirlpoolAddress)) {
            logger.debug('Fetching new whirlpool:', whirlpoolAddress);
            const whirlpool = await fetchWhirlpool(rpc, whirlpoolAddress);
            if (whirlpool) {
              fetchedWhirlpools.set(whirlpoolAddress, whirlpool.data);
              logger.debug('Whirlpool fetched and cached');
            }
          }

          const whirlpool = fetchedWhirlpools.get(whirlpoolAddress);
          logger.debug('Whirlpool data:', {
            tokenMintA: whirlpool.tokenMintA,
            tokenMintB: whirlpool.tokenMintB,
            tickCurrentIndex: whirlpool.tickCurrentIndex
          });

          const { tokenMintA, tokenMintB } = whirlpool;

          if (!fetchedMints.has(tokenMintA)) {
            const mintA = await fetchMint(rpc, tokenMintA);
            fetchedMints.set(tokenMintA, mintA.data);
          }
          if (!fetchedMints.has(tokenMintB)) {
            const mintB = await fetchMint(rpc, tokenMintB);
            fetchedMints.set(tokenMintB, mintB.data);
          }

          const mintA = fetchedMints.get(tokenMintA);
          const mintB = fetchedMints.get(tokenMintB);

          const currentPrice = sqrtPriceToPrice(whirlpool.sqrtPrice, mintA.decimals, mintB.decimals);
          const positionLowerPrice = tickIndexToPrice(positionData.tickLowerIndex, mintA.decimals, mintB.decimals);
          const positionUpperPrice = tickIndexToPrice(positionData.tickUpperIndex, mintA.decimals, mintB.decimals);

          const inRange = whirlpool.tickCurrentIndex >= positionData.tickLowerIndex && whirlpool.tickCurrentIndex <= positionData.tickUpperIndex;
          const positionCenterPrice = (positionLowerPrice + positionUpperPrice) / 2;
          const distanceCenterPositionFromPoolPriceBps = Math.abs(currentPrice - positionCenterPrice) / currentPrice * 10000;
          const positionWidthBps = ((positionUpperPrice - positionLowerPrice) / positionCenterPrice * 10000) / 2;

          const result = {
            whirlpoolAddress: whirlpoolAddress.toString(),
            positionMint: positionMint.toString(),
            inRange,
            distanceCenterPositionFromPoolPriceBps,
            positionWidthBps,
          };

          logger.debug('Processed position result:', result);
          return result;
        })
      );

      logger.debug('=== Final results ===');
      logger.debug('Total positions processed:', FetchedPositionsStatistics.length);
      logger.debug('Positions:', JSON.stringify(FetchedPositionsStatistics, jsonReplacer, 2));

      return FetchedPositionsStatistics;
    } catch (error) {
      logger.error("Error fetching positions:", error);
      logger.error("Error stack:", error.stack);
      throw new Error("Error fetching positions");
    }
  }
}

function toAddress(publicKey: PublicKey): Address {
  return publicKey.toBase58() as Address;
}
