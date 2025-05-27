// Unit tests for trust score calculation logic

import type {
  IAgentRuntime,
  UUID,
  Component as CoreComponent,
  ServiceTypeName,
  TestCase,
  TestSuite,
} from '@elizaos/core';
import { asUUID, logger } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { CommunityInvestorService } from '../service';
import type {
  UserTrustProfile,
  Recommendation,
  RecommendationMetric,
  TokenAPIData,
} from '../types';
import {
  Conviction,
  TRUST_MARKETPLACE_COMPONENT_TYPE,
  SupportedChain,
  ServiceType,
} from '../types';

const testUserIdGlobalTrustScore = asUUID(uuidv4());
const testWorldId = asUUID(uuidv4());

// Helper to create a full mock component for tests
const createFullMockComponentForTrustScore = (
  userId: UUID,
  profileData: UserTrustProfile,
  runtime: IAgentRuntime
): CoreComponent => ({
  id: asUUID(uuidv4()),
  entityId: userId,
  agentId: runtime.agentId!,
  worldId: testWorldId,
  roomId: asUUID(uuidv4()),
  sourceEntityId: runtime.agentId!,
  type: TRUST_MARKETPLACE_COMPONENT_TYPE,
  createdAt: Date.now(),
  data: profileData,
});

const createRecForTrustScore = (
  id: string,
  timestamp: number,
  type: 'BUY' | 'SELL',
  conviction: Recommendation['conviction'],
  metric: RecommendationMetric | undefined,
  priceAtRec?: number
): Recommendation => ({
  id: asUUID(uuidv4()),
  userId: testUserIdGlobalTrustScore,
  messageId: asUUID(uuidv4()),
  timestamp,
  tokenAddress: `TOKEN_ADDR_${id}`,
  chain: SupportedChain.SOLANA,
  recommendationType: type,
  conviction,
  rawMessageQuote: `Quote for ${id}`,
  priceAtRecommendation: priceAtRec,
  metrics: metric,
  processedForTradeDecision: true,
});

// Test Cases for Trust Score Logic
const recencyWeightTests: TestCase[] = [
  {
    name: 'TrustScore.Recency: 1.0 for very recent',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const weight = service.getRecencyWeight(Date.now());
      if (Math.abs(weight - 1.0) > 0.015) {
        throw new Error(`Recency Weight: Expected ~1.0, got ${weight}`);
      }
      logger.info('TrustScore.Recency: 1.0 - Passed');
    },
  },
  {
    name: 'TrustScore.Recency: 0.1 for older than RECENCY_WEIGHT_MONTHS',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const recencyMonths = 6;
      const sixMonthsInMillis = recencyMonths * 30.44 * 24 * 60 * 60 * 1000;
      const weight = service.getRecencyWeight(Date.now() - sixMonthsInMillis - 1000);
      if (Math.abs(weight - 0.1) > 0.01) {
        throw new Error(`Recency Weight: Expected ~0.1, got ${weight}`);
      }
      logger.info('TrustScore.Recency: 0.1 older - Passed');
    },
  },
];

const convictionWeightTests: TestCase[] = [
  {
    name: 'TrustScore.Conviction: Correct weights per level',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      if (service.getConvictionWeight(Conviction.NONE) !== 0.25)
        throw new Error('NONE weight mismatch');
      if (service.getConvictionWeight(Conviction.LOW) !== 0.5)
        throw new Error('LOW weight mismatch');
      if (service.getConvictionWeight(Conviction.MEDIUM) !== 1.0)
        throw new Error('MEDIUM mismatch');
      if (service.getConvictionWeight(Conviction.HIGH) !== 1.5) throw new Error('HIGH mismatch');
      logger.info('TrustScore.Conviction: Weights - Passed');
    },
  },
];

const calculateScoreLogicTests: TestCase[] = [
  {
    name: 'TrustScore.Calc: New user, no recs, score 0',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      let createdCompData: UserTrustProfile | null = null;
      const originalGetComponent = runtime.getComponent;
      const originalCreateComponent = runtime.createComponent;
      try {
        runtime.getComponent = async () => null;
        runtime.createComponent = async (comp: CoreComponent) => {
          createdCompData = comp.data as UserTrustProfile;
          return true;
        };
        await service.calculateUserTrustScore(testUserIdGlobalTrustScore, runtime, testWorldId);
        if (!createdCompData) throw new Error('createComponent was not effectively called');
        if (
          createdCompData.trustScore !== 0 ||
          (createdCompData.recommendations || []).length !== 0
        ) {
          throw new Error(`New user score expected 0, got ${createdCompData.trustScore}`);
        }
        logger.info('TrustScore.Calc: New user - Passed');
      } finally {
        runtime.getComponent = originalGetComponent;
        runtime.createComponent = originalCreateComponent;
      }
    },
  },
  {
    name: 'TrustScore.Calc: Single good BUY (+50% perf, recent, high conv)',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const recTimestamp = Date.now() - 1 * 24 * 60 * 60 * 1000;
      const basePerformance = 50;
      const recs = [
        createRecForTrustScore(
          'goodBuy',
          recTimestamp,
          'BUY',
          Conviction.HIGH,
          {
            potentialProfitPercent: basePerformance,
            evaluationTimestamp: recTimestamp,
            isScamOrRug: false,
          },
          10
        ),
      ];
      const initialProfile: UserTrustProfile = {
        version: '1.0.0',
        userId: testUserIdGlobalTrustScore,
        trustScore: 0,
        lastTrustScoreCalculationTimestamp: 0,
        recommendations: recs,
      };
      const initialComponent = createFullMockComponentForTrustScore(
        testUserIdGlobalTrustScore,
        initialProfile,
        runtime
      );

      let updatedCompData: UserTrustProfile | null = null;
      const originalGetComponent = runtime.getComponent;
      const originalUpdateComponent = runtime.updateComponent;
      const originalServiceGetTokenAPIData = (service as any).getTokenAPIData?.bind(service);
      const originalServiceIsLikelyScamOrRug = (service as any).isLikelyScamOrRug?.bind(service);

      try {
        runtime.getComponent = async () => initialComponent;
        runtime.updateComponent = async (comp: CoreComponent) => {
          updatedCompData = comp.data as UserTrustProfile;
        };
        (service as any).getTokenAPIData = async () =>
          ({
            currentPrice: 15.0,
            priceHistory: [
              { timestamp: recTimestamp, price: 10.0 },
              { timestamp: Date.now(), price: 15.0 },
            ],
            name: 'TestCoin',
            symbol: 'TST',
          }) as TokenAPIData;
        (service as any).isLikelyScamOrRug = async () => false;

        await service.calculateUserTrustScore(testUserIdGlobalTrustScore, runtime, testWorldId);

        if (!updatedCompData) throw new Error('updateComponent was not effectively called');

        const expectedFinalScore = Math.max(-100, Math.min(100, basePerformance));

        if (Math.abs(updatedCompData.trustScore - expectedFinalScore) > 0.01) {
          throw new Error(
            `Expected score ${expectedFinalScore.toFixed(2)}, got ${updatedCompData.trustScore.toFixed(2)}`
          );
        }
        logger.info('TrustScore.Calc: Single good BUY - Passed');
      } finally {
        runtime.getComponent = originalGetComponent;
        runtime.updateComponent = originalUpdateComponent;
        if (originalServiceGetTokenAPIData)
          (service as any).getTokenAPIData = originalServiceGetTokenAPIData;
        else delete (service as any).getTokenAPIData;
        if (originalServiceIsLikelyScamOrRug)
          (service as any).isLikelyScamOrRug = originalServiceIsLikelyScamOrRug;
        else delete (service as any).isLikelyScamOrRug;
      }
    },
  },
  {
    name: 'TrustScore.Calc: Single scam BUY (-100 perf, recent, med conv)',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const recTimestamp = Date.now() - 2 * 24 * 60 * 60 * 1000;
      const recs = [
        createRecForTrustScore(
          'scamBuy',
          recTimestamp,
          'BUY',
          Conviction.MEDIUM,
          { potentialProfitPercent: -99, isScamOrRug: true, evaluationTimestamp: recTimestamp },
          10
        ),
      ];
      const initialProfile: UserTrustProfile = {
        version: '1.0.0',
        userId: testUserIdGlobalTrustScore,
        trustScore: 0,
        lastTrustScoreCalculationTimestamp: 0,
        recommendations: recs,
      };
      const initialComponent = createFullMockComponentForTrustScore(
        testUserIdGlobalTrustScore,
        initialProfile,
        runtime
      );

      let updatedCompData: UserTrustProfile | null = null;
      const originalGetComponent = runtime.getComponent;
      const originalUpdateComponent = runtime.updateComponent;
      const originalServiceGetTokenAPIData = (service as any).getTokenAPIData?.bind(service);
      const originalServiceIsLikelyScamOrRug = (service as any).isLikelyScamOrRug?.bind(service);

      try {
        runtime.getComponent = async () => initialComponent;
        runtime.updateComponent = async (comp: CoreComponent) => {
          updatedCompData = comp.data as UserTrustProfile;
        };
        (service as any).getTokenAPIData = async () =>
          ({ currentPrice: 0.01, name: 'ScamCoin', symbol: 'SCM' }) as TokenAPIData;
        (service as any).isLikelyScamOrRug = async () => true;

        await service.calculateUserTrustScore(testUserIdGlobalTrustScore, runtime, testWorldId);

        if (!updatedCompData)
          throw new Error('updateComponent was not effectively called for scam BUY');
        if (Math.abs(updatedCompData.trustScore - -100) > 0.01) {
          throw new Error(
            `Expected score ~-100 for scam BUY, got ${updatedCompData.trustScore.toFixed(2)}`
          );
        }
        logger.info('TrustScore.Calc: Single scam BUY - Passed');
      } finally {
        runtime.getComponent = originalGetComponent;
        runtime.updateComponent = originalUpdateComponent;
        if (originalServiceGetTokenAPIData)
          (service as any).getTokenAPIData = originalServiceGetTokenAPIData;
        else delete (service as any).getTokenAPIData;
        if (originalServiceIsLikelyScamOrRug)
          (service as any).isLikelyScamOrRug = originalServiceIsLikelyScamOrRug;
        else delete (service as any).isLikelyScamOrRug;
      }
    },
  },
  {
    name: 'TrustScore.Calc: Score clamps at +100',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const recs = [
        createRecForTrustScore(
          'superGood',
          Date.now(),
          'BUY',
          Conviction.HIGH,
          { potentialProfitPercent: 500, evaluationTimestamp: Date.now(), isScamOrRug: false },
          1
        ),
      ];
      const initialProfile: UserTrustProfile = {
        version: '1.0.0',
        userId: testUserIdGlobalTrustScore,
        trustScore: 0,
        lastTrustScoreCalculationTimestamp: 0,
        recommendations: recs,
      };
      const initialComponent = createFullMockComponentForTrustScore(
        testUserIdGlobalTrustScore,
        initialProfile,
        runtime
      );
      let updatedCompData: UserTrustProfile | null = null;
      const originalGetComponent = runtime.getComponent;
      const originalUpdateComponent = runtime.updateComponent;
      const originalServiceGetTokenAPIData = (service as any).getTokenAPIData?.bind(service);
      const originalServiceIsLikelyScamOrRug = (service as any).isLikelyScamOrRug?.bind(service);

      try {
        runtime.getComponent = async () => initialComponent;
        runtime.updateComponent = async (comp: CoreComponent) => {
          updatedCompData = comp.data as UserTrustProfile;
        };
        (service as any).getTokenAPIData = async () =>
          ({ currentPrice: 6, name: 'SuperCoin', symbol: 'SUP' }) as TokenAPIData;
        (service as any).isLikelyScamOrRug = async () => false;

        await service.calculateUserTrustScore(testUserIdGlobalTrustScore, runtime, testWorldId);

        if (!updatedCompData) throw new Error('updateComponent was not effectively called');
        if (Math.abs(updatedCompData.trustScore - 100) > 0.01) {
          throw new Error(
            `Expected score clamped at 100, got ${updatedCompData.trustScore.toFixed(2)}`
          );
        }
        logger.info('TrustScore.Calc: Clamping at +100 - Passed');
      } finally {
        runtime.getComponent = originalGetComponent;
        runtime.updateComponent = originalUpdateComponent;
        if (originalServiceGetTokenAPIData)
          (service as any).getTokenAPIData = originalServiceGetTokenAPIData;
        else delete (service as any).getTokenAPIData;
        if (originalServiceIsLikelyScamOrRug)
          (service as any).isLikelyScamOrRug = originalServiceIsLikelyScamOrRug;
        else delete (service as any).isLikelyScamOrRug;
      }
    },
  },
  {
    name: 'TrustScore.Calc: Score clamps at -100',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const recs = [
        createRecForTrustScore(
          'superBad',
          Date.now(),
          'BUY',
          Conviction.HIGH,
          { potentialProfitPercent: -500, evaluationTimestamp: Date.now(), isScamOrRug: false },
          1
        ),
      ];
      const initialProfile: UserTrustProfile = {
        version: '1.0.0',
        userId: testUserIdGlobalTrustScore,
        trustScore: 0,
        lastTrustScoreCalculationTimestamp: 0,
        recommendations: recs,
      };
      const initialComponent = createFullMockComponentForTrustScore(
        testUserIdGlobalTrustScore,
        initialProfile,
        runtime
      );
      let updatedCompData: UserTrustProfile | null = null;
      const originalGetComponent = runtime.getComponent;
      const originalUpdateComponent = runtime.updateComponent;
      const originalServiceGetTokenAPIData = (service as any).getTokenAPIData?.bind(service);
      const originalServiceIsLikelyScamOrRug = (service as any).isLikelyScamOrRug?.bind(service);

      try {
        runtime.getComponent = async () => initialComponent;
        runtime.updateComponent = async (comp: CoreComponent) => {
          updatedCompData = comp.data as UserTrustProfile;
        };
        (service as any).getTokenAPIData = async () =>
          ({ currentPrice: 0.01, name: 'SuperBadCoin', symbol: 'SBD' }) as TokenAPIData;
        (service as any).isLikelyScamOrRug = async () => false;

        await service.calculateUserTrustScore(testUserIdGlobalTrustScore, runtime, testWorldId);

        if (!updatedCompData) throw new Error('updateComponent was not effectively called');
        if (Math.abs(updatedCompData.trustScore - -100) > 0.01) {
          throw new Error(
            `Expected score clamped at -100, got ${updatedCompData.trustScore.toFixed(2)}`
          );
        }
        logger.info('TrustScore.Calc: Clamping at -100 - Passed');
      } finally {
        runtime.getComponent = originalGetComponent;
        runtime.updateComponent = originalUpdateComponent;
        if (originalServiceGetTokenAPIData)
          (service as any).getTokenAPIData = originalServiceGetTokenAPIData;
        else delete (service as any).getTokenAPIData;
        if (originalServiceIsLikelyScamOrRug)
          (service as any).isLikelyScamOrRug = originalServiceIsLikelyScamOrRug;
        else delete (service as any).isLikelyScamOrRug;
      }
    },
  },
  {
    name: 'TrustScore.Calc: Metric re-evaluation due to interval',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const METRIC_REFRESH_INTERVAL = (service as any)['METRIC_REFRESH_INTERVAL'];
      const oldEvalTimestamp = Date.now() - METRIC_REFRESH_INTERVAL * 2;
      const recTimestamp = Date.now() - METRIC_REFRESH_INTERVAL * 3;
      const recs = [
        createRecForTrustScore(
          'needsReEval',
          recTimestamp,
          'BUY',
          Conviction.MEDIUM,
          { potentialProfitPercent: 5, evaluationTimestamp: oldEvalTimestamp, isScamOrRug: false },
          10
        ),
      ];
      const initialProfile: UserTrustProfile = {
        version: '1.0.0',
        userId: testUserIdGlobalTrustScore,
        trustScore: 0,
        recommendations: recs,
        lastTrustScoreCalculationTimestamp: 0,
      };
      const initialComponent = createFullMockComponentForTrustScore(
        testUserIdGlobalTrustScore,
        initialProfile,
        runtime
      );
      let updatedCompData: UserTrustProfile | null = null;
      let getTokenAPIDataCalledCount = 0;
      const originalGetComponent = runtime.getComponent;
      const originalUpdateComponent = runtime.updateComponent;
      const originalServiceGetTokenAPIData = (service as any).getTokenAPIData?.bind(service);
      const originalServiceIsLikelyScamOrRug = (service as any).isLikelyScamOrRug?.bind(service);

      try {
        runtime.getComponent = async () => initialComponent;
        runtime.updateComponent = async (comp: CoreComponent) => {
          updatedCompData = comp.data as UserTrustProfile;
        };
        (service as any).getTokenAPIData = async () => {
          getTokenAPIDataCalledCount++;
          return {
            currentPrice: 12,
            priceHistory: [
              { timestamp: recTimestamp, price: 10 },
              { timestamp: Date.now(), price: 12 },
            ],
            name: 'ReevalCoin',
            symbol: 'REV',
          } as TokenAPIData;
        };
        (service as any).isLikelyScamOrRug = async () => false;

        await service.calculateUserTrustScore(testUserIdGlobalTrustScore, runtime, testWorldId);

        if (!updatedCompData) throw new Error('updateComponent was not effectively called');
        if (getTokenAPIDataCalledCount === 0)
          throw new Error('getTokenAPIData was NOT called for re-eval');
        if (
          Math.abs((updatedCompData.recommendations[0].metrics?.potentialProfitPercent || 0) - 20) >
          0.01
        ) {
          throw new Error('Metric not re-evaluated correctly to 20%');
        }
        logger.info('TrustScore.Calc: Metric re-evaluation due to interval - Passed');
      } finally {
        runtime.getComponent = originalGetComponent;
        runtime.updateComponent = originalUpdateComponent;
        if (originalServiceGetTokenAPIData)
          (service as any).getTokenAPIData = originalServiceGetTokenAPIData;
        else delete (service as any).getTokenAPIData;
        if (originalServiceIsLikelyScamOrRug)
          (service as any).isLikelyScamOrRug = originalServiceIsLikelyScamOrRug;
        else delete (service as any).isLikelyScamOrRug;
      }
    },
  },
  {
    name: 'TrustScore.Calc: Fresh metric NOT re-evaluated',
    fn: async (runtime: IAgentRuntime) => {
      const service = new CommunityInvestorService(runtime);
      const METRIC_REFRESH_INTERVAL = (service as any)['METRIC_REFRESH_INTERVAL'];
      const evalTimestampWithinInterval = Date.now() - METRIC_REFRESH_INTERVAL / 2;
      const recTimestamp = Date.now() - METRIC_REFRESH_INTERVAL / 3;
      const recsFreshMetrics = [
        createRecForTrustScore(
          'freshMetrics',
          recTimestamp,
          'BUY',
          Conviction.HIGH,
          {
            potentialProfitPercent: 15,
            evaluationTimestamp: evalTimestampWithinInterval,
            isScamOrRug: false,
          },
          10
        ),
      ];
      const initialProfileFreshMetrics: UserTrustProfile = {
        version: '1.0.0',
        userId: testUserIdGlobalTrustScore,
        trustScore: 0,
        recommendations: recsFreshMetrics,
        lastTrustScoreCalculationTimestamp: 0,
      };
      const mockCompFreshMetrics = createFullMockComponentForTrustScore(
        testUserIdGlobalTrustScore,
        initialProfileFreshMetrics,
        runtime
      );
      let updatedCompData: UserTrustProfile | null = null;
      let getTokenAPIDataCalledCount = 0;
      const originalGetComponent = runtime.getComponent;
      const originalUpdateComponent = runtime.updateComponent;
      const originalServiceGetTokenAPIData = (service as any).getTokenAPIData?.bind(service);

      try {
        runtime.getComponent = async () => mockCompFreshMetrics;
        runtime.updateComponent = async (comp: CoreComponent) => {
          updatedCompData = comp.data as UserTrustProfile;
        };
        (service as any).getTokenAPIData = async () => {
          getTokenAPIDataCalledCount++;
          return {} as TokenAPIData;
        };

        await service.calculateUserTrustScore(testUserIdGlobalTrustScore, runtime, testWorldId);

        if (!updatedCompData)
          throw new Error('updateComponent was not effectively called (freshMetrics)');
        if (getTokenAPIDataCalledCount > 0)
          throw new Error('getTokenAPIData WAS called for fresh metric, but should not have been.');
        if (
          Math.abs((updatedCompData.recommendations[0].metrics?.potentialProfitPercent || 0) - 15) >
          0.01
        ) {
          throw new Error('Existing fresh metric was incorrectly changed');
        }
        logger.info('TrustScore.Calc: Fresh metric NOT re-evaluated - Passed');
      } finally {
        runtime.getComponent = originalGetComponent;
        runtime.updateComponent = originalUpdateComponent;
        if (originalServiceGetTokenAPIData)
          (service as any).getTokenAPIData = originalServiceGetTokenAPIData;
        else delete (service as any).getTokenAPIData;
      }
    },
  },
];

export const trustScoreTestSuite: TestSuite = {
  name: 'Trust Score Logic Tests (Runtime Format)',
  tests: [...recencyWeightTests, ...convictionWeightTests, ...calculateScoreLogicTests],
};
