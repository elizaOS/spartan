import { type IAgentRuntime, Service, logger } from '@elizaos/core';

const PROVIDER_CONFIG = {
  BIRDEYE_API: 'https://public-api.birdeye.so',
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  DEFAULT_RPC: 'https://api.mainnet-beta.solana.com',
  TOKEN_ADDRESSES: {
    SOL: 'So11111111111111111111111111111111111111112',
    BTC: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
    ETH: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
  },
};

export class CoinmarketcapService extends Service {
  static serviceType: string = "coinmarketcap";
  capabilityDescription = 'Coinmarketcap data access';

  constructor(protected runtime: IAgentRuntime) {
    super();
    this.runtime = runtime
  }

  private getBirdeyeFetchOptions() {
    console.log('')
    return {
      headers: {
        accept: 'application/json',
        'x-CHAIN': 'solana',
        'X-API-KEY': this.apiKey,
      },
    };
  }

  static async start(runtime: IAgentRuntime): Promise<BirdeyeService> {
    logger.log('Initializing Birdeye Service');

    const birdEyeService = new BirdeyeService(runtime);

    birdEyeService.apiKey = runtime.getSetting('BIRDEYE_API_KEY');
    if (!birdEyeService.apiKey) {
      logger.warn('no BIRDEYE_API_KEY set')
    }

    logger.log('Birdeye service initialized');
    return birdEyeService;
  }

  static async stop(runtime: IAgentRuntime) {
    const service = runtime.getService(BIRDEYE_SERVICE_NAME);
    if (!service) {
      logger.error('Birdeye not found');
      return;
    }
    await service.stop();
  }

  async getTokenMarketData(tokenAddress: string): Promise<{
    price: number;
    marketCap: number;
    liquidity: number;
    volume24h: number;
    priceHistory: number[];
  }> {
    try {
      if (tokenAddress === 'So11111111111111111111111111111111111111111') {
        tokenAddress = 'So11111111111111111111111111111111111111112'; // WSOL
      }

      const [response, volResponse, priceHistoryResponse] = await Promise.all([
        fetch(
          `${PROVIDER_CONFIG.BIRDEYE_API}/defi/v3/token/market-data?address=${tokenAddress}`,
          this.getBirdeyeFetchOptions()
        ),
        fetch(
          `${PROVIDER_CONFIG.BIRDEYE_API}/defi/price_volume/single?address=${tokenAddress}&type=24h`,
          this.getBirdeyeFetchOptions()
        ),
        fetch(
          `${PROVIDER_CONFIG.BIRDEYE_API}/defi/history_price?address=${tokenAddress}&address_type=token&type=15m`,
          this.getBirdeyeFetchOptions()
        ),
      ]);

      if (!response.ok || !volResponse.ok || !priceHistoryResponse.ok) {
        throw new Error(`Birdeye API error for token ${tokenAddress}`);
      }

      const [data, volData, priceHistoryData] = await Promise.all([
        response.json(),
        volResponse.json(),
        priceHistoryResponse.json(),
      ]);

      if (!data.data) {
        logger.warn('getTokenMarketData - cant save result', data, 'for', tokenAddress);
        return this.getEmptyMarketData();
      }

      return {
        price: data.data.price,
        marketCap: data.data.market_cap || 0,
        liquidity: data.data.liquidity || 0,
        volume24h: volData.data.volumeUSD || 0,
        priceHistory: priceHistoryData.data.items.map((item: any) => item.value),
      };
    } catch (error) {
      logger.error('Error fetching token market data:', error);
      return this.getEmptyMarketData();
    }
  }

  async getTokensMarketData(tokenAddresses: string[]): Promise<any> {
    const tokenDb: Record<string, any> = {};

    try {
      const chunkArray = (arr: string[], size: number) =>
        arr.map((_, i) => (i % size === 0 ? arr.slice(i, i + size) : null)).filter(Boolean);

      const hundos = chunkArray(tokenAddresses, 100);
      console.log('getTokensMarketData hundos', hundos)
      const multipricePs = hundos.map((addresses) => {
        const listStr = addresses.join(',');
        return fetch(
          `${PROVIDER_CONFIG.BIRDEYE_API}/defi/multi_price?list_address=${listStr}&include_liquidity=true`,
          this.getBirdeyeFetchOptions()
        );
      });

      const multipriceResps = await Promise.all(multipricePs);
      const multipriceData = await Promise.all(multipriceResps.map((resp) => resp.json()));

      for (const mpd of multipriceData) {
        //console.log('mpd', mpd)
        for (const ca in mpd.data) {
          const t = mpd.data[ca];
          if (t) {
            tokenDb[ca] = {
              priceUsd: t.value,
              priceSol: t.priceInNative,
              liquidity: t.liquidity,
              priceChange24h: t.priceChange24h,
            };
            const test: IToken = tokenDb[ca]
            //console.log('saving', ca, test)
            await this.runtime.setCache<IToken>(`birdeye_tokens_solana_${ca}`, test);
          } else {
            logger.warn(ca, 'mpd error', t);
          }
        }
      }

      return tokenDb;
    } catch (error) {
      logger.error('Error fetching multiple tokens market data:', error);
      return tokenDb;
    }
  }

  // lookup token
  async lookupToken(chain, ca) {
    const cachedToken = await this.runtime.getCache<IToken>(`birdeye_tokens_${chain}_${ca}`);
    if (cachedToken) {
      return cachedToken
    }
    // check cache
    // but if not in cache get it
    const res = await this.getTokensMarketData([ca])
    return res
  }

  async stop(): Promise<void> {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    logger.log('BirdEye service shutdown');
  }

}
