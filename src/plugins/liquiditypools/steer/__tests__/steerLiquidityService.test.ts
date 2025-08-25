import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SteerLiquidityService } from '../services/steerLiquidityService';

// Mock the viem and Steer SDK imports
vi.mock('viem', () => ({
    createPublicClient: vi.fn(() => ({})),
    http: vi.fn(() => ({})),
}));

vi.mock('viem/chains', () => ({
    mainnet: { id: 1, name: 'Ethereum' },
    polygon: { id: 137, name: 'Polygon' },
    arbitrum: { id: 42161, name: 'Arbitrum' },
    optimism: { id: 10, name: 'Optimism' },
}));

vi.mock('@steer-finance/sdk', () => ({
    VaultClient: vi.fn().mockImplementation(() => ({
        getVaults: vi.fn().mockResolvedValue({
            success: true,
            data: [
                {
                    address: '0x1234567890123456789012345678901234567890',
                    name: 'Test Vault',
                    token0: '0xA0b86a33E6441b8c4C8C1C1B8c4C8C1C1B8c4C8C1',
                    token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                    fee: 3000,
                    tvl: 1000000,
                    volume24h: 50000,
                    apy: 12.5,
                    isActive: true,
                    createdAt: '2024-01-01T00:00:00Z',
                    strategyType: 'UniswapV3',
                    poolAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
                    ammType: 'UniswapV3',
                    singleAssetDepositContract: '0xdef1234567890abcdef1234567890abcdef123456'
                }
            ]
        }),
        previewSingleAssetDeposit: vi.fn().mockResolvedValue({
            success: true,
            data: {
                lpEstimation: {
                    lpTokens: '1000000000000000000',
                    finalAmount0: '500000000000000000',
                    finalAmount1: '500000000000000000'
                },
                swapAmount: '500000000000000000'
            }
        }),
        singleAssetDeposit: vi.fn().mockResolvedValue({
            success: true,
            data: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
        })
    })),
    StakingClient: vi.fn().mockImplementation(() => ({
        getStakingPools: vi.fn().mockResolvedValue({
            success: true,
            data: [
                {
                    address: '0x0987654321098765432109876543210987654321',
                    name: 'Test Staking Pool',
                    stakingToken: '0xA0b86a33E6441b8c4C8C1C1B8c4C8C1C1B8c4C8C1',
                    rewardToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                    totalStaked: 500000,
                    totalStakedUSD: 500000,
                    apr: 8.5,
                    isActive: true,
                    rewardRate: 1000,
                    periodFinish: '2024-12-31T23:59:59Z'
                }
            ]
        }),
        earned: vi.fn().mockResolvedValue({
            success: true,
            data: '1000000000000000000'
        }),
        totalSupply: vi.fn().mockResolvedValue({
            success: true,
            data: '10000000000000000000'
        }),
        balanceOf: vi.fn().mockResolvedValue({
            success: true,
            data: '500000000000000000'
        })
    })),
    AMMType: {
        UniswapV3: 0
    }
}));

// Mock the IAgentRuntime
const mockRuntime = {
    getSetting: vi.fn((key: string) => {
        const settings: { [key: string]: string } = {
            'STEER_RPC_URL_MAINNET': 'https://eth-mainnet.alchemyapi.io/v2/test',
            'STEER_RPC_URL_POLYGON': 'https://polygon-rpc.com',
            'STEER_RPC_URL_ARBITRUM': 'https://arb1.arbitrum.io/rpc',
            'STEER_RPC_URL_OPTIMISM': 'https://mainnet.optimism.io'
        };
        return settings[key] || null;
    })
} as any;

describe('SteerLiquidityService', () => {
    let service: SteerLiquidityService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new SteerLiquidityService(mockRuntime);
    });

    describe('initialization', () => {
        it('should initialize with supported chains', () => {
            expect(service).toBeInstanceOf(SteerLiquidityService);
            expect(service['supportedChains']).toEqual([1, 137, 42161, 10]);
        });

        it('should have correct service type and name', () => {
            expect(SteerLiquidityService.serviceType).toBe('STEER_LIQUIDITY_SERVICE');
            expect(SteerLiquidityService.serviceName).toBe('SteerLiquidityService');
        });

        it('should implement service lifecycle methods', () => {
            expect(typeof service.start).toBe('function');
            expect(typeof service.stop).toBe('function');
            expect(typeof service.isServiceRunning).toBe('function');
            expect(typeof SteerLiquidityService.create).toBe('function');
            expect(typeof SteerLiquidityService.start).toBe('function');
            expect(typeof SteerLiquidityService.stop).toBe('function');
        });
    });

    describe('token normalization', () => {
        it('should normalize 0x addresses to lowercase', () => {
            const result = service['normalizeTokenIdentifier']('0xA0B86A33E6441B8C4C8C1C1B8C4C8C1C1B8C4C8C1');
            expect(result).toBe('0xa0b86a33e6441b8c4c8c1c1b8c4c8c1c1b8c4c8c1');
        });

        it('should handle non-0x addresses', () => {
            const result = service['normalizeTokenIdentifier']('USDC');
            expect(result).toBe('USDC');
        });

        it('should handle Solana-style addresses with warning', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            const result = service['normalizeTokenIdentifier']('HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC');
            expect(result).toBe('HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC');
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('appears to be a Solana address, but Steer Finance is EVM-based')
            );
            consoleSpy.mockRestore();
        });
    });

    describe('token name resolution', () => {
        it('should return known token names', () => {
            const result = service['getTokenName']('USDC');
            expect(result).toBe('USDC');
        });

        it('should format unknown 0x addresses', () => {
            const result = service['getTokenName']('0xA0b86a33E6441b8c4C8C1C1B8c4C8C1C1B8c4C8C1');
            expect(result).toBe('Token 0xa0b86a...4C8C1C');
        });

        it('should return symbol for unknown non-0x identifiers', () => {
            const result = service['getTokenName']('UNKNOWN');
            expect(result).toBe('UNKNOWN');
        });
    });

    describe('getTokenLiquidityStats', () => {
        it('should return comprehensive stats for a valid token', async () => {
            const stats = await service.getTokenLiquidityStats('0xA0b86a33E6441b8c4C8C1C1B8c4C8C1C1B8c4C8C1');

            expect(stats).toHaveProperty('tokenIdentifier');
            expect(stats).toHaveProperty('normalizedToken');
            expect(stats).toHaveProperty('tokenName');
            expect(stats).toHaveProperty('timestamp');
            expect(stats).toHaveProperty('vaults');
            expect(stats).toHaveProperty('stakingPools');
            expect(stats).toHaveProperty('totalTvl');
            expect(stats).toHaveProperty('totalVolume');
            expect(stats).toHaveProperty('apyRange');
            expect(stats).toHaveProperty('vaultCount');
            expect(stats).toHaveProperty('stakingPoolCount');

            expect(stats.vaultCount).toBeGreaterThan(0);
            expect(stats.stakingPoolCount).toBeGreaterThan(0);
            expect(stats.totalTvl).toBeGreaterThan(0);
        });

        it('should handle tokens with no pools gracefully', async () => {
            // Mock empty responses
            const mockVaultClient = {
                getVaults: vi.fn().mockResolvedValue({ success: true, data: [] })
            };
            const mockStakingClient = {
                getStakingPools: vi.fn().mockResolvedValue({ success: true, data: [] })
            };

            service['vaultClients'].set(1, mockVaultClient as any);
            service['stakingClients'].set(1, mockStakingClient as any);

            const stats = await service.getTokenLiquidityStats('0x0000000000000000000000000000000000000000');

            expect(stats.vaultCount).toBe(0);
            expect(stats.stakingPoolCount).toBe(0);
            expect(stats.totalTvl).toBe(0);
        });
    });

    describe('testConnection', () => {
        it('should test connection to all supported chains', async () => {
            const result = await service.testConnection();

            expect(result).toHaveProperty('connectionTest');
            expect(result).toHaveProperty('supportedChains');
            expect(result).toHaveProperty('vaultCount');
            expect(result).toHaveProperty('stakingPoolCount');

            expect(result.supportedChains).toEqual([1, 137, 42161, 10]);
            expect(result.vaultCount).toBeGreaterThan(0);
            expect(result.stakingPoolCount).toBeGreaterThan(0);
        });

        it('should handle connection failures gracefully', async () => {
            // Mock failed connections
            const mockVaultClient = {
                getVaults: vi.fn().mockRejectedValue(new Error('Connection failed'))
            };
            const mockStakingClient = {
                getStakingPools: vi.fn().mockRejectedValue(new Error('Connection failed'))
            };

            service['vaultClients'].set(1, mockVaultClient as any);
            service['stakingClients'].set(1, mockStakingClient as any);

            const result = await service.testConnection();

            expect(result.connectionTest).toBe(false);
            expect(result.error).toContain('Connection failed');
        });
    });

    describe('error handling', () => {
        it('should handle SDK errors gracefully', async () => {
            const mockVaultClient = {
                getVaults: vi.fn().mockResolvedValue({ success: false, error: 'SDK Error' })
            };

            service['vaultClients'].set(1, mockVaultClient as any);

            const stats = await service.getTokenLiquidityStats('0xA0b86a33E6441b8c4C8C1C1B8c4C8C1C1B8c4C8C1');

            expect(stats.vaultCount).toBe(0);
            expect(stats.totalTvl).toBe(0);
        });

        it('should throw meaningful errors for critical failures', async () => {
            const mockVaultClient = {
                getVaults: vi.fn().mockRejectedValue(new Error('Critical failure'))
            };

            service['vaultClients'].set(1, mockVaultClient as any);

            await expect(
                service.getTokenLiquidityStats('0xA0b86a33E6441b8c4C8C1C1B8c4C8C1C1B8c4C8C1')
            ).rejects.toThrow('Failed to get Steer liquidity stats');
        });
    });

    describe('single-asset deposit functionality', () => {
        it('should preview single-asset deposit', async () => {
            const preview = await service.previewSingleAssetDeposit(
                '0x1234567890123456789012345678901234567890',
                1,
                BigInt('1000000000000000000'), // 1 token
                true, // isToken0
                5n, // 5% slippage
                500 // 5% swap slippage
            );

            expect(preview.success).toBe(true);
            expect(preview.data.lpEstimation.lpTokens).toBe('1000000000000000000');
            expect(preview.data.swapAmount).toBe('500000000000000000');
        });

        it('should execute single-asset deposit', async () => {
            const result = await service.executeSingleAssetDeposit(
                '0x1234567890123456789012345678901234567890',
                1,
                BigInt('1000000000000000000'), // 1 token
                '0x1234567890123456789012345678901234567890', // receiver
                true, // isToken0
                5n, // 5% slippage
                500 // 5% swap slippage
            );

            expect(result.success).toBe(true);
            expect(result.data).toBe('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
        });
    });

    describe('staking pool functionality', () => {
        it('should get earned rewards', async () => {
            const earned = await service.getEarnedRewards(
                '0x0987654321098765432109876543210987654321',
                '0x1234567890123456789012345678901234567890',
                1
            );

            expect(earned.success).toBe(true);
            expect(earned.data).toBe('1000000000000000000');
        });

        it('should get staking pool total supply', async () => {
            const totalSupply = await service.getStakingPoolTotalSupply(
                '0x0987654321098765432109876543210987654321',
                1
            );

            expect(totalSupply.success).toBe(true);
            expect(totalSupply.data).toBe('10000000000000000000');
        });

        it('should get staking pool balance', async () => {
            const balance = await service.getStakingPoolBalance(
                '0x0987654321098765432109876543210987654321',
                '0x1234567890123456789012345678901234567890',
                1
            );

            expect(balance.success).toBe(true);
            expect(balance.data).toBe('500000000000000000');
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

        it('should handle multiple start calls gracefully', async () => {
            await service.start();
            expect(service.isServiceRunning()).toBe(true);

            await service.start(); // Should not throw
            expect(service.isServiceRunning()).toBe(true);

            await service.stop();
        });

        it('should handle multiple stop calls gracefully', async () => {
            await service.start();
            await service.stop();
            expect(service.isServiceRunning()).toBe(false);

            await service.stop(); // Should not throw
            expect(service.isServiceRunning()).toBe(false);
        });
    });
});
