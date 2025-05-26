import { parseJSONObjectFromText, type IAgentRuntime, logger, ModelType } from '@elizaos/core';
import type { Sentiment } from '../schemas';

const rolePrompt = 'You are a sell signal analyzer.';
const template = `

I want you to give a crypto sell signal based on both the sentiment analysis as well as the wallet token data.
The sentiment score has a range of -100 to 100, with -100 indicating extreme negativity and 100 indicating extreme positiveness.
My current balance is {{solana_balance}} SOL, If I have less than 0.3 SOL, I should up the priority on selling something but we don't need to realize a heavy loss over it.

Sentiment analysis:

{{sentiment}}

Wallet tokens:

{{walletData}}

Additional wallet token data (in JSON format):
{{walletData2}}

Only return the following JSON:

{
  recommended_sell: "the symbol of the token for example DEGENAI",
  recommend_sell_address: "the address of the token to purchase, for example: 2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump",
  reason: "the reason why you think this is a good sell, and why you chose the specific amount",
  sell_amount: "number, for example: 600.54411 (number amount of tokens to sell)"
}`;

interface ISellSignalOutput {
  recommended_sell: string;
  recommend_sell_address: string;
  marketcap?: number;
  reason: string;
  sell_amount: string;
}

export default class SellSignal {
  runtime: IAgentRuntime;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  async generateSignal(): Promise<boolean> {
    try {
      logger.info('sell-signal::generateSignal - Generating sell signal');

      // Get Solana service
      const solanaService = this.runtime.getService('solana') as any;
      if (!solanaService) {
        logger.error('Solana service not found');
        return false;
      }

      // Get wallet data from Solana service
      const walletData = await solanaService.forceUpdate();
      if (!walletData?.items || walletData.items.length === 0) {
        logger.warn('No wallet tokens found');
        return false;
      }

      // Filter out SOL and tokens with very small balances
      const significantTokens = walletData.items.filter((item: any) => {
        const balance = parseFloat(item.uiAmount || '0');
        const valueUsd = parseFloat(item.valueUsd || '0');
        // Skip SOL and tokens worth less than $1
        return item.symbol !== 'SOL' && valueUsd > 1;
      });

      if (significantTokens.length === 0) {
        logger.warn('No significant tokens to sell');
        return false;
      }

      // Format wallet data for prompt
      let walletProviderStr = 'Your wallet contents:\n';
      const tokensHeld = [];
      for (const token of significantTokens) {
        walletProviderStr +=
          `You hold ${token.uiAmount} ${token.symbol} (${token.name}) ` +
          `at address ${token.address} worth $${token.valueUsd} USD\n`;
        tokensHeld.push(token.address);
      }

      let prompt = template.replace('{{walletData}}', walletProviderStr);

      // Get additional token data from Birdeye
      const tokenMarketData = await this.getTokensMarketData(tokensHeld);
      prompt = prompt.replace('{{walletData2}}', JSON.stringify(tokenMarketData));

      // Get all sentiments
      const sentimentData = (await this.runtime.getCache<Sentiment[]>('sentiments')) || [];
      if (!sentimentData.length) {
        logger.warn('No sentiment data found');
        return false;
      }

      let sentiments = '';
      let idx = 1;
      for (const sentiment of sentimentData) {
        if (!sentiment?.occuringTokens?.length) continue;
        sentiments += `ENTRY ${idx}\nTIME: ${sentiment.timeslot}\nTOKEN ANALYSIS:\n`;
        for (const token of sentiment.occuringTokens) {
          sentiments += `${token.token} - Sentiment: ${token.sentiment}\n${token.reason}\n`;
        }
        sentiments += '\n-------------------\n';
        idx++;
      }
      prompt = prompt.replace('{{sentiment}}', sentiments);

      const solanaBalance = await this.getBalance(solanaService);
      const finalPrompt = prompt.replace('{{solana_balance}}', String(solanaBalance));

      // Get sell recommendation from model
      let responseContent: ISellSignalOutput | null = null;
      let retries = 0;
      const maxRetries = 3;

      while (
        retries < maxRetries &&
        (!responseContent?.recommended_sell ||
          !responseContent?.reason ||
          !responseContent?.recommend_sell_address)
      ) {
        const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
          prompt: finalPrompt,
          system: rolePrompt,
          temperature: 0.2,
          maxTokens: 4096,
          object: true,
        });

        responseContent = parseJSONObjectFromText(response) as ISellSignalOutput;
        retries++;

        if (
          !responseContent?.recommended_sell ||
          !responseContent?.reason ||
          !responseContent?.recommend_sell_address
        ) {
          logger.warn('*** Missing required fields, retrying... generateSignal ***');
        }
      }

      if (!responseContent?.recommend_sell_address) {
        logger.warn('sell-signal::generateSignal - no sell recommendation');
        return false;
      }

      // Validate token address format
      if (!this.validateSolanaAddress(responseContent.recommend_sell_address)) {
        logger.error('Invalid Solana token address', {
          address: responseContent.recommend_sell_address,
        });
        return false;
      }

      // Fetch marketcap data
      responseContent.marketcap = await this.fetchMarketcap(responseContent.recommend_sell_address);

      // Add logging before emitting
      logger.info('Emitting sell signal', {
        token: responseContent.recommended_sell,
        address: responseContent.recommend_sell_address,
        amount: responseContent.sell_amount,
      });

      // Emit sell signal event
      await this.runtime.emitEvent('DEGEN_INTEL_SELL_SIGNAL', responseContent);

      logger.info('Sell signal emitted successfully');

      // Cache the signal
      await this.runtime.setCache<any>('sell_signals', {
        key: 'SELL_SIGNAL',
        data: responseContent,
      });

      return true;
    } catch (error) {
      logger.error('Error generating sell signal:', error);
      return false;
    }
  }

  private async getBalance(solanaService: any): Promise<number | null> {
    try {
      const connection = solanaService.getConnection();
      const publicKey = solanaService.getPublicKey();

      if (!publicKey) {
        logger.warn('No public key available for balance check');
        return null;
      }

      const balance = await connection.getBalance(publicKey);
      return balance / 1_000_000_000; // Convert lamports to SOL
    } catch (error) {
      logger.error('Error getting balance:', error);
      return null;
    }
  }

  private validateSolanaAddress(address: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }

  private async getTokensMarketData(tokenAddresses: string[]): Promise<any[]> {
    const apiKey = this.runtime.getSetting('BIRDEYE_API_KEY');
    if (!apiKey) {
      logger.error('BIRDEYE_API_KEY not found');
      return [];
    }

    const marketData = [];
    for (const address of tokenAddresses) {
      try {
        const data = await this.fetchTokenData(address, apiKey);
        if (data) {
          marketData.push(data);
        }
      } catch (error) {
        logger.error(`Error fetching data for ${address}:`, error);
      }
    }
    return marketData;
  }

  private async fetchTokenData(tokenAddress: string, apiKey: string): Promise<any> {
    const BIRDEYE_API = 'https://public-api.birdeye.so';
    const endpoint = `${BIRDEYE_API}/defi/token_overview`;
    const url = `${endpoint}?address=${tokenAddress}`;

    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-chain': 'solana',
        'X-API-KEY': apiKey,
      },
    };

    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        throw new Error(`Birdeye request failed: ${res.status}`);
      }

      const resJson = await res.json();
      return resJson?.data || null;
    } catch (error) {
      logger.error('Error fetching token data:', error);
      return null;
    }
  }

  private async fetchMarketcap(tokenAddress: string): Promise<number> {
    const apiKey = this.runtime.getSetting('BIRDEYE_API_KEY');
    if (!apiKey) {
      logger.error('BIRDEYE_API_KEY not found in runtime settings');
      return 0;
    }

    const data = await this.fetchTokenData(tokenAddress, apiKey);
    const marketcap = data?.marketCap;

    if (!marketcap) {
      logger.warn('sell: No marketcap data returned from Birdeye', {
        address: tokenAddress,
      });
    }

    return Number(marketcap || 0);
  }
}
