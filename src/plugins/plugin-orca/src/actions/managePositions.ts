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
  Connection
} from '@solana/web3.js';
import { address } from "@solana/kit";
import { getMint } from '@solana/spl-token';
import { getPositionAddress, fetchPosition, fetchWhirlpool, } from '@orca-so/whirlpools-client';
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
import { createSolanaRpc, Rpc } from '@solana/kit'
import { Address } from '@solana/addresses';
import { GetAccountInfoApi, GetMultipleAccountsApi, GetMinimumBalanceForRentExemptionApi, GetEpochInfoApi, SolanaRpcApi } from '@solana/rpc-api';
import { acquireService } from '../utils/utils';
//import { positionProvider } from '../providers/positionProvider';

// Module-level flag to prevent concurrent execution of the handler's core logic
let isManagingPositionsHandlerActive = false;

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
  get_positions: () => Promise<FetchedPosition[]>;
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

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    if (!message || !message.content || !message.content.text || message.content.text.trim() === "") {
      elizaLogger.warn('[Validate] Message content is missing or empty.');
      return false;
    }
    elizaLogger.log('[Validate] Basic validation passed (message content present).');
    return true;
  },

  handler: async (
    runtime: AgentRuntime,
    message: Memory,
    state: State,
    params: { [key: string]: unknown },
    callback?: HandlerCallback
  ) => {
    console.log('MANAGE_POSITION HANDLER')
    if (isManagingPositionsHandlerActive) {
      elizaLogger.warn('managePositions handler is already active. Skipping this invocation to prevent concurrency issues.');
      return false; // Indicate that this call was skipped
    }

    isManagingPositionsHandlerActive = true;
    elizaLogger.log('Start managing positions (handler activated)');

    try {
      // Get configuration - LLM call now happens only here for config.
      elizaLogger.log('Getting configuration');
      const config: ManagePositionsInput | null = await extractAndValidateConfiguration(message.content.text, runtime);
      console.log('GOT CONFIG', config)

      if (!config) {
        elizaLogger.warn('Failed to get valid configuration in handler. Aborting managePositions handler.');
        return false; // Indicate failure due to no config
      }
      //elizaLogger.log('Configuration extracted and validated', config);

      elizaLogger.log('Fetching existing positions');
      //console.log('MANAGE_POSITION HANDLER 10', positionProvider.name, positionProvider)

      const { address: ownerAddressString } = await loadWallet(runtime as AgentRuntime, false);
      console.log('MANAGE_POSITION - got wallet', address(ownerAddressString.toString()))
      const ownerPublicKey = new PublicKey(ownerAddressString);
      const connection = new Connection((runtime as AgentRuntime).getSetting('SOLANA_RPC_URL'));
      console.log('MANAGE_POSITION - got conn')

      const orcaService = runtime.getService('ORCA_SERVICE') as any;

      //const providerResult = await positionProvider.get(runtime, message, state);
      console.log('MANAGE_POSITION HANDLER 20')
      const rpc = createSolanaRpc((runtime as AgentRuntime).getSetting('SOLANA_RPC_URL'));
      const existingPositions = await orcaService.fetchPositions(rpc, ownerPublicKey.toString());
      elizaLogger.log('Existing positions:', existingPositions);

      // Update state with positions
      state.providers = {
        positions: existingPositions
      };

      console.log('MANAGE_POSITION HANDLER 30')

      // Now extract positions from updated state
      const fetchedPositions = await extractFetchedPositions(
        JSON.stringify(state.providers),
        runtime
      );
      console.log('Positions extracted', fetchedPositions);

      elizaLogger.log('Loading wallet');
      const { signer: wallet } = await loadWallet(runtime, true);
      elizaLogger.log('Wallet loaded', wallet);

      //const connection = new Connection(runtime.getSetting('SOLANA_RPC_URL')) as unknown as OrcaConnection;
      elizaLogger.log('Connection created', connection);

      setDefaultSlippageToleranceBps(config.slippageToleranceBps);
      elizaLogger.log('Slippage tolerance set', config.slippageToleranceBps);

      // Create transaction signer
      elizaLogger.log('Creating transaction signer');
      const transactionSigner: TransactionSigner = {
        publicKey: wallet.publicKey,
        signTransaction: async (tx: Transaction) => {
          elizaLogger.log('Signing transaction', tx);
          tx.partialSign(wallet);
          elizaLogger.log('Transaction signed', tx);
          return tx;
        },
        signAllTransactions: async (txs: Transaction[]) => {
          elizaLogger.log('Signing all transactions', txs);
          return txs.map(tx => {
            tx.partialSign(wallet);
            elizaLogger.log('Transaction signed', tx);
            return tx;
          });
        }
      };
      elizaLogger.log('Transaction signer created');
      setDefaultFunder(toAddress(transactionSigner.publicKey));
      elizaLogger.log('Default funder set');

      // Initialize services
      elizaLogger.log('Initializing services');
      const whirlpoolClient = buildWhirlpoolClient({
        connection,
        wallet: { publicKey: wallet.publicKey },
      } as unknown as WhirlpoolContext);
      elizaLogger.log('Whirlpool client initialized', whirlpoolClient);

      // Register positions for monitoring
      elizaLogger.log('Registering positions for monitoring and creating tasks');
      for (const position of fetchedPositions) {
        const positionId = await positionService.register_position(position);
        elizaLogger.log(`Position ${positionId} registered`, positionId);
        // Create rebalancing task
        elizaLogger.log('Creating rebalancing task');
        await runtime.createTask({
          id: uuidv4() as UUID,
          name: `monitor_position_${positionId}`,
          type: 'MONITOR',
          description: `Monitor and rebalance position ${positionId}`,
          tags: ['queue', 'repeat', 'position', 'monitor'],
          schedule: { interval: config.intervalSeconds * 1000 },
          execute: async () => {
            elizaLogger.log(`Executing rebalancing task for position ${positionId}`);
            await checkAndRebalancePosition(
              position,
              config.repositionThresholdBps,
              connection,
              wallet,
              whirlpoolClient,
              positionService
            );
            elizaLogger.log(`Rebalancing task for position ${positionId} executed`);
          }
        } as Task);
        elizaLogger.log('Rebalancing task created');
      }
      elizaLogger.log('All positions registered and tasks created');
      return true;
    } catch (error) {
      elizaLogger.error('Error in managePositions handler:', error);
      if (error instanceof Error && error.stack) {
        elizaLogger.error('managePositions handler error stack:', error.stack);
      }
      return false; // Indicate failure
    } finally {
      isManagingPositionsHandlerActive = false;
      elizaLogger.log('Finished managing positions attempt. Handler is no longer active.');
    }
  },
  examples: [],
};

async function extractFetchedPositions(
  text: string,
  runtime: IAgentRuntime
): Promise<FetchedPosition[]> {
  elizaLogger.log('[EFP] Extracting fetched positions. Text (provider data):', text);
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

  elizaLogger.log('[EFP] Prompt constructed for fetched positions. Calling generateText.');
  let content: string | null = null;
  try {
    content = await runtime.useModel(ModelType.SMALL, { prompt });

    elizaLogger.log(`[EFP] generateText call completed. Raw content: ${content}`);
  } catch (modelError) {
    elizaLogger.error('[EFP] Error directly from generateText call:', modelError);
    if (modelError instanceof Error && modelError.stack) {
      elizaLogger.error('[EFP] generateText error stack:', modelError.stack);
    }
    return []; // Return empty array on failure
  }

  if (content === null || content.trim() === "") {
    elizaLogger.warn('[EFP] content is null or empty after generateText call, cannot proceed with parsing.');
    return [];
  }

  try {
    elizaLogger.log('[EFP] Entering parsing try block for fetched positions.');
    const parsedPositions = parseJSONObjectFromText(content);
    elizaLogger.log('[EFP] parseJSONObjectFromText returned:', parsedPositions);

    if (!Array.isArray(parsedPositions)) {
      elizaLogger.warn('[EFP] Parsed positions is not an array:', parsedPositions);
      return [];
    }
    return parsedPositions as FetchedPosition[];
  } catch (parseError) {
    elizaLogger.error('[EFP] Error parsing fetched positions:', parseError);
    if (parseError instanceof Error && parseError.stack) {
      elizaLogger.error('[EFP] Parsing error stack:', parseError.stack);
    }
    return [];
  }
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
  elizaLogger.log(`[EAVC] Start. Text: "${text}"`);

  // Default values (from current code, not in old example's prompt directly but good for context)
  const defaultConfig = {
    repositionThresholdBps: 500,
    intervalSeconds: 300,
    slippageToleranceBps: 100
  };

  // Modified prompt to be closer to the old one, but keeping context if available
  const prompt = `Given this message: "${text}". Extract or suggest the reposition threshold value, time interval, and slippage tolerance.
        The threshold value and the slippage tolerance can be given in percentages or bps. You will always respond with the reposition threshold in bps.
        ${position ? `\n        Current position data:\n        ${JSON.stringify(position, null, 2)}` : '\n        No position data available'}
        ${whirlpoolData ? `\n        Current whirlpool data:\n        ${JSON.stringify(whirlpoolData, null, 2)}` : '\n        No whirlpool data available'}
        If no values are provided in the message, suggest optimal values based on pool conditions or use these defaults: ${JSON.stringify(defaultConfig, null, 2)}.
        Very important: Add null values for each field that is not present in the message if you cannot suggest one.
        Return ONLY the JSON object with the following structure. Do not include any other text, explanations, or conversational preamble.
        {
            "repositionThresholdBps": number (integer value),
            "intervalSeconds": number (integer value),
            "slippageToleranceBps": number (integer value)
        }
    `;

  elizaLogger.log('[EAVC] Prompt constructed. Calling generateText.');
  let json: string | null = null;
  try {
    json = await runtime.useModel(ModelType.SMALL, { prompt });
    elizaLogger.log(`[EAVC] generateText call completed. Raw JSON: ${json}`);
  } catch (modelError) {
    elizaLogger.error('[EAVC] Error directly from generateText call:', modelError);
    if (modelError instanceof Error && modelError.stack) {
      elizaLogger.error('[EAVC] generateText error stack:', modelError.stack);
    }
    return null;
  }

  if (json === null || json.trim() === "") {
    elizaLogger.warn('[EAVC] json is null or empty after generateText call, cannot proceed with parsing.');
    return null;
  }

  try {
    elizaLogger.log('[EAVC] Entering parsing/validation try block.');
    const parsedObject = parseJSONObjectFromText(json);
    elizaLogger.log('[EAVC] parseJSONObjectFromText returned:', parsedObject);

    if (!parsedObject || typeof parsedObject !== 'object' || parsedObject === null) {
      elizaLogger.warn('[EAVC] Failed to parse configuration from LLM or result is not a valid object:', parsedObject);
      return null;
    }
    elizaLogger.log('[EAVC] parsedObject is a valid object.');

    const configurationWithNumbers: Record<string, any> = {};
    const keysToConvert = ['repositionThresholdBps', 'intervalSeconds', 'slippageToleranceBps'];
    elizaLogger.log('[EAVC] Starting conversion loop for keys:', keysToConvert);

    for (const key of keysToConvert) {
      elizaLogger.log(`[EAVC] Processing key: "${key}"`);
      if (Object.prototype.hasOwnProperty.call(parsedObject, key) && parsedObject[key] !== undefined && parsedObject[key] !== null) {
        const originalValue = parsedObject[key];
        configurationWithNumbers[key] = Number(originalValue);
        elizaLogger.log(`[EAVC] Key "${key}": Original value "${originalValue}" (type: ${typeof originalValue}), Converted value "${configurationWithNumbers[key]}" (type: ${typeof configurationWithNumbers[key]})`);
      } else {
        configurationWithNumbers[key] = parsedObject[key];
        elizaLogger.log(`[EAVC] Key "${key}" was missing, undefined, or null in parsedObject. Assigned value: ${configurationWithNumbers[key]}`);
      }
    }
    elizaLogger.log('[EAVC] Conversion loop finished. Resulting configurationWithNumbers:', configurationWithNumbers);

    elizaLogger.log('[EAVC] Calling validateManagePositionsInput with:', configurationWithNumbers);
    const result = validateManagePositionsInput(configurationWithNumbers);
    elizaLogger.log('[EAVC] validateManagePositionsInput returned successfully:', result);
    return result;

  } catch (error) {
    elizaLogger.error('[EAVC] Error caught in extractAndValidateConfiguration parsing/validation block:', error);
    if (error instanceof Error && error.stack) {
      elizaLogger.error('[EAVC] Parsing/validation error stack:', error.stack);
    }
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

async function checkAndRebalancePosition(
  position: FetchedPosition,
  thresholdBps: number,
  connection: Connection,
  wallet: Keypair,
  whirlpoolClient: ReturnType<typeof buildWhirlpoolClient>,
  positionService: PositionService
) {
  elizaLogger.log('Starting checkAndRebalancePosition for position:', position);
  const { inRange, distanceCenterPositionFromPoolPriceBps, positionWidthBps } = position;
  elizaLogger.log('Position status:', { inRange, distanceCenterPositionFromPoolPriceBps, thresholdBps });

  if (!inRange || distanceCenterPositionFromPoolPriceBps > thresholdBps) {
    elizaLogger.log('Position needs rebalancing');
    try {
      elizaLogger.log('Getting position address');
      const positionMintPublicKey = new PublicKey(position.positionMint);
      const pda = await getPositionAddress(toAddress(positionMintPublicKey));
      elizaLogger.log('Position address obtained:', pda);
      const positionAddress = pda[0];
      elizaLogger.log('Position address:', positionAddress);
      let whirlpoolPosition = await whirlpoolClient.getPosition(positionAddress);
      const whirlpoolAddress = whirlpoolPosition.getData().whirlpool;
      elizaLogger.log('Whirlpool address:', whirlpoolAddress);
      let whirlpool = await whirlpoolClient.getPool(whirlpoolAddress);
      elizaLogger.log('Whirlpool:', whirlpool);

      // Close existing position
      const orcaConnection = {
        ...connection,
        getAccountInfo: (address: string) => connection.getAccountInfo(new PublicKey(address)),
        getMultipleAccountsInfo: (addresses: string[]) =>
          connection.getMultipleAccountsInfo(addresses.map(addr => new PublicKey(addr)))
      } as unknown as Rpc<SolanaRpcApi>;

      elizaLogger.log('Closing position', position);
      const { instructions: closeInstructions, quote } = await closePositionInstructions(
        orcaConnection,
        toAddress(positionMintPublicKey)
      );
      elizaLogger.log('Close instructions:', closeInstructions);
      const closeTxId = await sendTransaction(connection, closeInstructions, wallet);
      elizaLogger.log('Close transaction ID:', closeTxId);
      if (!closeTxId) {
        elizaLogger.warn(`Failed to close position ${position.positionMint}`);
        return;
      }

      // Calculate new position parameters
      elizaLogger.log('Calculating new position parameters');
      const mintA = await getMint(connection, whirlpool.getData().tokenMintA);
      elizaLogger.log('Mint A:', mintA);
      const mintB = await getMint(connection, whirlpool.getData().tokenMintB);
      elizaLogger.log('Mint B:', mintB);
      const newPriceBounds = calculatePriceBounds(
        whirlpool.getData().sqrtPrice,
        mintA.decimals,
        mintB.decimals,
        positionWidthBps
      );
      elizaLogger.log('New price bounds:', newPriceBounds);

      // Open new position
      elizaLogger.log('Opening new position');
      const increaseLiquidityQuoteParam: IncreaseLiquidityQuoteParam = {
        liquidity: quote.liquidityDelta,
      };
      elizaLogger.log('Increase liquidity quote param:', increaseLiquidityQuoteParam);
      const { instructions: openInstructions, positionMint: newPositionMint } =
        await openPositionInstructions(
          orcaConnection,
          toAddress(whirlpoolAddress),
          increaseLiquidityQuoteParam,
          newPriceBounds.newLowerPrice,
          newPriceBounds.newUpperPrice
        );
      elizaLogger.log('Open instructions:', openInstructions);
      const openTxId = await sendTransaction(connection, openInstructions, wallet);
      elizaLogger.log('Open transaction ID:', openTxId);
      if (openTxId) {
        elizaLogger.log(`Successfully rebalanced position. New position mint: ${newPositionMint}`);
      }

    } catch (error) {
      elizaLogger.error('Rebalancing error:', error);
      throw error; // Re-throw to maintain error handling
    }
  } else {
    elizaLogger.log('Position is in good range, no rebalancing needed');
  }
}