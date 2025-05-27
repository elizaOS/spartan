// Unit tests for CommunityInvestorService

import type {
  Component as CoreComponent,
  IAgentRuntime,
  Memory,
  Plugin,
  Service,
  TestCase,
  TestSuite,
  UUID,
} from '@elizaos/core';
import { asUUID, logger } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';

import { CommunityInvestorService } from '../service';
import {
  Conviction,
  type Recommendation,
  type RecommendationMetric,
  SupportedChain,
  type TokenAPIData,
  type TokenTradeData,
  type TokenSecurityData,
  TRUST_MARKETPLACE_COMPONENT_TYPE,
  type UserTrustProfile,
} from '../types';
// Removed client imports as they will be mocked via service/runtime mocks
// import { BirdeyeClient, DexscreenerClient, HeliusClient } from '../clients';

const testUserIdGlobalForService = asUUID(uuidv4());

const createFullMockComponentForSvcTest = (
  userId: UUID,
  profileData: UserTrustProfile,
  runtime: IAgentRuntime
): CoreComponent => ({
  id: asUUID(uuidv4()),
  entityId: userId,
  agentId: runtime.agentId!,
  worldId: runtime.agentId!,
  roomId: asUUID(uuidv4()),
  sourceEntityId: runtime.agentId!,
  type: TRUST_MARKETPLACE_COMPONENT_TYPE,
  createdAt: Date.now(),
  data: profileData,
});

const createMockRecForSvcTest = (
  id: string,
  timestamp: number,
  type: 'BUY' | 'SELL',
  conviction: Recommendation['conviction'],
  userIdToSet: UUID,
  priceAtRec?: number,
  metric?: RecommendationMetric | undefined
): Recommendation => ({
  id: asUUID(uuidv4()),
  userId: userIdToSet,
  messageId: asUUID(uuidv4()),
  timestamp,
  tokenAddress: `TEST_TOKEN_${id}`,
  chain: SupportedChain.SOLANA,
  recommendationType: type,
  conviction,
  rawMessageQuote: `This is a quote for ${id}`,
  priceAtRecommendation: priceAtRec,
  metrics: metric,
  processedForTradeDecision: false,
});

// --- calculateUserTrustScore Test Cases ---
const calculateUserTrustScoreTestCases: TestCase[] = [
  {
    name: 'Service.calculateUserTrustScore: New user, score 0',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      let createdComp: CoreComponent | undefined;
      const originalGetComponent = runtime.getComponent;
      const originalCreateComponent = runtime.createComponent;
      try {
        runtime.getComponent = async () => null;
        runtime.createComponent = async (comp: CoreComponent) => {
          createdComp = comp;
          return true;
        };
        await service.calculateUserTrustScore(testUserIdGlobalForService, runtime);
        if (!createdComp)
          throw new Error('createComponent was not called or did not set createdComp');
        const data = createdComp.data as UserTrustProfile;
        if (data.trustScore !== 0 || data.recommendations.length !== 0) {
          throw new Error(`New user score expected 0, got ${data.trustScore}`);
        }
        logger.info('Service.calculateUserTrustScore: New user score 0 - Passed');
      } finally {
        runtime.getComponent = originalGetComponent;
        runtime.createComponent = originalCreateComponent;
      }
    },
  },
  {
    name: 'Service.calculateUserTrustScore: Single positive BUY recommendation',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const recTimestamp = Date.now() - 10 * 24 * 60 * 60 * 1000;
      const mockRec = createMockRecForSvcTest(
        'rec1',
        recTimestamp,
        'BUY',
        Conviction.HIGH,
        testUserIdGlobalForService,
        10.0,
        {
          evaluationTimestamp: Date.now(),
          potentialProfitPercent: 20.0,
          isScamOrRug: false,
        }
      );
      const initialProfile: UserTrustProfile = {
        version: '1.0.0',
        userId: testUserIdGlobalForService,
        trustScore: 0,
        lastTrustScoreCalculationTimestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
        recommendations: [mockRec],
      };
      const mockComp = createFullMockComponentForSvcTest(
        testUserIdGlobalForService,
        initialProfile,
        runtime
      );
      let updatedComp: CoreComponent | undefined;

      const originalGetComponent = runtime.getComponent;
      const originalUpdateComponent = runtime.updateComponent;
      const originalServiceGetTokenAPIData = (service as any).getTokenAPIData?.bind(service);
      const originalServiceIsLikelyScamOrRug = (service as any).isLikelyScamOrRug?.bind(service);
      const originalServiceEvalPerf = (service as any).evaluateRecommendationPerformance?.bind(
        service
      );

      try {
        runtime.getComponent = async () => mockComp;
        runtime.updateComponent = async (comp: CoreComponent) => {
          updatedComp = comp;
        };
        (service as any).getTokenAPIData = async () =>
          ({
            currentPrice: 12.0,
            priceHistory: [
              { timestamp: recTimestamp, price: 10.0 },
              { timestamp: Date.now(), price: 12.0 },
            ],
          }) as TokenAPIData;
        (service as any).isLikelyScamOrRug = async () => false;
        (service as any).evaluateRecommendationPerformance = async () => ({
          evaluationTimestamp: Date.now(),
          potentialProfitPercent: 20.0,
          isScamOrRug: false,
        });

        await service.calculateUserTrustScore(testUserIdGlobalForService, runtime);
        if (!updatedComp) throw new Error('updateComponent not called');
        const updatedData = updatedComp.data as UserTrustProfile;
        if (Math.abs(updatedData.trustScore - 20.0) > 0.01)
          throw new Error(`Expected score ~20.0, got ${updatedData.trustScore}`);
        logger.info('Service.calculateUserTrustScore: Single positive BUY - Passed');
      } finally {
        runtime.getComponent = originalGetComponent;
        runtime.updateComponent = originalUpdateComponent;
        if (originalServiceGetTokenAPIData)
          (service as any).getTokenAPIData = originalServiceGetTokenAPIData;
        else delete (service as any).getTokenAPIData;
        if (originalServiceIsLikelyScamOrRug)
          (service as any).isLikelyScamOrRug = originalServiceIsLikelyScamOrRug;
        else delete (service as any).isLikelyScamOrRug;
        if (originalServiceEvalPerf)
          (service as any).evaluateRecommendationPerformance = originalServiceEvalPerf;
        else delete (service as any).evaluateRecommendationPerformance;
      }
    },
  },
  {
    name: 'Service.calculateUserTrustScore: Score clamping at +100',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const recTimestamp = Date.now();
      const recs = [
        createMockRecForSvcTest(
          'superGood',
          recTimestamp,
          'BUY',
          Conviction.HIGH,
          testUserIdGlobalForService,
          10,
          {
            potentialProfitPercent: 500,
            evaluationTimestamp: recTimestamp,
          }
        ),
      ];
      const initialProfile: UserTrustProfile = {
        version: '1.0.0',
        userId: testUserIdGlobalForService,
        trustScore: 0,
        lastTrustScoreCalculationTimestamp: 0,
        recommendations: recs,
      };
      const mockComponent = createFullMockComponentForSvcTest(
        testUserIdGlobalForService,
        initialProfile,
        runtime
      );
      let updatedComp: CoreComponent | undefined;

      const originalGetComponent = runtime.getComponent;
      const originalUpdateComponent = runtime.updateComponent;
      const originalServiceEvalPerf = (service as any).evaluateRecommendationPerformance?.bind(
        service
      );
      const originalServiceGetTokenAPIData = (service as any).getTokenAPIData?.bind(service);

      try {
        runtime.getComponent = async () => mockComponent;
        runtime.updateComponent = async (comp: CoreComponent) => {
          updatedComp = comp;
        };
        (service as any).evaluateRecommendationPerformance = async () => ({
          evaluationTimestamp: Date.now(),
          potentialProfitPercent: 500,
          isScamOrRug: false,
        });
        (service as any).getTokenAPIData = async () => ({ currentPrice: 60 }) as TokenAPIData;

        await service.calculateUserTrustScore(testUserIdGlobalForService, runtime);
        if (!updatedComp) throw new Error('updateComponent not called');
        const updatedData = updatedComp.data as UserTrustProfile;
        if (Math.abs(updatedData.trustScore - 100) > 0.01)
          throw new Error(`Expected score clamped at 100, got ${updatedData.trustScore}`);
        logger.info('Service.calculateUserTrustScore: Clamping at +100 - Passed');
      } finally {
        runtime.getComponent = originalGetComponent;
        runtime.updateComponent = originalUpdateComponent;
        if (originalServiceEvalPerf)
          (service as any).evaluateRecommendationPerformance = originalServiceEvalPerf;
        else delete (service as any).evaluateRecommendationPerformance;
        if (originalServiceGetTokenAPIData)
          (service as any).getTokenAPIData = originalServiceGetTokenAPIData;
        else delete (service as any).getTokenAPIData;
      }
    },
  },
  {
    name: 'Service.calculateUserTrustScore: Recommendation with undefined metrics triggers re-evaluation',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const recTimestamp = Date.now();
      const recs = [
        createMockRecForSvcTest(
          'needsEval',
          recTimestamp,
          'BUY',
          Conviction.MEDIUM,
          testUserIdGlobalForService,
          10,
          undefined
        ),
      ];
      const initialProfile: UserTrustProfile = {
        version: '1.0.0',
        userId: testUserIdGlobalForService,
        trustScore: 0,
        lastTrustScoreCalculationTimestamp: 0,
        recommendations: recs,
      };
      const mockComponent = createFullMockComponentForSvcTest(
        testUserIdGlobalForService,
        initialProfile,
        runtime
      );
      let updatedComp: CoreComponent | undefined;
      let getTokenAPIDataCalled = false;
      let evaluatePerformanceCalled = false;

      const originalGetComponent = runtime.getComponent;
      const originalUpdateComponent = runtime.updateComponent;
      const originalServiceGetTokenAPIData = (service as any).getTokenAPIData?.bind(service);
      const originalServiceEvalPerf = (service as any).evaluateRecommendationPerformance?.bind(
        service
      );

      try {
        runtime.getComponent = async () => mockComponent;
        runtime.updateComponent = async (comp: CoreComponent) => {
          updatedComp = comp;
        };
        (service as any).getTokenAPIData = async () => {
          getTokenAPIDataCalled = true;
          return {
            currentPrice: 12.0,
            priceHistory: [
              { timestamp: recTimestamp, price: 10 },
              { timestamp: Date.now(), price: 12 },
            ],
          } as TokenAPIData;
        };
        (service as any).evaluateRecommendationPerformance = async () => {
          evaluatePerformanceCalled = true;
          return {
            evaluationTimestamp: Date.now(),
            potentialProfitPercent: 20.0,
            isScamOrRug: false,
          } as RecommendationMetric;
        };

        await service.calculateUserTrustScore(testUserIdGlobalForService, runtime);
        if (!updatedComp) throw new Error('updateComponent not called');
        if (!getTokenAPIDataCalled)
          throw new Error('getTokenAPIData was not called for metric re-evaluation');
        if (!evaluatePerformanceCalled)
          throw new Error(
            'evaluateRecommendationPerformance was not called for metric re-evaluation'
          );
        const updatedData = updatedComp.data as UserTrustProfile;
        if (Math.abs(updatedData.trustScore - 20.0) > 0.01)
          throw new Error(`Expected score ~20.0 after re-eval, got ${updatedData.trustScore}`);
        logger.info('Service.calculateUserTrustScore: Undefined metrics re-evaluation - Passed');
      } finally {
        runtime.getComponent = originalGetComponent;
        runtime.updateComponent = originalUpdateComponent;
        if (originalServiceGetTokenAPIData)
          (service as any).getTokenAPIData = originalServiceGetTokenAPIData;
        else delete (service as any).getTokenAPIData;
        if (originalServiceEvalPerf)
          (service as any).evaluateRecommendationPerformance = originalServiceEvalPerf;
        else delete (service as any).evaluateRecommendationPerformance;
      }
    },
  },
];

// --- resolveTicker Test Cases ---
const resolveTickerTestCases: TestCase[] = [
  {
    name: 'Service.resolveTicker: Known SOL ticker ($SOL)',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const result = await service.resolveTicker('$SOL', SupportedChain.SOLANA, []);
      if (
        result?.address !== 'So11111111111111111111111111111111111111112' ||
        result?.ticker !== 'SOL'
      ) {
        throw new Error(`Unexpected result for $SOL: ${JSON.stringify(result)}`);
      }
      logger.info('Service.resolveTicker: Known SOL - Passed');
    },
  },
  {
    name: 'Service.resolveTicker: Unknown ticker, DexScreener finds it (SOL)',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const originalDexscreenerClient = (service as any).dexscreenerClient;
      try {
        (service as any).dexscreenerClient = {
          search: async (query: string) => ({
            pairs: [
              {
                baseToken: { address: 'DEX_FOUND_ADDR_SOL', symbol: query.replace('$', '') },
                chainId: 'solana',
                liquidity: { usd: 10000 },
              },
            ],
          }),
          searchForHighestLiquidityPair: async (query: string) => ({
            baseToken: { address: 'DEX_FOUND_ADDR_SOL', symbol: query.replace('$', '') },
            chainId: 'solana',
            liquidity: { usd: 10000 },
          }),
        };
        const result = await service.resolveTicker('$NEWCOINSOL', SupportedChain.SOLANA, []);
        if (result?.address !== 'DEX_FOUND_ADDR_SOL' || result?.ticker !== 'NEWCOINSOL') {
          throw new Error(`Unexpected result from DexScreener for SOL: ${JSON.stringify(result)}`);
        }
        logger.info('Service.resolveTicker: DexScreener SOL find - Passed');
      } finally {
        (service as any).dexscreenerClient = originalDexscreenerClient;
      }
    },
  },
  {
    name: 'Service.resolveTicker: Context message provides address for SOL',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const testSolanaAddressInContext = 'TESTCTXADRESSSOLANAbe891z3456789012345';
      const contextMessages: Memory[] = [
        {
          entityId: asUUID(uuidv4()),
          roomId: asUUID(uuidv4()),
          agentId: runtime.agentId!,
          content: { text: `I heard $CTXTOKEN (${testSolanaAddressInContext}) is good.` },
        } as Memory,
      ];
      const result = await service.resolveTicker(
        '$CTXTOKEN',
        SupportedChain.SOLANA,
        contextMessages
      );
      if (result?.address !== testSolanaAddressInContext || result?.ticker !== 'CTXTOKEN') {
        throw new Error(
          `Context resolution failed for $CTXTOKEN: expected ${testSolanaAddressInContext}, got ${JSON.stringify(result)}`
        );
      }
      logger.info('Service.resolveTicker: Context message SOL - Passed');
    },
  },
  {
    name: 'Service.resolveTicker: Returns null for unresolvable ticker',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const originalDexscreenerClient = (service as any).dexscreenerClient;
      try {
        (service as any).dexscreenerClient = { search: async () => ({ pairs: [] }) };
        const result = await service.resolveTicker('$NONEXISTENT', SupportedChain.SOLANA, []);
        if (result !== null)
          throw new Error(`Expected null for unresolvable ticker, got ${JSON.stringify(result)}`);
        logger.info('Service.resolveTicker: Unresolvable returns null - Passed');
      } finally {
        (service as any).dexscreenerClient = originalDexscreenerClient;
      }
    },
  },
];

// --- getTokenAPIData Test Cases ---
const getTokenAPIDataTestCases: TestCase[] = [
  {
    name: 'Service.getTokenAPIData: Fetches SOL token data successfully',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const tokenAddress = 'TESTSOLADDR';
      const originalBirdeyeClient = (service as any).birdeyeClient;
      const originalDexscreenerClient = (service as any).dexscreenerClient;
      try {
        (service as any).birdeyeClient = {
          fetchTokenOverview: async () => ({ name: 'BirdEyeCoin', symbol: 'BEC', decimals: 9 }),
          fetchPrice: async () => 15.0,
          fetchTokenTradeData: async () =>
            ({
              price: 15.0,
              history_24h_price: 14.0,
              volume_24h_usd: 10000,
              market: 500000,
              price_change_24h_percent: 5,
              unique_wallet_24h_change_percent: 1,
              volume_24h: 1000,
            }) as unknown as TokenTradeData,
          fetchTokenSecurity: async () => ({ top10HolderPercent: 10 }) as any,
        };
        (service as any).dexscreenerClient = {
          search: async () => ({
            schemaVersion: '1.0.0',
            pairs: [
              {
                baseToken: { name: 'DexCoin', symbol: 'DXC' },
                priceUsd: '15.5',
                liquidity: { usd: 50000 },
                marketCap: 500000,
                chainId: 'solana',
              },
            ],
          }),
        };

        const data = await service.getTokenAPIData(tokenAddress, SupportedChain.SOLANA);
        if (
          !data ||
          data.name !== 'BirdEyeCoin' ||
          data.currentPrice !== 15.0 ||
          data.liquidity !== 50000
        ) {
          throw new Error(`getTokenAPIData failed for SOL: ${JSON.stringify(data)}`);
        }
        logger.info('Service.getTokenAPIData: SOL token data success - Passed');
      } finally {
        (service as any).birdeyeClient = originalBirdeyeClient;
        (service as any).dexscreenerClient = originalDexscreenerClient;
      }
    },
  },
  {
    name: 'Service.getTokenAPIData: Returns null if all SOL API calls fail and DexScreener has no pair',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const originalBirdeyeClient = (service as any).birdeyeClient;
      const originalDexscreenerClient = (service as any).dexscreenerClient;
      const originalLoggerError = logger.error; // For suppressing expected errors
      const originalLoggerWarn = logger.warn;

      try {
        logger.error = () => {}; // Suppress for this test
        logger.warn = () => {}; // Suppress for this test

        (service as any).birdeyeClient = {
          fetchTokenOverview: async () => {
            throw new Error('Birdeye API Error');
          },
          fetchPrice: async () => {
            throw new Error('Birdeye API Error');
          },
          fetchTokenTradeData: async () => {
            throw new Error('Birdeye API Error');
          },
          fetchTokenSecurity: async () => {
            throw new Error('Birdeye API Error');
          },
        };
        (service as any).dexscreenerClient = {
          search: async () => ({ pairs: [] }),
          searchForHighestLiquidityPair: async () => null, // Ensure this is also mocked if called by getTokenAPIData
        };
        const data = await service.getTokenAPIData('FAILSOLADDR', SupportedChain.SOLANA);
        if (data !== null) {
          throw new Error('Expected null when all SOL APIs fail and Dexscreener finds no pair');
        }
        logger.info('Service.getTokenAPIData: SOL API failure correctly returns null - Passed');
      } finally {
        (service as any).birdeyeClient = originalBirdeyeClient;
        (service as any).dexscreenerClient = originalDexscreenerClient;
        logger.error = originalLoggerError;
        logger.warn = originalLoggerWarn;
      }
    },
  },
  {
    name: 'Service.getTokenAPIData: Fetches ETH token data using DexScreener',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      (service as any).dexscreenerClient = {
        search: async () => ({
          pairs: [
            {
              baseToken: { name: 'EthCoin', symbol: 'ECN' },
              priceUsd: '2000.0',
              liquidity: { usd: 100000 },
              marketCap: 200000000,
              chainId: 'ethereum',
              priceChange: { h24: 5, h6: 2, h1: 1, m5: 0.1 },
            } as any,
          ],
        }),
      };
      // Birdeye calls should not be made for ETH chain in this path
      (service as any).birdeyeClient = {
        fetchTokenOverview: async () => {
          throw new Error('Birdeye should not be called for ETH');
        },
      };
      const data = await service.getTokenAPIData('TESTETHADDR', SupportedChain.ETHEREUM);
      if (!data || data.name !== 'EthCoin' || data.currentPrice !== 2000.0) {
        throw new Error(`getTokenAPIData failed for ETH: ${JSON.stringify(data)}`);
      }
      logger.info('Service.getTokenAPIData: ETH token data success - Passed');
    },
  },
  {
    name: 'Service.getTokenAPIData: Fetches BASE token data using DexScreener',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      (service as any).dexscreenerClient = {
        search: async () => ({
          pairs: [
            {
              baseToken: { name: 'BaseCoin', symbol: 'BCN' },
              priceUsd: '100.0',
              liquidity: { usd: 50000 },
              marketCap: 10000000,
              chainId: 'base',
              priceChange: { h24: 2, h6: 1, h1: 0.5, m5: 0.05 },
            } as any,
          ],
        }),
      };
      const data = await service.getTokenAPIData('TESTBASEADDR', SupportedChain.BASE);
      if (!data || data.name !== 'BaseCoin' || data.currentPrice !== 100.0) {
        throw new Error(`getTokenAPIData failed for BASE: ${JSON.stringify(data)}`);
      }
      logger.info('Service.getTokenAPIData: BASE token data success - Passed');
    },
  },
];

// --- isLikelyScamOrRug Test Cases ---
const isLikelyScamOrRugTestCases: TestCase[] = [
  {
    name: 'Service.isLikelyScamOrRug: Flags severe price drop (>90%)',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const recTimestamp = Date.now() - 10 * 60 * 1000;
      const tokenData: TokenAPIData = {
        currentPrice: 1,
        priceHistory: [
          { timestamp: recTimestamp - 1000, price: 100 },
          { timestamp: recTimestamp, price: 1 },
        ],
        liquidity: 10000,
        marketCap: 100000,
      };
      const result = await service.isLikelyScamOrRug(tokenData, recTimestamp - 2000);
      if (!result) throw new Error('Severe price drop not flagged as scam/rug');
      logger.info('Service.isLikelyScamOrRug: Severe price drop - Passed');
    },
  },
  {
    name: 'Service.isLikelyScamOrRug: Flags based on isKnownScam field',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const tokenData: TokenAPIData = {
        isKnownScam: true,
        currentPrice: 10,
        name: 'ScamCoin',
        symbol: 'SCM',
      };
      const result = await service.isLikelyScamOrRug(tokenData, Date.now());
      if (!result) throw new Error('Known scam not flagged.');
      logger.info('Service.isLikelyScamOrRug: Known scam field - Passed');
    },
  },
  {
    name: 'Service.isLikelyScamOrRug: Flags critical liquidity (<$500)',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const tokenData: TokenAPIData = {
        currentPrice: 1,
        liquidity: 400,
        marketCap: 10000,
        name: 'LowLiq',
        symbol: 'LLQ',
      };
      const result = await service.isLikelyScamOrRug(tokenData, Date.now());
      if (!result) throw new Error('Critical liquidity not flagged.');
      logger.info('Service.isLikelyScamOrRug: Critical liquidity - Passed');
    },
  },
  {
    name: 'Service.isLikelyScamOrRug: Flags very low liquidity ratio (<0.5%)',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const tokenData: TokenAPIData = {
        currentPrice: 1,
        liquidity: 400,
        marketCap: 100000,
        name: 'LowRatio',
        symbol: 'LRT',
      };
      const result = await service.isLikelyScamOrRug(tokenData, Date.now());
      if (!result) throw new Error('Very low liquidity ratio not flagged as scam/rug');
      logger.info('Service.isLikelyScamOrRug: Very low liquidity ratio - Passed');
    },
  },
  {
    name: 'Service.isLikelyScamOrRug: Not flagged for healthy token',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const tokenData: TokenAPIData = {
        currentPrice: 100,
        liquidity: 500000,
        marketCap: 5000000,
        priceHistory: [
          { timestamp: Date.now() - 1000, price: 95 },
          { timestamp: Date.now(), price: 100 },
        ],
        name: 'Healthy',
        symbol: 'HLT',
      };
      const result = await service.isLikelyScamOrRug(tokenData, Date.now() - 2000);
      if (result) throw new Error('Healthy token incorrectly flagged as scam/rug');
      logger.info('Service.isLikelyScamOrRug: Healthy token - Passed');
    },
  },
];

// --- evaluateRecommendationPerformance Test Cases ---
const evaluatePerfTestCases: TestCase[] = [
  {
    name: 'Service.evaluatePerf: BUY rec profit, not scam',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const originalIsLikelyScamOrRug = (service as any).isLikelyScamOrRug?.bind(service);
      try {
        const recTimestamp = Date.now() - 60 * 60 * 1000;
        const baseRec: Omit<Recommendation, 'recommendationType' | 'metrics'> = {
          id: asUUID(uuidv4()),
          userId: testUserIdGlobalForService,
          messageId: asUUID(uuidv4()),
          timestamp: recTimestamp,
          tokenAddress: 'ADDR_PROFIT',
          chain: SupportedChain.SOLANA,
          conviction: Conviction.HIGH,
          rawMessageQuote: 'quote',
          priceAtRecommendation: 10.0,
        };
        const tokenData: TokenAPIData = {
          currentPrice: 15,
          priceHistory: [
            { timestamp: recTimestamp, price: 10 },
            { timestamp: Date.now(), price: 15 },
          ],
          name: 'ProfitCoin',
          symbol: 'PFT',
        };
        (service as any).isLikelyScamOrRug = async () => false;
        const metrics = await service.evaluateRecommendationPerformance(
          { ...baseRec, recommendationType: 'BUY' } as Recommendation,
          tokenData
        );
        if (Math.abs((metrics.potentialProfitPercent || 0) - 50) > 0.01)
          throw new Error('BUY profit mismatch');
        if (metrics.isScamOrRug) throw new Error('Incorrectly flagged as scam');
        logger.info('Service.evaluatePerf: BUY profit - Passed');
      } finally {
        if (originalIsLikelyScamOrRug)
          (service as any).isLikelyScamOrRug = originalIsLikelyScamOrRug;
        else delete (service as any).isLikelyScamOrRug;
      }
    },
  },
  {
    name: 'Service.evaluatePerf: BUY rec for rugged token results in -99 profit percent',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const originalIsLikelyScamOrRug = (service as any).isLikelyScamOrRug?.bind(service);
      try {
        const recTimestamp = Date.now() - 60 * 60 * 1000;
        const baseRec: Omit<Recommendation, 'recommendationType' | 'metrics'> = {
          id: asUUID(uuidv4()),
          userId: testUserIdGlobalForService,
          messageId: asUUID(uuidv4()),
          timestamp: recTimestamp,
          tokenAddress: 'ADDR_RUG_BUY',
          chain: SupportedChain.SOLANA,
          conviction: Conviction.HIGH,
          rawMessageQuote: 'quote',
          priceAtRecommendation: 10.0,
        };
        const tokenData: TokenAPIData = {
          currentPrice: 0.1,
          priceHistory: [
            { timestamp: recTimestamp, price: 10 },
            { timestamp: Date.now(), price: 0.1 },
          ],
          name: 'RugCoin',
          symbol: 'RUG',
        };
        (service as any).isLikelyScamOrRug = async () => true;
        const metrics = await service.evaluateRecommendationPerformance(
          { ...baseRec, recommendationType: 'BUY' } as Recommendation,
          tokenData
        );
        if (metrics.potentialProfitPercent !== -99)
          throw new Error('BUY scam profit mismatch, expected -99');
        if (!metrics.isScamOrRug) throw new Error('Not flagged as scam when it should be');
        logger.info('Service.evaluatePerf: BUY rec rugged - Passed');
      } finally {
        if (originalIsLikelyScamOrRug)
          (service as any).isLikelyScamOrRug = originalIsLikelyScamOrRug;
        else delete (service as any).isLikelyScamOrRug;
      }
    },
  },
  {
    name: 'Service.evaluatePerf: SELL rec, avoided loss correctly (price dropped)',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const originalIsLikelyScamOrRug = (service as any).isLikelyScamOrRug?.bind(service);
      try {
        const recTimestamp = Date.now() - 60 * 60 * 1000;
        const baseRec: Omit<Recommendation, 'recommendationType' | 'metrics'> = {
          id: asUUID(uuidv4()),
          userId: testUserIdGlobalForService,
          messageId: asUUID(uuidv4()),
          timestamp: recTimestamp,
          tokenAddress: 'ADDR_AVOID_LOSS',
          chain: SupportedChain.SOLANA,
          conviction: Conviction.MEDIUM,
          rawMessageQuote: 'sell this',
          priceAtRecommendation: 100.0,
        };
        const tokenData: TokenAPIData = {
          currentPrice: 20,
          priceHistory: [
            { timestamp: recTimestamp, price: 100 },
            { timestamp: Date.now(), price: 20 },
          ],
          name: 'DropCoin',
          symbol: 'DRP',
        };
        (service as any).isLikelyScamOrRug = async () => false;
        const metrics = await service.evaluateRecommendationPerformance(
          { ...baseRec, recommendationType: 'SELL' } as Recommendation,
          tokenData
        );
        if (Math.abs((metrics.avoidedLossPercent || 0) - 80) > 0.01)
          throw new Error('SELL avoided loss mismatch. Expected 80%');
        logger.info('Service.evaluatePerf: SELL avoided loss - Passed');
      } finally {
        if (originalIsLikelyScamOrRug)
          (service as any).isLikelyScamOrRug = originalIsLikelyScamOrRug;
        else delete (service as any).isLikelyScamOrRug;
      }
    },
  },
  {
    name: 'Service.evaluatePerf: SELL rec, missed gain (price pumped)',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const originalIsLikelyScamOrRug = (service as any).isLikelyScamOrRug?.bind(service);
      try {
        const recTimestamp = Date.now() - 60 * 60 * 1000;
        const baseRec: Omit<Recommendation, 'recommendationType' | 'metrics'> = {
          id: asUUID(uuidv4()),
          userId: testUserIdGlobalForService,
          messageId: asUUID(uuidv4()),
          timestamp: recTimestamp,
          tokenAddress: 'ADDR_MISSED_GAIN',
          chain: SupportedChain.SOLANA,
          conviction: Conviction.MEDIUM,
          rawMessageQuote: 'sell this now',
          priceAtRecommendation: 50.0,
        };
        const tokenData: TokenAPIData = {
          currentPrice: 100,
          priceHistory: [
            { timestamp: recTimestamp, price: 50 },
            { timestamp: Date.now(), price: 100 },
          ],
          name: 'PumpCoin',
          symbol: 'PMP',
        };
        (service as any).isLikelyScamOrRug = async () => false;
        const metrics = await service.evaluateRecommendationPerformance(
          { ...baseRec, recommendationType: 'SELL' } as Recommendation,
          tokenData
        );
        if (Math.abs((metrics.avoidedLossPercent || 0) - -100) > 0.01)
          throw new Error('SELL missed gain mismatch. Expected -100%');
        logger.info('Service.evaluatePerf: SELL missed gain - Passed');
      } finally {
        if (originalIsLikelyScamOrRug)
          (service as any).isLikelyScamOrRug = originalIsLikelyScamOrRug;
        else delete (service as any).isLikelyScamOrRug;
      }
    },
  },
  {
    name: 'Service.evaluatePerf: SELL rec, correctly identified scam (avoidedLossPercent = 99)',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const originalIsLikelyScamOrRug = (service as any).isLikelyScamOrRug?.bind(service);
      try {
        const recTimestamp = Date.now() - 60 * 60 * 1000;
        const baseRec: Omit<Recommendation, 'recommendationType' | 'metrics'> = {
          id: asUUID(uuidv4()),
          userId: testUserIdGlobalForService,
          messageId: asUUID(uuidv4()),
          timestamp: recTimestamp,
          tokenAddress: 'ADDR_RUG_SELL',
          chain: SupportedChain.SOLANA,
          conviction: Conviction.HIGH,
          rawMessageQuote: 'quote',
          priceAtRecommendation: 10.0,
        };
        const tokenData: TokenAPIData = { currentPrice: 0.1, name: 'SellScam', symbol: 'SSC' };
        (service as any).isLikelyScamOrRug = async () => true;
        const metrics = await service.evaluateRecommendationPerformance(
          { ...baseRec, recommendationType: 'SELL' } as Recommendation,
          tokenData
        );
        if (metrics.avoidedLossPercent !== 99)
          throw new Error('SELL scam avoidedLossPercent mismatch, expected 99');
        if (!metrics.isScamOrRug) throw new Error('Not flagged as scam for SELL when it should be');
        logger.info('Service.evaluatePerf: SELL rec rugged, correct ID - Passed');
      } finally {
        if (originalIsLikelyScamOrRug)
          (service as any).isLikelyScamOrRug = originalIsLikelyScamOrRug;
        else delete (service as any).isLikelyScamOrRug;
      }
    },
  },
];

// --- getLeaderboardData Test Cases ---
const getLeaderboardDataTestCases: TestCase[] = [
  {
    name: 'Service.getLeaderboardData: Returns sorted entries with ranks',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const user1Id = asUUID(uuidv4());
      const user2Id = asUUID(uuidv4());
      const user3Id = asUUID(uuidv4());

      (runtime.getAgents as any) = async () => [
        { id: user1Id, names: ['UserA'], metadata: {} },
        { id: user2Id, names: ['UserB'], metadata: {} },
        { id: user3Id, names: ['UserC'], metadata: {} },
      ];

      const user1Comp = createFullMockComponentForSvcTest(
        user1Id,
        {
          version: '1.0.0',
          userId: user1Id,
          trustScore: 75,
          recommendations: [],
          lastTrustScoreCalculationTimestamp: Date.now(),
        },
        runtime
      );
      const user2Comp = createFullMockComponentForSvcTest(
        user2Id,
        {
          version: '1.0.0',
          userId: user2Id,
          trustScore: 90,
          recommendations: [],
          lastTrustScoreCalculationTimestamp: Date.now(),
        },
        runtime
      );
      const user3Comp = createFullMockComponentForSvcTest(
        user3Id,
        {
          version: '1.0.0',
          userId: user3Id,
          trustScore: 80,
          recommendations: [],
          lastTrustScoreCalculationTimestamp: Date.now(),
        },
        runtime
      );

      (runtime.getComponent as any) = async (entityId: UUID, type: string, worldId?: UUID) => {
        if (worldId && worldId !== runtime.agentId) return null;
        if (type !== TRUST_MARKETPLACE_COMPONENT_TYPE) return null;
        if (entityId === user1Id) return user1Comp;
        if (entityId === user2Id) return user2Comp;
        if (entityId === user3Id) return user3Comp;
        return null;
      };
      (runtime.getEntityById as any) = async (id: UUID) => {
        if (id === user1Id) return { id: user1Id, names: ['UserA'], agentId: runtime.agentId! };
        if (id === user2Id) return { id: user2Id, names: ['UserB'], agentId: runtime.agentId! };
        if (id === user3Id) return { id: user3Id, names: ['UserC'], agentId: runtime.agentId! };
        return null;
      };

      const leaderboard = await service.getLeaderboardData(runtime);
      if (leaderboard.length !== 3)
        throw new Error(`Expected 3 leaderboard entries, got ${leaderboard.length}`);
      if (
        leaderboard[0].userId !== user2Id ||
        leaderboard[0].rank !== 1 ||
        leaderboard[0].trustScore !== 90
      )
        throw new Error(`Leaderboard error for rank 1: ${JSON.stringify(leaderboard[0])}`);
      if (
        leaderboard[1].userId !== user3Id ||
        leaderboard[1].rank !== 2 ||
        leaderboard[1].trustScore !== 80
      )
        throw new Error(`Leaderboard error for rank 2: ${JSON.stringify(leaderboard[1])}`);
      if (
        leaderboard[2].userId !== user1Id ||
        leaderboard[2].rank !== 3 ||
        leaderboard[2].trustScore !== 75
      )
        throw new Error(`Leaderboard error for rank 3: ${JSON.stringify(leaderboard[2])}`);
      logger.info('Service.getLeaderboardData: Sorted entries - Passed');
    },
  },
  {
    name: 'Service.getLeaderboardData: Handles empty agents list',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      (runtime.getAgents as any) = async () => [];
      const leaderboard = await service.getLeaderboardData(runtime);
      if (leaderboard.length !== 0) throw new Error('Expected 0 leaderboard entries for no agents');
      logger.info('Service.getLeaderboardData: Empty agents list - Passed');
    },
  },
  {
    name: 'Service.getLeaderboardData: Handles agents with no trust profile component',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const user1Id = asUUID(uuidv4());
      (runtime.getAgents as any) = async () => [{ id: user1Id, names: ['UserA'], metadata: {} }];
      (runtime.getComponent as any) = async () => null; // No component for UserA
      (runtime.getEntityById as any) = async (id: UUID) => ({
        id,
        names: ['UserA'],
        agentId: runtime.agentId!,
      });

      const leaderboard = await service.getLeaderboardData(runtime);
      if (leaderboard.length !== 0)
        throw new Error('Expected 0 leaderboard entries when no profiles found');
      logger.info('Service.getLeaderboardData: No profiles found - Passed');
    },
  },
];

export const serviceTestSuite: TestSuite = {
  name: 'CommunityInvestorService Tests (ElizaOS Runner Format)',
  tests: [
    ...calculateUserTrustScoreTestCases,
    ...resolveTickerTestCases,
    ...getTokenAPIDataTestCases,
    ...isLikelyScamOrRugTestCases,
    ...evaluatePerfTestCases,
    ...getLeaderboardDataTestCases,
  ],
};
