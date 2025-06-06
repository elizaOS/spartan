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
import { sqrtPriceToPrice, tickIndexToPrice } from '@orca-so/whirlpools-core';
import { sendTransaction } from '../utils/sendTransaction';
import {
  closePositionInstructions,
  IncreaseLiquidityQuoteParam,
  openPositionInstructions,
  setDefaultFunder,
  setDefaultSlippageToleranceBps,
} from '@orca-so/whirlpools';
import { loadWallet } from '../utils/loadWallet';
import { v4 as uuidv4 } from 'uuid';
import {
  buildWhirlpoolClient,
  PriceMath,
  WhirlpoolContext,
  Position,
  getLiquidityFromTokenAmounts,
  WhirlpoolClient
} from '@orca-so/whirlpools-sdk';
import { createSolanaRpc, Rpc } from '@solana/kit'
import { Address } from '@solana/addresses';
import { GetAccountInfoApi, GetMultipleAccountsApi, GetMinimumBalanceForRentExemptionApi, GetEpochInfoApi, SolanaRpcApi } from '@solana/rpc-api';
import { acquireService } from '../utils/utils';
import { fetchAllMint, fetchMint, Mint } from '@solana-program/token-2022';
import BN from 'bn.js';
import Decimal from 'decimal.js';
//import { positionProvider } from '../providers/positionProvider';
import { askLlmObject } from "../utils/utils";

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
  open_position: (params: OpenPositionParams) => Promise<string | null>;
  get_positions: () => Promise<FetchedPosition[]>;
}

interface OpenPositionParams {
  whirlpoolAddress: string;
  lowerPrice: number;
  upperPrice: number;
  tokenAmount?: number;
}

// Helper function to validate the structure of an OpenPositionParams object
function isValidOpenPositionParams(obj: any): obj is OpenPositionParams {
  console.log('obj', obj)
  if (!obj || typeof obj !== 'object') return false;
  const params = obj as OpenPositionParams;
  params.lowerTick = parseFloat(params.lowerTick)
  if (isNaN(params.lowerTick)) {
    console.log('lowerTick parse fail', obj.lowerTick, params.lowerTick)
    return false;
  }
  params.upperTick = parseFloat(params.upperTick)
  if (isNaN(params.upperTick)) {
    console.log('upperTick parse fail', obj.upperTick, params.upperTick)
    return false;
  }
  params.tokenAmount = parseFloat(params.tokenAmount)
  if (isNaN(params.tokenAmount)) {
    console.log('tokenAmount parse fail', obj.tokenAmount, params.tokenAmount)
    return false;
  }
  console.log('isValidOpenPositionParams', params, {
    wp: typeof (params.whirlpoolAddress),
    lt: typeof (params.lowerTick),
    ut: typeof (params.upperTick),
    ta: typeof (params.tokenAmount),
  })
  return (
    typeof params.whirlpoolAddress === 'string' && params.whirlpoolAddress.length > 0 &&
    typeof params.lowerTick === 'number' && params.lowerTick &&
    typeof params.upperTick === 'number' && params.upperTick &&
    params.lowerTick < params.upperTick && // Basic sanity: lower tick must be less than upper tick
    (params.tokenAmount === undefined || (typeof params.tokenAmount === 'number' && params.tokenAmount >= 0))
  );
}

async function getInitialPositionParametersFromLLM(
  runtime: AgentRuntime,
  rpc,
  ownerAddress: string
): Promise<OpenPositionParams | null> {
  elizaLogger.log('[GIPPL] Attempting to get initial position parameters from LLM for owner:', ownerAddress);

  const asking = 'GIPPL';
  const serviceType = 'chain_solana';
  let solanaService = runtime.getService(serviceType) as any;
  while (!solanaService) {
    console.log(asking, 'waiting for', serviceType, 'service...');
    solanaService = runtime.getService(serviceType) as any;
    if (!solanaService) {
      await new Promise((waitResolve) => setTimeout(waitResolve, 1000));
    } else {
      console.log(asking, 'Acquired', serviceType, 'service...');
    }
  }
  const walletData = await solanaService.updateWalletData()
  console.log('walletData', walletData)


  // look at each token, get the best LP and see if there's any open pools
  const orcaService = runtime.getService('ORCA_SERVICE');
  const pools = {}
  console.log('Checking wallet for pools')
  // takes 4 mins rn
  console.time('pools')
  for (const t of walletData.items) {
    // develop list of pools we could enter
    const pool: any | null = await orcaService.best_lp(t.address)
    console.log(t.address, 'pool', pool)
    if (pool && !Array.isArray(pool)) {
      pools[t.address] = pool
    }
  }
  console.timeEnd('pools')

  console.log('pools', pools)

  if (!Object.keys(pools).length) {
    console.log('[GIPPL] No pools to open an LP with')
    return null;
  }

  // we have at least one pool! ask LLM about them

  const promptTemplate = `
    You are an expert Solana DeFi assistant. A user with wallet address "${ownerAddress}" wants to open a new concentrated liquidity position on Orca.
    Please suggest parameters for an initial position. Consider common, relatively safe pairs and a reasonable starting token amount (e.g., for USDC or SOL).
    Provide the whirlpool address (as a string), lower tick (integer), upper tick (integer), and an optional token amount (number, representing the amount of one of the tokens, e.g., in its native decimal format, or a conceptual amount if the exact token isn't specified).
    If you suggest a tokenAmount, assume it's for one of the more liquid tokens in the pair (like USDC or SOL). If unsure, suggest a small tokenAmount like 10 (representing 10 units of the token).
    The lower tick must be less than the upper tick.

    {{providers}}

    Available Pools:
    {{pools}}

    Return ONLY the JSON object with the following structure. Do not include any other text, explanations, or conversational preamble.
    Ensure the tick values are integers.

    {
        "whirlpoolAddress": "string",
        "lowerPrice": decimal, (lower bounds price where we should re-evaluate if it hits this bounds, should be lower than currentPrice)
        "upperPrice": decimal, (upper bounds price where we should re-evaluate if it hits this bounds, should be higher than currentPrice)
        "tokenPercentage": a number between 1 and 100% of how much available token to LP,
        "reasoning: "string" (why you open this position in this manner)
    }
  `;
  // pull yields?
  // when do we harvest yield? ask llm

  // rebalance makes sense
  // when do we close out position?

  // maybe fee growth for each token...
  // single address against base pair (splitting)
  let poolsStr = '\nwhirlpoolAddress,liquidity,currentPrice,feeRate,protocolFeeRate,nonBaseCA,holdingAmtInTokens,valueUsd\n'
  for (const ca in pools) {
    const p = pools[ca]
    const wd = walletData.items.find(t => t.address === ca)
    // look up amount by ca
    // p.rawData.tickCurrentIndex,

    // there is valueSol and valueUsd (but it's worth of what you're holding)
    let caCoinA = p.rawData.tokenMintA === 'So11111111111111111111111111111111111111112' ? 'So11111111111111111111111111111111111111111' : p.rawData.tokenMintA
    let caCoinB = p.rawData.tokenMintB === 'So11111111111111111111111111111111111111112' ? 'So11111111111111111111111111111111111111111' : p.rawData.tokenMintB

    const coinA = walletData.items.find(t => t.address === caCoinA)
    const coinB = walletData.items.find(t => t.address === caCoinB)
    console.log('coinA', coinA)
    console.log('coinB', coinB)

    const currentPrice = coinA?.priceUsd / (coinB?.priceUsd || 1)

    /*
    const mintA = await fetchMint(rpc, p.rawData.tokenMintA);
    console.log('mintA', mintA)
    const mintB = await fetchMint(rpc, p.rawData.tokenMintB);
    console.log('mintB', mintB)
    */
    //const currentPrice = tickIndexToPrice(p.rawData.tickCurrentIndex, mintA.decimals, mintB.decimals);
    // is just priceUsd tbh...
    // but we want SOL per JUP
    // get USD for both?
    console.log(p.rawData.tickCurrentIndex, '=> currentPrice', currentPrice)
    poolsStr += [p.address, p.liquidity, currentPrice, p.rawData.feeRate, p.rawData.protocolFeeRate, ca, wd.uiAmount, wd.valueUsd].join(',') + '\n'
  }
  const promptsWPools = promptTemplate.replace('{{pools}}', poolsStr)

  elizaLogger.log('[GIPPL] Prompt constructed. Calling generateText.');

  const memory: Memory = {
    content: { text: '' }
  }
  // use state to get other contexts/providers (wallet info)
  const state = await runtime.composeState(memory, ['OrcaLP_positions', 'solana-wallet'])
  //console.log('state', state)
  const prompt = composePromptFromState({ state, template: promptsWPools })
  console.log('finalPrompt', prompt)

  const llmResponse = await askLlmObject(runtime, { prompt }, ['whirlpoolAddress', 'lowerPrice', 'upperPrice', 'tokenPercentage'])
  console.log('llmResponse', llmResponse)

  // we need take 'tokenPercentage' and create tokenAmount
  if (llmResponse?.tokenPercentage) {
    //console.log('parsedResult', parsedResult)
    // whirlpoolCA
    const ca = Object.keys(pools).find(key => pools[key].address === llmResponse.whirlpoolAddress);
    const pool = pools[ca]
    console.log('pool', pool)
    // likely will be A (but not always?)
    const wd = walletData.items.find(t => t.address === ca)
    console.log('wd', wd)

    let caCoinA = pool.rawData.tokenMintA === 'So11111111111111111111111111111111111111112' ? 'So11111111111111111111111111111111111111111' : pool.rawData.tokenMintA
    let caCoinB = pool.rawData.tokenMintB === 'So11111111111111111111111111111111111111112' ? 'So11111111111111111111111111111111111111111' : pool.rawData.tokenMintB

    const wdA = walletData.items.find(t => t.address === caCoinA)
    console.log('wdA', wdA)
    const wdB = walletData.items.find(t => t.address === caCoinB)
    console.log('wdB', wdB)

    const currentSqrtPrice = pool.rawData.sqrtPrice
    const mintA = await fetchMint(rpc, pool.rawData.tokenMintA);
    console.log('mintA', mintA)
    const mintB = await fetchMint(rpc, pool.rawData.tokenMintB);
    console.log('mintB', mintB)

    llmResponse.tokenAmount = (llmResponse.tokenPercentage / 100) * wd.uiAmount
    console.log('tokenAmount', llmResponse.tokenAmount)
    const valueTokenAUsd = llmResponse.tokenAmount * wdA.priceUsd
    console.log('valueTokenAUsd', valueTokenAUsd)

    const amountA = BigInt(Math.floor(llmResponse.tokenAmount * 10 ** mintA.data.decimals));
    console.log('amountA', amountA)
    const tokenBAmountUi = valueTokenAUsd / wdB.priceUsd;
    console.log('tokenBAmountUi', tokenBAmountUi)
    const amountB = BigInt(Math.floor(tokenBAmountUi * 10 ** mintB.data.decimals));
    console.log('amountB', amountB)

    const lowerSqrtPrice = PriceMath.priceToSqrtPriceX64(
      new Decimal(llmResponse.lowerPrice), mintA.data.decimals, mintB.data.decimals
    )
    console.log('lowerSqrtPrice', lowerSqrtPrice)
    const upperSqrtPrice = PriceMath.priceToSqrtPriceX64(
      new Decimal(llmResponse.upperPrice), mintA.data.decimals, mintB.data.decimals
    )
    console.log('upperSqrtPrice', upperSqrtPrice)

    const liquidity = getLiquidityFromTokenAmounts(
      currentSqrtPrice,
      lowerSqrtPrice,
      upperSqrtPrice,
      amountA,
      amountB,
      true // Use this flag based on whether amountA is the limiting factor
    );
    console.log('liquidity', liquidity)

    console.log(llmResponse.tokenPercentage + '% of ', wd.uiAmount, '=', llmResponse.tokenAmount)
  }
  return llmResponse as OpenPositionParams;

  /*
  let llmResponse: string | null = null;
  try {
    llmResponse = await runtime.useModel(ModelType.SMALL, { prompt });
    elizaLogger.log(`[GIPPL] generateText call completed. Raw LLM output: ${llmResponse}`);
  } catch (modelError) {
    elizaLogger.error('[GIPPL] Error directly from generateText call:', modelError);
    return null;
  }

  if (llmResponse === null || llmResponse.trim() === "") {
    elizaLogger.warn('[GIPPL] LLM output is null or empty.');
    return null;
  }

  let jsonStringToParse = llmResponse;
  const jsonCodeBlockRegex = /```json\s*([\s\S]*?)\s*```/;
  const codeBlockMatch = llmResponse.match(jsonCodeBlockRegex);

  if (codeBlockMatch && codeBlockMatch[1]) {
    jsonStringToParse = codeBlockMatch[1].trim();
    elizaLogger.log(`[GIPPL] Extracted content from json code block: ${jsonStringToParse}`);
  } else {
    const lastStartObject = llmResponse.lastIndexOf('{');
    const lastEndObject = llmResponse.lastIndexOf('}');
    if (lastStartObject !== -1 && lastEndObject !== -1 && lastEndObject > lastStartObject) {
      jsonStringToParse = llmResponse.substring(lastStartObject, lastEndObject + 1);
      elizaLogger.log(`[GIPPL] Extracted JSON object string using lastIndexOf heuristic: ${jsonStringToParse}`);
    } else {
      elizaLogger.warn('[GIPPL] No JSON code block found and heuristic object extraction failed.');
    }
  }

  try {
    let parsedResult = JSON.parse(jsonStringToParse);
    elizaLogger.log('[GIPPL] Attempt 1 JSON.parse result:', parsedResult);

    // we need take 'tokenPercentage' and create tokenAmount
    if (parsedResult?.tokenPercentage) {
      //console.log('parsedResult', parsedResult)
      const ca = Object.keys(pools).find(key => pools[key].address === parsedResult.whirlpoolAddress);
      const wd = walletData.items.find(t => t.address === ca)
      parsedResult.tokenAmount = (parsedResult.tokenPercentage / 100) * wd.uiAmount
      console.log(parsedResult.tokenPercentage + '% of ', wd.uiAmount, '=', parsedResult.tokenAmount)
    }

    if (!isValidOpenPositionParams(parsedResult)) {
      elizaLogger.warn('[GIPPL] Parsed result from attempt 1 is not valid OpenPositionParams. Trying parseJSONObjectFromText.');
      parsedResult = parseJSONObjectFromText(llmResponse); // Try with original full response
      elizaLogger.log('[GIPPL] Attempt 2 parseJSONObjectFromText result:', parsedResult);
    }

    if (parsedResult?.tokenPercentage) {
      //console.log('parsedResult', parsedResult)
      const ca = Object.keys(pools).find(key => pools[key].address === parsedResult.whirlpoolAddress);
      const wd = walletData.items.find(t => t.address === ca)
      parsedResult.tokenAmount = (parsedResult.tokenPercentage / 100) * wd.uiAmount
      console.log(parsedResult.tokenPercentage + '% of ', wd.uiAmount, '=', parsedResult.tokenAmount)
    }

    //console.log('parsedResult', parsedResult)

    if (isValidOpenPositionParams(parsedResult)) {
      // Ensure tokenAmount has a default if not provided or invalid
      if (parsedResult.tokenAmount === undefined || typeof parsedResult.tokenAmount !== 'number' || parsedResult.tokenAmount < 0) {
        elizaLogger.log(`[GIPPL] tokenAmount is undefined or invalid (${parsedResult.tokenAmount}), defaulting to 10.`);
        parsedResult.tokenAmount = 10; // Default token amount
      }
      // Ensure ticks are integers
      // odi: I don't think we want this...
      //parsedResult.lowerTick = Math.round(parsedResult.lowerTick);
      //parsedResult.upperTick = Math.round(parsedResult.upperTick);

      // we already checked this in isValidOpenPositionParams
      // if (parsedResult.lowerTick >= parsedResult.upperTick) {
      //   elizaLogger.error(`[GIPPL] Invalid tick range after parsing/rounding: lowerTick ${parsedResult.lowerTick} >= upperTick ${parsedResult.upperTick}.`);
      //   return null;
      // }

      elizaLogger.log('[GIPPL] Successfully parsed and validated OpenPositionParams:', parsedResult);
      return parsedResult as OpenPositionParams;
    } else {
      elizaLogger.error('[GIPPL] Failed to parse valid OpenPositionParams from LLM response after all attempts. Parsed data:', parsedResult);
      return null;
    }
} catch (error) {
  elizaLogger.error('[GIPPL] Error parsing LLM response for initial position parameters:', error);
  // Try parseJSONObjectFromText on the original llmResponse as a final fallback if JSON.parse failed
  try {
    const fallbackResult = parseJSONObjectFromText(llmResponse);
    elizaLogger.log('[GIPPL] Fallback parseJSONObjectFromText result:', fallbackResult);
    if (isValidOpenPositionParams(fallbackResult)) {
      if (fallbackResult.tokenAmount === undefined || typeof fallbackResult.tokenAmount !== 'number' || fallbackResult.tokenAmount < 0) {
        fallbackResult.tokenAmount = 10;
      }
      fallbackResult.lowerTick = Math.round(fallbackResult.lowerTick);
      fallbackResult.upperTick = Math.round(fallbackResult.upperTick);
      if (fallbackResult.lowerTick >= fallbackResult.upperTick) {
        elizaLogger.error(`[GIPPL] Fallback - Invalid tick range: lowerTick ${fallbackResult.lowerTick} >= upperTick ${fallbackResult.upperTick}.`);
        return null;
      }
      elizaLogger.log('[GIPPL] Successfully parsed and validated OpenPositionParams via fallback:', fallbackResult);
      return fallbackResult as OpenPositionParams;
    }
  } catch (fallbackError) {
    elizaLogger.error('[GIPPL] Error in fallback parsing attempt:', fallbackError);
  }
  return null;
}
*/
}

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
    if (isManagingPositionsHandlerActive) {
      elizaLogger.warn('managePositions handler is already active. Skipping this invocation.');
      return false;
    }

    isManagingPositionsHandlerActive = true;
    elizaLogger.log('Start managing positions (handler activated)');

    try {
      const config = await extractAndValidateConfiguration(message.content.text, runtime);
      if (!config) {
        elizaLogger.warn('Failed to get valid configuration for managing positions. Aborting.');
        //isManagingPositionsHandlerActive = false; // Moved to finally block
        return false;
      }

      const { address: ownerAddress } = await loadWallet(runtime as AgentRuntime, false);
      if (!ownerAddress) {
        elizaLogger.error("Failed to load wallet address. Cannot proceed.");
        //isManagingPositionsHandlerActive = false; // Moved to finally block
        return false;
      }
      const orcaService = runtime.getService('ORCA_SERVICE') as any; // Cast to any for now

      // Ensure the service has the wallet if it needs it internally for signing
      // This depends on OrcaService's design; assuming it might need it or can be set.
      if (orcaService && typeof orcaService.setWallet === 'function') {
        orcaService.setWallet(ownerAddress);
      }


      const rpc = createSolanaRpc((runtime as AgentRuntime).getSetting('SOLANA_RPC_URL'));

      // // --- BEGIN TEST CALL TO best_lp ---
      // if (orcaService && typeof orcaService.best_lp === 'function') {
      //   elizaLogger.log('[Test best_lp] Attempting to call best_lp method.');
      //   try {
      //     const testInputTokenMint = "So11111111111111111111111111111111111111112"; // WSOL Mint
      //     const testAmount = 1; // Example: 1 SOL
      //     elizaLogger.log(`[Test best_lp] Calling with RPC, token: ${testInputTokenMint}, amount: ${testAmount}`);

      //     const bestLpResult = await orcaService.best_lp(testInputTokenMint, testAmount);
      //     if (bestLpResult) {
      //       // Format liquidity to be more readable
      //       const liquidityFormatted = new Intl.NumberFormat('en-US', {
      //         notation: 'compact',
      //         maximumFractionDigits: 2
      //       }).format(Number(bestLpResult.liquidity));

      //       const poolInfo = {
      //         pool: bestLpResult.address.slice(0, 8) + '...',  // Shorten pool address
      //         pair: `${bestLpResult.tokenAMint.slice(0, 8)}-${bestLpResult.tokenBMint.slice(0, 8)}`,  // Hardcoded for now, could be made dynamic with a token symbol lookup
      //         liquidity: liquidityFormatted,
      //         spacing: bestLpResult.tickSpacing
      //       };
      //       elizaLogger.log('[Test best_lp] Best LP found:', poolInfo);
      //     } else {
      //       elizaLogger.log('[Test best_lp] No suitable LP found by best_lp.');
      //     }
      //   } catch (testError) {
      //     elizaLogger.error('[Test best_lp] Error during best_lp test call:', testError);
      //   }
      // } else {
      //   elizaLogger.warn('[Test best_lp] orcaService is not available or best_lp method does not exist.');
      // }
      // // --- END TEST CALL TO best_lp ---

      // // After the best_lp test

      // // --- BEGIN TEST CALL TO open_position ---
      // if (orcaService && typeof orcaService.open_position === 'function') {
      //   elizaLogger.log('[Test open_position] Attempting to open a new position');
      //   try {
      //     const testTokenMint = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"; // JUP token
      //     const testAmount = 1; // Amount of tokens to provide

      //     // First find the best pool
      //     const bestPool = await orcaService.best_lp(testTokenMint, testAmount);
      //     if (!bestPool) {
      //       elizaLogger.warn('[Test open_position] No suitable pool found for token');
      //       return;
      //     }

      //     // Calculate ticks based on current price
      //     const currentPrice = sqrtPriceToPrice(
      //       bestPool.rawData.sqrtPrice,
      //       bestPool.rawData.tickCurrentIndex,
      //       bestPool.tickSpacing
      //     );

      //     // Open position with ±5% range around current price
      //     const openParams = {
      //       whirlpoolAddress: bestPool.address,
      //       tokenAmount: testAmount,
      //       lowerTick: bestPool.rawData.tickCurrentIndex - 100, // Approximately -5%
      //       upperTick: bestPool.rawData.tickCurrentIndex + 100, // Approximately +5%
      //     };

      //     elizaLogger.log('[Test open_position] Opening position with params:', {
      //       pool: bestPool.address.slice(0, 8) + '...',
      //       pair: `${bestPool.tokenAMint.slice(0, 8)}-${bestPool.tokenBMint.slice(0, 8)}`,
      //       range: `${openParams.lowerTick} to ${openParams.upperTick}`,
      //       amount: testAmount
      //     });

      //     try {
      //       const positionMint = await orcaService.open_position(openParams);
      //       if (positionMint) {
      //         elizaLogger.log('[Test open_position] Successfully opened position:', {
      //           mint: positionMint.slice(0, 8) + '...',
      //           pool: bestPool.address.slice(0, 8) + '...'
      //         });
      //       }
      //     } catch (error) {
      //       elizaLogger.error('[Test open_position] Failed to open position:', error.message);
      //     }
      //   } catch (testError) {
      //     elizaLogger.error('[Test open_position] Error during open_position test:', testError);
      //   }
      // } else {
      //   elizaLogger.warn('[Test open_position] orcaService.open_position is not available');
      // }
      // // --- END TEST CALL TO open_position ---

      let positions = await orcaService.fetchPositions(ownerAddress);
      elizaLogger.log(`Found ${positions.length} existing positions for owner ${ownerAddress}.`);

      const initialParams = await getInitialPositionParametersFromLLM(runtime, rpc, ownerAddress.toString());

      elizaLogger.log("Received initial position parameters from LLM:", initialParams);

      if (initialParams) {

        try {
          const newPositionMint = await orcaService.open_position(initialParams);
          if (newPositionMint) {
            elizaLogger.info(`Successfully opened initial position. Mint: ${newPositionMint}. Re-fetching positions.`);
            // Re-fetch positions to include the newly opened one
            positions = await orcaService.fetchPositions(ownerAddress);
            elizaLogger.log(`Found ${positions.length} positions after opening initial one.`);
          } else {
            elizaLogger.warn("Attempted to open initial position, but open_position returned null (possibly an existing position was found by the service itself, or opening failed silently).");
          }
        } catch (openError) {
          elizaLogger.error("Error opening initial position:", openError);
        }
      } else {
        elizaLogger.warn("Failed to get initial position parameters from LLM. Cannot open a new position automatically.");
      }

      if (positions.length === 0) {
        elizaLogger.info("Still no positions found after attempting to open an initial one. No monitoring tasks will be created.");
        //isManagingPositionsHandlerActive = false; // Moved to finally block
        // return true because the handler itself completed, even if no positions are managed.
        // Or false if we consider not managing any position a failure of the action's goal.
        // Let's return true, as the process ran.
        return true;
      }

      const worldId = runtime.agentId;

      // Register positions and create monitoring tasks
      for (const position of positions) {
        if (!isValidFetchedPosition(position)) {
          elizaLogger.warn(`Skipping invalid position object: ${JSON.stringify(position)}`);
          continue;
        }

        elizaLogger.log(`Processing position: ${position.positionMint}`);
        const positionId = await orcaService.register_position(position);
        elizaLogger.log(`Position ${position.positionMint} registered with ID: ${positionId}. Creating monitoring task.`);

        // Check position immediately if out of range
        if (!position.inRange) {
          elizaLogger.info(`Position ${positionId} is out of range. Triggering immediate rebalance.`);
          await checkAndRebalancePosition(
            position,
            config.repositionThresholdBps,
            orcaService
          );
        }

        // Create monitoring task for future checks
        await runtime.createTask({
          id: uuidv4() as UUID,
          name: `monitor_position_${positionId}`,
          type: 'MONITOR',
          description: `Monitor and rebalance position ${positionId} (Mint: ${position.positionMint})`,
          tags: ['queue', 'repeat', 'position', 'monitor'],
          schedule: { interval: config.intervalSeconds * 1000 },
          worldId,
          execute: async () => {
            elizaLogger.log(`Executing monitoring task for position ID: ${positionId}, Mint: ${position.positionMint}`);

            // Add immediate execution for out-of-range positions
            if (!position.inRange) {
              elizaLogger.info(`Position ${positionId} is out of range. Triggering immediate rebalance.`);
              await checkAndRebalancePosition(
                position,
                config.repositionThresholdBps,
                orcaService
              );
            }
          }
        } as Task);
        elizaLogger.log(`Monitoring task created for position ID: ${positionId}`);
      }

      elizaLogger.log('Finished processing all positions and creating tasks.');
      return true;
    } catch (error) {
      elizaLogger.error('Error in managePositions handler:', error);
      if (error instanceof Error && error.stack) {
        elizaLogger.error('Stack trace for managePositions handler error:', error.stack);
      }
      return false;
    } finally {
      isManagingPositionsHandlerActive = false;
      elizaLogger.log('End managing positions (handler deactivated)');
    }
  },
  examples: [],
};

// Helper function to validate the structure of a FetchedPosition object
function isValidFetchedPosition(obj: any): obj is FetchedPosition {
  return (
    obj &&
    typeof obj.whirlpoolAddress === 'string' &&
    typeof obj.positionMint === 'string' &&
    typeof obj.inRange === 'boolean' &&
    typeof obj.distanceCenterPositionFromPoolPriceBps === 'number' &&
    typeof obj.positionWidthBps === 'number'
  );
}

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
    return [];
  }

  if (content === null || content.trim() === "") {
    elizaLogger.warn('[EFP] content is null or empty after generateText call, cannot proceed with parsing.');
    return [];
  }

  let jsonStringToParse = content;

  const jsonCodeBlockRegex = /```json\s*([\s\S]*?)\s*```/;
  const codeBlockMatch = content.match(jsonCodeBlockRegex);

  if (codeBlockMatch && codeBlockMatch[1]) {
    jsonStringToParse = codeBlockMatch[1].trim();
    elizaLogger.log(`[EFP] Extracted content from json code block: ${jsonStringToParse}`);
  } else {
    elizaLogger.log('[EFP] No json code block found. Falling back to heuristic array extraction.');
    const lastStartIndex = content.lastIndexOf('[');
    const lastEndIndex = content.lastIndexOf(']');
    if (lastStartIndex !== -1 && lastEndIndex !== -1 && lastEndIndex > lastStartIndex) {
      const potentialJsonArray = content.substring(lastStartIndex, lastEndIndex + 1);
      if (potentialJsonArray.includes('"whirlpoolAddress"')) {
        jsonStringToParse = potentialJsonArray;
        elizaLogger.log(`[EFP] Extracted JSON array string using lastIndexOf heuristic: ${jsonStringToParse}`);
      } else {
        elizaLogger.warn('[EFP] Found last [] but keywords missing. Will attempt to parse broader content segment.');
      }
    } else {
      elizaLogger.warn('[EFP] Could not reliably find JSON array structure using simple lastIndexOf.');
    }
  }

  let parsedResult: any = null;

  // Attempt 1: JSON.parse on the heuristically extracted string
  try {
    elizaLogger.log('[EFP] Attempt 1: JSON.parse on extracted string:', jsonStringToParse);
    parsedResult = JSON.parse(jsonStringToParse);
    elizaLogger.log('[EFP] JSON.parse result:', parsedResult);
    if (Array.isArray(parsedResult)) {
      const validatedPositions = parsedResult.filter(isValidFetchedPosition);
      if (validatedPositions.length !== parsedResult.length) {
        elizaLogger.warn('[EFP] Attempt 1: Some items in the parsed array did not conform to FetchedPosition structure. Original count:', parsedResult.length, 'Validated count:', validatedPositions.length);
        parsedResult.forEach((item, index) => {
          if (!isValidFetchedPosition(item)) {
            elizaLogger.warn(`[EFP] Attempt 1: Item at index ${index} is not a valid FetchedPosition:`, item);
          }
        });
      }
      elizaLogger.log('[EFP] Successfully parsed and validated (Attempt 1). Returning extracted positions:', validatedPositions);
      return validatedPositions;
    }
    elizaLogger.warn('[EFP] JSON.parse result is not an array. Proceeding to fallback.');
    parsedResult = null; // Clear to ensure fallback is tried
  } catch (e) {
    elizaLogger.warn(`[EFP] JSON.parse failed on extracted string. Error: ${e instanceof Error ? e.message : String(e)}`);
    // parsedResult remains null, fallback will be tried
  }

  // Attempt 2: parseJSONObjectFromText on the original full content
  try {
    elizaLogger.log('[EFP] Attempt 2: parseJSONObjectFromText on full content (if Attempt 1 failed or was not an array).');
    // Use original 'content' for parseJSONObjectFromText as it's designed for less clean inputs
    parsedResult = parseJSONObjectFromText(content);
    elizaLogger.log('[EFP] parseJSONObjectFromText (fallback) result:', parsedResult);
    if (Array.isArray(parsedResult)) {
      const validatedPositions = parsedResult.filter(isValidFetchedPosition);
      if (validatedPositions.length !== parsedResult.length) {
        elizaLogger.warn('[EFP] Attempt 2: Some items in the parsed array did not conform to FetchedPosition structure. Original count:', parsedResult.length, 'Validated count:', validatedPositions.length);
        parsedResult.forEach((item, index) => {
          if (!isValidFetchedPosition(item)) {
            elizaLogger.warn(`[EFP] Attempt 2: Item at index ${index} is not a valid FetchedPosition:`, item);
          }
        });
      }
      elizaLogger.log('[EFP] Successfully parsed and validated (Attempt 2 - fallback). Returning extracted positions:', validatedPositions);
      return validatedPositions;
    }
    elizaLogger.warn('[EFP] Fallback parseJSONObjectFromText result is not an array:', parsedResult);
    return [];
  } catch (parseError) {
    elizaLogger.error('[EFP] Error in fallback parseJSONObjectFromText:', parseError);
    if (parseError instanceof Error && parseError.stack) {
      elizaLogger.error('[EFP] Fallback parsing error stack:', parseError.stack);
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
    elizaLogger.log(`[EAVC] generateText call completed. Raw LLM output: ${json}`);
  } catch (modelError) {
    elizaLogger.error('[EAVC] Error directly from generateText call:', modelError);
    if (modelError instanceof Error && modelError.stack) {
      elizaLogger.error('[EAVC] generateText error stack:', modelError.stack);
    }
    return null;
  }

  if (json === null || json.trim() === "") {
    elizaLogger.warn('[EAVC] LLM output is null or empty, cannot proceed with parsing.');
    return null;
  }

  let jsonStringToParse = json; // Start with the full LLM output for heuristic extraction

  const jsonCodeBlockRegex = /```json\s*([\s\S]*?)\s*```/;
  const codeBlockMatch = json.match(jsonCodeBlockRegex);

  if (codeBlockMatch && codeBlockMatch[1]) {
    jsonStringToParse = codeBlockMatch[1].trim();
    elizaLogger.log(`[EAVC] Extracted content from json code block: ${jsonStringToParse}`);
  } else {
    elizaLogger.log('[EAVC] No json code block found. Falling back to heuristic object extraction.');
    const lastStartObject = json.lastIndexOf('{');
    const lastEndObject = json.lastIndexOf('}');
    if (lastStartObject !== -1 && lastEndObject !== -1 && lastEndObject > lastStartObject) {
      const potentialJsonObject = json.substring(lastStartObject, lastEndObject + 1);
      if (potentialJsonObject.includes('"repositionThresholdBps"')) {
        jsonStringToParse = potentialJsonObject;
        elizaLogger.log(`[EAVC] Extracted JSON object string using lastIndexOf heuristic: ${jsonStringToParse}`);
      } else {
        elizaLogger.warn('[EAVC] Found last {} but keywords missing. Will attempt to parse broader content segment.');
      }
    } else {
      elizaLogger.warn('[EAVC] Could not find clear JSON object structure using simple lastIndexOf.');
    }
  }

  let parsedLLMOutput: any = null;

  // Attempt 1: JSON.parse on the heuristically extracted string
  try {
    elizaLogger.log('[EAVC] Attempt 1: JSON.parse on extracted string:', jsonStringToParse);
    const result = JSON.parse(jsonStringToParse);
    elizaLogger.log('[EAVC] JSON.parse result:', result);
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      parsedLLMOutput = result;
    } else {
      elizaLogger.warn('[EAVC] JSON.parse result is not a valid object. Proceeding to fallback.', result);
    }
  } catch (e) {
    elizaLogger.warn(`[EAVC] JSON.parse failed on extracted string. Error: ${e instanceof Error ? e.message : String(e)}`);
    // parsedLLMOutput remains null, fallback will be tried
  }

  // Attempt 2: parseJSONObjectFromText on the original full LLM output if Attempt 1 failed or was not an object
  if (!parsedLLMOutput) {
    try {
      elizaLogger.log('[EAVC] Attempt 2: parseJSONObjectFromText on full LLM output:', json);
      // Use original 'json' (raw LLM output) for parseJSONObjectFromText
      const result = parseJSONObjectFromText(json);
      elizaLogger.log('[EAVC] parseJSONObjectFromText (fallback) result:', result);
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        parsedLLMOutput = result;
      } else {
        elizaLogger.warn('[EAVC] Fallback parseJSONObjectFromText result is not a valid object.', result);
      }
    } catch (coreParseError) {
      elizaLogger.error('[EAVC] Error in fallback parseJSONObjectFromText:', coreParseError);
      if (coreParseError instanceof Error && coreParseError.stack) {
        elizaLogger.error('[EAVC] Fallback parsing error stack:', coreParseError.stack);
      }
    }
  }

  if (!parsedLLMOutput) {
    elizaLogger.warn('[EAVC] Failed to parse configuration from LLM after all attempts.');
    return null;
  }

  // Proceed with validation and number conversion using parsedLLMOutput
  try {
    elizaLogger.log('[EAVC] Validating and converting parsed LLM output:', parsedLLMOutput);
    const configurationWithNumbers: Record<string, any> = {};
    const keysToConvert = ['repositionThresholdBps', 'intervalSeconds', 'slippageToleranceBps'];
    elizaLogger.log('[EAVC] Starting conversion loop for keys:', keysToConvert);

    for (const key of keysToConvert) {
      elizaLogger.log(`[EAVC] Processing key: "${key}"`);
      if (Object.prototype.hasOwnProperty.call(parsedLLMOutput, key) && parsedLLMOutput[key] !== undefined && parsedLLMOutput[key] !== null) {
        const originalValue = parsedLLMOutput[key];
        configurationWithNumbers[key] = Number(originalValue);
        elizaLogger.log(`[EAVC] Key "${key}": Original value "${originalValue}" (type: ${typeof originalValue}), Converted value "${configurationWithNumbers[key]}" (type: ${typeof configurationWithNumbers[key]})`);
      } else {
        configurationWithNumbers[key] = parsedLLMOutput[key]; // Preserve null/undefined for validation
        elizaLogger.log(`[EAVC] Key "${key}" was missing, undefined, or null in parsedLLMOutput. Assigned value: ${configurationWithNumbers[key]}`);
      }
    }
    elizaLogger.log('[EAVC] Conversion loop finished. Resulting configurationWithNumbers:', configurationWithNumbers);

    elizaLogger.log('[EAVC] Calling validateManagePositionsInput with:', configurationWithNumbers);
    const result = validateManagePositionsInput(configurationWithNumbers);
    elizaLogger.log('[EAVC] validateManagePositionsInput returned successfully:', result);
    return result;

  } catch (validationOrConversionError) {
    elizaLogger.error('[EAVC] Error during validation or conversion of LLM output:', validationOrConversionError);
    if (validationOrConversionError instanceof Error && validationOrConversionError.stack) {
      elizaLogger.error('[EAVC] Validation/conversion error stack:', validationOrConversionError.stack);
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
  orcaService: any
) {
  elizaLogger.log(`Checking position ${position.positionMint}. InRange: ${position.inRange}, DistanceBps: ${position.distanceCenterPositionFromPoolPriceBps}, ThresholdBps: ${thresholdBps}`);

  if (!position.inRange || position.distanceCenterPositionFromPoolPriceBps > thresholdBps) {
    elizaLogger.info(`Position ${position.positionMint} needs rebalancing.`);
    try {
      // Get whirlpool data first
      const whirlpool = await fetchWhirlpool(orcaService.rpc, position.whirlpoolAddress as Address);
      if (!whirlpool) {
        elizaLogger.error(`Could not fetch whirlpool data for ${position.whirlpoolAddress}`);
        return;
      }

      // Get mint information for decimals
      const [mintA, mintB] = await fetchAllMint(orcaService.rpc, [
        whirlpool.data.tokenMintA,
        whirlpool.data.tokenMintB
      ]);
      if (!mintA || !mintB) {
        elizaLogger.error(`Could not fetch mint data for tokens in whirlpool ${position.whirlpoolAddress}`);
        return;
      }

      // Fetch full position details to get current token amounts
      const fullPositionData = await fetchPosition(orcaService.rpc, position.positionMint as Address);
      if (!fullPositionData) {
        elizaLogger.error(`Could not fetch full position data for ${position.positionMint}`);
        return;
      }

      // Create Position instance from data
      const client = buildWhirlpoolClient(orcaService.rpc);
      const positionObj = await client.getPosition(position.positionMint as Address);
      const positionData = positionObj.getData();

      // Convert to BN for calculations
      const amountToReinvestBN = new BN(positionData.liquidity.toString());

      let reinvestTokenAmount = amountToReinvestBN.toNumber();
      if (reinvestTokenAmount === 0) {
        elizaLogger.warn(`Position ${position.positionMint} had zero reinvestable liquidity based on old amounts. Using minimal amount (1 raw unit) for new position.`);
        reinvestTokenAmount = 1; // Default to a minimal raw unit if position was empty or amounts are zero
      }

      // Calculate current price
      const currentPrice = sqrtPriceToPrice(
        whirlpool.data.sqrtPrice, // This is BigInt
        mintA.data.decimals,
        mintB.data.decimals
      );

      // Calculate new price range (e.g., ±5% around current price)
      const newLowerPriceDecimal = new Decimal(currentPrice.toString()).mul(0.95);
      const newUpperPriceDecimal = new Decimal(currentPrice.toString()).mul(1.05);

      // Convert prices to tick indexes
      const tickSpacing = whirlpool.data.tickSpacing;
      const newLowerTick = PriceMath.priceToTickIndex(newLowerPriceDecimal, mintA.data.decimals, mintB.data.decimals);
      const newUpperTick = PriceMath.priceToTickIndex(newUpperPriceDecimal, mintA.data.decimals, mintB.data.decimals);

      // Close existing position
      elizaLogger.log(`Attempting to close position: ${position.positionMint}`);
      const closed = await orcaService.close_position(position.positionMint);
      if (!closed) {
        elizaLogger.warn(`Failed to close position ${position.positionMint}. Rebalancing aborted.`);
        return;
      }
      elizaLogger.info(`Successfully closed position ${position.positionMint}.`);

      // Add delay to avoid potential RPC congestion or state update lags
      await new Promise(resolve => setTimeout(resolve, 2000)); // Increased delay slightly

      // Open new position with calculated range and reinvestment amount
      const newPositionParams: OpenPositionParams = {
        whirlpoolAddress: position.whirlpoolAddress,
        lowerTick: newLowerTick,
        upperTick: newUpperTick,
        tokenAmount: reinvestTokenAmount
      };

      elizaLogger.log(`Opening new position with params:`, {
        pool: position.whirlpoolAddress.slice(0, 8) + '...',
        lowerTick: newPositionParams.lowerTick,
        upperTick: newPositionParams.upperTick,
        tokenAmount: newPositionParams.tokenAmount,
        approxLowerPrice: newLowerPriceDecimal.toFixed(mintB.data.decimals), // For logging
        approxUpperPrice: newUpperPriceDecimal.toFixed(mintB.data.decimals)  // For logging
      });

      const newMint = await orcaService.open_position(newPositionParams);
      if (newMint) {
        elizaLogger.info(`Successfully opened new position: ${newMint}. Old position: ${position.positionMint}`);
      } else {
        elizaLogger.warn(`Failed to open new position after closing ${position.positionMint}. 'open_position' returned null.`);
      }

    } catch (error) {
      elizaLogger.error(`Rebalancing error for position ${position.positionMint}:`, error);
      if (error instanceof Error && error.stack) {
        elizaLogger.error('Stack trace for rebalancing error:', error.stack);
      }
    }
  }
}