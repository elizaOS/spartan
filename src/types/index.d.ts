declare module '@elizaos/core';
declare module '@elizaos/plugin-rss';
declare module '@elizaos/plugin-visualizer';
declare module '@elizaos/plugin-translate' {
  import type { Plugin } from '@elizaos/core';
  export const translatePlugin: Plugin;
  const defaultExport: Plugin;
  export default defaultExport;
}

declare module '@elizaos/plugin-birdeye' {
  import type { Plugin } from '@elizaos/core';
  export const birdeyePlugin: Plugin;
  export type BirdeyeMarketData = {
    price: number;
    marketCap: number;
    liquidity: number;
    volume24h: number;
    priceHistory?: number[];
  };
  export type BirdeyeService = {
    getTokenMarketData(tokenAddress: string): Promise<BirdeyeMarketData | false>;
  };
  const defaultExport: Plugin;
  export default defaultExport;
}

declare module '@elizaos/plugin-discord' {
  import type { Plugin } from '@elizaos/core';
  export const discordPlugin: Plugin;
  export const DISCORD_SERVICE_NAME: string;
  export interface IDiscordService {
    sendMessage(channelId: string, content: unknown): Promise<void>;
  }
  export class DiscordService {
    static serviceType: string;
  }
  const defaultExport: Plugin;
  export default defaultExport;
}
