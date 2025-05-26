import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { IAgentRuntime } from '@elizaos/core';
import { BirdeyeService } from '../src/service';
import { elizaLogger as logger } from '@elizaos/core';

describe('BirdeyeService Tests', () => {
    let mockRuntime: IAgentRuntime;
    let birdeyeService: BirdeyeService;
    let originalFetch: typeof global.fetch;

    const PROVIDER_CONFIG = {
        BIRDEYE_API_KEY: process.env.BIRDEYE_API_KEY,
        BIRDEYE_API: 'https://public-api.birdeye.so',
        TOKEN_ADDRESSES: {
          SOL: 'So11111111111111111111111111111111111111112',
          BTC: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
          ETH: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
        },
      };

    beforeEach(async () => {
        originalFetch = global.fetch;
        global.fetch = vi.fn();

        mockRuntime = {
            getSetting: vi.fn((key: string) => {
                if (key === 'BIRDEYE_API_KEY') {
                    return process.env.BIRDEYE_API_KEY;
                }
                return undefined;
            }),
            getCache: vi.fn().mockResolvedValue(null),
            setCache: vi.fn().mockResolvedValue(undefined),
            getService: vi.fn(),
        } as unknown as IAgentRuntime;

        birdeyeService = await BirdeyeService.start(mockRuntime);
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    const mockSuccessfulResponse = (data: any) => {
        (fetch as vi.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(data),
        });
    };

    const mockFailedResponse = (status: number) => {
        (fetch as vi.Mock).mockRejectedValueOnce(new Error(`HTTP error! status: ${status}`));
    };

    const getEmptyMarketData = () => ({
        price: 0,
        marketCap: 0,
        liquidity: 0,
        volume24h: 0,
        priceHistory: [],
    });

    describe('Service Initialization', () => {
        it('should initialize with API key from .env', async () => {
                expect(birdeyeService.apiKey).toBe(process.env.BIRDEYE_API_KEY);
        });

        it('should warn when no API key is provided', async () => {
            const loggerSpy = vi.spyOn(logger, 'warn');
            const runtimeWithoutKey = {
                ...mockRuntime,
                getSetting: vi.fn().mockReturnValue(undefined),
            } as unknown as IAgentRuntime;
            
            await BirdeyeService.start(runtimeWithoutKey);
            
            expect(loggerSpy).toHaveBeenCalledWith('no BIRDEYE_API_KEY set');
            loggerSpy.mockRestore();
        });
    });

    describe('Token Market Data', () => {
        it('should fetch token market data successfully', async () => {
            const mockData = {
                data: {
                    price: 1.23,
                    market_cap: 1000000,
                    liquidity: 500000,
                }
            };
            mockSuccessfulResponse(mockData);
            mockSuccessfulResponse({ data: { volumeUSD: 100000 } });
            mockSuccessfulResponse({ data: { items: [{ value: 1.2 }, { value: 1.3 }] } });

            const result = await birdeyeService.getTokenMarketData(PROVIDER_CONFIG.TOKEN_ADDRESSES.SOL);

            expect(result).toEqual({
                price: 1.23,
                marketCap: 1000000,
                liquidity: 500000,
                volume24h: 100000,
                priceHistory: [1.2, 1.3],
            });

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining(`${PROVIDER_CONFIG.BIRDEYE_API}/defi/v3/token/market-data`),
                expect.any(Object)
            );
        });

        it('should handle failed token market data request', async () => {
            // Mock all three fetch calls to fail since the service makes parallel requests
            mockFailedResponse(500);
            mockFailedResponse(500);
            mockFailedResponse(500);

            const result = await birdeyeService.getTokenMarketData(PROVIDER_CONFIG.TOKEN_ADDRESSES.SOL);

            expect(result).toEqual(getEmptyMarketData());
        });
    });

    describe('Multiple Tokens Market Data', () => {
        it('should fetch multiple tokens market data', async () => {
            const mockData = {
                data: {
                    [PROVIDER_CONFIG.TOKEN_ADDRESSES.SOL]: {
                        value: 1.23,
                        priceInNative: 1,
                        liquidity: 1000000,
                        priceChange24h: 5,
                    }
                }
            };
            mockSuccessfulResponse(mockData);

            const result = await birdeyeService.getTokensMarketData([PROVIDER_CONFIG.TOKEN_ADDRESSES.SOL]);

            expect(result).toHaveProperty(PROVIDER_CONFIG.TOKEN_ADDRESSES.SOL);
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining(`${PROVIDER_CONFIG.BIRDEYE_API}/defi/multi_price`),
                expect.any(Object)
            );
        });
    });

    describe('Token Lookup', () => {
        it('should lookup token from cache', async () => {
            const mockCachedToken = {
                priceUsd: 1.23,
                priceSol: 1,
                liquidity: 1000000,
                priceChange24h: 5,
            };
            mockRuntime.getCache = vi.fn().mockResolvedValue(mockCachedToken);

            const result = await birdeyeService.lookupToken('solana', PROVIDER_CONFIG.TOKEN_ADDRESSES.SOL);

            expect(result).toEqual(mockCachedToken);
            expect(fetch).not.toHaveBeenCalled();
        });

        it('should lookup token from API when not in cache', async () => {
            mockRuntime.getCache = vi.fn().mockResolvedValue(null);
            const mockData = {
                data: {
                    [PROVIDER_CONFIG.TOKEN_ADDRESSES.SOL]: {
                        value: 1.23,
                        priceInNative: 1,
                        liquidity: 1000000,
                        priceChange24h: 5,
                    }
                }
            };
            mockSuccessfulResponse(mockData);

            const result = await birdeyeService.lookupToken('solana', PROVIDER_CONFIG.TOKEN_ADDRESSES.SOL);

            expect(result).toBeDefined();
            expect(fetch).toHaveBeenCalled();
        });
    });

    describe('Service Lifecycle', () => {
        it('should stop service and clear interval', async () => {
            const service = await BirdeyeService.start(mockRuntime);
            // Add refreshInterval property to the service
            service.refreshInterval = setInterval(() => {}, 1000);
            
            await service.stop();
            expect(service.refreshInterval).toBeNull();
        });

        it('should handle stop when service not found', async () => {
            mockRuntime.getService = vi.fn().mockReturnValue(null);
            const loggerSpy = vi.spyOn(logger, 'error');
            
            await BirdeyeService.stop(mockRuntime);
            
            expect(loggerSpy).toHaveBeenCalledWith('Birdeye not found');
            loggerSpy.mockRestore();
        });
    });
});
