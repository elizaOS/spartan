import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KaminoLiquidityService } from '../services/kaminoLiquidityService';
import { getKaminoLiquidityStatsAction } from '../actions/getKaminoLiquidityStats';

// Mock the runtime
const mockRuntime = {
    getSetting: vi.fn((key: string) => {
        if (key === 'SOLANA_RPC_URL') return 'https://api.mainnet-beta.solana.com';
        return undefined;
    }),
    getService: vi.fn(),
    logger: {
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }
} as any;

// Mock Solana web3
vi.mock('@solana/web3.js', () => ({
    Connection: vi.fn().mockImplementation(() => ({
        getSlot: vi.fn().mockResolvedValue(12345),
        getAccountInfo: vi.fn().mockResolvedValue({
            data: Buffer.from('mock data'),
            lamports: 1000000000,
            owner: { toString: () => '6LtLpnUFNByNXLyCoK9wA2MykKAmQNZKBdY8s47dehDc' },
            executable: false,
            rentEpoch: 0
        }),
        getProgramAccounts: vi.fn().mockResolvedValue([
            {
                pubkey: { toString: () => 'mock-strategy-1' },
                account: { data: Buffer.from('mock strategy data') }
            },
            {
                pubkey: { toString: () => 'mock-strategy-2' },
                account: { data: Buffer.from('mock strategy data') }
            }
        ])
    })),
    PublicKey: vi.fn().mockImplementation((address: string) => ({
        toString: () => address
    }))
}));

// Mock Kamino SDK
vi.mock('@kamino-finance/kliquidity-sdk', () => ({
    Kamino: vi.fn().mockImplementation(() => ({
        getAllStrategiesWithFilters: vi.fn().mockResolvedValue([
            {
                address: { toString: () => 'mock-strategy-1' },
                strategy: {
                    tokenAMint: { toString: () => 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC' },
                    tokenBMint: { toString: () => 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
                    owner: { toString: () => 'mock-owner' },
                    totalShares: { toString: () => '1000000' }
                }
            },
            {
                address: { toString: () => 'mock-strategy-2' },
                strategy: {
                    tokenAMint: { toString: () => 'So11111111111111111111111111111111111111112' },
                    tokenBMint: { toString: () => 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
                    owner: { toString: () => 'mock-owner' },
                    totalShares: { toString: () => '2000000' }
                }
            }
        ]),
        getStrategyByAddress: vi.fn().mockResolvedValue({
            tokenAMint: { toString: () => 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC' },
            tokenBMint: { toString: () => 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
            owner: { toString: () => 'mock-owner' },
            totalShares: { toString: () => '1000000' }
        })
    })),
    StrategiesFilters: {}
}));

describe('KaminoLiquidityService', () => {
    let service: KaminoLiquidityService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new KaminoLiquidityService(mockRuntime);
    });

    describe('normalizeTokenIdentifier', () => {
        it('should normalize ai16z symbol to correct address', () => {
            const result = service['normalizeTokenIdentifier']('ai16z');
            expect(result).toBe('HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC');
        });

        it('should return valid Solana addresses as-is', () => {
            const address = 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC';
            const result = service['normalizeTokenIdentifier'](address);
            expect(result).toBe(address);
        });

        it('should return other identifiers as-is', () => {
            const identifier = 'some-other-token';
            const result = service['normalizeTokenIdentifier'](identifier);
            expect(result).toBe(identifier);
        });
    });

    describe('getTokenLiquidityStats', () => {
        it('should return stats for ai16z token', async () => {
            const stats = await service.getTokenLiquidityStats('ai16z');

            expect(stats).toHaveProperty('tokenIdentifier', 'ai16z');
            expect(stats).toHaveProperty('normalizedToken', 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC');
            expect(stats).toHaveProperty('tokenName', 'AI16Z Token');
            expect(stats).toHaveProperty('strategies');
            expect(stats).toHaveProperty('totalTvl');
            expect(stats).toHaveProperty('totalVolume');
            expect(stats).toHaveProperty('apyRange');
            expect(stats).toHaveProperty('poolCount');
        });

        it('should return stats for direct address', async () => {
            const address = 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC';
            const stats = await service.getTokenLiquidityStats(address);

            expect(stats).toHaveProperty('tokenIdentifier', address);
            expect(stats).toHaveProperty('normalizedToken', address);
            expect(stats).toHaveProperty('tokenName', 'AI16Z Token');
        });
    });

    describe('testConnection', () => {
        it('should return connection test results', async () => {
            const results = await service.testConnection();

            expect(results).toHaveProperty('rpcEndpoint');
            expect(results).toHaveProperty('programId');
            expect(results).toHaveProperty('connectionTest');
            expect(results).toHaveProperty('programExists');
            expect(results).toHaveProperty('strategyCount');
            expect(results).toHaveProperty('timestamp');
        });
    });
});

describe('getKaminoLiquidityStatsAction', () => {
    const mockLiquidityService = {
        getTokenLiquidityStats: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockRuntime.getService.mockReturnValue(mockLiquidityService);
    });

    it('should return success response for valid token', async () => {
        const mockStats = {
            tokenName: 'AI16Z Token',
            strategies: [
                {
                    address: 'mock-strategy-1',
                    strategyType: 'Liquidity Pool',
                    estimatedTvl: 1000000,
                    apy: 10.5,
                    feeTier: '0.3%',
                    rebalancing: 'Auto',
                    positions: []
                }
            ],
            totalTvl: 1000000,
            totalVolume: 50000,
            apyRange: { min: 8.5, max: 12.5 },
            poolCount: 1
        };

        mockLiquidityService.getTokenLiquidityStats.mockResolvedValue(mockStats);

        const result = await getKaminoLiquidityStatsAction.handler(
            mockRuntime,
            { tokenIdentifier: 'ai16z' },
            {} as any
        );

        expect(result.success).toBe(true);
        expect(result.message).toContain('KAMINO LIQUIDITY STATS FOR AI16Z');
        expect(result.message).toContain('AI16Z Token');
        expect(result.message).toContain('$1,000,000');
        expect(result.data).toEqual(mockStats);
    });

    it('should return error when service is not available', async () => {
        mockRuntime.getService.mockReturnValue(null);

        const result = await getKaminoLiquidityStatsAction.handler(
            mockRuntime,
            { tokenIdentifier: 'ai16z' },
            {} as any
        );

        expect(result.success).toBe(false);
        expect(result.message).toContain('Kamino liquidity service is not available');
    });

    it('should handle service errors gracefully', async () => {
        mockLiquidityService.getTokenLiquidityStats.mockRejectedValue(new Error('Service error'));

        const result = await getKaminoLiquidityStatsAction.handler(
            mockRuntime,
            { tokenIdentifier: 'ai16z' },
            {} as any
        );

        expect(result.success).toBe(false);
        expect(result.message).toContain('Error fetching Kamino liquidity stats');
    });
});
