import { describe, expect, it, beforeEach, vi } from 'bun:test';
import { MeteoraService } from '../services/meteoraService';

// Mock fetch globally
global.fetch = vi.fn();

// Mock require to handle missing Meteora SDK
vi.mock('@meteora-ag/dlmm', () => {
    return {
        default: null,
        DLMM: null,
        PositionInfo: null
    };
});

// Mock runtime for testing
const mockRuntime = {
    getSetting: (key: string) => {
        const settings: Record<string, string> = {
            'SOLANA_RPC_ENDPOINT': 'https://api.mainnet-beta.solana.com',
            'METEORA_API_ENDPOINT': 'https://dlmm-api.meteora.ag',
            'METEORA_PROGRAM_ID': 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'
        };
        return settings[key];
    }
} as any;

describe('MeteoraService', () => {
    let service: MeteoraService;

    beforeEach(() => {
        service = new MeteoraService(mockRuntime);
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct configuration', () => {
            expect(service).toBeDefined();
            expect(service.getDexName()).toBe('meteora');
        });
    });

    describe('getDexName', () => {
        it('should return meteora as the DEX name', () => {
            expect(service.getDexName()).toBe('meteora');
        });
    });

    describe('getPools', () => {
        it('should fetch pools from API', async () => {
            // Mock API response
            const mockPools = {
                pairs: [
                    {
                        address: 'pool123',
                        name: 'SOL-USDC',
                        bin_step: 1,
                        base_fee_percentage: '0.3',
                        max_fee_percentage: '0.5',
                        protocol_fee_percentage: '0.1',
                        liquidity: '1000000',
                        fees_24h: 1500,
                        trade_volume_24h: 500000,
                        current_price: 100,
                        apr: 12.5
                    }
                ]
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockPools
            });

            const pools = await service.getPools();
            expect(pools.length).toBe(1);
            expect(pools[0].dex).toBe('meteora');
            expect(pools[0].id).toBe('pool123');
        });

        it('should handle API errors gracefully', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                statusText: 'Not Found'
            });

            const pools = await service.getPools();
            expect(pools.length).toBe(0);
        });
    });

    describe('addLiquidity', () => {
        it('should return mock success result', async () => {
            const result = await service.addLiquidity({
                userVault: {},
                poolId: 'test-pool',
                tokenAAmountLamports: '1000000000',
                slippageBps: 50
            });

            expect(result.success).toBe(true);
            expect(result.transactionId).toMatch(/^meteora-tx-\d+$/);
        });
    });

    describe('removeLiquidity', () => {
        it('should return mock success result', async () => {
            const result = await service.removeLiquidity({
                userVault: {},
                poolId: 'test-pool',
                lpTokenAmountLamports: '100000000',
                slippageBps: 50
            });

            expect(result.success).toBe(true);
            expect(result.transactionId).toMatch(/^meteora-tx-\d+$/);
        });
    });

    describe('getLpPositionDetails', () => {
        it('should return fallback position details when SDK not available', async () => {
            const position = await service.getLpPositionDetails('test-user', 'test-pool');

            expect(position).toBeDefined();
            expect(position?.dex).toBe('meteora');
            expect(position?.poolId).toBe('test-pool');
            expect(position?.lpTokenBalance.symbol).toBe('METEORA-LP');
        });
    });

    describe('getMarketDataForPools', () => {
        it('should return market data for pools', async () => {
            // Mock the fetchPoolMarketData method
            vi.spyOn(service as any, 'fetchPoolMarketData').mockResolvedValueOnce({
                apr: 12.5,
                apy: 13.2,
                tvl: 1000000,
                fee: 0.003
            });

            const marketData = await service.getMarketDataForPools(['pool1']);

            expect(Object.keys(marketData)).toHaveLength(1);
            expect(marketData.pool1.dex).toBe('meteora');
            expect(marketData.pool1.apr).toBe(12.5);
        });
    });

    describe('getPoolsFromAPI', () => {
        it('should fetch pools with search parameters', async () => {
            const mockPools = {
                pairs: [
                    {
                        address: 'pool456',
                        name: 'SOL-USDC',
                        bin_step: 1,
                        base_fee_percentage: '0.3',
                        max_fee_percentage: '0.5',
                        protocol_fee_percentage: '0.1',
                        liquidity: '2000000',
                        fees_24h: 3000,
                        trade_volume_24h: 1000000,
                        current_price: 100,
                        apr: 15.0
                    }
                ]
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockPools
            });

            const pools = await service.getPoolsFromAPI({ asset: 'SOL', assetB: 'USDC' });
            expect(pools.length).toBe(1);
            expect(pools[0].address).toBe('pool456');
        });
    });

    describe('getAllUserPositions', () => {
        it('should return empty map when SDK not available', async () => {
            const positions = await service.getAllUserPositions('test-user');
            expect(positions.size).toBe(0);
        });
    });

    describe('getPositionsFromPool', () => {
        it('should return empty array when SDK not available', async () => {
            const positions = await service.getPositionsFromPool({ poolAddress: 'test-pool' });
            expect(positions.length).toBe(0);
        });
    });

    describe('getActiveBin', () => {
        it('should return null when SDK not available', async () => {
            const bin = await service.getActiveBin({ poolAddress: 'test-pool' });
            expect(bin).toBeNull();
        });
    });

    describe('service lifecycle', () => {
        it('should start and stop correctly', async () => {
            expect(service.isServiceRunning()).toBe(false);

            await service.start();
            expect(service.isServiceRunning()).toBe(true);

            await service.stop();
            expect(service.isServiceRunning()).toBe(false);
        });
    });

    describe('static methods', () => {
        it('should have static start method', () => {
            expect(typeof MeteoraService.start).toBe('function');
        });

        it('should have static stop method', () => {
            expect(typeof MeteoraService.stop).toBe('function');
        });
    });

    describe('service type', () => {
        it('should have correct service type', () => {
            expect(MeteoraService.serviceType).toBe('METEORA_SERVICE');
        });
    });

    describe('capability description', () => {
        it('should have capability description', () => {
            expect(service.capabilityDescription).toBeDefined();
            expect(typeof service.capabilityDescription).toBe('string');
        });
    });
}); 