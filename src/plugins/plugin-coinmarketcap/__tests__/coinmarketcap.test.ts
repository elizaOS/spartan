import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { IAgentRuntime, Memory, State, Action, Provider, TaskWorker } from '@elizaos/core';
import axios from 'axios';
import { coinmarketcapPlugin } from '../src/index';
import type { GetPriceContent, PriceData, ApiResponse } from '../src/actions/getPrice/types';
import CoinmarketcapTask from '../src/tasks/coinmarketcap';
import { trendingProvider } from '../src/providers/trending';
import type { IToken } from '../src/types';

vi.mock('axios');
const mockedAxios = axios as vi.Mocked<typeof axios>;

// Mock settings
const MOCK_API_KEY = 'test-cmc-api-key';

describe('CoinMarketCap Plugin Tests', () => {
    let mockRuntime: IAgentRuntime;
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        global.fetch = vi.fn();

        mockRuntime = {
            agentId: 'test-agent',
            getSetting: vi.fn((key: string) => {
                if (key === 'COINMARKETCAP_API_KEY') return process.env.COINMARKETCAP_API_KEY;
                return undefined;
            }),
            getCache: vi.fn().mockResolvedValue(null),
            setCache: vi.fn().mockResolvedValue(undefined),
            useModel: vi.fn(),
            // Mock other IAgentRuntime methods as needed by the plugin
            composeState: vi.fn().mockResolvedValue({} as State),
            getTasks: vi.fn().mockResolvedValue([]),
            deleteTask: vi.fn().mockResolvedValue(true),
            registerTaskWorker: vi.fn(),
            createTask: vi.fn().mockResolvedValue({ id: 'task-123' }),
        } as unknown as IAgentRuntime;

        mockedAxios.create.mockReturnValue(mockedAxios); // Ensure axios.create returns the mocked instance
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
        mockedAxios.get.mockReset();
    });

    describe('GET_PRICE Action', () => {
        const getPriceAction = coinmarketcapPlugin.actions.find(a => a.name === 'GET_PRICE') as Action;

        it('should fetch price successfully', async () => {
            const mockPriceData: PriceData = { price: 50000, marketCap: 1e12, volume24h: 5e10, percentChange24h: 2.5 };
            const apiResponse: ApiResponse = {
                data: {
                    BTC: {
                        quote: {
                            USD: {
                                price: mockPriceData.price,
                                market_cap: mockPriceData.marketCap,
                                volume_24h: mockPriceData.volume24h,
                                percent_change_24h: mockPriceData.percentChange24h,
                            },
                        },
                    },
                },
            };
            mockedAxios.get.mockResolvedValueOnce({ data: apiResponse, status: 200, statusText: 'OK', headers: {}, config: {} });

            const mockContent: GetPriceContent = { symbol: 'BTC', currency: 'USD' };
            mockRuntime.useModel = vi.fn().mockResolvedValue(mockContent); // Mock content extraction

            const callback = vi.fn();
            await getPriceAction.handler(mockRuntime, {} as Memory, {} as State, {}, callback);

            expect(mockedAxios.get).toHaveBeenCalledWith(
                expect.stringContaining("/cryptocurrency/quotes/latest"),
                expect.objectContaining({
                    params: { symbol: 'BTC', convert: 'USD' },
                })
            );
            expect(callback).toHaveBeenCalledWith(expect.objectContaining({
                text: `The current price of BTC is ${mockPriceData.price} USD`,
                content: expect.objectContaining(mockPriceData),
            }));
        });

        it('should handle API error when fetching price', async () => {
            mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));
            const mockContent: GetPriceContent = { symbol: 'ETH', currency: 'EUR' };
            mockRuntime.useModel = vi.fn().mockResolvedValue(mockContent);

            const callback = vi.fn();
            await getPriceAction.handler(mockRuntime, {} as Memory, {} as State, {}, callback);

            expect(callback).toHaveBeenCalledWith(expect.objectContaining({
                text: expect.stringContaining("Error fetching price: API Error: Network Error"),
            }));
        });

         it('should default to USD if currency is not specified by model', async () => {
            const mockPriceData: PriceData = { price: 2000, marketCap: 1e11, volume24h: 1e10, percentChange24h: 1.5 };
            const apiResponse: ApiResponse = {
                data: { ETH: { quote: { USD: { price: mockPriceData.price, market_cap: mockPriceData.marketCap, volume_24h: mockPriceData.volume24h, percent_change_24h: mockPriceData.percentChange24h } } } }
            };
            mockedAxios.get.mockResolvedValueOnce({ data: apiResponse, status: 200, statusText: 'OK', headers: {}, config: {} });

            const mockContentFromModel = { symbol: 'ETH' };
            mockRuntime.useModel = vi.fn().mockResolvedValue(mockContentFromModel);
            
            const callback = vi.fn();
            await getPriceAction.handler(mockRuntime, {} as Memory, {} as State, {}, callback);
            
            expect(mockedAxios.get).toHaveBeenCalledWith(
                expect.stringContaining("/cryptocurrency/quotes/latest"),
                expect.objectContaining({
                    params: { symbol: 'ETH', convert: 'USD' }, 
                })
            );
            expect(callback).toHaveBeenCalledWith(expect.objectContaining({
                text: `The current price of ETH is ${mockPriceData.price} USD`,
            }));
        });
    });

    describe('Coinmarketcap Task (syncTokens)', () => {
        it('should sync tokens successfully', async () => {
            const mockListingData = {
                data: [
                    { id: 1, name: 'Bitcoin', symbol: 'BTC', slug: 'bitcoin', cmc_rank: 1, platform: null, quote: { USD: { price: 50000, volume_24h: 1e10, percent_change_24h: 1.0 } }, last_updated: new Date().toISOString() },
                    { id: 1027, name: 'Ethereum', symbol: 'ETH', slug: 'ethereum', cmc_rank: 2, platform: null, quote: { USD: { price: 4000, volume_24h: 5e9, percent_change_24h: 0.5 } }, last_updated: new Date().toISOString() },
                    { id: 825, name: 'Tether', symbol: 'USDT', slug: 'tether', cmc_rank: 3, platform: { slug: 'ethereum', token_address: '0xdac17f958d2ee523a2206206994597c13d831ec7'}, quote: { USD: { price: 1.00, volume_24h: 6e10, percent_change_24h: 0.01 } }, last_updated: new Date().toISOString() },
                ],
            };
            (fetch as vi.Mock).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockListingData),
            });

            const cmcTask = new CoinmarketcapTask(mockRuntime);
            await cmcTask.syncTokens();

            expect(fetch).toHaveBeenCalledWith(
                'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest',
                expect.objectContaining({
                    headers: { 'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY },
                })
            );
            expect(mockRuntime.setCache).toHaveBeenCalledWith(
                'coinmarketcap_sync',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Bitcoin', symbol: 'BTC' }),
                    expect.objectContaining({ name: 'Ethereum', symbol: 'ETH' }),
                    expect.objectContaining({ name: 'Tether', symbol: 'USDT', chain: 'ethereum' }),
                ])
            );
        });

        it('should handle API error during token sync', async () => {
            (fetch as vi.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ error: 'Server Error' }),
            });
            const cmcTask = new CoinmarketcapTask(mockRuntime);

            await cmcTask.syncTokens(); 
            expect(mockRuntime.setCache).not.toHaveBeenCalledWith(
                'coinmarketcap_sync',
                expect.anything() 
            );
        });
    });

    describe('Trending Provider', () => {
        const cmcTrendingProvider = coinmarketcapPlugin.providers?.find(p => p.name === 'COINMARKETCAP_CURRENCY_LATEST') as Provider;

        it('should return trending data from cache', async () => {
            const mockCachedTokens: IToken[] = [
                { provider: 'coinmarketcap', chain: 'L1', address: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', rank: 1, price: 50000, volume24hUSD: 1e10, price24hChangePercent: 1, logoURI: '', decimals: null, liquidity: null, marketcap: 0, last_updated: new Date() },
            ];
            mockRuntime.getCache = vi.fn().mockResolvedValue(mockCachedTokens);

            const result = await cmcTrendingProvider.get(mockRuntime, {} as Memory, {} as State);

            expect(result).toBeTruthy();
            if (result) {
                expect(result.data?.tokens).toEqual(mockCachedTokens);
                expect(result.text).toContain('Bitcoin');
            }
        });

        it('should return false if no data in cache', async () => {
            mockRuntime.getCache = vi.fn().mockResolvedValue([]); // Empty cache
            const result = await cmcTrendingProvider.get(mockRuntime, {} as Memory, {} as State);
            expect(result).toBe(false);
        });
    });

    describe('Plugin Initialization (init)', () => {
        it('should attempt to clear old tasks and register new ones', async () => {
            const oldTask = { id: 'old-task-id', name: 'COINMARKETCAP_SYNC_TRENDING', tags: ['queue', 'repeat', 'plugin_coinmarketcap'] };
            mockRuntime.getTasks = vi.fn().mockResolvedValue([oldTask]);

            await coinmarketcapPlugin.init?.({} as any, mockRuntime);

            expect(mockRuntime.getTasks).toHaveBeenCalledWith({ tags: ['queue', 'repeat', 'plugin_coinmarketcap'] });
            expect(mockRuntime.deleteTask).toHaveBeenCalledWith(oldTask.id);
            expect(mockRuntime.registerTaskWorker).toHaveBeenCalledWith(expect.objectContaining({ name: 'COINMARKETCAP_SYNC_TRENDING' }));
            expect(mockRuntime.createTask).toHaveBeenCalledWith(expect.objectContaining({ name: 'COINMARKETCAP_SYNC_TRENDING' }));
        });

        it('task worker execute should call syncTokens and handle errors', async () => {
            let taskWorker: TaskWorker | undefined;
            mockRuntime.registerTaskWorker = vi.fn((worker) => {
                taskWorker = worker;
            });
            
            await coinmarketcapPlugin.init?.({} as any, mockRuntime);
            expect(taskWorker).toBeDefined();

            if (taskWorker) {
                const cmcTaskInstance = new CoinmarketcapTask(mockRuntime);
                const syncTokensSpy = vi.spyOn(CoinmarketcapTask.prototype, 'syncTokens').mockResolvedValue(true);
                
                await taskWorker.execute(mockRuntime, {}, { id: 'test-task', name: 'COINMARKETCAP_SYNC_TRENDING' } as any);
                expect(syncTokensSpy).toHaveBeenCalled();
                syncTokensSpy.mockRestore();

                // Test error handling
                const errorSyncSpy = vi.spyOn(CoinmarketcapTask.prototype, 'syncTokens').mockRejectedValue(new Error("Sync failed"));
                mockRuntime.deleteTask = vi.fn(); // Reset mock for this specific check

                await taskWorker.execute(mockRuntime, {}, { id: 'test-task-fail', name: 'COINMARKETCAP_SYNC_TRENDING' } as any);
                expect(errorSyncSpy).toHaveBeenCalled();
                expect(mockRuntime.deleteTask).toHaveBeenCalledWith('test-task-fail');
                errorSyncSpy.mockRestore();
            }
        });
    });
});
