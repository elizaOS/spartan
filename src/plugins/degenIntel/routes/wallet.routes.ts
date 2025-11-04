/**
 * Wallet & DeFi Routes
 * Consolidated from rt_* handler files - all wallet operations, swaps, AI chat, and verification
 */

import type { Route, IAgentRuntime, createUniqueUuid } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { PublicKey } from '@solana/web3.js';
import { verifyUserRegistration, createOrUpdateVerificationToken, verifyEmailToken } from '../utils/emailVerification';

// ==================== Helper Functions ====================

/**
 * Get token info from cache or data provider service
 */
async function getTokenInfo(runtime: IAgentRuntime, tokenMint: string) {
  try {
    const cachedTokens = await runtime.getCache('tokens_solana') || [];
    const cachedToken = (cachedTokens as any[]).find((t: any) => t.address === tokenMint);

    if (cachedToken) {
      return {
        symbol: cachedToken.symbol,
        name: cachedToken.name,
        decimals: cachedToken.decimals || 9,
      };
    }

    const dataProviderService = runtime.getService('TRADER_DATAPROVIDER') as any;
    if (dataProviderService && dataProviderService.getTokenInfo) {
      return await dataProviderService.getTokenInfo('solana', tokenMint);
    }

    return {
      symbol: tokenMint.slice(0, 6),
      name: `Token ${tokenMint.slice(0, 8)}`,
      decimals: 9,
    };
  } catch (error) {
    console.error("Error getting token info:", error);
    return null;
  }
}

/**
 * Get wallet balances from chain_solana service
 */
async function getWalletBalancesFromServices(runtime: IAgentRuntime, walletAddress: string, includePrices: boolean) {
  try {
    const solanaService = runtime.getService('chain_solana') as any;

    if (!solanaService) {
      throw new Error("Solana service not available");
    }

    const balances = await solanaService.getBalancesByAddrs([walletAddress]);
    const solBalance = balances[walletAddress];
    const tokenAccounts = await solanaService.getTokenAccountsByKeypair(new PublicKey(walletAddress));

    const tokens: any[] = [];
    let totalValueUsd = 0;

    const cachedTokens = await runtime.getCache('tokens_solana') || [];
    const dataProviderService = runtime.getService('TRADER_DATAPROVIDER') as any;

    for (const account of tokenAccounts) {
      const accountInfo = account.account.data.parsed.info;
      const tokenMint = accountInfo.mint;

      if (accountInfo.tokenAmount.uiAmount === 0) continue;

      let tokenInfo: any = null;
      if (includePrices && dataProviderService && dataProviderService.getTokenInfo) {
        tokenInfo = await dataProviderService.getTokenInfo('solana', tokenMint);
      }

      const cachedToken = (cachedTokens as any[]).find((t: any) => t.address === tokenMint);
      const price = includePrices ? tokenInfo?.priceUsd : undefined;
      const valueUsd = price ? parseFloat(accountInfo.tokenAmount.uiAmount) * price : undefined;

      if (valueUsd) {
        totalValueUsd += valueUsd;
      }

      let symbol = cachedToken?.symbol || tokenMint.slice(0, 6);
      try {
        const tokenSymbol = await solanaService.getTokenSymbol(new PublicKey(tokenMint));
        if (tokenSymbol) {
          symbol = tokenSymbol;
        }
      } catch (symbolError) {
        console.warn(`Failed to get symbol for token ${tokenMint}:`, symbolError);
      }

      tokens.push({
        mint: tokenMint,
        symbol,
        name: symbol,
        balance: accountInfo.tokenAmount.uiAmount,
        decimals: accountInfo.tokenAmount.decimals,
        uiAmount: accountInfo.tokenAmount.uiAmount,
        priceUsd: price,
        valueUsd,
      });
    }

    return {
      solBalance,
      tokens,
      totalValueUsd,
    };
  } catch (error) {
    console.error("Error getting wallet balances from services:", error);
    return {
      solBalance: 0,
      tokens: [],
      totalValueUsd: 0,
    };
  }
}

/**
 * Get specific token balance from wallet
 */
async function getTokenBalanceFromServices(runtime: IAgentRuntime, walletAddress: string, tokenMint: string) {
  try {
    const solanaService = runtime.getService('chain_solana') as any;

    if (!solanaService) {
      throw new Error("Solana service not available");
    }

    const tokenAccounts = await solanaService.getTokenAccountsByKeypair(new PublicKey(walletAddress));

    const tokenAccount = tokenAccounts.find((account: any) =>
      account.account.data.parsed.info.mint === tokenMint
    );

    if (!tokenAccount) {
      return null;
    }

    const accountInfo = tokenAccount.account.data.parsed.info;

    const dataProviderService = runtime.getService('TRADER_DATAPROVIDER') as any;
    let tokenInfo: any = null;

    if (dataProviderService && dataProviderService.getTokenInfo) {
      tokenInfo = await dataProviderService.getTokenInfo('solana', tokenMint);
    }

    let price = undefined;
    const cachedTokens = await runtime.getCache('tokens_solana');
    if (cachedTokens) {
      const token = (cachedTokens as any[]).find((t: any) => t.address === tokenMint);
      if (token) {
        price = token.price;
      }
    }

    let symbol = tokenInfo?.symbol || tokenMint.slice(0, 6);
    try {
      const tokenSymbol = await solanaService.getTokenSymbol(new PublicKey(tokenMint));
      if (tokenSymbol) {
        symbol = tokenSymbol;
      }
    } catch (symbolError) {
      console.warn(`Failed to get symbol for token ${tokenMint}:`, symbolError);
    }

    return {
      mint: tokenMint,
      symbol,
      name: symbol,
      balance: accountInfo.tokenAmount.uiAmount,
      decimals: accountInfo.tokenAmount.decimals,
      uiAmount: accountInfo.tokenAmount.uiAmount,
      valueUsd: price ? accountInfo.tokenAmount.uiAmount * price : undefined,
    };
  } catch (error) {
    console.error("Error getting token balance from services:", error);
    return null;
  }
}

/**
 * Get swap quote from Jupiter
 */
async function getSwapQuoteFromServices(runtime: IAgentRuntime, params: any) {
  try {
    const jupiterApiUrl = (runtime.getSetting("JUPITER_API_URL") as string) || "https://quote-api.jup.ag/v6";

    const solanaService = runtime.getService('chain_solana') as any;
    if (!solanaService) {
      throw new Error("Solana service not available");
    }

    const inputTokenInfo = await getTokenInfo(runtime, params.inputMint);
    const outputTokenInfo = await getTokenInfo(runtime, params.outputMint);

    const inputDecimals = inputTokenInfo?.decimals || 9;
    const rawAmount = Math.floor(params.amount * Math.pow(10, inputDecimals));

    const response = await fetch(
      `${jupiterApiUrl}/quote?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${rawAmount}&slippageBps=${params.slippageBps}`
    );

    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.statusText}`);
    }

    const quote = await response.json();
    return quote;
  } catch (error) {
    console.error("Error getting swap quote from services:", error);
    return null;
  }
}

/**
 * Generate AI suggestions based on context
 */
function generateSuggestionsFromContext(context: any): string[] {
  const suggestions = [
    "Show my wallet balances",
    "Get a swap quote for SOL to USDC",
    "What's the current market sentiment?",
    "Analyze my portfolio performance",
    "Show trending tokens",
  ];

  return suggestions.slice(0, 3);
}

/**
 * Build context string for AI chat
 */
function buildContextString(context: any): string {
  if (!context) return '';

  let contextString = '';

  if (context.marketData) {
    contextString += `**Current Market Data:**\n`;
    contextString += `- Total tokens tracked: ${context.marketData.totalTokens || 0}\n`;

    if (context.marketData.trendingTokens?.length > 0) {
      contextString += `- Top trending tokens:\n`;
      context.marketData.trendingTokens.slice(0, 5).forEach((token: any) => {
        contextString += `  • ${token.symbol}: $${token.price?.toFixed(4) || 'N/A'} (${token.change24h?.toFixed(2) || 'N/A'}% 24h)\n`;
      });
    }
  }

  if (context.portfolio) {
    contextString += `\n**Portfolio Data Available**\n`;
  }

  if (context.recentTransactions?.length > 0) {
    contextString += `\n**Recent Transactions:** ${context.recentTransactions.length} transactions\n`;
  }

  return contextString;
}

/**
 * Create or get session for AI chat
 */
async function createOrGetSession(runtime: IAgentRuntime, userId: string): Promise<string> {
  try {
    const response = await fetch(`${(runtime.getSetting('API_BASE_URL') as string) || 'http://206.81.100.168:3000'}/api/messaging/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentId: runtime.agentId,
        userId,
        metadata: {
          platform: 'spartan',
          username: userId,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    const { sessionId } = await response.json();
    return sessionId;
  } catch (error) {
    console.error("Error creating session:", error);
    throw error;
  }
}

/**
 * Send message in session
 */
async function sendSessionMessage(runtime: IAgentRuntime, sessionId: string, message: string, context: any) {
  try {
    const contextString = buildContextString(context);
    const fullMessage = contextString ? `${contextString}\n\nUser: ${message}` : message;

    const response = await fetch(
      `${(runtime.getSetting('API_BASE_URL') as string) || 'http://206.81.100.168:3000'}/api/messaging/sessions/${sessionId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: fullMessage,
          metadata: {
            userTimezone: 'UTC',
            context: contextString ? 'defi' : 'general',
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error sending session message:", error);
    throw error;
  }
}

/**
 * Chat with Spartan AI
 */
async function chatWithSpartanAI(runtime: IAgentRuntime, message: string, context: any) {
  try {
    const userId = context.userId || 'default-user';
    const sessionId = await createOrGetSession(runtime, userId);

    const response = await sendSessionMessage(runtime, sessionId, message, context);

    return {
      message: response.content,
      sessionId,
      suggestions: generateSuggestionsFromContext(context),
      confidence: 0.9,
    };
  } catch (error) {
    console.error("Error chatting with Spartan AI:", error);
    return {
      message: "I'm having trouble processing your request right now. Please try again.",
      confidence: 0.1,
    };
  }
}

/**
 * Validate auth token
 */
async function validateAuthToken(
  runtime: IAgentRuntime,
  email: string,
  authToken: string
): Promise<{ valid: boolean; userEntityId?: string; error?: string }> {
  try {
    const authTokenKey = `auth_token_${email}`;
    const cachedAuthData = await runtime.getCache(authTokenKey);

    if (!cachedAuthData) {
      return { valid: false, error: 'No auth token found' };
    }

    const { authToken: storedAuthToken, expiry, userEntityId } = cachedAuthData as any;

    if (Date.now() > expiry) {
      await runtime.deleteCache(authTokenKey);
      return { valid: false, error: 'Auth token has expired' };
    }

    if (authToken !== storedAuthToken) {
      return { valid: false, error: 'Invalid auth token' };
    }

    return { valid: true, userEntityId };
  } catch (error) {
    logger.error('Error validating auth token:', error as any);
    return { valid: false, error: 'Failed to validate auth token' };
  }
}

// ==================== Route Definitions ====================

export const walletRoutes: Route[] = [
  // API Overview
  {
    type: 'GET',
    path: '/spartan-defi',
    public: true,
    name: 'Spartan DeFi',
    handler: async (_req: any, res: any) => {
      res.json({
        name: 'Spartan DeFi API',
        version: '1.0.0',
        description: 'DeFi token management, swaps, and AI-powered trading insights using degenIntel services',
        endpoints: [
          'GET /spartan-defi/balances/:walletAddress',
          'GET /spartan-defi/token/:walletAddress/:tokenMint',
          'GET /spartan-defi/token/:tokenMint',
          'GET /spartan-defi/status',
          'POST /spartan-defi/chat',
          'POST /spartan-defi/sessions',
          'POST /spartan-defi/sessions/:sessionId/messages',
          'GET /spartan-defi/sessions/:sessionId/messages',
          'DELETE /spartan-defi/sessions/:sessionId',
          'POST /spartan-defi/validate-account',
          'POST /spartan-defi/request-email-verification',
          'GET /spartan-defi/verify-email-token',
          'POST /spartan-defi/verify-email-token',
        ]
      });
    },
  },

  // Service Status
  {
    type: 'GET',
    path: '/spartan-defi/status',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const dataProviderService = runtime.getService('TRADER_DATAPROVIDER');
        const chainService = runtime.getService('TRADER_CHAIN');
        const solanaService = runtime.getService('chain_solana');

        const cachedTokens = await runtime.getCache<any[]>('tokens_solana') || [];
        const portfolioData = await runtime.getCache<any>('portfolio');
        const transactionHistory = await runtime.getCache<any[]>('transaction_history') || [];

        res.json({
          success: true,
          data: {
            service: 'Spartan DeFi',
            status: 'running',
            dependencies: {
              dataProvider: !!dataProviderService,
              chainService: !!chainService,
              solanaService: !!solanaService,
            },
            cache: {
              tokens: Array.isArray(cachedTokens) ? cachedTokens.length : 0,
              portfolio: !!portfolioData,
              transactions: Array.isArray(transactionHistory) ? transactionHistory.length : 0,
            },
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error('Error getting service status:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },

  // Get Wallet Balances
  {
    type: 'GET',
    path: '/spartan-defi/balances/:walletAddress',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { walletAddress } = req.params || {};
        const { includePrices = true } = req.query || {};

        if (!walletAddress) {
          return res.status(400).json({
            success: false,
            message: 'walletAddress is required'
          });
        }

        logger.info('Getting wallet balances for:', walletAddress, 'includePrices', includePrices);

        const balances = await getWalletBalancesFromServices(runtime, walletAddress, includePrices);

        res.json({
          success: true,
          walletAddress,
          solBalance: balances.solBalance,
          tokens: balances.tokens,
          totalValueUsd: balances.totalValueUsd,
          message: `Retrieved balances for ${balances.tokens.length} tokens`,
          tokenCount: balances.tokens.length
        });
      } catch (error) {
        logger.error('Error in getWalletBalances route:', error as any);
        res.status(500).json({
          success: false,
          message: 'Error getting wallet balances',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },

  // Get Token Balance
  {
    type: 'GET',
    path: '/spartan-defi/token/:walletAddress/:tokenMint',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { walletAddress, tokenMint } = req.params || {};

        if (!walletAddress || !tokenMint) {
          return res.status(400).json({
            success: false,
            message: 'walletAddress and tokenMint are required'
          });
        }

        logger.info('Getting token balance for:', tokenMint, 'in wallet:', walletAddress);

        const tokenBalance = await getTokenBalanceFromServices(runtime, walletAddress, tokenMint);

        if (tokenBalance) {
          res.json({
            success: true,
            walletAddress,
            tokenBalance,
            message: `Retrieved balance for ${tokenBalance.symbol}`,
            hasBalance: tokenBalance.balance > 0
          });
        } else {
          res.json({
            success: true,
            walletAddress,
            tokenMint,
            message: 'No token account found for this mint',
            hasBalance: false
          });
        }
      } catch (error) {
        logger.error('Error in getTokenBalance route:', error as any);
        res.status(500).json({
          success: false,
          message: 'Error getting token balance',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },

  // Get Token Info
  {
    type: 'GET',
    path: '/spartan-defi/token/:tokenMint',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { tokenMint } = req.params || {};

        if (!tokenMint) {
          return res.status(400).json({
            success: false,
            message: 'tokenMint is required'
          });
        }

        logger.info('Getting token info for:', tokenMint);

        const tokenInfo = await getTokenInfo(runtime, tokenMint);

        if (tokenInfo) {
          res.json({
            success: true,
            tokenInfo,
            message: `Retrieved info for ${tokenInfo.symbol}`,
            tokenMint
          });
        } else {
          res.status(400).json({
            success: false,
            message: 'Failed to get token info',
            tokenMint
          });
        }
      } catch (error) {
        logger.error('Error in getTokenInfo route:', error as any);
        res.status(500).json({
          success: false,
          message: 'Error getting token info',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },

  // Get Swap Quote
  {
    type: 'POST',
    path: '/spartan-defi/swap/quote',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { inputMint, outputMint, amount, slippageBps = 50 } = req.body || {};

        if (!inputMint || !outputMint || !amount) {
          return res.status(400).json({
            success: false,
            message: 'inputMint, outputMint, and amount are required'
          });
        }

        logger.info('Getting swap quote for:', inputMint, 'to', outputMint, 'amount:', amount);

        const quote = await getSwapQuoteFromServices(runtime, {
          inputMint,
          outputMint,
          amount,
          slippageBps
        });

        if (quote) {
          res.json({
            success: true,
            quote,
            message: 'Successfully retrieved swap quote',
            inputMint,
            outputMint,
            amount,
            slippageBps
          });
        } else {
          res.status(400).json({
            success: false,
            message: 'Failed to get swap quote',
            inputMint,
            outputMint,
            amount
          });
        }
      } catch (error) {
        logger.error('Error in getSwapQuote route:', error as any);
        res.status(500).json({
          success: false,
          message: 'Error getting swap quote',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },

  // Chat with Spartan AI
  {
    type: 'POST',
    path: '/spartan-defi/chat',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { message: userMessage, context = {} } = req.body || {};

        if (!userMessage) {
          return res.status(400).json({
            success: false,
            message: 'Message is required'
          });
        }

        logger.info('Chatting with Spartan AI:', userMessage.substring(0, 100) + '...');

        const response = await chatWithSpartanAI(runtime, userMessage, context);

        res.json({
          success: true,
          message: response.message,
          sessionId: response.sessionId,
          suggestions: response.suggestions,
          confidence: response.confidence,
          originalMessage: userMessage
        });
      } catch (error) {
        logger.error('Error in chatWithSpartanAI route:', error as any);
        res.status(500).json({
          success: false,
          message: 'Error chatting with Spartan AI',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },

  // Create Session
  {
    type: 'POST',
    path: '/spartan-defi/sessions',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { userId, metadata } = req.body;

        if (!userId) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameter: userId'
          });
        }

        const sessionId = await createOrGetSession(runtime, userId);

        res.json({
          success: true,
          data: { sessionId },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },

  // Send Session Message
  {
    type: 'POST',
    path: '/spartan-defi/sessions/:sessionId/messages',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { sessionId } = req.params;
        const { content, metadata } = req.body;

        if (!content) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameter: content'
          });
        }

        const messageResponse = await sendSessionMessage(runtime, sessionId, content, metadata);

        res.json({
          success: true,
          data: messageResponse,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error sending session message:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },

  // Get Session Messages
  {
    type: 'GET',
    path: '/spartan-defi/sessions/:sessionId/messages',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { sessionId } = req.params;
        const { limit = 20, before, after } = req.query;

        const queryParams = new URLSearchParams();
        if (limit) queryParams.append('limit', limit.toString());
        if (before) queryParams.append('before', before);
        if (after) queryParams.append('after', after);

        const response = await fetch(
          `${(runtime.getSetting('API_BASE_URL') as string) || 'http://localhost:3000'}/api/messaging/sessions/${sessionId}/messages?${queryParams}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to get messages: ${response.statusText}`);
        }

        const messagesResponse = await response.json();

        res.json({
          success: true,
          data: messagesResponse,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error getting session messages:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },

  // Delete Session
  {
    type: 'DELETE',
    path: '/spartan-defi/sessions/:sessionId',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { sessionId } = req.params;

        const response = await fetch(
          `${(runtime.getSetting('API_BASE_URL') as string) || 'http://localhost:3000'}/api/messaging/sessions/${sessionId}`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to delete session: ${response.statusText}`);
        }

        res.json({
          success: true,
          data: { message: 'Session deleted successfully' },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },

  // Validate Account
  {
    type: 'POST',
    path: '/spartan-defi/validate-account',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { email } = req.body || {};
        const authToken = req.headers.authorization?.replace('Bearer ', '') || req.body?.authToken;

        if (!email) {
          return res.status(400).json({
            success: false,
            message: 'Email is required'
          });
        }

        if (!authToken) {
          return res.status(400).json({
            success: false,
            message: 'Auth token is required (send in Authorization header or request body)'
          });
        }

        logger.info('Validating auth token for:', email);

        const result = await validateAuthToken(runtime, email, authToken);

        if (result.valid) {
          const { createUniqueUuid } = await import('@elizaos/core');
          const emailEntityId = createUniqueUuid(runtime, email);
          const intAccountService = runtime.getService('AUTONOMOUS_TRADER_INTERFACE_ACCOUNTS') as any;
          let wallets: any[] = [];

          if (intAccountService) {
            try {
              const components = await intAccountService.interface_accounts_ByIds([emailEntityId]);
              const component = components[emailEntityId];

              if (component && component.metawallets) {
                console.log('component.metawallets', component.metawallets);

                for (const mw of component.metawallets) {
                  for (const chain in mw.keypairs) {
                    const kp = mw.keypairs[chain];
                    console.log(chain, kp);
                    wallets.push({
                      address: kp.publicKey,
                      name: kp.publicKey.slice(0, 8) + '...',
                      type: chain,
                      verified: true,
                    });
                  }
                }
                console.log('wallets', wallets);
              }
            } catch (error) {
              console.error('Error fetching user wallets:', error);
            }
          }

          const accountData = {
            type: 'email',
            address: email,
            verified: true,
            registrationDate: new Date().toISOString(),
            wallets: wallets
          };

          res.json({
            success: true,
            data: {
              userEntityId: result.userEntityId,
              message: 'Auth token is valid',
              email,
              isValid: true,
              account: accountData
            }
          });
        } else {
          res.status(401).json({
            success: false,
            message: result.error || 'Invalid auth token',
            email
          });
        }
      } catch (error) {
        logger.error('Error in validateAuthToken route:', error as any);
        res.status(500).json({
          success: false,
          message: 'Error validating auth token',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },

  // Request Email Verification
  {
    type: 'POST',
    path: '/spartan-defi/request-email-verification',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { email } = req.body;

        if (!email) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameter: email'
          });
        }

        const registrationStatus = await verifyUserRegistration(runtime, email);

        if (!registrationStatus.isRegistered) {
          return res.status(404).json({
            success: false,
            error: 'EMAIL_NOT_REGISTERED',
            message: 'Email address is not registered with Spartan DeFi'
          });
        }

        const tokenResult = await createOrUpdateVerificationToken(
          runtime,
          email,
          registrationStatus.accountEntityId!
        );

        if (!tokenResult.success) {
          return res.status(500).json({
            success: false,
            error: 'FAILED_TO_SEND_TOKEN',
            message: tokenResult.error || 'Failed to send verification token'
          });
        }

        res.json({
          success: true,
          data: {
            message: 'Verification token sent successfully',
            email,
            verified: registrationStatus.verified,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error('Error requesting email verification:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },

  // Verify Email Token
  {
    type: 'POST',
    path: '/spartan-defi/verify-email-token',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { email, token } = req.body || {};

        if (!email || !token) {
          return res.status(400).json({
            success: false,
            message: 'Email and token are required'
          });
        }

        logger.info('Verifying email token for:', email);

        const result = await verifyEmailToken(runtime, email, token);

        if (result.success) {
          res.json({
            success: true,
            data: {
              authToken: result.authToken,
              message: 'Email token verified successfully',
              email
            }
          });
        } else {
          res.status(400).json({
            success: false,
            message: result.error || 'Failed to verify email token',
            email
          });
        }
      } catch (error) {
        logger.error('Error in verifyEmailToken route:', error as any);
        res.status(500).json({
          success: false,
          message: 'Error verifying email token',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },
];

