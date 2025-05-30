import { Service, IAgentRuntime, logger } from '@elizaos/core';
import { Address } from '@solana/addresses';
import { fetchPositionsForOwner, HydratedPosition } from "@orca-so/whirlpools"
import { fetchWhirlpool, Whirlpool } from "@orca-so/whirlpools-client";
import { sqrtPriceToPrice, tickIndexToPrice } from "@orca-so/whirlpools-core";
import { fetchMint, Mint } from "@solana-program/token-2022"
import { GetAccountInfoApi, GetMultipleAccountsApi, SolanaRpcApi } from '@solana/rpc-api';
import { Rpc } from '@solana/kit'
// Create a wrapper type that preserves original Connection methods and adds Orca-specific ones
export interface FetchedPositionStatistics {
  whirlpoolAddress: Address;
  positionMint: Address;
  inRange: boolean;
  distanceCenterPositionFromPoolPriceBps: number;
  positionWidthBps: number;
}

export class OrcaService extends Service {
  private isRunning = false;

  static serviceType = 'ORCA_SERVICE';
  capabilityDescription = 'Provides Orca DEX integration for LP management';

  constructor(public runtime: IAgentRuntime) {
    super(runtime);
    console.log('ORCA_SERVICE cstr');
  }

  static async start(runtime: IAgentRuntime) {
    console.log('ORCA_SERVICE trying to start');
    const service = new OrcaService(runtime);
    await service.start();
    return service;
  }

  async start() {
    console.log('ORCA_SERVICE trying to start');
  }

  async stop() {
    console.log('ORCA_SERVICE trying to stop');
  }

  async fetchPositions(
    rpc: Rpc<SolanaRpcApi>,
    ownerAddress: Address
  ): Promise<FetchedPositionStatistics[]> {
    logger.debug('OrcaService: fetchPositions called');
    try {
      console.log('ownerAddress', ownerAddress)
      const positions = await fetchPositionsForOwner(rpc, ownerAddress);
      console.log('positions', positions)
      const fetchedWhirlpools: Map<string, Whirlpool> = new Map();
      const fetchedMints: Map<string, Mint> = new Map();

      const FetchedPositionsStatistics = await Promise.all(
        positions.map(async (position) => {
          const positionData = (position as HydratedPosition).data;
          const positionMint = positionData.positionMint;
          const whirlpoolAddress = positionData.whirlpool;

          if (!fetchedWhirlpools.has(whirlpoolAddress)) {
            const whirlpool = await fetchWhirlpool(rpc, whirlpoolAddress);
            if (whirlpool) {
              fetchedWhirlpools.set(whirlpoolAddress, whirlpool.data);
            }
          }

          const whirlpool = fetchedWhirlpools.get(whirlpoolAddress);
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

          return {
            whirlpoolAddress,
            positionMint: positionMint,
            inRange,
            distanceCenterPositionFromPoolPriceBps,
            positionWidthBps,
          } as FetchedPositionStatistics;
        })
      );

      return FetchedPositionsStatistics;
    } catch (error) {
      console.error(error)
      return [];
    }
  }
}
