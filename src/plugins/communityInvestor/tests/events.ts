// Unit tests for event handlers (e.g., messageReceivedHandler)

import type {
  Component,
  HandlerCallback,
  IAgentRuntime,
  MemoryMetadata,
  MessagePayload,
  ModelTypeName,
  Service,
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
  type Recommendation,
  ServiceType,
  SupportedChain,
  type TokenAPIData,
  TRUST_MARKETPLACE_COMPONENT_TYPE,
  type UserTrustProfile,
} from '../types';

type Message = MessagePayload['message'];

const testUserIdGlobalEvents = asUUID(uuidv4());
const testRoomIdGlobalEvents = asUUID(uuidv4());
const testWorldIdGlobalEvents = asUUID(uuidv4());

const createMockMessageForEventsTest = (
  text: string,
  senderId: UUID,
  agentId: UUID,
  worldIdToUse: UUID,
  msgId?: UUID,
  timestamp?: number
): Message =>
  ({
    id: msgId || asUUID(uuidv4()),
    entityId: senderId,
    agentId: agentId,
    roomId: testRoomIdGlobalEvents,
    worldId: worldIdToUse,
    content: { text, name: 'TestUser' },
    channelType: 'DISCORD',
    source: 'discord',
    reactions: [],
    createdAt: timestamp || Date.now(),
    updatedAt: timestamp || Date.now(),
    conversationId: asUUID(uuidv4()),
    channelId: 'test-channel-id',
    mentions: [],
    metadata: {} as MemoryMetadata,
  }) as Message;

const callMessageHandlerForEventsTest = async (message: Message, runtime: IAgentRuntime) => {
  const messageHandler = events[CoreEventType.MESSAGE_RECEIVED]?.[0];
  if (!messageHandler)
    throw new Error('Message handler not defined for EventType.MESSAGE_RECEIVED');
  let completed = false;
  const onComplete = () => {
    completed = true;
  };
  let callbackResponse: any = null;
  const callback: HandlerCallback = async (response: any) => {
    callbackResponse = response;
    return [];
  };
  const payload: MessagePayload = { runtime, message, callback, onComplete, source: 'discord' };
  await messageHandler(payload);
  await new Promise((resolve) => setTimeout(resolve, 50));
  return { callbackResponse, completed };
};

const eventHandlerTestCases: TestCase[] = [
  {
    name: 'EventHandler: Ignores messages from the agent itself',
    fn: async (runtime: IAgentRuntime) => {
      const originalUseModel = runtime.useModel;
      let useModelCalled = false;
      try {
        (runtime.useModel as any) = async () => {
          useModelCalled = true;
          return '';
        };
        const selfMessage = createMockMessageForEventsTest(
          'Hello from myself',
          runtime.agentId!,
          runtime.agentId!,
          testWorldIdGlobalEvents
        );
        const { completed } = await callMessageHandlerForEventsTest(selfMessage, runtime);
        if (!completed) throw new Error('onComplete was not called for self-message.');
        if (useModelCalled) throw new Error('useModel was called for agent self-message');
        logger.info('EventHandler: Ignores self-messages - Passed');
      } finally {
        runtime.useModel = originalUseModel;
      }
    },
  },
  {
    name: 'EventHandler: Ignores irrelevant messages via LLM check',
    fn: async (runtime: IAgentRuntime) => {
      const originalUseModel = runtime.useModel;
      let relevanceCheckPromptReceived = false;
      let extractionPromptReceived = false;
      try {
        (runtime.useModel as any) = async (
          modelType: ModelTypeName,
          params: { prompt: string }
        ) => {
          const promptContent = params.prompt;
          if (promptContent.includes('# Task: Relevance Check')) {
            relevanceCheckPromptReceived = true;
            return JSON.stringify({ isRelevant: false, reason: 'Not crypto related' });
          }
          extractionPromptReceived = true;
          return JSON.stringify({ recommendations: [] });
        };
        const irrelevantMessage = createMockMessageForEventsTest(
          'What is the weather today?',
          testUserIdGlobalEvents,
          runtime.agentId!,
          testWorldIdGlobalEvents
        );
        const { completed } = await callMessageHandlerForEventsTest(irrelevantMessage, runtime);
        if (!completed) throw new Error('onComplete was not called for irrelevant message.');
        if (!relevanceCheckPromptReceived)
          throw new Error('useModel was not called for relevance check.');
        if (extractionPromptReceived)
          throw new Error(
            'useModel was incorrectly called for extraction for an irrelevant message.'
          );
        logger.info('EventHandler: Ignores irrelevant messages - Passed');
      } finally {
        runtime.useModel = originalUseModel;
      }
    },
  },
  {
    name: 'EventHandler: Processes BUY recommendation, creates profile & task',
    fn: async (runtime: IAgentRuntime) => {
      let useModelCallCount = 0;
      let createdComponentData: UserTrustProfile | undefined;
      let createdTaskInfo: any;
      let serviceCallTracker = { resolveTicker: 0, getTokenAPIData: 0 };

      const originalUseModel = runtime.useModel;
      const originalGetService = runtime.getService;
      const originalGetComponent = runtime.getComponent;
      const originalCreateComponent = runtime.createComponent;
      const originalCreateTask = runtime.createTask;

      try {
        (runtime.useModel as any) = async (
          modelType: ModelTypeName,
          params: { prompt: string }
        ) => {
          useModelCallCount++;
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
                  quote: '$GOODCOIN to the moon!',
                },
              ],
            });
          return '';
        };
        const mockService = {
          resolveTicker: async () => {
            serviceCallTracker.resolveTicker++;
            return { address: 'GOODCOIN_ADDR', chain: SupportedChain.SOLANA, ticker: 'GOODCOIN' };
          },
          getTokenAPIData: async () => {
            serviceCallTracker.getTokenAPIData++;
            return { currentPrice: 50.0, name: 'Good Coin', symbol: 'GOODCOIN' } as TokenAPIData;
          },
        } as Partial<CommunityInvestorService>;
        (runtime.getService as any) = <T extends Service>(st: string): T | null =>
          st === ServiceType.COMMUNITY_INVESTOR ? (mockService as T) : null;
        (runtime.getComponent as any) = async () => null;
        (runtime.createComponent as any) = async (comp: Component) => {
          createdComponentData = comp.data as UserTrustProfile;
          return comp.id as UUID | boolean;
        };
        (runtime.createTask as any) = async (task: Task) => {
          createdTaskInfo = task;
          return task.id || asUUID(uuidv4());
        };

        const buyMessage = createMockMessageForEventsTest(
          '$GOODCOIN to the moon!',
          testUserIdGlobalEvents,
          runtime.agentId!,
          testWorldIdGlobalEvents
        );
        await callMessageHandlerForEventsTest(buyMessage, runtime);

        if (useModelCallCount !== 2)
          throw new Error(`useModel call count mismatch, expected 2, got ${useModelCallCount}`);
        if (serviceCallTracker.resolveTicker !== 1)
          throw new Error('service.resolveTicker not called once');
        if (serviceCallTracker.getTokenAPIData !== 1)
          throw new Error('service.getTokenAPIData not called once');
        if (!createdComponentData) throw new Error('User profile component not created');
        if (createdComponentData.recommendations.length !== 1)
          throw new Error('Recommendation not added to profile');
        const rec = createdComponentData.recommendations[0];
        if (
          rec.tokenAddress !== 'GOODCOIN_ADDR' ||
          rec.recommendationType !== 'BUY' ||
          rec.priceAtRecommendation !== 50.0
        ) {
          throw new Error(`Recommendation data mismatch: ${JSON.stringify(rec)}`);
        }
        if (!createdTaskInfo || createdTaskInfo.name !== 'PROCESS_TRADE_DECISION')
          throw new Error('Trade decision task not created or name mismatch');
        if (createdTaskInfo.metadata?.userId !== testUserIdGlobalEvents)
          throw new Error('Task metadata userId mismatch');
        logger.info('EventHandler: Processes BUY recommendation - Passed');
      } finally {
        runtime.useModel = originalUseModel;
        runtime.getService = originalGetService;
        runtime.getComponent = originalGetComponent;
        runtime.createComponent = originalCreateComponent;
        runtime.createTask = originalCreateTask;
      }
    },
  },
  {
    name: 'EventHandler: Updates existing user profile with new recommendation',
    fn: async (runtime: IAgentRuntime) => {
      const existingRec: Recommendation = {
        id: asUUID(uuidv4()),
        userId: testUserIdGlobalEvents,
        messageId: asUUID(uuidv4()),
        timestamp: Date.now() - 86400000 * 2,
        tokenAddress: 'OLD_TOKEN',
        chain: SupportedChain.SOLANA,
        recommendationType: 'BUY',
        conviction: Conviction.LOW,
        rawMessageQuote: 'Old rec',
        priceAtRecommendation: 1.0,
        processedForTradeDecision: false,
      };
      const initialProfile: UserTrustProfile = {
        version: '1.0.0',
        userId: testUserIdGlobalEvents,
        trustScore: 10,
        lastTrustScoreCalculationTimestamp: Date.now() - 86400000,
        recommendations: [existingRec],
      };
      const existingComponent = createMockCoreComponentForEvents(
        testUserIdGlobalEvents,
        initialProfile,
        runtime
      );
      let updatedComponentData: UserTrustProfile | undefined;

      const originalUseModel = runtime.useModel;
      const originalGetService = runtime.getService;
      const originalGetComponent = runtime.getComponent;
      const originalUpdateComponent = runtime.updateComponent;
      const originalCreateTask = runtime.createTask;
      try {
        (runtime.getComponent as any) = async () => existingComponent;
        (runtime.updateComponent as any) = async (comp: Component) => {
          updatedComponentData = comp.data as UserTrustProfile; /* Returns Promise<void> */
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
                  tokenMentioned: '$NEWSELL',
                  isTicker: true,
                  sentiment: 'negative',
                  conviction: 'MEDIUM',
                  quote: '$NEWSELL looks bearish',
                },
              ],
            });
          return '';
        };
        const mockService = {
          resolveTicker: async () => ({
            address: 'NEWSELL_ADDR',
            chain: SupportedChain.SOLANA,
            ticker: 'NEWSELL',
          }),
          getTokenAPIData: async () => ({ currentPrice: 20.0 }) as TokenAPIData,
        } as Partial<CommunityInvestorService>;
        (runtime.getService as any) = <T extends Service>(serviceType: string): T | null =>
          serviceType === ServiceType.COMMUNITY_INVESTOR ? (mockService as unknown as T) : null;
        (runtime.createTask as any) = async () => asUUID(uuidv4());

        const sellMessage = createMockMessageForEventsTest(
          '$NEWSELL looks bearish',
          testUserIdGlobalEvents,
          runtime.agentId!,
          testWorldIdGlobalEvents
        );
        await callMessageHandlerForEventsTest(sellMessage, runtime);

        if (!updatedComponentData) throw new Error('User profile component not updated');
        if (updatedComponentData.recommendations.length !== 2)
          throw new Error('New recommendation not added to existing profile');
        const newRec = updatedComponentData.recommendations[0];
        if (newRec.tokenAddress !== 'NEWSELL_ADDR' || newRec.recommendationType !== 'SELL')
          throw new Error('New SELL rec data mismatch');
        logger.info('EventHandler: Updates existing profile - Passed');
      } finally {
        runtime.useModel = originalUseModel;
        runtime.getService = originalGetService;
        runtime.getComponent = originalGetComponent;
        runtime.updateComponent = originalUpdateComponent;
        runtime.createTask = originalCreateTask;
      }
    },
  },
  {
    name: 'EventHandler: Skips duplicate recommendation within timeframe',
    fn: async (runtime: IAgentRuntime) => {
      const recentTimestamp = Date.now() - 10 * 60 * 1000;
      const existingRec: Recommendation = {
        id: asUUID(uuidv4()),
        userId: testUserIdGlobalEvents,
        messageId: asUUID(uuidv4()),
        timestamp: recentTimestamp,
        tokenAddress: 'DUP_TOKEN_ADDR',
        chain: SupportedChain.SOLANA,
        recommendationType: 'BUY',
        conviction: Conviction.HIGH,
        rawMessageQuote: 'Buy $DUP!',
        priceAtRecommendation: 5.0,
        processedForTradeDecision: false,
      };
      const initialProfile: UserTrustProfile = {
        version: '1.0.0',
        userId: testUserIdGlobalEvents,
        trustScore: 5,
        recommendations: [existingRec],
        lastTrustScoreCalculationTimestamp: Date.now(),
      };
      const existingComponent = createMockCoreComponentForEvents(
        testUserIdGlobalEvents,
        initialProfile,
        runtime
      );

      const originalUseModel = runtime.useModel;
      const originalGetService = runtime.getService;
      const originalGetComponent = runtime.getComponent;
      const originalUpdateComponent = runtime.updateComponent;
      const originalCreateTask = runtime.createTask;
      let updateComponentCalled = false; // Declared locally
      let createTaskCalled = false; // Declared locally

      try {
        (runtime.getComponent as any) = async () => existingComponent;
        (runtime.updateComponent as any) = async () => {
          updateComponentCalled = true;
        }; // Correctly void
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
                  tokenMentioned: '$DUP',
                  isTicker: true,
                  sentiment: 'positive',
                  conviction: 'HIGH',
                  quote: 'Buy $DUP again!',
                },
              ],
            });
          return '';
        };
        const mockService = {
          resolveTicker: async () => ({
            address: 'DUP_TOKEN_ADDR',
            chain: SupportedChain.SOLANA,
            ticker: 'DUP',
          }),
          getTokenAPIData: async () => ({ currentPrice: 5.1 }) as TokenAPIData,
        } as Partial<CommunityInvestorService>;
        (runtime.getService as any) = <T extends Service>(serviceType: string): T | null =>
          serviceType === ServiceType.COMMUNITY_INVESTOR ? (mockService as unknown as T) : null;
        (runtime.createTask as any) = async () => {
          createTaskCalled = true;
          return asUUID(uuidv4());
        };

        const dupMessage = createMockMessageForEventsTest(
          'Buy $DUP again!',
          testUserIdGlobalEvents,
          runtime.agentId!,
          testWorldIdGlobalEvents,
          undefined,
          Date.now() - 5 * 60 * 1000
        );
        await callMessageHandlerForEventsTest(dupMessage, runtime);

        if (updateComponentCalled)
          throw new Error('updateComponent was called for a duplicate recommendation.');
        if (createTaskCalled)
          throw new Error('createTask was called for a duplicate recommendation.');
        logger.info('EventHandler: Skips duplicate recommendation - Passed');
      } finally {
        runtime.useModel = originalUseModel;
        runtime.getService = originalGetService;
        runtime.getComponent = originalGetComponent;
        runtime.updateComponent = originalUpdateComponent;
        runtime.createTask = originalCreateTask;
      }
    },
  },
  {
    name: 'EventHandler: Ignores message if token resolution fails',
    fn: async (runtime: IAgentRuntime) => {
      const originalUseModel = runtime.useModel;
      const originalGetService = runtime.getService;
      const originalCreateTask = runtime.createTask;
      let createTaskCalled = false; // Declared locally

      try {
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
                  tokenMentioned: '$FAILRES',
                  isTicker: true,
                  sentiment: 'positive',
                  conviction: 'HIGH',
                  quote: 'Test $FAILRES',
                },
              ],
            });
          return '';
        };
        const mockService = {
          resolveTicker: async () => null,
        } as Partial<CommunityInvestorService>;
        (runtime.getService as any) = <T extends Service>(st: string): T | null =>
          st === ServiceType.COMMUNITY_INVESTOR ? (mockService as T) : null;
        (runtime.createTask as any) = async () => {
          createTaskCalled = true;
          return asUUID(uuidv4());
        }; // createTask returns UUID

        const msg = createMockMessageForEventsTest(
          'Test $FAILRES',
          testUserIdGlobalEvents,
          runtime.agentId!,
          testWorldIdGlobalEvents
        );
        await callMessageHandlerForEventsTest(msg, runtime);
        if (createTaskCalled) throw new Error('Task created despite token resolution failure.');
        logger.info('EventHandler: Ignores on token resolution failure - Passed');
      } finally {
        runtime.useModel = originalUseModel;
        runtime.getService = originalGetService;
        runtime.createTask = originalCreateTask;
      }
    },
  },
  {
    name: 'EventHandler: Ignores message if LLM extracts no actionable recommendation',
    fn: async (runtime: IAgentRuntime) => {
      const originalUseModel = runtime.useModel;
      const originalGetService = runtime.getService;
      let serviceCalled = false; // Declared locally
      try {
        (runtime.useModel as any) = async (
          modelType: ModelTypeName,
          params: { prompt: string }
        ) => {
          if (params.prompt.includes('# Task: Relevance Check'))
            return JSON.stringify({ isRelevant: true });
          if (params.prompt.includes('# Task: Extract Cryptocurrency Recommendations'))
            return JSON.stringify({ recommendations: [] });
          return '';
        };
        const mockService = {
          resolveTicker: async () => {
            serviceCalled = true;
            return null;
          },
        } as Partial<CommunityInvestorService>;
        (runtime.getService as any) = <T extends Service>(st: string): T | null =>
          st === ServiceType.COMMUNITY_INVESTOR ? (mockService as T) : null;

        const msg = createMockMessageForEventsTest(
          'Just chatting about crypto generally',
          testUserIdGlobalEvents,
          runtime.agentId!,
          testWorldIdGlobalEvents
        );
        await callMessageHandlerForEventsTest(msg, runtime);
        if (serviceCalled)
          throw new Error(
            'Service methods called when no actionable recommendation was extracted.'
          );
        logger.info('EventHandler: No actionable recs from LLM - Passed');
      } finally {
        runtime.useModel = originalUseModel;
        runtime.getService = originalGetService;
      }
    },
  },
  {
    name: 'EventHandler: Ignores message from muted agent (not mentioned)',
    fn: async (runtime: IAgentRuntime) => {
      const originalGetParticipantUserState = runtime.getParticipantUserState;
      const originalUseModel = runtime.useModel;
      let useModelCalled = false; // Declared locally
      try {
        (runtime.getParticipantUserState as any) = async () => 'MUTED';
        (runtime.useModel as any) = async () => {
          useModelCalled = true;
          return '';
        };

        const msg = createMockMessageForEventsTest(
          'A muted message',
          testUserIdGlobalEvents,
          runtime.agentId!,
          testWorldIdGlobalEvents
        );
        await callMessageHandlerForEventsTest(msg, runtime);

        if (useModelCalled) throw new Error('useModel called for muted, unmentioned agent.');
        logger.info('EventHandler: Muted unmentioned agent ignored - Passed');
      } finally {
        runtime.getParticipantUserState = originalGetParticipantUserState;
        runtime.useModel = originalUseModel;
      }
    },
  },
  {
    name: 'EventHandler: Processes message from muted agent IF MENTIONED',
    fn: async (runtime: IAgentRuntime) => {
      const originalGetParticipantUserState = runtime.getParticipantUserState;
      const originalCharacter = runtime.character;
      const originalUseModel = runtime.useModel;
      let relevanceModelCalled = false; // Declared locally
      try {
        (runtime.getParticipantUserState as any) = async () => 'MUTED';
        (runtime.character as any) = { ...runtime.character, name: 'TestAgentEvents' };
        (runtime.useModel as any) = async (
          modelType: ModelTypeName,
          params: { prompt: string }
        ) => {
          if (params.prompt.includes('# Task: Relevance Check')) {
            relevanceModelCalled = true;
            return JSON.stringify({ isRelevant: true });
          }
          if (params.prompt.includes('# Task: Extract Cryptocurrency Recommendations')) {
            return JSON.stringify({ recommendations: [] });
          }
          return '';
        };

        const msg = createMockMessageForEventsTest(
          'Hey @TestAgentEvents check this $coin',
          testUserIdGlobalEvents,
          runtime.agentId!,
          testWorldIdGlobalEvents
        );
        await callMessageHandlerForEventsTest(msg, runtime);

        if (!relevanceModelCalled)
          throw new Error('Relevance check not called for muted but mentioned agent.');
        logger.info('EventHandler: Muted but mentioned agent processed - Passed');
      } finally {
        runtime.getParticipantUserState = originalGetParticipantUserState;
        runtime.character = originalCharacter;
        runtime.useModel = originalUseModel;
      }
    },
  },
];

// Helper for creating components in event tests
const createMockCoreComponentForEvents = (
  userId: UUID,
  profileData: UserTrustProfile,
  runtime: IAgentRuntime
): Component => ({
  id: asUUID(uuidv4()),
  entityId: userId,
  agentId: runtime.agentId!,
  worldId: runtime.agentId!,
  roomId: testRoomIdGlobalEvents,
  sourceEntityId: runtime.agentId!,
  type: TRUST_MARKETPLACE_COMPONENT_TYPE,
  createdAt: Date.now(),
  data: profileData,
});

export const eventsTestSuite: TestSuite = {
  name: 'Community Investor Event Handler Tests (ElizaOS Runner Format)',
  tests: eventHandlerTestCases,
};
