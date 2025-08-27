import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KaminoLiquidityService } from '../services/kaminoLiquidityService';

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

    describe('getAllStrategies', () => {
        it('should return array of strategies', async () => {
            const strategies = await service.getAllStrategies();
            expect(Array.isArray(strategies)).toBe(true);
        });
    });

    describe('getStrategiesByFilter', () => {
        it('should return strategies for NON_PEGGED filter', async () => {
            const strategies = await service.getStrategiesByFilter({ strategyType: 'NON_PEGGED' });
            expect(Array.isArray(strategies)).toBe(true);
        });

        it('should return strategies for STABLE filter', async () => {
            const strategies = await service.getStrategiesByFilter({ strategyType: 'STABLE' });
            expect(Array.isArray(strategies)).toBe(true);
        });
    });

    describe('getStrategyByAddress', () => {
        it('should return strategy for valid address', async () => {
            const strategy = await service.getStrategyByAddress('mock-strategy-1');
            expect(strategy).toBeDefined();
        });

        it('should return null for invalid address', async () => {
            const strategy = await service.getStrategyByAddress('invalid-address');
            expect(strategy).toBeNull();
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
            expect(results).toHaveProperty('sdkTest');
            expect(results).toHaveProperty('timestamp');
        });
    });

    describe('resolveTokenWithBirdeye', () => {
        it('should return null when birdeye service is not available', async () => {
            mockRuntime.getService.mockReturnValue(null);
            const result = await service.resolveTokenWithBirdeye('ai16z');
            expect(result).toBeNull();
        });

        it('should return token info for known tokens', async () => {
            const result = await service.resolveTokenWithBirdeye('ai16z');
            expect(result).toHaveProperty('name', 'AI16Z Token (Symbol)');
            expect(result).toHaveProperty('address', 'ai16z');
        });
    });
});
