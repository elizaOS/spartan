import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kaminoProvider } from '../providers/kaminoProvider';
import { KaminoService } from '../services/kaminoService';

// Mock the autonomous-trader utils
vi.mock('../../../autonomous-trader/utils', () => ({
    getAccountFromMessage: vi.fn()
}));

// Mock the KaminoService
vi.mock('../services/kaminoService', () => ({
    KaminoService: vi.fn().mockImplementation(() => ({
        name: 'KAMINO_SERVICE',
        getUserPositions: vi.fn(),
        getAvailableReserves: vi.fn(),
        getMarketOverview: vi.fn(),
        init: vi.fn(),
        destroy: vi.fn()
    }))
}));

describe('Kamino Provider', () => {
    let mockRuntime: any;
    let mockMessage: any;
    let mockState: any;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Mock runtime
        mockRuntime = {
            getService: vi.fn()
        };

        // Mock message
        mockMessage = {
            content: {
                channelType: 'DM'
            },
            metadata: {
                sourceId: 'test-user-id'
            }
        };

        // Mock state
        mockState = {};
    });

    it('should return error message for non-DM messages', async () => {
        mockMessage.content.channelType = 'GUILD';

        const result = await kaminoProvider.get(mockRuntime, mockMessage, mockState);

        expect(result.text).toContain('Kamino lending protocol information is only available in private messages');
    });

    it('should return error when no account is found', async () => {
        const { getAccountFromMessage } = await import('../../../autonomous-trader/utils');
        (getAccountFromMessage as any).mockResolvedValue(null);

        const result = await kaminoProvider.get(mockRuntime, mockMessage, mockState);

        expect(result.text).toContain('No account found for this user');
    });

    it('should return error when Kamino service is not available', async () => {
        const { getAccountFromMessage } = await import('../../../autonomous-trader/utils');
        (getAccountFromMessage as any).mockResolvedValue({
            metawallets: [{
                keypairs: {
                    solana: {
                        publicKey: 'test-wallet-address'
                    }
                }
            }]
        });

        mockRuntime.getService.mockReturnValue(null);

        const result = await kaminoProvider.get(mockRuntime, mockMessage, mockState);

        expect(result.text).toContain('Kamino service not available');
    });

    it('should generate report when account and service are available', async () => {
        const { getAccountFromMessage } = await import('../../../autonomous-trader/utils');
        (getAccountFromMessage as any).mockResolvedValue({
            metawallets: [{
                keypairs: {
                    solana: {
                        publicKey: 'test-wallet-address'
                    }
                }
            }]
        });

        const mockKaminoService = {
            name: 'KAMINO_SERVICE',
            getUserPositions: vi.fn().mockResolvedValue({
                lending: [],
                borrowing: [],
                totalValue: 0
            }),
            getAvailableReserves: vi.fn().mockResolvedValue([]),
            getMarketOverview: vi.fn().mockResolvedValue({
                totalMarkets: 0,
                totalTvl: 0,
                totalBorrowed: 0,
                markets: []
            })
        };

        mockRuntime.getService.mockReturnValue(mockKaminoService);

        const result = await kaminoProvider.get(mockRuntime, mockMessage, mockState);

        expect(result.text).toContain('=== KAMINO LENDING PROTOCOL REPORT ===');
        expect(result.text).toContain('YOUR KAMINO POSITIONS');
        expect(result.text).toContain('AVAILABLE KAMINO RESERVES');
        expect(result.text).toContain('KAMINO MARKET OVERVIEW');
    });

    it('should handle errors gracefully', async () => {
        const { getAccountFromMessage } = await import('../../../autonomous-trader/utils');
        (getAccountFromMessage as any).mockRejectedValue(new Error('Test error'));

        const result = await kaminoProvider.get(mockRuntime, mockMessage, mockState);

        expect(result.text).toContain('Error generating Kamino report');
    });
});
