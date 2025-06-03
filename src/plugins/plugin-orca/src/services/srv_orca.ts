import { Service, IAgentRuntime, logger } from '@elizaos/core';
import {
  address, Address, createSolanaRpc, createKeyPairSignerFromBytes, SignatureBytes,
} from '@solana/kit';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';

import { FetchedPosition, OpenPositionParams } from '../types';
import { WhirlpoolData, PDAUtil as WhirlpoolPDAUtil } from '@orca-so/whirlpools-sdk';
import { closePositionInstructions, openPositionInstructions, decreaseLiquidityInstructions, resetPositionRangeInstructions } from '@orca-so/whirlpools';
import { fetchMaybePosition, fetchPosition, getPositionAddress } from '@orca-so/whirlpools-client';
import { sendTransaction } from '../utils/sendTransaction';
import { fetchPositionsForOwner, HydratedPosition, setDefaultFunder } from "@orca-so/whirlpools";
import { fetchWhirlpool, Whirlpool } from "@orca-so/whirlpools-client";
import { fetchAllMint, fetchMint, Mint } from "@solana-program/token-2022";
import { sqrtPriceToPrice, tickIndexToPrice, priceToTickIndex, getInitializableTickIndex } from '@orca-so/whirlpools-core';
import bs58 from 'bs58';
import { SetDefaultBaseFeeRateInput } from "@orca-so/whirlpools-client";
import BN from 'bn.js';

const MAINNET_WHIRLPOOLS_CONFIG_PUBKEY = new PublicKey("2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ");
const MAINNET_WHIRLPOOL_PROGRAM_ID = new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3dhpGDH");

const COMMON_QUOTE_TOKENS_MINTS: string[] = [
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "So11111111111111111111111111111111111111112", // WSOL
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
];

const TICK_SPACINGS_TO_CHECK: number[] = [1, 8, 64, 128];

export interface BestWhirlpoolInfo {
  address: string;         // Whirlpool public key address
  liquidity: string;       // Liquidity as a string (from BN.toString())
  tokenAMint: string;
  tokenBMint: string;
  tickSpacing: number;
  rawData: WhirlpoolData;  // The full data object for the whirlpool
}

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
  private rpc;
  private wallet: Keypair;
  private isRunning = false;
  private registeredPositions: Map<string, FetchedPosition> = new Map(); // For register_position

  static serviceType = 'ORCA_SERVICE';
  capabilityDescription = 'Provides Orca DEX integration and position management';

  constructor(runtime: IAgentRuntime) {
    super(runtime);
    this.connection = new Connection(runtime.getSetting('SOLANA_RPC_URL'));
    this.rpc = createSolanaRpc((runtime as AgentRuntime).getSetting('SOLANA_RPC_URL'));
    // Initialize wallet from private key
    const privateKeyString = runtime.getSetting('SOLANA_PRIVATE_KEY');
    if (!privateKeyString) {
      throw new Error('SOLANA_PRIVATE_KEY not found in settings');
    }
    const privateKeyBytes = bs58.decode(privateKeyString);
    this.wallet = Keypair.fromSecretKey(privateKeyBytes);
    createKeyPairSignerFromBytes(privateKeyBytes).then(signer => {
      this.signer = signer
      console.log('this.signer', this.signer)
    })
    logger.debug('ORCA_SERVICE: Wallet initialized');
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

      setDefaultFunder(this.signer);

      const positionMintAddress = address(positionId);
      logger.info(`Attempting to close position: Mint ${positionId}`);

      // Get position data to verify it exists
      const [positionAddress] = await getPositionAddress(positionMintAddress);
      const position = await fetchMaybePosition(this.rpc, positionAddress);

      if (!position.exists) {
        logger.error(`Position ${positionId} not found`);
        return false;
      }

      // Get close position instructions
      const { instructions, quote, feesQuote } = await closePositionInstructions(
        this.rpc,
        positionMintAddress
      );

      if (!instructions || instructions.length === 0) {
        logger.error('No instructions generated for closing position');
        return false;
      }

      // Add delay before sending transaction
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Send transaction
      const txId = await sendTransaction(this.rpc, instructions, this.wallet);
      logger.info(`Position close transaction sent: ${txId}`);

      // Add delay before verification
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify position was closed
      const positionAfter = await fetchMaybePosition(this.rpc, positionAddress);
      if (positionAfter.exists) {
        throw new Error('Position was not closed successfully');
      }

      logger.info(`Position closed successfully. Tokens returned: A=${quote.tokenEstA + feesQuote.feeOwedA}, B=${quote.tokenEstB + feesQuote.feeOwedB}`);
      logger.info(`OrcaService: Successfully closed position ${positionId} on-chain. Transaction ID: ${txId}`);
      this.registeredPositions.delete(positionId);
      logger.info(`OrcaService: Position ${positionId} unregistered locally.`);
      return true;

    } catch (error) {
      logger.error('Error in close_position:', error);
      return false;
    }
  }

  async open_position(params: OpenPositionParams): Promise<string | null> {
    logger.info('OrcaService: open_position called.');
    logger.debug('Attempting to open position with params:', params);

    try {
      const whirlpool = await fetchWhirlpool(
        this.rpc,
        params.whirlpoolAddress as Address
      );

      if (!whirlpool) {
        throw new Error('Whirlpool not found');
      }

      setDefaultFunder(this.signer);

      // Get token mints for price calculation
      const mintA = await fetchMint(this.rpc, whirlpool.data.tokenMintA);
      const mintB = await fetchMint(this.rpc, whirlpool.data.tokenMintB);

      // Convert price to tick indexes
      const lowerTickIndex = priceToTickIndex(
        params.lowerTick,
        mintA.data.decimals,
        mintB.data.decimals
      );
      const upperTickIndex = priceToTickIndex(
        params.upperTick,
        mintA.data.decimals,
        mintB.data.decimals
      );

      // Get initializable tick indexes
      const initializableLowerTick = getInitializableTickIndex(
        lowerTickIndex,
        whirlpool.data.tickSpacing,
        false
      );
      const initializableUpperTick = getInitializableTickIndex(
        upperTickIndex,
        whirlpool.data.tickSpacing,
        true
      );

      const { instructions, positionMint } = await openPositionInstructions(
        this.rpc,
        params.whirlpoolAddress as Address,
        {
          liquidity: BigInt(1_000_000_000)
        },
        initializableLowerTick,
        initializableUpperTick
      );

      const txId = await sendTransaction(this.rpc, instructions, this.wallet);
      logger.info(`Position opened successfully. TX: ${txId}, Position Mint: ${positionMint}`);

      // Verify position was created
      const [positionAddress] = await getPositionAddress(positionMint);
      const position = await fetchMaybePosition(this.rpc, positionAddress);

      if (!position.exists) {
        throw new Error('Position was not created successfully');
      }

      return positionMint.toString();
    } catch (error) {
      logger.error('Error in open_position:', error);
      throw error;
    }
  }

  async fetchPositions(
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

      const positions = await fetchPositionsForOwner(this.rpc, ownerAddressString as Address);
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
            const whirlpool = await fetchWhirlpool(this.rpc, whirlpoolAddress);
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
            const mintA = await fetchMint(this.rpc, tokenMintA);
            fetchedMints.set(tokenMintA, mintA.data);
          }
          if (!fetchedMints.has(tokenMintB)) {
            const mintB = await fetchMint(this.rpc, tokenMintB);
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

  async best_lp(
    inputTokenMintStr: string,
    amount: number
  ): Promise<BestWhirlpoolInfo | null> {
    let bestPoolFound: BestWhirlpoolInfo | null = null;
    let maxLiquidity = new BN(0);

    // First check existing positions
    const positions = await this.fetchPositions(this.wallet.publicKey.toBase58() as Address);

    // Look for positions containing the input token
    for (const position of positions) {
      const whirlpool = await fetchWhirlpool(this.rpc, position.whirlpoolAddress as Address);
      if (whirlpool &&
        (whirlpool.data.tokenMintA === inputTokenMintStr ||
          whirlpool.data.tokenMintB === inputTokenMintStr)) {
        const result = {
          address: position.whirlpoolAddress,
          liquidity: whirlpool.data.liquidity.toString(),
          tokenAMint: whirlpool.data.tokenMintA,
          tokenBMint: whirlpool.data.tokenMintB,
          tickSpacing: whirlpool.data.tickSpacing,
          rawData: whirlpool.data as unknown as WhirlpoolData
        };
        logger.info(`Found existing pool: ${result.address} (${result.tokenAMint}-${result.tokenBMint}) with liquidity ${result.liquidity}`);
        return result;
      }
    }

    // If no existing positions found, search for new pools
    logger.debug(`OrcaService: Searching for new pools for token ${inputTokenMintStr}`);

    for (const quoteTokenMintStr of COMMON_QUOTE_TOKENS_MINTS) {
      if (inputTokenMintStr === quoteTokenMintStr) continue;

      for (const tickSpacing of TICK_SPACINGS_TO_CHECK) {
        try {
          const whirlpoolPda = WhirlpoolPDAUtil.getWhirlpool(
            MAINNET_WHIRLPOOL_PROGRAM_ID,
            MAINNET_WHIRLPOOLS_CONFIG_PUBKEY,
            new PublicKey(inputTokenMintStr),
            new PublicKey(quoteTokenMintStr),
            tickSpacing
          );
          const whirlpool = await fetchWhirlpool(this.rpc, whirlpoolPda.publicKey.toBase58() as Address);

          if (whirlpool) {
            const currentLiquidity = new BN(whirlpool.data.liquidity);
            if (currentLiquidity.gt(maxLiquidity)) {
              maxLiquidity = currentLiquidity;
              bestPoolFound = {
                address: whirlpoolPda.publicKey.toBase58(),
                liquidity: currentLiquidity.toString(),
                tokenAMint: whirlpool.data.tokenMintA,
                tokenBMint: whirlpool.data.tokenMintB,
                tickSpacing: whirlpool.data.tickSpacing,
                rawData: whirlpool.data as unknown as WhirlpoolData
              };
            }
          }
        } catch (error) {
          // Only log that pool wasn't found, no stack trace
          logger.debug(`Pool not found for ${inputTokenMintStr}-${quoteTokenMintStr} with tick spacing ${tickSpacing}`);
        }
      }
    }

    if (bestPoolFound) {
      logger.info(`Found best new pool: ${bestPoolFound.address} with liquidity ${bestPoolFound.liquidity}`);
    } else {
      logger.info(`No suitable pools found for token ${inputTokenMintStr}`);
    }

    return bestPoolFound;
  }

  async reset_position(
    positionId: string,
    newLowerPrice: number,
    newUpperPrice: number
  ): Promise<boolean> {
    try {
      logger.info('OrcaService: reset_position called.');
      logger.debug(`Attempting to reset position ${positionId} to price range: ${newLowerPrice}-${newUpperPrice}`);

      setDefaultFunder(this.signer);

      const positionMintAddress = address(positionId);

      // Get position data to verify it exists
      const [positionAddress] = await getPositionAddress(positionMintAddress);
      const position = await fetchPosition(this.rpc, positionAddress);

      if (!position) {
        logger.error(`Position ${positionId} not found`);
        return false;
      }

      // First decrease liquidity to 0
      const { instructions: decreaseInstructions } = await decreaseLiquidityInstructions(
        this.rpc,
        positionMintAddress,
        {
          liquidity: position.data.liquidity
        }
      );

      const decreaseTxId = await sendTransaction(this.rpc, decreaseInstructions, this.wallet);
      logger.info(`Decreased liquidity to 0. TX: ${decreaseTxId}`);

      // Reset position range
      const { instructions: resetInstructions } = await resetPositionRangeInstructions(
        this.rpc,
        positionMintAddress,
        newLowerPrice,
        newUpperPrice,
        this.signer
      );

      const resetTxId = await sendTransaction(this.rpc, resetInstructions, this.wallet);
      logger.info(`Reset position range. TX: ${resetTxId}`);

      // Verify position was reset correctly
      const positionAfter = await fetchPosition(this.rpc, positionAddress);
      const whirlpool = await fetchWhirlpool(this.rpc, positionAfter.data.whirlpool);

      const [mintA, mintB] = await fetchAllMint(this.rpc, [
        whirlpool.data.tokenMintA,
        whirlpool.data.tokenMintB
      ]);

      const lowerTickIndex = priceToTickIndex(
        newLowerPrice,
        mintA.data.decimals,
        mintB.data.decimals
      );
      const upperTickIndex = priceToTickIndex(
        newUpperPrice,
        mintA.data.decimals,
        mintB.data.decimals
      );

      const initializableLowerTick = getInitializableTickIndex(
        lowerTickIndex,
        whirlpool.data.tickSpacing,
        false
      );
      const initializableUpperTick = getInitializableTickIndex(
        upperTickIndex,
        whirlpool.data.tickSpacing,
        true
      );

      if (
        positionAfter.data.tickLowerIndex !== initializableLowerTick ||
        positionAfter.data.tickUpperIndex !== initializableUpperTick
      ) {
        throw new Error('Position was not reset to correct tick range');
      }

      logger.info(`Successfully reset position ${positionId} to new price range`);
      return true;

    } catch (error) {
      logger.error('Error in reset_position:', error);
      return false;
    }
  }
}