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
} from '@elizaos/core';
import {
  Keypair,
  PublicKey,
  TransactionSignature,
  Transaction,
  Signer,
  Connection
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
    if (!state) {
      state = (await runtime.composeState(message)) as State;
    } else {
      state = await runtime.composeState(message) as State;
    }
    const { repositionThresholdBps, slippageToleranceBps }: ManagePositionsInput =
      await extractAndValidateConfiguration(message.content.text, runtime);
    const fetchedPositions = await extractFetchedPositions(state.providers, runtime);
    elizaLogger.log(
      `Validated configuration: repositionThresholdBps=${repositionThresholdBps}, slippageTolerance=${slippageToleranceBps}`
    );
    elizaLogger.log('Fetched positions:', fetchedPositions);

    const { signer: wallet } = await loadWallet(runtime, true);
    const connection = new Connection(runtime.getSetting('SOLANA_RPC_URL')) as unknown as OrcaConnection;
    setDefaultSlippageToleranceBps(slippageToleranceBps);

    // Create a TransactionSigner from the wallet
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

    await handleRepositioning(fetchedPositions, repositionThresholdBps, connection, wallet);

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
  runtime: IAgentRuntime
): Promise<ManagePositionsInput | null> {
  elizaLogger.log('Extracting and validating configuration from text:', text);

  const prompt = `Given this message: "${text}". Extract the reposition threshold value, time interval, and slippage tolerance.
        The threshold value and the slippage tolerance can be given in percentages or bps. You will always respond with the reposition threshold in bps.
        Very important: Add null values for each field that is not present in the message.
        Return the response as a JSON object with the following structure:
        {
            "repositionThresholdBps": number (integer value),
            "intervalSeconds": number (integer value),
            "slippageToleranceBps": number (integer value)
        }
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

  try {
    const configuration = parseJSONObjectFromText(state.content.text);
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

async function handleRepositioning(
  fetchedPositions: FetchedPosition[],
  repositionThresholdBps: number,
  connection: Connection,
  wallet: Keypair
) {
  const client = buildWhirlpoolClient({
    connection,
    wallet: { publicKey: wallet.publicKey },
  } as unknown as WhirlpoolContext);

  return await Promise.all(
    fetchedPositions.map(async (fetchedPosition) => {
      const { inRange, distanceCenterPositionFromPoolPriceBps, positionWidthBps } = fetchedPosition;
      if (!inRange || distanceCenterPositionFromPoolPriceBps > repositionThresholdBps) {
        const positionMintPublicKey = new PublicKey(fetchedPosition.positionMint);
        const pda = await getPositionAddress(toAddress(positionMintPublicKey));
        const positionAddress = pda[0];
        let position = await client.getPosition(positionAddress);
        const whirlpoolAddress = position.getData().whirlpool;
        let whirlpool = await client.getPool(whirlpoolAddress);
        const mintA = await getMint(connection, whirlpool.getData().tokenMintA);
        const mintB = await getMint(connection, whirlpool.getData().tokenMintB);
        const newPriceBounds: NewPriceBounds = calculatePriceBounds(
          whirlpool.getData().sqrtPrice,
          mintA.decimals,
          mintB.decimals,
          positionWidthBps
        );
        let newLowerPrice = newPriceBounds.newLowerPrice;
        let newUpperPrice = newPriceBounds.newUpperPrice;

        elizaLogger.log(`Repositioning position: ${positionMintPublicKey}`);

        let closeSuccess = false;
        let closeTxId;
        while (!closeSuccess) {
          try {
            // Create Orca RPC wrapper
            const orcaConnection = {
              ...connection,
              getAccountInfo: (address: string) => connection.getAccountInfo(new PublicKey(address)),
              getMultipleAccountsInfo: (addresses: string[]) =>
                connection.getMultipleAccountsInfo(addresses.map(addr => new PublicKey(addr)))
            } as Rpc;

            // Use orcaConnection for Orca functions
            const { instructions: closeInstructions, quote } = await closePositionInstructions(
              orcaConnection,
              toAddress(positionMintPublicKey)
            );
            closeTxId = await sendTransaction(connection, closeInstructions, wallet);
            closeSuccess = closeTxId ? true : false;

            // Prepare for open position
            const increaseLiquidityQuoteParam: IncreaseLiquidityQuoteParam = {
              liquidity: quote.liquidityDelta,
            };
            whirlpool = await client.getPool(whirlpoolAddress);
            const newPriceBounds: NewPriceBounds = calculatePriceBounds(
              whirlpool.getData().sqrtPrice,
              mintA.decimals,
              mintB.decimals,
              positionWidthBps
            );
            newLowerPrice = newPriceBounds.newLowerPrice;
            newUpperPrice = newPriceBounds.newUpperPrice;
            let openSuccess = false;
            let openTxId;
            while (!openSuccess) {
              try {
                const { instructions: openInstructions, positionMint: newPositionMint } =
                  await openPositionInstructions(
                    orcaConnection,
                    toAddress(whirlpoolAddress),
                    increaseLiquidityQuoteParam,
                    newLowerPrice,
                    newUpperPrice
                  );
                openTxId = await sendTransaction(connection, openInstructions, wallet);
                openSuccess = openTxId ? true : false;

                elizaLogger.log(`Successfully reopened position with mint: ${newPositionMint}`);
                return { positionMintAddress: positionMintPublicKey, closeTxId, openTxId };
              } catch (openError) {
                elizaLogger.warn(
                  `Open position failed for ${positionMintPublicKey}, retrying. Error: ${openError}`
                );
                whirlpool = await client.getPool(whirlpoolAddress);
                const newPriceBounds: NewPriceBounds = calculatePriceBounds(
                  whirlpool.getData().sqrtPrice,
                  mintA.decimals,
                  mintB.decimals,
                  positionWidthBps
                );
                newLowerPrice = newPriceBounds.newLowerPrice;
                newUpperPrice = newPriceBounds.newUpperPrice;
              }
            }
          } catch (closeError) {
            elizaLogger.warn(
              `Close position failed for ${positionMintPublicKey}, retrying after fetching new prices. Error: ${closeError}`
            );
            whirlpool = await client.getPool(whirlpoolAddress);
            const newPriceBounds: NewPriceBounds = calculatePriceBounds(
              whirlpool.getData().sqrtPrice,
              mintA.decimals,
              mintB.decimals,
              positionWidthBps
            );
            newLowerPrice = newPriceBounds.newLowerPrice;
            newUpperPrice = newPriceBounds.newUpperPrice;
          }
        }
      } else {
        elizaLogger.log(`Position ${fetchedPosition.positionMint} is in range, skipping.`);
        return null;
      }
    })
  );
}

const address = (addressString: string) => new PublicKey(addressString);
