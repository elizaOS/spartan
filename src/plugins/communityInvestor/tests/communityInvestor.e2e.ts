// Contents of the existing communityInvestor.ts, to be refactored
// For now, just a placeholder comment indicating the rename operation's intent.
// The actual content will be the refactored E2E tests.

// Placeholder: E2E tests will be defined here in ElizaOS TestRunner format.

import type {
  Component,
  HandlerCallback,
  IAgentRuntime,
  MemoryMetadata,
  MessagePayload,
  ModelTypeName,
  Task,
  TestCase,
  TestSuite,
  UUID,
} from '@elizaos/core';
import { asUUID, EventType as CoreEventType, logger } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';

import { events } from '../events';
import { CommunityInvestorService } from '../service';
import {
  Conviction,
  ServiceType,
  SupportedChain,
  type TokenAPIData,
  TRUST_MARKETPLACE_COMPONENT_TYPE,
  type UserTrustProfile,
} from '../types';

type Message = MessagePayload['message'];

// File-scoped variables to be reset by each test
let userProfileStore: Component | null = null;
let createdTaskDetails: Task | null = null;

// Helper to create a message for E2E tests
const createE2EMessage = (
  runtime: IAgentRuntime,
  text: string,
  senderId: UUID,
  worldId: UUID,
  msgId?: UUID,
  timestamp?: number
): Message =>
  ({
    id: msgId || asUUID(uuidv4()),
    entityId: senderId,
    agentId: runtime.agentId!,
    roomId: asUUID(uuidv4()), // Each E2E test might use a conceptual new room
    worldId: worldId,
    content: { text, name: 'E2ETestUser' },
    channelType: 'DISCORD',
    source: 'discord',
    reactions: [],
    createdAt: timestamp || Date.now(),
    updatedAt: timestamp || Date.now(),
    conversationId: asUUID(uuidv4()),
    channelId: 'e2e-test-channel',
    mentions: [],
    metadata: {} as MemoryMetadata,
  }) as Message;

// Helper to simulate message processing via the event handler
const simulateMessageProcessing = async (runtime: IAgentRuntime, message: Message) => {
  const messageHandler = events[CoreEventType.MESSAGE_RECEIVED]?.[0];
  if (!messageHandler) throw new Error('Message handler not defined for E2E test');
  logger.error(`[E2E DEBUG] Found message handler: ${messageHandler ? 'YES' : 'NO'}`);
  let completed = false;
  const onComplete = () => {
    completed = true;
    logger.error(`[E2E DEBUG] onComplete called`);
  };
  const callback: HandlerCallback = async (response: any) => {
    logger.error('[E2E Test] Agent callback response:', response);
    return [];
  };
  const payload: MessagePayload = { runtime, message, callback, onComplete, source: 'discord' };
  logger.error(`[E2E DEBUG] About to call message handler with message: "${message.content.text}"`);
  await messageHandler(payload);
  await new Promise((resolve) => setTimeout(resolve, 150)); // Allow more time for E2E async ops
  if (!completed)
    logger.warn(
      '[E2E Test] onComplete was not called in message handler for E2E message:',
      message.content.text
    );
  logger.error(`[E2E DEBUG] Message handler completed. onComplete called: ${completed}`);
  return completed;
};

const e2eTestCases: TestCase[] = [
  {
    name: 'E2E: Full flow - Relevant BUY message, recommendation, profile creation, task, trust score update',
    fn: async (runtime: IAgentRuntime) => {
      userProfileStore = null;
      createdTaskDetails = null;
      const testUserId = asUUID(uuidv4());
      let testWorldId: UUID;

      const originalGetWorlds = runtime.getAllWorlds;
      const originalEnsureWorld = runtime.ensureWorldExists;
      const originalGetService = runtime.getService;
      const originalGetComponent = runtime.getComponent;
      const originalCreateComponent = runtime.createComponent;
      const originalUpdateComponent = runtime.updateComponent;
      const originalDeleteComponent = runtime.deleteComponent;
      const originalGetMemories = runtime.getMemories;
      const originalCreateTask = runtime.createTask;
      const originalUseModel = runtime.useModel;
      const originalGetParticipantUserState = runtime.getParticipantUserState;

      let serviceInstance: CommunityInvestorService | null = null;
      let originalServiceResolveTicker: any;
      let originalServiceGetTokenAPIData: any;
      let originalServiceEvaluatePerf: any;
      let testComponentStore: Component | null = null; // Local to this test

      try {
        try {
          /* world setup */ const allWorlds = await originalGetWorlds.call(runtime);
          if (allWorlds && allWorlds.length > 0) testWorldId = allWorlds[0].id;
          else {
            testWorldId = asUUID(uuidv4());
            await originalEnsureWorld.call(runtime, {
              id: testWorldId,
              name: 'E2E Test World',
              agentId: runtime.agentId,
              serverId: 'e2e-test-server',
              metadata: {},
            });
          }
        } catch (error) {
          testWorldId = asUUID(uuidv4());
          await originalEnsureWorld.call(runtime, {
            id: testWorldId,
            name: 'E2E Test World Fallback',
            agentId: runtime.agentId,
            serverId: 'e2e-test-server-fallback',
            metadata: {},
          });
        }

        serviceInstance = new CommunityInvestorService(runtime);
        originalServiceResolveTicker = (serviceInstance as any).resolveTicker;
        originalServiceGetTokenAPIData = (serviceInstance as any).getTokenAPIData;
        originalServiceEvaluatePerf = (serviceInstance as any).evaluateRecommendationPerformance;

        (runtime.getService as any) = (serviceType: string) =>
          serviceType === ServiceType.COMMUNITY_INVESTOR ? serviceInstance : null;
        (runtime.getComponent as any) = async (entityId: UUID, type: string) =>
          entityId === testUserId && type === TRUST_MARKETPLACE_COMPONENT_TYPE
            ? testComponentStore
            : await originalGetComponent.call(
                runtime,
                entityId,
                type,
                testWorldId,
                runtime.agentId
              );
        (runtime.createComponent as any) = async (component: Component) => {
          if (
            component.entityId === testUserId &&
            component.type === TRUST_MARKETPLACE_COMPONENT_TYPE
          ) {
            testComponentStore = component;
            return component.id as UUID | boolean;
          }
          return await originalCreateComponent.call(runtime, component);
        };
        (runtime.updateComponent as any) = async (component: Component) => {
          if (
            component.entityId === testUserId &&
            component.type === TRUST_MARKETPLACE_COMPONENT_TYPE
          ) {
            testComponentStore = component;
            return; /* void */
          }
          await originalUpdateComponent.call(runtime, component);
        };
        (runtime.deleteComponent as any) = async (componentId: UUID) =>
          testComponentStore && testComponentStore.id === componentId
            ? ((testComponentStore = null), true)
            : await originalDeleteComponent.call(runtime, componentId);
        (runtime.getMemories as any) = async () => [];
        (runtime.createTask as any) = async (task: Task) => {
          createdTaskDetails = task;
          return task.id || asUUID(uuidv4());
        };
        (runtime.useModel as any) = async (
          modelType: ModelTypeName,
          params: { prompt: string }
        ) => {
          if (params.prompt.includes('# Task: Relevance Check'))
            return JSON.stringify({ isRelevant: true });
          if (params.prompt.includes('# Task: Extract Cryptocurrency Recommendations'))
            return JSON.stringify({
              recommendations: [
                {
                  tokenMentioned: '$GOODCOIN',
                  isTicker: true,
                  sentiment: 'positive',
                  conviction: 'HIGH',
                  quote: 'E2E: $GOODCOIN moon!',
                },
              ],
            });
          return '';
        };
        (serviceInstance.resolveTicker as any) = async (ticker: string) => ({
          address: 'GOODCOIN_ADDR',
          chain: SupportedChain.SOLANA,
          ticker: 'GOODCOIN',
        });
        (serviceInstance.getTokenAPIData as any) = async (address: string) =>
          ({
            currentPrice: 10.0,
            name: 'GoodCoinE2E',
            symbol: 'GCDE2E',
            priceHistory: [
              { timestamp: Date.now() - 1000, price: 9 },
              { timestamp: Date.now(), price: 10 },
            ],
          }) as TokenAPIData;
        (serviceInstance.evaluateRecommendationPerformance as any) = async () => ({
          evaluationTimestamp: Date.now(),
          potentialProfitPercent: 25.0,
          isScamOrRug: false,
        });
        (runtime.getParticipantUserState as any) = async () => 'ACTIVE';

        const message = createE2EMessage(
          runtime,
          'E2E: I think $GOODCOIN is going to moon, very high conviction!',
          testUserId,
          testWorldId
        );
        const messageHandler = events[CoreEventType.MESSAGE_RECEIVED]?.[0];
        if (!messageHandler) throw new Error('Message handler not defined for E2E test');
        let completed = false;
        const onComplete = () => {
          completed = true;
        };
        const callback = async () => [];
        await messageHandler({ runtime, message, callback, onComplete, source: 'discord' });
        await new Promise((resolve) => setTimeout(resolve, 150));

        const fetchedComponent = testComponentStore;
        if (!fetchedComponent)
          throw new Error('E2E: UserProfile component was not created/retrieved.');
        const profile = fetchedComponent.data as UserTrustProfile;
        if (profile.recommendations.length !== 1) throw new Error('E2E: Recommendation not added.');
        const rec = profile.recommendations[0];
        if (rec.tokenAddress !== 'GOODCOIN_ADDR' || rec.conviction !== Conviction.HIGH)
          throw new Error('E2E: Recommendation data mismatch.');
        if (!createdTaskDetails || createdTaskDetails.name !== 'PROCESS_TRADE_DECISION')
          throw new Error('E2E: PROCESS_TRADE_DECISION task not created.');
        if (
          createdTaskDetails.metadata?.recommendationId !== rec.id ||
          createdTaskDetails.metadata?.userId !== testUserId
        )
          throw new Error('E2E: Task metadata incorrect.');

        await serviceInstance.calculateUserTrustScore(testUserId, runtime, testWorldId);

        const finalFetchedComponent = testComponentStore;
        if (!finalFetchedComponent) throw new Error('E2E: UserProfile component disappeared.');
        const finalProfile = finalFetchedComponent.data as UserTrustProfile;
        if (Math.abs(finalProfile.trustScore - 25.0) > 0.01)
          throw new Error(`E2E: Expected score ~25.0, got ${finalProfile.trustScore.toFixed(2)}`);
        if (
          !finalProfile.recommendations[0].metrics ||
          finalProfile.recommendations[0].metrics.potentialProfitPercent !== 25.0
        )
          throw new Error('E2E: Rec metrics not updated.');
        logger.info('E2E: Full BUY flow and score update - Passed');
      } finally {
        runtime.getAllWorlds = originalGetWorlds;
        runtime.ensureWorldExists = originalEnsureWorld;
        runtime.getService = originalGetService;
        runtime.getComponent = originalGetComponent;
        runtime.createComponent = originalCreateComponent;
        runtime.updateComponent = originalUpdateComponent;
        runtime.deleteComponent = originalDeleteComponent;
        runtime.getMemories = originalGetMemories;
        runtime.createTask = originalCreateTask;
        runtime.useModel = originalUseModel;
        runtime.getParticipantUserState = originalGetParticipantUserState;
        if (serviceInstance) {
          (serviceInstance as any).resolveTicker = originalServiceResolveTicker;
          (serviceInstance as any).getTokenAPIData = originalServiceGetTokenAPIData;
          (serviceInstance as any).evaluateRecommendationPerformance = originalServiceEvaluatePerf;
        }
      }
    },
  },
  {
    name: 'E2E: Irrelevant message is ignored',
    fn: async (runtime: IAgentRuntime) => {
      userProfileStore = null;
      createdTaskDetails = null;
      const testUserId = asUUID(uuidv4());
      let testWorldId: UUID;
      const originalUseModel = runtime.useModel;
      const originalCreateComponent = runtime.createComponent;
      const originalGetWorlds = runtime.getAllWorlds;
      const originalEnsureWorld = runtime.ensureWorldExists;
      let createComponentCalled = false;
      try {
        try {
          const allWorlds = await originalGetWorlds.call(runtime);
          if (allWorlds && allWorlds.length > 0) testWorldId = allWorlds[0].id;
          else {
            testWorldId = asUUID(uuidv4());
            await originalEnsureWorld.call(runtime, {
              id: testWorldId,
              name: 'E2E Test World Irrelevant',
              agentId: runtime.agentId,
              serverId: 'e2e-test-server-irrelevant',
              metadata: {},
            });
          }
        } catch (error) {
          testWorldId = asUUID(uuidv4());
          await originalEnsureWorld.call(runtime, {
            id: testWorldId,
            name: 'E2E Test World Irrelevant Fallback',
            agentId: runtime.agentId,
            serverId: 'e2e-test-server-irrelevant-fallback',
            metadata: {},
          });
        }
        (runtime.useModel as any) = async (
          modelType: ModelTypeName,
          params: { prompt: string }
        ) => {
          if (params.prompt.includes('# Task: Relevance Check'))
            return JSON.stringify({ isRelevant: false });
          return '';
        };
        (runtime.createComponent as any) = async () => {
          createComponentCalled = true;
          return true;
        };
        const message = createE2EMessage(
          runtime,
          'E2E: This is not about crypto.',
          testUserId,
          testWorldId
        );
        await simulateMessageProcessing(runtime, message);
        if (createComponentCalled)
          throw new Error('E2E: Component created for irrelevant message.');
        logger.info('E2E: Irrelevant message ignored - Passed');
      } finally {
        runtime.useModel = originalUseModel;
        runtime.createComponent = originalCreateComponent;
        runtime.getAllWorlds = originalGetWorlds;
        runtime.ensureWorldExists = originalEnsureWorld;
      }
    },
  },
  {
    name: 'E2E: SELL recommendation flow and negative score impact for bad SELL',
    fn: async (runtime: IAgentRuntime) => {
      userProfileStore = null;
      createdTaskDetails = null;
      const testUserId = asUUID(uuidv4());
      let testWorldId: UUID;
      const originalGetWorlds = runtime.getAllWorlds;
      const originalEnsureWorld = runtime.ensureWorldExists;
      const originalGetService = runtime.getService;
      const originalGetComponent = runtime.getComponent;
      const originalCreateComponent = runtime.createComponent;
      const originalUpdateComponent = runtime.updateComponent;
      const originalDeleteComponent = runtime.deleteComponent;
      const originalGetMemories = runtime.getMemories;
      const originalCreateTask = runtime.createTask;
      const originalUseModel = runtime.useModel;
      const originalGetParticipantUserState = runtime.getParticipantUserState;
      let serviceInstance: CommunityInvestorService | null = null;
      let originalServiceResolveTicker: any;
      let originalServiceGetTokenAPIData: any;
      let originalServiceEvaluatePerf: any;
      let testComponentStore: Component | null = null;

      try {
        try {
          const allWorlds = await originalGetWorlds.call(runtime);
          if (allWorlds && allWorlds.length > 0) testWorldId = allWorlds[0].id;
          else {
            testWorldId = asUUID(uuidv4());
            await originalEnsureWorld.call(runtime, {
              id: testWorldId,
              name: 'E2E Test World SELL',
              agentId: runtime.agentId,
              serverId: 'e2e-test-server-sell',
              metadata: {},
            });
          }
        } catch (error) {
          testWorldId = asUUID(uuidv4());
          await originalEnsureWorld.call(runtime, {
            id: testWorldId,
            name: 'E2E Test World SELL Fallback',
            agentId: runtime.agentId,
            serverId: 'e2e-test-server-sell-fallback',
            metadata: {},
          });
        }
        serviceInstance = new CommunityInvestorService(runtime);
        originalServiceResolveTicker = (serviceInstance as any).resolveTicker;
        originalServiceGetTokenAPIData = (serviceInstance as any).getTokenAPIData;
        originalServiceEvaluatePerf = (serviceInstance as any).evaluateRecommendationPerformance;

        (runtime.getService as any) = (serviceType: string) =>
          serviceType === ServiceType.COMMUNITY_INVESTOR ? serviceInstance : null;
        (runtime.getComponent as any) = async (entityId: UUID, type: string) =>
          entityId === testUserId && type === TRUST_MARKETPLACE_COMPONENT_TYPE
            ? testComponentStore
            : await originalGetComponent.call(
                runtime,
                entityId,
                type,
                testWorldId,
                runtime.agentId
              );
        (runtime.createComponent as any) = async (component: Component) => {
          if (
            component.entityId === testUserId &&
            component.type === TRUST_MARKETPLACE_COMPONENT_TYPE
          ) {
            testComponentStore = component;
            return component.id as UUID | boolean;
          }
          return await originalCreateComponent.call(runtime, component);
        };
        (runtime.updateComponent as any) = async (component: Component) => {
          if (
            component.entityId === testUserId &&
            component.type === TRUST_MARKETPLACE_COMPONENT_TYPE
          ) {
            testComponentStore = component;
            return; /* void */
          }
          await originalUpdateComponent.call(runtime, component);
        };
        (runtime.deleteComponent as any) = async (componentId: UUID) =>
          testComponentStore && testComponentStore.id === componentId
            ? ((testComponentStore = null), true)
            : await originalDeleteComponent.call(runtime, componentId);
        (runtime.getMemories as any) = async () => [];
        (runtime.createTask as any) = async (task: Task) => {
          createdTaskDetails = task;
          return task.id || asUUID(uuidv4());
        };
        (runtime.useModel as any) = async (
          modelType: ModelTypeName,
          params: { prompt: string }
        ) => {
          if (params.prompt.includes('# Task: Relevance Check'))
            return JSON.stringify({ isRelevant: true });
          if (params.prompt.includes('# Task: Extract Cryptocurrency Recommendations'))
            return JSON.stringify({
              recommendations: [
                {
                  tokenMentioned: '$BADSELL',
                  isTicker: true,
                  sentiment: 'negative',
                  conviction: 'MEDIUM',
                  quote: 'E2E: Sell $BADSELL now!',
                },
              ],
            });
          return '';
        };
        (serviceInstance.resolveTicker as any) = async (ticker: string) => ({
          address: 'BADSELL_ADDR',
          chain: SupportedChain.SOLANA,
          ticker: 'BADSELL',
        });
        (serviceInstance.getTokenAPIData as any) = async (address: string) =>
          ({
            currentPrice: 50.0,
            name: 'BadSellCoin',
            symbol: 'BADSELL',
            priceHistory: [
              { timestamp: Date.now() - 1000, price: 25 },
              { timestamp: Date.now(), price: 50 },
            ],
          }) as TokenAPIData;
        (serviceInstance.evaluateRecommendationPerformance as any) = async () => ({
          evaluationTimestamp: Date.now(),
          avoidedLossPercent: -100.0,
          isScamOrRug: false,
        });
        (runtime.getParticipantUserState as any) = async () => 'ACTIVE';

        const message = createE2EMessage(
          runtime,
          'E2E: Sell $BADSELL now, it is crashing!',
          testUserId,
          testWorldId
        );
        const messageHandler = events[CoreEventType.MESSAGE_RECEIVED]?.[0];
        if (!messageHandler) throw new Error('Message handler not defined for E2E test');
        let completed = false;
        const onComplete = () => {
          completed = true;
        };
        const callback = async () => [];
        await messageHandler({ runtime, message, callback, onComplete, source: 'discord' });
        await new Promise((resolve) => setTimeout(resolve, 150));

        const fetchedComponentBeforeScore = testComponentStore;
        if (!fetchedComponentBeforeScore)
          throw new Error('E2E: UserProfile component was not created for SELL rec.');
        const profileBeforeScore = fetchedComponentBeforeScore.data as UserTrustProfile;
        if (profileBeforeScore.recommendations.length === 0)
          throw new Error('E2E: SELL recommendation was not added.');
        if (profileBeforeScore.recommendations[0].recommendationType !== 'SELL')
          throw new Error(
            `E2E: Expected SELL, got ${profileBeforeScore.recommendations[0].recommendationType}`
          );

        await serviceInstance.calculateUserTrustScore(testUserId, runtime, testWorldId);

        const fetchedComponentAfterScore = testComponentStore;
        if (!fetchedComponentAfterScore) throw new Error('E2E: UserProfile component disappeared.');
        const profileAfterScore = fetchedComponentAfterScore.data as UserTrustProfile;
        if (
          profileAfterScore.recommendations.length !== 1 ||
          profileAfterScore.recommendations[0].recommendationType !== 'SELL'
        )
          throw new Error('E2E: SELL rec not preserved.');
        if (Math.abs(profileAfterScore.trustScore - -100.0) > 0.01)
          throw new Error(
            `E2E: Expected score ~-100 for bad SELL, got ${profileAfterScore.trustScore}`
          );
        logger.info('E2E: SELL recommendation (bad call) correctly impacts score - Passed');
      } finally {
        runtime.getAllWorlds = originalGetWorlds;
        runtime.ensureWorldExists = originalEnsureWorld;
        runtime.getService = originalGetService;
        runtime.getComponent = originalGetComponent;
        runtime.createComponent = originalCreateComponent;
        runtime.updateComponent = originalUpdateComponent;
        runtime.deleteComponent = originalDeleteComponent;
        runtime.getMemories = originalGetMemories;
        runtime.createTask = originalCreateTask;
        runtime.useModel = originalUseModel;
        runtime.getParticipantUserState = originalGetParticipantUserState;
        if (serviceInstance) {
          (serviceInstance as any).resolveTicker = originalServiceResolveTicker;
          (serviceInstance as any).getTokenAPIData = originalServiceGetTokenAPIData;
          (serviceInstance as any).evaluateRecommendationPerformance = originalServiceEvaluatePerf;
        }
      }
    },
  },
  // TODO: Add more E2E TestCases:
  // - User with existing profile makes another recommendation (profile update, score averaging)
  // - Duplicate recommendation within cooldown (should be logged and skipped by handler)
  // - Critical service call failure (e.g., resolveTicker fails) - how handler copes.
];

export const communityInvestorE2ETestSuite: TestSuite = {
  name: 'CommunityInvestor Plugin E2E Tests (ElizaOS Runner Format)',
  tests: e2eTestCases,
};
