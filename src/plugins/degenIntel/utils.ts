import { type IAgentRuntime, ModelType, logger, parseJSONObjectFromText, createUniqueUuid } from '@elizaos/core';
import { PublicKey } from '@solana/web3.js';
import { v4 as uuidv4 } from 'uuid';
import { generateRandomString, getDataFromMessage, findGeneratedCode } from '../autonomous-trader/utils';
import CONSTANTS from '../autonomous-trader/constants';

// Email verification functions using existing infrastructure
export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  try {
    // Use the existing email sending function from act_reg_start.ts
    const nodemailer = await import('nodemailer');

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD
      }
    });

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@spartan.com',
      to: email,
      subject: 'Spartan DeFi - Email Verification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Spartan DeFi Email Verification</h2>
          <p>Hello!</p>
          <p>You're trying to access Spartan DeFi services. Please use the following verification code:</p>
          <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="color: #1f2937; font-size: 32px; letter-spacing: 4px; margin: 0;">${token}</h1>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this verification, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">Spartan DeFi - Your AI-powered DeFi assistant</p>
        </div>
      `,
      text: `Spartan DeFi Email Verification\n\nYour verification code is: ${token}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this verification, please ignore this email.`
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info('Verification email sent:', info.envelope);
    return true;
  } catch (error) {
    logger.error('Error sending verification email:', error);
    return false;
  }
}

export function generateVerificationToken(): string {
  // Use existing generateRandomString function with CONSTANTS.useCodeLength
  const token = generateRandomString(CONSTANTS.useCodeLength);
  console.log('Generated verification token:', token);
  return token;
}

export async function verifyUserRegistration(runtime: IAgentRuntime, email: string): Promise<{
  isRegistered: boolean;
  userEntityId?: string;
  accountEntityId?: string;
  verified?: boolean;
}> {
  try {
    const emailEntityId = createUniqueUuid(runtime, email);
    //console.log('emailEntityId', emailEntityIdg)
    const intAccountService = runtime.getService('AUTONOMOUS_TRADER_INTERFACE_ACCOUNTS') as any;

    if (!intAccountService) {
      logger.warn('User interface service not available');
      return { isRegistered: false };
    }

    // Check if user exists and is verified using existing service
    //const components = await intUserService.interface_users_ByIds([emailEntityId]);
    const components = await intAccountService.interface_accounts_ByIds([emailEntityId]);
    //console.log('components', components)
    const component = components[emailEntityId];

    if (component) {
      return {
        isRegistered: true,
        //userEntityId: emailEntityId,
        accountEntityId: emailEntityId,
        //verified: component.verified
      };
    }

    /*
    if (component && component.verified) {
      return {
        isRegistered: true,
        userEntityId: emailEntityId,
        accountEntityId: emailEntityId,
        verified: component.verified
      };
    }

    // Check if user exists but not verified
    if (component && !component.verified) {
      return {
        isRegistered: true,
        userEntityId: emailEntityId,
        accountEntityId: emailEntityId,
        verified: false
      };
    }
    */

    return { isRegistered: false };
  } catch (error) {
    logger.error('Error verifying user registration:', error);
    return { isRegistered: false };
  }
}

export async function createOrUpdateVerificationToken(
  runtime: IAgentRuntime,
  email: string,
  accountEntityId: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    console.log('createOrUpdateVerificationToken called with:');
    console.log('Email:', email);
    console.log('accountEntityId:', accountEntityId);

    const token = generateVerificationToken();
    console.log('Generated token:', token);

    const tokenExpiry = Date.now() + (10 * 60 * 1000); // 10 minutes
    console.log('Token expiry:', new Date(tokenExpiry));

    // Store token in cache with expiry (using existing pattern)
    const tokenKey = `verification_token_${email}`;
    console.log('Token key for storage:', tokenKey);

    const tokenData = {
      token,
      email,
      //userEntityId,
      accountEntityId,
      expiry: tokenExpiry,
      createdAt: Date.now()
    };
    console.log('Token data to store:', tokenData);

    await runtime.setCache(tokenKey, tokenData);
    console.log('Token stored in cache successfully');

    // Send verification email using existing infrastructure
    const emailSent = await sendVerificationEmail(email, token);

    if (!emailSent) {
      return { success: false, error: 'Failed to send verification email' };
    }

    return { success: true, token };
  } catch (error) {
    logger.error('Error creating verification token:', error);
    return { success: false, error: 'Failed to create verification token' };
  }
}

export async function verifyEmailToken(
  runtime: IAgentRuntime,
  email: string,
  token: string
): Promise<{ success: boolean; authToken?: string; error?: string }> {
  try {
    console.log('verifyEmailToken called with:');
    console.log('Email:', email);
    console.log('Token:', token);

    const tokenKey = `verification_token_${email}`;
    console.log('Token key:', tokenKey);

    const cachedTokenData = await runtime.getCache(tokenKey);
    console.log('Cached token data:', cachedTokenData);

    if (!cachedTokenData) {
      return { success: false, error: 'No verification token found for this email' };
    }

    const { token: storedToken, expiry, userEntityId } = cachedTokenData as any;

    // Check if token is expired
    if (Date.now() > expiry) {
      await runtime.deleteCache(tokenKey);
      return { success: false, error: 'Verification token has expired' };
    }

    // Check if token matches (using existing findGeneratedCode pattern)
    if (token !== storedToken) {
      return { success: false, error: 'Invalid verification token' };
    }

    // Generate auth token for successful verification
    const authToken = uuidv4();
    const authTokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

    // Store auth token
    const authTokenKey = `auth_token_${email}`;
    await runtime.setCache(authTokenKey, {
      authToken,
      email,
      userEntityId,
      expiry: authTokenExpiry,
      createdAt: Date.now()
    });

    // Clean up verification token
    await runtime.deleteCache(tokenKey);

    return { success: true, authToken };
  } catch (error) {
    logger.error('Error verifying email token:', error);
    return { success: false, error: 'Failed to verify token' };
  }
}

export async function validateAuthToken(
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

    // Check if token is expired
    if (Date.now() > expiry) {
      await runtime.deleteCache(authTokenKey);
      return { valid: false, error: 'Auth token has expired' };
    }

    // Check if token matches
    if (authToken !== storedAuthToken) {
      return { valid: false, error: 'Invalid auth token' };
    }

    return { valid: true, userEntityId };
  } catch (error) {
    logger.error('Error validating auth token:', error);
    return { valid: false, error: 'Failed to validate auth token' };
  }
}

export async function acquireService(
  runtime: IAgentRuntime,
  serviceType,
  asking = '',
  retries = 10
) {
  let service = runtime.getService(serviceType) as any;
  while (!service) {
    console.log(asking, 'waiting for', serviceType, 'service...');
    service = runtime.getService(serviceType) as any;
    if (!service) {
      await new Promise((waitResolve) => setTimeout(waitResolve, 1000));
    } else {
      console.log(asking, 'Acquired', serviceType, 'service...');
    }
  }
  return service;
}

export async function askLlmObject(
  runtime: IAgentRuntime,
  ask: Object,
  requiredFields: string[],
  maxRetries = 3
) {
  let responseContent: any | null = null;
  // Retry if missing required fields
  let retries = 0;

  function checkRequired(resp) {
    if (!resp) return false;
    let hasAll = true;
    for (const f of requiredFields) {
      if (!resp[f]) {
        hasAll = false;
        break;
      }
    }
    return hasAll;
  }

  let good = false;
  while (retries < maxRetries && !good) {
    const response = await runtime.useModel(ModelType.TEXT_LARGE, {
      ...ask, // prompt, system
      temperature: 0.2,
      maxTokens: 4096,
      object: true,
    });

    console.log('trader::utils:askLlmObject - response', response);
    responseContent = parseJSONObjectFromText(response) as any;

    retries++;
    good = checkRequired(responseContent);
    if (!good) {
      logger.warn(
        '*** Missing required fields',
        responseContent,
        'needs',
        requiredFields,
        ', retrying... ***'
      );
    }
  }
  return responseContent;
}

// Spartan DeFi Helper Functions
export async function getWalletBalancesFromServices(runtime: IAgentRuntime, walletAddress: string, includePrices: boolean) {
  try {
    const solanaService = runtime.getService('chain_solana') as any;

    if (!solanaService) {
      throw new Error("Solana service not available");
    }

    const balances = await solanaService.getBalancesByAddrs([walletAddress]);
    const solBalance = balances[walletAddress];
    const tokenAccounts = await solanaService.getTokenAccountsByKeypair(new PublicKey(walletAddress));

    const tokens: any[] = [];
    let totalValueUsd = solBalance / 1e9;

    const cachedTokens = await runtime.getCache('tokens_solana') || [];

    for (const account of tokenAccounts) {
      const accountInfo = account.account.data.parsed.info;
      const tokenMint = accountInfo.mint;

      if (accountInfo.tokenAmount.uiAmount === 0) continue;

      const cachedToken = (cachedTokens as any[]).find((t: any) => t.address === tokenMint);
      const price = includePrices && cachedToken ? cachedToken.price : undefined;
      const valueUsd = price ? accountInfo.tokenAmount.uiAmount * price : undefined;

      if (valueUsd) {
        totalValueUsd += valueUsd;
      }

      // Get token symbol from Solana service
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
        valueUsd,
      });
    }

    return {
      solBalance: solBalance / 1e9,
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

export async function getTokenBalanceFromServices(runtime: IAgentRuntime, walletAddress: string, tokenMint: string) {
  try {
    const solanaService = runtime.getService('chain_solana') as any;

    if (!solanaService) {
      throw new Error("Solana service not available");
    }

    const tokenAccounts = await solanaService.getTokenAccountsByKeypair(new solanaService.connection.PublicKey(walletAddress));

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

    // Get token symbol from Solana service
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

export async function getSwapQuoteFromServices(runtime: IAgentRuntime, params: any) {
  try {
    const jupiterApiUrl = runtime.getSetting("JUPITER_API_URL") || "https://quote-api.jup.ag/v6";

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

export async function getTokenInfo(runtime: IAgentRuntime, tokenMint: string) {
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

export async function chatWithSpartanAI(runtime: IAgentRuntime, message: string, context: any) {
  try {
    // Create or get existing session for the user
    const userId = context.userId || 'default-user';
    const sessionId = await createOrGetSession(runtime, userId);

    // Send message to the session
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

async function createOrGetSession(runtime: IAgentRuntime, userId: string): Promise<string> {
  try {
    // Try to create a new session
    const response = await fetch(`${runtime.getSetting('API_BASE_URL') || 'http://206.81.100.168:3000'}/api/messaging/sessions`, {
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

async function sendSessionMessage(runtime: IAgentRuntime, sessionId: string, message: string, context: any) {
  try {
    // Build context string for the message
    const contextString = buildContextString(context);
    const fullMessage = contextString ? `${contextString}\n\nUser: ${message}` : message;

    const response = await fetch(
      `${runtime.getSetting('API_BASE_URL') || 'http://206.81.100.168:3000'}/api/messaging/sessions/${sessionId}/messages`,
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

export function buildSpartanSystemPrompt(context: any): string {
  let prompt = `You are Spartan, an AI assistant specialized in DeFi and cryptocurrency trading. You help users with:

- Token analysis and market insights
- Portfolio management and balance tracking
- Trading strategies and risk assessment
- DeFi protocol explanations
- Market trends and sentiment analysis

Always provide accurate, helpful information and be transparent about risks.`;

  if (context?.marketData) {
    prompt += `\n\n**Current Market Data:**`;
    prompt += `\n- Total tokens tracked: ${context.marketData.totalTokens}`;
    if (context.marketData.trendingTokens?.length > 0) {
      prompt += `\n- Top trending tokens:`;
      context.marketData.trendingTokens.slice(0, 5).forEach((token: any) => {
        prompt += `\n  • ${token.symbol}: $${token.price?.toFixed(4) || 'N/A'} (${token.change24h?.toFixed(2) || 'N/A'}% 24h)`;
      });
    }
  }

  return prompt;
}

export function generateSuggestionsFromContext(context: any): string[] {
  const suggestions = [
    "Show my wallet balances",
    "Get a swap quote for SOL to USDC",
    "What's the current market sentiment?",
    "Analyze my portfolio performance",
    "Show trending tokens",
  ];

  return suggestions.slice(0, 3);
}

export async function buildChatContextFromServices(runtime: IAgentRuntime) {
  const context: any = {};

  try {
    // Get market data from degenIntel cache
    const cachedTokens = await runtime.getCache('tokens_solana') || [];
    const trendingTokens = (cachedTokens as any[]).slice(0, 10).map((token: any) => ({
      symbol: token.symbol,
      price: token.price,
      change24h: token.priceChange24h,
      volume24h: token.volume24h,
    }));

    // Get portfolio data if available
    const portfolioData = await runtime.getCache('portfolio');
    const transactionHistory = await runtime.getCache('transaction_history') || [];

    // Get sentiment data if available
    const sentimentMemories = await runtime.getMemories({
      tableName: 'messages',
      roomId: createUniqueUuid(runtime, 'sentiment-analysis'),
      end: Date.now(),
      count: 10,
    });

    context.marketData = {
      timestamp: new Date(),
      source: "degenIntel Services",
      trendingTokens,
      totalTokens: (cachedTokens as any[]).length,
    };

    context.portfolio = (portfolioData as any)?.data || null;
    context.recentTransactions = (transactionHistory as any[]).slice(0, 5);
    context.sentiment = sentimentMemories.length > 0 ? sentimentMemories : null;

    // Get service status
    const dataProviderService = runtime.getService('TRADER_DATAPROVIDER') as any;
    const chainService = runtime.getService('TRADER_CHAIN') as any;

    context.services = {
      dataProvider: !!dataProviderService,
      chainService: !!chainService,
      solanaService: !!runtime.getService("chain_solana"),
    };

  } catch (error) {
    logger.warn("Failed to build chat context from services:", error);
  }

  return context;
}
