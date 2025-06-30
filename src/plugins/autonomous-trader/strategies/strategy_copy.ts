import type { IAgentRuntime } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { acquireService, askLlmObject } from '../utils';
import { getSpartanWallets } from '../interfaces/int_wallets';
import { createPosition, updatePosition } from '../interfaces/int_positions';
import { SOLANA_SERVICE_NAME } from '../constants';

// Define UUID type to match strategy_llm
type UUID = `${string}-${string}-${string}-${string}-${string}`;

// NOTES:
// what wallets are using this strategy
// who's following this wallet
// if no one, deregister event
// scale amount for each specific interested wallet
// buy: (maybe based on available balance)
// sell: can be scaled based on position info, as long we record the OG wallet amount (and have our amount)
// execute trade, open/close positions:
// verify address for this chain
// if looks good, get token(s) info (birdeye?)
// validateTokenForTrading (look at liquidity/volume/suspicious atts)
// now it's a signal
// assess response, figure what wallet are buying based on balance
// and scale amount for each wallet based on available balance
// execute buys on each of wallet
// calculateOptimalBuyAmount
// wallet.swap (wallet slippage cfg: 2.5%)
// wallet.quote
// calculateDynamicSlippage (require quote)
// wallet.buy
// open position
// set up exit conditions
//await strategyService.open_position(hndl, pos)

//Flow:
//   1. User says: "Watch wallet FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1"
//   2. WATCH_WALLET action triggered
//   3. LLM extracts wallet address
//   4. User added to followers list
//   5. WebSocket subscription created for that wallet
//   6. [Later] Watched wallet makes a Jupiter swap
//   7. Solana WebSocket fires account change event
//   8. onWalletEvent() triggered automatically
//   9. Transaction analyzed for swap details
//   10. Mirrored trade executed for all followers  

const STRATEGY_NAME = 'Copy trading strategy';

// Store active subscriptions
const activeSubscriptions = new Map<string, number>();

// Store wallet followers mapping
const walletFollowers = new Map<string, Array<{
  entityId: string;
  walletAddress: string;
  scalingFactor: number;
}>>();

// Template for extracting wallet address from user command
const watchWalletTemplate = `
Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Recent Messages:
{{recentMessages}}

Extract the following information about the requested wallet watching:
- Target wallet address to watch/copy

Example response:
\`\`\`json
{
    "targetWalletAddress": "FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1"
}
\`\`\`

Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the JSON response format without any preamble or explanation.

IMPORTANT: Your response must ONLY contain the json block above. Do not include any text, thinking, or reasoning before or after this JSON block. Start your response immediately with { and end with }.`;

export async function copyStrategy(runtime: IAgentRuntime) {
  const service = await acquireService(runtime, 'TRADER_STRATEGY', 'copy trading strategy');
  const infoService = await acquireService(runtime, 'TRADER_DATAPROVIDER', 'copy trading info');
  const solanaService = await acquireService(runtime, SOLANA_SERVICE_NAME, 'copy trading solana service');

  const me = {
    name: STRATEGY_NAME,
  };
  const hndl = await service.register_strategy(me);

  // Set up periodic cleanup of inactive subscriptions
  setInterval(() => {
    cleanupInactiveSubscriptions(runtime, solanaService);
  }, 60000); // Check every minute

  // Register action handlers for watch/copy commands
  runtime.registerAction({
    name: 'WATCH_WALLET',
    similes: ['COPY_WALLET', 'FOLLOW_WALLET', 'MIRROR_WALLET'],
    validate: async (runtime: IAgentRuntime, message: any) => {
      // Basic validation - user must be registered
      return message?.metadata?.fromId !== undefined;
    },
    description: 'Watch and copy trades from a specific wallet address',
    handler: async (runtime: IAgentRuntime, message: any, state: any, options: any, callback?: any) => {
      return await handleWatchWallet(runtime, message, state, callback);
    }
  });

  // Register action handlers for unwatch commands
  runtime.registerAction({
    name: 'UNWATCH_WALLET',
    similes: ['STOP_COPYING', 'UNFOLLOW_WALLET', 'STOP_MIRRORING'],
    validate: async (runtime: IAgentRuntime, message: any) => {
      return message?.metadata?.fromId !== undefined;
    },
    description: 'Stop watching and copying trades from a specific wallet address',
    handler: async (runtime: IAgentRuntime, message: any, state: any, options: any, callback?: any) => {
      return await handleUnwatchWallet(runtime, message, state, callback);
    }
  });

  logger.log('Copy trading strategy initialized');
}

async function handleWatchWallet(runtime: IAgentRuntime, message: any, state: any, callback?: any) {
  try {
    // Extract target wallet address from message
    const prompt = watchWalletTemplate.replace('{{recentMessages}}', message.content.text);
    const result = await runtime.useModel('TEXT_LARGE', { prompt });

    const parsed = JSON.parse(result);
    const targetWalletAddress = parsed.targetWalletAddress;

    if (!targetWalletAddress) {
      callback?.({ text: 'Could not determine which wallet address to watch. Please specify a valid Solana wallet address.' });
      return false;
    }

    // Validate the wallet address
    const solanaService = runtime.getService(SOLANA_SERVICE_NAME) as any;
    if (!solanaService.validateAddress(targetWalletAddress)) {
      callback?.({ text: 'Invalid wallet address provided. Please provide a valid Solana wallet address.' });
      return false;
    }

    // Get user's entity ID
    const entityId = message.entityId;

    // Get user's wallets with copy trading strategy
    const userWallets = await getSpartanWallets(runtime, { strategy: STRATEGY_NAME });
    const userSolanaWallets = userWallets.filter(w => (w as any).chain === 'solana');

    if (userSolanaWallets.length === 0) {
      callback?.({ text: 'You need to create a wallet with the copy trading strategy first. Use "create wallet with copy trading strategy" to get started.' });
      return false;
    }

    // Calculate scaling factor based on wallet balance
    const scalingFactor = await calculateScalingFactor(runtime, userSolanaWallets[0]);

    // Add user to followers list
    if (!walletFollowers.has(targetWalletAddress)) {
      walletFollowers.set(targetWalletAddress, []);
    }

    const followers = walletFollowers.get(targetWalletAddress)!;
    const existingFollower = followers.find(f => f.entityId === entityId);

    if (existingFollower) {
      existingFollower.scalingFactor = scalingFactor;
    } else {
      followers.push({
        entityId,
        walletAddress: (userSolanaWallets[0] as any).publicKey,
        scalingFactor
      });
    }

    // Subscribe to wallet if not already subscribed
    if (!activeSubscriptions.has(targetWalletAddress)) {
      await subscribeToWallet(runtime, targetWalletAddress);
    }

    callback?.({ text: `Now watching wallet ${targetWalletAddress}. Your trades will be scaled based on your wallet balance.` });
    return true;

  } catch (error) {
    logger.error('Error in handleWatchWallet:', error);
    callback?.({ text: 'Failed to set up wallet watching. Please try again.' });
    return false;
  }
}

async function handleUnwatchWallet(runtime: IAgentRuntime, message: any, state: any, callback?: any) {
  try {
    // Extract target wallet address from message
    const prompt = watchWalletTemplate.replace('{{recentMessages}}', message.content.text);
    const result = await runtime.useModel('TEXT_LARGE', { prompt });

    const parsed = JSON.parse(result);
    const targetWalletAddress = parsed.targetWalletAddress;

    if (!targetWalletAddress) {
      callback?.({ text: 'Could not determine which wallet address to stop watching. Please specify a valid Solana wallet address.' });
      return false;
    }

    // Get user's entity ID
    const entityId = message.entityId;

    // Remove user from followers list
    const followers = walletFollowers.get(targetWalletAddress);
    if (followers) {
      const updatedFollowers = followers.filter(f => f.entityId !== entityId);
      if (updatedFollowers.length === 0) {
        walletFollowers.delete(targetWalletAddress);
        // Unsubscribe if no more followers
        await unsubscribeFromWallet(runtime, targetWalletAddress);
      } else {
        walletFollowers.set(targetWalletAddress, updatedFollowers);
      }
    }

    callback?.({ text: `Stopped watching wallet ${targetWalletAddress}.` });
    return true;

  } catch (error) {
    logger.error('Error in handleUnwatchWallet:', error);
    callback?.({ text: 'Failed to stop watching wallet. Please try again.' });
    return false;
  }
}

async function subscribeToWallet(runtime: IAgentRuntime, walletAddress: string) {
  try {
    const connection = new Connection(
      runtime.getSetting('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com'
    );

    // Subscribe to account changes using WebSocket
    const subscriptionId = connection.onAccountChange(
      new PublicKey(walletAddress),
      (accountInfo, context) => {
        onWalletEvent(runtime, walletAddress, accountInfo, context);
      },
      'confirmed'
    );

    activeSubscriptions.set(walletAddress, subscriptionId);
    logger.log(`Subscribed to wallet ${walletAddress} with subscription ID ${subscriptionId}`);

  } catch (error) {
    logger.error(`Error subscribing to wallet ${walletAddress}:`, error);
  }
}

async function unsubscribeFromWallet(runtime: IAgentRuntime, walletAddress: string) {
  try {
    const subscriptionId = activeSubscriptions.get(walletAddress);
    if (subscriptionId) {
      const connection = new Connection(
        runtime.getSetting('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com'
      );

      await connection.removeAccountChangeListener(subscriptionId);
      activeSubscriptions.delete(walletAddress);
      logger.log(`Unsubscribed from wallet ${walletAddress}`);
    }
  } catch (error) {
    logger.error(`Error unsubscribing from wallet ${walletAddress}:`, error);
  }
}

async function cleanupInactiveSubscriptions(runtime: IAgentRuntime, solanaService: any) {
  for (const [walletAddress, subscriptionId] of activeSubscriptions.entries()) {
    const followers = walletFollowers.get(walletAddress);
    if (!followers || followers.length === 0) {
      await unsubscribeFromWallet(runtime, walletAddress);
      logger.log(`Cleaned up inactive subscription for wallet ${walletAddress}`);
    }
  }
}

async function onWalletEvent(runtime: IAgentRuntime, walletAddress: string, accountInfo: any, context: any) {
  try {
    logger.log(`Wallet event detected for ${walletAddress} at slot ${context.slot}`);

    // Get followers for this wallet
    const followers = walletFollowers.get(walletAddress);
    if (!followers || followers.length === 0) {
      return;
    }

    // Analyze the account change to determine if it's a trade
    const tradeInfo = await analyzeAccountChange(runtime, walletAddress, accountInfo);
    if (!tradeInfo) {
      return; // Not a trade we're interested in
    }

    logger.log(`Trade detected: ${tradeInfo.type} ${tradeInfo.amount} ${tradeInfo.tokenSymbol}`);

    // Execute mirrored trades for all followers
    for (const follower of followers) {
      await executeMirroredTrade(runtime, follower, tradeInfo);
    }

  } catch (error) {
    logger.error(`Error processing wallet event for ${walletAddress}:`, error);
  }
}

async function analyzeAccountChange(runtime: IAgentRuntime, walletAddress: string, accountInfo: any) {
  try {

    // Get recent transactions for this wallet
    const connection = new Connection(
      runtime.getSetting('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com'
    );

    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(walletAddress),
      { limit: 5 }
    );

    if (signatures.length === 0) {
      return null;
    }

    // Get the most recent transaction
    const latestTx = await connection.getTransaction(signatures[0].signature, {
      maxSupportedTransactionVersion: 0
    });

    if (!latestTx) {
      return null;
    }

    // Check if this is a swap transaction (Jupiter or similar)
    const isSwap = await detectSwapTransaction(latestTx);
    if (!isSwap) {
      return null;
    }

    // Extract trade information
    const tradeInfo = await extractTradeInfo(runtime, latestTx);
    return tradeInfo;

  } catch (error) {
    logger.error('Error analyzing account change:', error);
    return null;
  }
}

async function detectSwapTransaction(transaction: any): Promise<boolean> {
  // Check if transaction involves Jupiter or other DEX programs
  const swapPrograms = [
    'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB', // Jupiter v4
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter v6
    '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Jupiter v3
  ];

  for (const instruction of transaction.transaction.message.instructions) {
    const programId = instruction.programId.toString();
    if (swapPrograms.includes(programId)) {
      return true;
    }
  }

  return false;
}

async function extractTradeInfo(runtime: IAgentRuntime, transaction: any) {
  try {
    const birdeyeService = runtime.getService('BIRDEYE_SERVICE') as any;

    // Get transaction timestamp
    const timestamp = transaction.blockTime ? transaction.blockTime * 1000 : Date.now();

    // Parse Jupiter instructions to extract swap details
    const swapDetails = await parseJupiterInstructions(transaction);
    if (!swapDetails) {
      logger.warn('Could not parse Jupiter instructions from transaction');
      return null;
    }

    // Get token metadata for both input and output tokens
    const [inputTokenMeta, outputTokenMeta] = await Promise.all([
      getTokenMetadata(runtime, swapDetails.inputMint),
      getTokenMetadata(runtime, swapDetails.outputMint)
    ]);

    // Determine trade direction and token info
    const isBuyingToken = swapDetails.inputMint === 'So11111111111111111111111111111111111111112'; // SOL
    const targetToken = isBuyingToken ? outputTokenMeta : inputTokenMeta;
    const solAmount = isBuyingToken ? swapDetails.inputAmount : swapDetails.outputAmount;
    const tokenAmount = isBuyingToken ? swapDetails.outputAmount : swapDetails.inputAmount;

    return {
      type: 'swap',
      direction: isBuyingToken ? 'buy' : 'sell',
      amount: solAmount / 1e9, // Convert lamports to SOL
      tokenSymbol: targetToken?.symbol || 'UNKNOWN',
      tokenAddress: isBuyingToken ? swapDetails.outputMint : swapDetails.inputMint,
      tokenAmount: tokenAmount,
      inputMint: swapDetails.inputMint,
      outputMint: swapDetails.outputMint,
      timestamp: timestamp
    };
  } catch (error) {
    logger.error('Error extracting trade info:', error);
    return null;
  }
}

async function parseJupiterInstructions(transaction: any) {
  try {
    const instructions = transaction.transaction.message.instructions;
    const accounts = transaction.transaction.message.accountKeys;

    // Find Jupiter instruction
    const jupiterInstruction = instructions.find((inst: any) => {
      const programId = accounts[inst.programIdIndex].toString();
      return [
        'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB', // Jupiter v4
        'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter v6
        '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Jupiter v3
      ].includes(programId);
    });

    if (!jupiterInstruction) {
      return null;
    }

    // For Jupiter v6, the instruction format includes route plan
    // We'll extract from the accounts array which typically includes:
    // - User's token accounts (input/output)
    // - Token mints
    // - Associated token accounts

    // Look for token mints in the accounts
    const tokenMints: string[] = [];
    const tokenAccounts: string[] = [];

    for (const accountIndex of jupiterInstruction.accounts) {
      const account = accounts[accountIndex];
      const accountStr = account.toString();

      // Token mints are typically 32 bytes and not associated token accounts
      if (accountStr.length === 44 && !accountStr.includes('AssociatedToken')) {
        tokenMints.push(accountStr);
      }

      // Token accounts are typically associated token accounts
      if (accountStr.includes('AssociatedToken')) {
        tokenAccounts.push(accountStr);
      }
    }

    // Remove duplicates and filter out known system addresses
    const uniqueMints = [...new Set(tokenMints)].filter(mint =>
      mint !== '11111111111111111111111111111111' && // System Program
      mint !== 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' && // Token Program
      mint !== 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' // Associated Token Program
    );

    if (uniqueMints.length < 2) {
      logger.warn('Could not identify token mints from Jupiter instruction');
      return null;
    }

    // Determine input and output mints
    // SOL is typically the input for buys, output for sells
    const solMint = 'So11111111111111111111111111111111111111112';
    const inputMint = uniqueMints.includes(solMint) ? solMint : uniqueMints[0];
    const outputMint = uniqueMints.find(mint => mint !== inputMint) || uniqueMints[1];

    // Extract amounts from pre/post token balances
    const preBalances = transaction.meta?.preTokenBalances || [];
    const postBalances = transaction.meta?.postTokenBalances || [];

    let inputAmount = 0;
    let outputAmount = 0;

    // Calculate balance changes for each token
    for (const preBalance of preBalances) {
      const postBalance = postBalances.find(pb => pb.accountIndex === preBalance.accountIndex);
      if (postBalance) {
        const preAmount = parseFloat(preBalance.uiTokenAmount?.uiAmount || '0');
        const postAmount = parseFloat(postBalance.uiTokenAmount?.uiAmount || '0');
        const change = Math.abs(postAmount - preAmount);

        const mint = preBalance.mint;
        if (mint === inputMint) {
          inputAmount = change;
        } else if (mint === outputMint) {
          outputAmount = change;
        }
      }
    }

    // If we couldn't get amounts from balances, try to estimate from instruction data
    if (inputAmount === 0 || outputAmount === 0) {
      // For SOL, use lamports change
      const preLamports = transaction.meta?.preBalances?.[0] || 0;
      const postLamports = transaction.meta?.postBalances?.[0] || 0;
      const lamportsChange = Math.abs(postLamports - preLamports);

      if (inputMint === solMint) {
        inputAmount = lamportsChange / 1e9; // Convert to SOL
      } else if (outputMint === solMint) {
        outputAmount = lamportsChange / 1e9; // Convert to SOL
      }
    }

    return {
      inputMint,
      outputMint,
      inputAmount: inputAmount * 1e9, // Convert to lamports for consistency
      outputAmount: outputAmount * 1e9, // Convert to lamports for consistency
    };

  } catch (error) {
    logger.error('Error parsing Jupiter instructions:', error);
    return null;
  }
}

async function getTokenMetadata(runtime: IAgentRuntime, tokenAddress: string) {
  try {
    // Try to get from Birdeye service first
    const birdeyeService = runtime.getService('BIRDEYE_SERVICE') as any;
    if (birdeyeService) {
      try {
        const metadata = await birdeyeService.fetchTokenMetadataSingle({ address: tokenAddress });
        if (metadata?.success && metadata.data) {
          return {
            symbol: metadata.data.symbol,
            name: metadata.data.name,
            decimals: metadata.data.decimals,
            address: metadata.data.address
          };
        }
      } catch (error) {
        logger.debug('Birdeye metadata fetch failed, trying fallback:', error);
      }
    }

    // Fallback to Solana service for basic token info
    const solanaService = runtime.getService(SOLANA_SERVICE_NAME) as any;
    if (solanaService) {
      try {
        const symbol = await solanaService.getTokenSymbol(new PublicKey(tokenAddress));
        if (symbol) {
          return {
            symbol,
            name: symbol,
            decimals: 9, // Default for most Solana tokens
            address: tokenAddress
          };
        }
      } catch (error) {
        logger.debug('Solana service metadata fetch failed:', error);
      }
    }

    // Final fallback - return basic info
    return {
      symbol: 'UNKNOWN',
      name: 'Unknown Token',
      decimals: 9,
      address: tokenAddress
    };

  } catch (error) {
    logger.error('Error getting token metadata:', error);
    return {
      symbol: 'UNKNOWN',
      name: 'Unknown Token',
      decimals: 9,
      address: tokenAddress
    };
  }
}

async function executeMirroredTrade(runtime: IAgentRuntime, follower: any, tradeInfo: any) {
  try {
    const solanaService = runtime.getService(SOLANA_SERVICE_NAME) as any;
    const strategyService = await acquireService(runtime, 'TRADER_STRATEGY', 'copy trading strategy');

    // Get follower's wallet
    const userWallets = await getSpartanWallets(runtime, { strategy: STRATEGY_NAME });
    const followerWallet = userWallets.find(w => (w as any).publicKey === follower.walletAddress) as any;

    if (!followerWallet) {
      logger.warn(`Follower wallet ${follower.walletAddress} not found`);
      return;
    }

    // Get balance and scale amount exactly like strategy_llm
    const bal = await solanaService.getBalanceByAddr(followerWallet.publicKey);
    if (bal === -1) {
      logger.warn(`Invalid balance for wallet ${follower.walletAddress}`);
      return;
    }

    // Scale amount using the same pattern as strategy_llm
    const amt = await scaleAmount(followerWallet, bal, { buy_amount: follower.scalingFactor * 100 });
    if (amt <= 0) {
      logger.warn(`Scaled amount too small for wallet ${follower.walletAddress}`);
      return;
    }

    // Execute the mirrored trade using the same pattern as strategy_llm
    const kp = {
      privateKey: followerWallet.privateKey,
      publicKey: followerWallet.publicKey,
    };

    const swapParams = {
      sourceTokenCA: 'So11111111111111111111111111111111111111112', // SOL
      targetTokenCA: tradeInfo.tokenAddress,
      amount: amt * 1e9, // Convert to lamports
      keypair: kp
    };

    const res = await solanaService.executeSwap([swapParams], {
      sourceTokenCA: swapParams.sourceTokenCA,
      targetTokenCA: swapParams.targetTokenCA
    });

    if (!res?.length) {
      logger.warn('Bad response', res);
      return;
    }

    if (res[0].success) {
      // Create position record exactly like strategy_llm
      const position = {
        id: uuidv4() as UUID,
        chain: 'solana',
        token: tradeInfo.tokenAddress,
        publicKey: kp.publicKey,
        solAmount: amt,
        tokenAmount: res[0].outAmount,
        swapFee: res[0].fees.lamports,
        timestamp: Date.now(),
        exitConditions: {
          reasoning: 'Copy trading position',
          sentimentDrop: -50,
          volumeDrop: 1000000,
          priceDrop: tradeInfo.amount * 0.8, // 20% stop loss
          targetPrice: tradeInfo.amount * 1.5 // 50% take profit
        }
      };

      // Open position in strategy service exactly like strategy_llm
      const me = { name: STRATEGY_NAME };
      const hndl = await strategyService.register_strategy(me);
      await strategyService.open_position(hndl, position);

      logger.log(`Created copy trading position for ${follower.walletAddress}`);
    } else {
      logger.warn(`Failed to execute mirrored trade for ${follower.walletAddress}`);
    }

  } catch (error) {
    logger.error(`Error executing mirrored trade for ${follower.walletAddress}:`, error);
  }
}

// Mirror the exact scaleAmount function from strategy_llm
async function scaleAmount(walletKeypair: any, availableBalance: number, signal: any): Promise<number> {
  // Ensure we have valid inputs
  if (!signal?.buy_amount) {
    return 0;
  }

  // Convert buy_amount to a decimal (e.g. 23 -> 0.23)
  const percentage = Math.min(Math.max(signal.buy_amount, 1), 99) / 100;

  // Calculate the amount to buy based on available balance
  const amountToBuy = availableBalance * percentage;

  // Round to 6 decimal places to avoid floating point issues
  return Math.floor(amountToBuy * 1000000) / 1000000;
}

async function calculateScalingFactor(runtime: IAgentRuntime, wallet: any): Promise<number> {
  try {
    const solanaService = runtime.getService(SOLANA_SERVICE_NAME) as any;
    const balance = await solanaService.getBalanceByAddr(new PublicKey((wallet as any).publicKey));

    if (balance <= 0) {
      return 0;
    }

    // Calculate dynamic percentage based on balance
    // Higher balance = lower percentage to avoid large trades
    // Lower balance = higher percentage to make meaningful trades
    const basePercentage = 10; // Base 10%
    const balanceInSol = balance / 1e9; // Convert lamports to SOL

    if (balanceInSol < 0.1) {
      return 50; // 50% for very small balances
    } else if (balanceInSol < 1) {
      return 25; // 25% for small balances
    } else if (balanceInSol < 10) {
      return 15; // 15% for medium balances
    } else {
      return Math.max(5, basePercentage - Math.floor(balanceInSol / 10)); // Scale down for large balances
    }
  } catch (error) {
    logger.error('Error calculating scaling factor:', error);
    return 5; // Default to 5% if error
  }
}
