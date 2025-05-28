import {
  elizaLogger,
  HandlerCallback,
  AgentRuntime,
  Memory,
  parseJSONObjectFromText,
  State,
  IAgentRuntime,
  ModelType,
  composePromptFromState,
  UUID,
  Action,
  Task
} from '@elizaos/core';
import {
  Keypair,
  PublicKey,
  TransactionSignature,
  Transaction,
  Signer,
  Connection,
} from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { getPositionAddress } from '@orca-so/whirlpools-client';
import { sqrtPriceToPrice } from '@orca-so/whirlpools-core';
import { sendTransaction } from '../utils/sendTransaction';
import {
  closePositionInstructions,
  IncreaseLiquidityQuoteParam,
  openPositionInstructions,
  setDefaultFunder,
  setDefaultSlippageToleranceBps
} from '@orca-so/whirlpools';
import { loadWallet } from '../utils/loadWallet';
import { v4 as uuidv4 } from 'uuid';
import {
  buildWhirlpoolClient,
  WhirlpoolContext
} from '@orca-so/whirlpools-sdk';
import { Address } from '@solana/addresses';
import { GetAccountInfoApi, GetMultipleAccountsApi, GetMinimumBalanceForRentExemptionApi, GetEpochInfoApi } from '@solana/rpc-api';
import { acquireService } from '../utils/utils';

interface FetchedPosition {
  whirlpoolAddress: string;
  positionMint: string;
  inRange: boolean;
  distanceCenterPositionFromPoolPriceBps: number;
  positionWidthBps: number;
}

interface NewPriceBounds {
  newLowerPrice: number;
  newUpperPrice: number;
}

interface ManagePositionsInput {
  repositionThresholdBps: number;
  intervalSeconds: number;
  slippageToleranceBps: number;
}

interface TransactionSigner {
  publicKey: PublicKey;
  signTransaction(tx: Transaction): Promise<Transaction>;
  signAllTransactions(txs: Transaction[]): Promise<Transaction[]>;
}

interface PositionService {
  register_position: (position: FetchedPosition) => Promise<string>;
  close_position: (positionId: string) => Promise<boolean>;
  open_position: (params: OpenPositionParams) => Promise<string>;
}

interface OpenPositionParams {
  whirlpoolAddress: string;
  liquidityQuote: IncreaseLiquidityQuoteParam;
  lowerPrice: number;
  upperPrice: number;
}

// Create a wrapper type that combines Connection with Orca's required methods
type OrcaConnection = Connection & GetAccountInfoApi & GetMultipleAccountsApi &
  GetMinimumBalanceForRentExemptionApi & GetEpochInfoApi;

export const managePositions: Action = {
  name: 'manage_positions',
  similes: ['AUTOMATE_REBALANCING', 'AUTOMATE_POSITIONS', 'START_MANAGING_POSITIONS'],
  description:
    'Automatically manage positions by rebalancing them when they drift too far from the pool price',

  validate: async (runtime: AgentRuntime, message: Memory): Promise<boolean> => {
    const config = await extractAndValidateConfiguration(message.content.text, runtime);
    if (!config) {
      elizaLogger.warn('Validation failed: No valid configuration provided.');
      return false;
    }
    return true;
  },

  handler: async (
    runtime: AgentRuntime,
    message: Memory,
    state: State,
    params: { [key: string]: unknown },
    callback?: HandlerCallback
  ) => {
    elizaLogger.log('Start managing positions');

    // Get configuration
    const config: ManagePositionsInput = await extractAndValidateConfiguration(message.content.text, runtime);
    const fetchedPositions = await extractFetchedPositions(state.providers, runtime);

    const { signer: wallet } = await loadWallet(runtime, true);
    const connection = new Connection(runtime.getSetting('SOLANA_RPC_URL')) as unknown as OrcaConnection;
    setDefaultSlippageToleranceBps(config.slippageToleranceBps);

    // Create transaction signer
    const transactionSigner: TransactionSigner = {
      publicKey: wallet.publicKey,
      signTransaction: async (tx: Transaction) => {
        tx.partialSign(wallet);
        return tx;
      },
      signAllTransactions: async (txs: Transaction[]) => {
        return txs.map(tx => {
          tx.partialSign(wallet);
          return tx;
        });
      }
    };

    setDefaultFunder(toAddress(transactionSigner.publicKey));

    // Initialize services
    const positionService = await acquireService(runtime, 'POSITION_MANAGER', 'position management service');
    const whirlpoolClient = buildWhirlpoolClient({
      connection,
      wallet: { publicKey: wallet.publicKey },
    } as unknown as WhirlpoolContext);

    // Register positions for monitoring
    for (const position of fetchedPositions) {
      const positionId = await positionService.register_position(position);

      // Create rebalancing task
      await runtime.createTask({
        id: uuidv4() as UUID,
        name: `monitor_position_${positionId}`,
        type: 'MONITOR',
        description: `Monitor and rebalance position ${positionId}`,
        tags: ['queue', 'repeat', 'position', 'monitor'],
        schedule: { interval: config.intervalSeconds * 1000 },
        execute: async () => {
          await checkAndRebalancePosition(
            position,
            config.repositionThresholdBps,
            connection,
            wallet,
            whirlpoolClient,
            positionService
          );
        }
      } as Task);
    }

    return true;
  },
  examples: [],
};

async function extractFetchedPositions(
  text: string,
  runtime: AgentRuntime
): Promise<FetchedPosition[]> {
  const prompt = `Given this message: "${text}", extract the available data and return a JSON object with the following structure:
        [
            {
                "whirlpoolAddress": string,
                "positionMint": string,
                "inRange": boolean,
                "distanceCenterPositionFromPoolPriceBps": number,
                "positionWidthBps": number
            },
        ]
    `;

  const memory: Memory = {
    id: uuidv4() as UUID,
    entityId: runtime.agentId,
    roomId: 'global' as UUID,
    content: {
      text: prompt,
      type: 'text'
    },
    createdAt: Date.now(),
  };

  const state = await runtime.composeState(memory);

  const content = await runtime.useModel(ModelType.LARGE, {
    prompt: composePromptFromState({
      state: state,
      template: prompt,
    })
  });

  const fetchedPositions = parseJSONObjectFromText(content) as FetchedPosition[];
  return fetchedPositions;
}

function validateManagePositionsInput(obj: Record<string, any>): ManagePositionsInput {
  if (
    typeof obj.repositionThresholdBps !== 'number' ||
    !Number.isInteger(obj.repositionThresholdBps) ||
    typeof obj.intervalSeconds !== 'number' ||
    !Number.isInteger(obj.intervalSeconds) ||
    typeof obj.slippageToleranceBps !== 'number' ||
    !Number.isInteger(obj.slippageToleranceBps)
  ) {
    throw new Error('Invalid input: Object does not match the ManagePositionsInput type.');
  }
  return obj as ManagePositionsInput;
}

export async function extractAndValidateConfiguration(
  text: string,
  runtime: IAgentRuntime,
  position?: FetchedPosition,
  whirlpoolData?: any
): Promise<ManagePositionsInput | null> {
  elizaLogger.log('Extracting and validating configuration from text:', text);

  // Default values for reference
  const defaultConfig = {
    repositionThresholdBps: 500, // 5% drift threshold
    intervalSeconds: 300, // 5 minutes
    slippageToleranceBps: 100 // 1% slippage tolerance
  };

  const prompt = `Given this message: "${text}". Extract or suggest the reposition threshold value, time interval, and slippage tolerance.
        The threshold value and the slippage tolerance can be given in percentages or bps. You will always respond with the reposition threshold in bps.
        
        Current position data:
        ${position ? JSON.stringify(position, null, 2) : 'No position data available'}
        
        Current whirlpool data:
        ${whirlpoolData ? JSON.stringify(whirlpoolData, null, 2) : 'No whirlpool data available'}
        
        If no values are provided in the message, suggest optimal values based on:
        - Pool volatility and volume
        - Current position width and range
        - Default reference values: ${JSON.stringify(defaultConfig, null, 2)}
        
        Return the response as a JSON object with the following structure:
        {
            "repositionThresholdBps": number (integer value),
            "intervalSeconds": number (integer value),
            "slippageToleranceBps": number (integer value)
        }
    `;

  const json = await runtime.useModel(ModelType.TEXT_SMALL, { prompt })
  console.log('json', json)

  try {
    const configuration = parseJSONObjectFromText(json);
    console.log('configuration', configuration)
    return validateManagePositionsInput(configuration);
  } catch (error) {
    elizaLogger.warn('Invalid configuration detected:', error);
    return null;
  }
}

function calculatePriceBounds(
  sqrtPrice: bigint,
  decimalsA: number,
  decimalsB: number,
  positionWidthBps: number
): NewPriceBounds {
  const currentPrice = sqrtPriceToPrice(sqrtPrice, decimalsA, decimalsB);
  const newLowerPrice = currentPrice * (1 - positionWidthBps / 10000);
  const newUpperPrice = currentPrice * (1 + positionWidthBps / 10000);

  return { newLowerPrice, newUpperPrice };
}

function toAddress(publicKey: PublicKey): Address {
  return publicKey.toBase58() as Address;
}

function toPublicKey(address: Address): PublicKey {
  return new PublicKey(address);
}

async function checkAndRebalancePosition(
  position: FetchedPosition,
  thresholdBps: number,
  connection: Connection,
  wallet: Keypair,
  whirlpoolClient: ReturnType<typeof buildWhirlpoolClient>,
  positionService: PositionService
) {
  const { inRange, distanceCenterPositionFromPoolPriceBps, positionWidthBps } = position;

  if (!inRange || distanceCenterPositionFromPoolPriceBps > thresholdBps) {
    try {
      const positionMintPublicKey = new PublicKey(position.positionMint);
      const pda = await getPositionAddress(toAddress(positionMintPublicKey));
      const positionAddress = pda[0];
      let whirlpoolPosition = await whirlpoolClient.getPosition(positionAddress);
      const whirlpoolAddress = whirlpoolPosition.getData().whirlpool;
      let whirlpool = await whirlpoolClient.getPool(whirlpoolAddress);

      // Close existing position
      const orcaConnection = {
        ...connection,
        getAccountInfo: (address: string) => connection.getAccountInfo(new PublicKey(address)),
        getMultipleAccountsInfo: (addresses: string[]) =>
          connection.getMultipleAccountsInfo(addresses.map(addr => new PublicKey(addr)))
      } as Rpc;

      const { instructions: closeInstructions, quote } = await closePositionInstructions(
        orcaConnection,
        toAddress(positionMintPublicKey)
      );
      const closeTxId = await sendTransaction(connection, closeInstructions, wallet);

      if (!closeTxId) {
        elizaLogger.warn(`Failed to close position ${position.positionMint}`);
        return;
      }

      // Calculate new position parameters
      const mintA = await getMint(connection, whirlpool.getData().tokenMintA);
      const mintB = await getMint(connection, whirlpool.getData().tokenMintB);
      const newPriceBounds = calculatePriceBounds(
        whirlpool.getData().sqrtPrice,
        mintA.decimals,
        mintB.decimals,
        positionWidthBps
      );

      // Open new position
      const increaseLiquidityQuoteParam: IncreaseLiquidityQuoteParam = {
        liquidity: quote.liquidityDelta,
      };

      const { instructions: openInstructions, positionMint: newPositionMint } =
        await openPositionInstructions(
          orcaConnection,
          toAddress(whirlpoolAddress),
          increaseLiquidityQuoteParam,
          newPriceBounds.newLowerPrice,
          newPriceBounds.newUpperPrice
        );

      const openTxId = await sendTransaction(connection, openInstructions, wallet);

      if (openTxId) {
        elizaLogger.log(`Successfully rebalanced position. New position mint: ${newPositionMint}`);
      }

    } catch (error) {
      elizaLogger.error(`Error rebalancing position ${position.positionMint}:`, error);
    }
  }
}