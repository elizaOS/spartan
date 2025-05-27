import {
  elizaLogger, AgentRuntime, State, IAgentRuntime, ProviderResult,
  Provider, Memory
} from '@elizaos/core';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  buildWhirlpoolClient,
  WhirlpoolContext,
  Position,
} from '@orca-so/whirlpools-sdk';
import { getMint } from '@solana/spl-token';
import { loadWallet } from '../utils/loadWallet';

export interface FetchedPositionStatistics {
  whirlpoolAddress: PublicKey;
  positionMint: PublicKey;
  inRange: boolean;
  distanceCenterPositionFromPoolPriceBps: number;
  positionWidthBps: number;
}

export const positionProvider: Provider = {
  name: 'degen-lp-position-provider',
  get: async (runtime: IAgentRuntime, message: Memory, state: State): Promise<ProviderResult> => {
    if (!state) {
      state = (await runtime.composeState(message)) as State;
    } else {
      state = await runtime.composeState(message) as State;
    }
    try {
      const { address: ownerAddress } = await loadWallet(runtime as AgentRuntime, false);
      const connection = new Connection((runtime as AgentRuntime).getSetting('SOLANA_RPC_URL'));
      const positions = await fetchPositions(connection, ownerAddress);
      return { values: positions };
    } catch (error) {
      elizaLogger.error('Error in wallet provider:', error);
      return { values: [] };
    }
  },
};

const fetchPositions = async (
  connection: Connection,
  ownerAddress: PublicKey
): Promise<FetchedPositionStatistics[]> => {
  try {
    const client = buildWhirlpoolClient({
      connection,
      wallet: { publicKey: ownerAddress },
    } as WhirlpoolContext);
    const positions = await client.getPositions([ownerAddress]);
    const fetchedWhirlpools = new Map();
    const fetchedMints = new Map();
    const FetchedPositionsStatistics: FetchedPositionStatistics[] = await Promise.all(
      Object.values(positions)
        .filter((position): position is Position => position !== null)
        .map(async (position: Position) => {
          const positionData = position.getData();
          const positionMint = position.getAddress();
          const whirlpoolAddress = positionData.whirlpool;

          if (!fetchedWhirlpools.has(whirlpoolAddress.toString())) {
            const whirlpool = await client.getPool(whirlpoolAddress);
            if (whirlpool) {
              fetchedWhirlpools.set(whirlpoolAddress.toString(), whirlpool);
            }
          }
          const whirlpool = fetchedWhirlpools.get(whirlpoolAddress.toString());
          const tokenMintA = whirlpool.getTokenAMint();
          const tokenMintB = whirlpool.getTokenBMint();

          if (!fetchedMints.has(tokenMintA.toString())) {
            const mintA = await getMint(connection, tokenMintA);
            fetchedMints.set(tokenMintA.toString(), mintA);
          }
          if (!fetchedMints.has(tokenMintB.toString())) {
            const mintB = await getMint(connection, tokenMintB);
            fetchedMints.set(tokenMintB.toString(), mintB);
          }
          const mintA = fetchedMints.get(tokenMintA.toString());
          const mintB = fetchedMints.get(tokenMintB.toString());

          const currentPrice = whirlpool.sqrtPriceX64ToPrice(
            whirlpool.getData().sqrtPrice,
            mintA.decimals,
            mintB.decimals
          );
          const positionLowerPrice = whirlpool.tickIndexToPrice(
            positionData.tickLowerIndex,
            mintA.decimals,
            mintB.decimals
          );
          const positionUpperPrice = whirlpool.tickIndexToPrice(
            positionData.tickUpperIndex,
            mintA.decimals,
            mintB.decimals
          );

          const currentTick = whirlpool.getData().tickCurrentIndex;
          const inRange =
            currentTick >= positionData.tickLowerIndex && currentTick <= positionData.tickUpperIndex;
          const positionCenterPrice = (positionLowerPrice + positionUpperPrice) / 2;
          const distanceCenterPositionFromPoolPriceBps =
            (Math.abs(currentPrice - positionCenterPrice) / currentPrice) * 10000;
          const positionWidthBps =
            (((positionUpperPrice - positionLowerPrice) / positionCenterPrice) * 10000) / 2;

          return {
            whirlpoolAddress,
            positionMint,
            inRange,
            distanceCenterPositionFromPoolPriceBps,
            positionWidthBps,
          } as FetchedPositionStatistics;
        })
    );

    return FetchedPositionsStatistics;
  } catch (error) {
    throw new Error('Error during fetching positions');
  }
};
