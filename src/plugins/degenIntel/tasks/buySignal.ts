import { type IAgentRuntime, ModelType, logger, parseJSONObjectFromText } from '@elizaos/core';
import type { Sentiment } from '../schemas';
import type { IToken } from '../types';

const _rolePrompt = 'You are a buy signal analyzer.';
/**
 * Template for generating a crypto buy signal based on sentiment analysis and trending tokens.
 *
 * Sentiment analysis:
 * {{sentiment}}
 *
 * Trending tokens:
 * {{trending_tokens}}
 *
 * Only return the following JSON:
 * {
 *     recommended_buy: "the symbol of the token for example DEGENAI",
 *     recommend_buy_address: "the address of the token to purchase, for example: 2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump",
 *     reason: "the reason why you think this is a good buy, and why you chose the specific amount",
 *     buy_amount: "number, for example: 0.1"
 * }
 */
const _template = `
I want you to give a crypto buy signal based on both the sentiment analysis as well as the trending tokens.
Only choose a token that occurs in both the Trending Tokens list as well as the Sentiment analysis. This ensures we have the proper token address.
The sentiment score has a range of -100 to 100, with -100 indicating extreme negativity and 100 indicating extreme positiveness.
My current balance is {{solana_balance}} SOL, If I have less than 0.3 SOL then I should not buy unless it's really good opportunity.
Also let me know what a good amount would be to buy. Buy amount should at least be 0.05 SOL and maximum 0.25 SOL.

Sentiment analysis:

{{sentiment}}

Trending tokens:

{{trending_tokens}}

Only return the following JSON:

{
recommended_buy: "the symbol of the token for example DEGENAI",
recommend_buy_address: "the address of the token to purchase, for example: 2sCUCJdVkmyXp4dT8sFaA9LKgSMK4yDPi9zLHiwXpump",
reason: "the reason why you think this is a good buy, and why you chose the specific amount",
buy_amount: "number, for example: 0.1"
}`;

/**
 * Interface representing the output of a buy signal.
 * @typedef {object} IBuySignalOutput
 * @property {string} recommended_buy - The recommended buy action.
 * @property {string} recommend_buy_address - The recommended buy address.
 * @property {number} marketcap - The marketcap value.
 * @property {string} reason - The reason for the buy recommendation.
 * @property {string} buy_amount - The amount to buy.
 */
interface IBuySignalOutput {
  recommended_buy: string;
  recommend_buy_address: string;
  marketcap: number;
  reason: string;
  buy_amount: string;
}

export default class BuySignal {
  runtime: IAgentRuntime;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  async generateSignal(): Promise<boolean> {
    logger.info('buy-signal::generateSignal - Updating latest buy signal');

    // Get Solana service
    const solanaService = this.runtime.getService('solana') as any;
    if (!solanaService) {
      logger.error('Solana service not found');
      return false;
    }

    // Get all sentiments
    const sentimentsData = (await this.runtime.getCache<Sentiment[]>('sentiments')) || [];
    let sentiments = '';

    let idx = 1;
    for (const sentiment of sentimentsData) {
      if (!sentiment?.occuringTokens?.length) continue;
      sentiments += `ENTRY ${idx}\nTIME: ${sentiment.timeslot}\nTOKEN ANALYSIS:\n`;
      for (const token of sentiment.occuringTokens) {
        sentiments += `${token.token} - Sentiment: ${token.sentiment}\n${token.reason}\n`;
      }
      sentiments += '\n-------------------\n';
      idx++;
    }
    const prompt = _template.replace('{{sentiment}}', sentiments);

    // Get all trending tokens
    let tokens = '';
    const trendingData = (await this.runtime.getCache<IToken[]>('tokens_solana')) || [];
    if (!trendingData.length) {
      logger.warn('No trending tokens found in cache');
    } else {
      let index = 1;
      for (const token of trendingData) {
        tokens += `ENTRY ${index}\n\nTOKEN SYMBOL: ${token.name}\nTOKEN ADDRESS: ${token.address}\nPRICE: ${token.price}\n24H CHANGE: ${token.price24hChangePercent}\nLIQUIDITY: ${token.liquidity}`;
        tokens += '\n-------------------\n';
        index++;
      }
    }

    // Get balance using Solana service
    const solanaBalance = await this.getBalance(solanaService);
    if (solanaBalance === null) {
      logger.error('Failed to get Solana balance');
      return false;
    }

    const finalPrompt = prompt
      .replace('{{trending_tokens}}', tokens)
      .replace('{{solana_balance}}', String(solanaBalance));

    let responseContent: IBuySignalOutput | null = null;
    let retries = 0;
    const maxRetries = 3;

    while (
      retries < maxRetries &&
      (!responseContent?.recommended_buy ||
        !responseContent?.reason ||
        !responseContent?.recommend_buy_address)
    ) {
      const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
        prompt: finalPrompt,
        system: _rolePrompt,
        temperature: 0.2,
        maxTokens: 4096,
        object: true,
      });

      logger.debug('intel:buy-signal - response', response);
      responseContent = parseJSONObjectFromText(response) as IBuySignalOutput;

      retries++;
      if (
        !responseContent?.recommended_buy ||
        !responseContent?.reason ||
        !responseContent?.recommend_buy_address
      ) {
        logger.warn('*** Missing required fields, retrying... generateSignal ***');
      }
    }

    if (!responseContent?.recommend_buy_address) {
      logger.warn('buy-signal::generateSignal - no buy recommendation');
      return false;
    }

    // Validate Solana address
    if (!this.validateSolanaAddress(responseContent.recommend_buy_address)) {
      logger.error('Invalid Solana token address', {
        address: responseContent.recommend_buy_address,
      });
      return false;
    }

    // Fetch marketcap from Birdeye
    responseContent.marketcap = await this.fetchMarketcap(responseContent.recommend_buy_address);

    // Emit event for other plugins to consume
    await this.runtime.emitEvent('DEGEN_INTEL_BUY_SIGNAL', responseContent);

    // Cache the signal
    await this.runtime.setCache<any>('buy_signals', {
      key: 'BUY_SIGNAL',
      data: responseContent,
    });

    return true;
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

  private async fetchMarketcap(tokenAddress: string): Promise<number> {
    const apiKey = this.runtime.getSetting('BIRDEYE_API_KEY');
    if (!apiKey) {
      logger.error('BIRDEYE_API_KEY not found in runtime settings');
      return 0;
    }

    const BIRDEYE_API = 'https://public-api.birdeye.so';
    const endpoint = `${BIRDEYE_API}/defi/token_overview`;
    const url = `${endpoint}?address=${tokenAddress}`;

    logger.debug('Making Birdeye API request', {
      url,
      address: tokenAddress,
    });

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
        const errorText = await res.text();
        logger.error('Birdeye API request failed', {
          status: res.status,
          statusText: res.statusText,
          error: errorText,
          address: tokenAddress,
        });
        throw new Error(`Birdeye marketcap request failed: ${res.status} ${res.statusText}`);
      }

      const resJson = await res.json();
      const marketcap = resJson?.data?.marketCap;

      if (!marketcap) {
        logger.warn('buy-signal: No marketcap data returned from Birdeye', {
          response: resJson,
          address: tokenAddress,
        });
      }

      return Number(marketcap || 0);
    } catch (error) {
      logger.error('Error fetching marketcap data:', error);
      return 0;
    }
  }
}
