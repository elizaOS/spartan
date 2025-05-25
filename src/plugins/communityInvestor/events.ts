// TODO: REWRITE THIS EVENT HANDLER FOR TRUST MARKETPLACE

import {
  asUUID,
  ChannelType,
  composePromptFromState,
  Content,
  createUniqueUuid,
  EventType,
  logger,
  Memory,
  messageHandlerTemplate,
  MessageReceivedHandlerParams,
  ModelType,
  parseJSONObjectFromText,
  shouldRespondTemplate,
  truncateToCompleteSentence,
  type MessagePayload,
  type IAgentRuntime,
  type UUID as CoreUUID,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { CommunityInvestorService } from './service';
import {
  ServiceType,
  type Recommendation,
  type UserTrustProfile,
  TRUST_MARKETPLACE_COMPONENT_TYPE,
  SupportedChain,
  type TrustMarketplaceComponentData,
  type TokenAPIData,
} from './types';

const RELEVANCE_CHECK_TEMPLATE = `
# Task: Relevance Check
Given the current message and recent conversation context, determine if the message is relevant to cryptocurrency discussions.
This includes topics like token mentions, trading, market sentiment, buy/sell signals, DeFi, NFTs, or financial advice related to crypto.

# Conversation Context
Current Message Sender: {{senderName}}
Current Message: "{{currentMessageText}}"

Recent Messages (if any):
{{recentMessagesContext}}

# Instructions
Respond with a JSON object with two keys: "isRelevant" (boolean) and "reason" (string, a brief explanation for your decision).
Focus SOLELY on relevance to crypto. Do not analyze for recommendations yet.

Example Output for relevant message:
\`\`\`json
{
  "isRelevant": true,
  "reason": "The message discusses price predictions for $ETH."
}
\`\`\`

Example Output for irrelevant message:
\`\`\`json
{
  "isRelevant": false,
  "reason": "The message is about weekend plans."
}
\`\`\`

# Your Analysis (Respond with JSON only):
`;

const RECOMMENDATION_EXTRACTION_TEMPLATE = `
# Task: Extract Cryptocurrency Recommendations
Analyze the user's message to identify any explicit or strongly implied recommendations to buy or sell a cryptocurrency token, or strong criticisms.

# User Message
Sender: {{senderName}}
Message: "{{messageText}}"

# Instructions
If the message contains a recommendation or strong criticism:
1. Identify the token mentioned (ticker like $SOL or contract address). If a contract address, make sure it looks like one (e.g. long alphanumeric string).
2. Determine if the mention is a ticker (true/false).
3. Determine the sentiment: 'positive' (buy, pump, moon, good investment), 'negative' (sell, dump, scam, bad investment), or 'neutral' (general discussion without clear buy/sell intent).
4. Estimate the sender's conviction: 'NONE', 'LOW', 'MEDIUM', 'HIGH'.
5. Extract the direct quote from the message that forms the basis of the recommendation/criticism.

Output a JSON object: \`{"recommendations": [{"tokenMentioned": "string", "isTicker": boolean, "sentiment": "string", "conviction": "string", "quote": "string"}]}\`. 
If no new, clear recommendation or strong criticism is found, output \`{"recommendations": []}\`
Focus only on actionable recommendations or strong criticisms, not general token mentions without sentiment or conviction.

# Your Analysis (Respond with JSON only):
`;

const MAX_RECENT_MESSAGES_FOR_CONTEXT = 5;
const MAX_RECOMMENDATIONS_IN_PROFILE = 50;
const DEFAULT_CHAIN = SupportedChain.SOLANA;
const RECENT_REC_DUPLICATION_TIMEFRAME_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Handles incoming messages and generates responses based on the provided runtime and message information.
 *
 * @param {MessageReceivedHandlerParams} params - The parameters needed for message handling, including runtime, message, and callback.
 * @returns {Promise<void>} - A promise that resolves once the message handling and response generation is complete.
 */
const messageReceivedHandler = async ({
  runtime,
  message,
  callback,
  onComplete,
}: MessageReceivedHandlerParams): Promise<void> => {
  const {
    entityId: currentMessageSenderId,
    roomId,
    id: messageId,
    content,
    createdAt,
    worldId: msgWorldId,
  } = message;
  const agentId = runtime.agentId;
  // Use the worldId from the message if available, otherwise fallback to agentId as a placeholder for global components
  const componentWorldId = msgWorldId || (runtime.agentId as CoreUUID);

  // Ensure the world exists before creating components
  try {
    await runtime.ensureWorldExists({
      id: componentWorldId,
      name: `Community Investor World ${componentWorldId}`,
      agentId: runtime.agentId,
      serverId: 'community-investor',
      metadata: {},
    });
  } catch (error) {
    logger.debug(
      `[CommunityInvestor] World ${componentWorldId} already exists or error ensuring world: ${error}`
    );
  }

  try {
    logger.debug(
      `[CommunityInvestor] Message from ${currentMessageSenderId} in room ${roomId}. Text: "${content.text?.substring(0, 50)}..."`
    );

    if (currentMessageSenderId === agentId) {
      logger.debug('[CommunityInvestor] Skipping self-message.');
      return;
    }

    const agentUserState = await runtime.getParticipantUserState(roomId, agentId);
    if (
      agentUserState === 'MUTED' &&
      !content.text?.toLowerCase().includes(runtime.character.name.toLowerCase())
    ) {
      logger.debug('[CommunityInvestor] Agent muted and not mentioned. Ignoring.');
      return;
    }

    const recentMessagesForContext = await runtime.getMemories({
      tableName: 'messages',
      roomId,
      count: MAX_RECENT_MESSAGES_FOR_CONTEXT,
      unique: false,
    });
    const recentMessagesContextString = recentMessagesForContext
      .map((msg) => `${msg.content?.name || msg.entityId.toString()}: ${msg.content?.text || ''}`)
      .join('\n');

    let relevancePrompt = RELEVANCE_CHECK_TEMPLATE.replace(
      '{{senderName}}',
      String(content.name || currentMessageSenderId.toString())
    )
      .replace('{{currentMessageText}}', String(content.text || ''))
      .replace('{{recentMessagesContext}}', recentMessagesContextString);
    relevancePrompt += '\n\`\`\`json\n';

    // logger.debug(`[CommunityInvestor Handler] Relevance prompt being sent to useModel:\n${relevancePrompt}`);

    const relevanceResponseRaw = await runtime.useModel(ModelType.TEXT_SMALL, {
      prompt: relevancePrompt,
    });
    logger.debug(
      `[HANDLER DEBUG] relevanceResponseRaw: '${relevanceResponseRaw}' (type: ${typeof relevanceResponseRaw})`
    ); // Changed to error for visibility

    const relevanceResult = parseJSONObjectFromText(relevanceResponseRaw);

    logger.debug(
      `[HANDLER DEBUG] Parsed relevanceResult: ${JSON.stringify(relevanceResult)} (type: ${typeof relevanceResult})`
    ); // Changed to error

    let isActuallyRelevant = false; // Default to false
    if (relevanceResult && relevanceResult.hasOwnProperty('isRelevant')) {
      if (typeof relevanceResult.isRelevant === 'boolean') {
        isActuallyRelevant = relevanceResult.isRelevant;
      } else if (typeof relevanceResult.isRelevant === 'string') {
        isActuallyRelevant = relevanceResult.isRelevant.toLowerCase() === 'true';
      }
    }
    logger.debug(`[HANDLER DEBUG] isActuallyRelevant determined as: ${isActuallyRelevant}`); // Changed to error

    if (!isActuallyRelevant) {
      logger.info(
        `[CommunityInvestor] Message determined NOT relevant. Reason: ${relevanceResult?.reason || 'N/A'}. Returning.`
      ); // Changed from error to info
      onComplete?.();
      return;
    }

    logger.debug(`[CommunityInvestor] Message IS RELEVANT. Proceeding to extraction.`); // Changed to error

    let extractionPrompt = RECOMMENDATION_EXTRACTION_TEMPLATE.replace(
      '{{senderName}}',
      String(content.name || currentMessageSenderId.toString())
    ).replace('{{messageText}}', String(content.text || ''));
    extractionPrompt += '\n\`\`\`json\n';

    const extractionResponseRaw = await runtime.useModel(ModelType.TEXT_LARGE, {
      prompt: extractionPrompt,
    });
    type ExtractedRec = {
      tokenMentioned: string;
      isTicker: boolean;
      sentiment: 'positive' | 'negative' | 'neutral';
      conviction: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
      quote: string;
    };
    const extractionResult = parseJSONObjectFromText(extractionResponseRaw) as {
      recommendations: ExtractedRec[];
    } | null;

    if (!extractionResult?.recommendations || extractionResult.recommendations.length === 0) {
      logger.debug('[CommunityInvestor] No recommendations extracted.');
      return;
    }

    const communityInvestorService = runtime.getService<CommunityInvestorService>(
      ServiceType.COMMUNITY_INVESTOR
    );
    if (!communityInvestorService) {
      logger.error('[CommunityInvestor] Service not found!');
      return;
    }

    let userProfileComponent = await runtime.getComponent(
      currentMessageSenderId,
      TRUST_MARKETPLACE_COMPONENT_TYPE,
      componentWorldId,
      agentId
    );
    let userProfile: UserTrustProfile;

    if (!userProfileComponent?.data) {
      userProfile = {
        version: '1.0.0',
        userId: currentMessageSenderId,
        trustScore: 0,
        lastTrustScoreCalculationTimestamp: Date.now(),
        recommendations: [],
      };
      logger.debug(`[CommunityInvestor] Initializing new profile for ${currentMessageSenderId}`);
    } else {
      userProfile = userProfileComponent.data as UserTrustProfile;
      if (!Array.isArray(userProfile.recommendations)) userProfile.recommendations = [];
    }

    let profileUpdated = false;

    for (const extractedRec of extractionResult.recommendations) {
      if (extractedRec.sentiment === 'neutral' || !extractedRec.tokenMentioned?.trim()) {
        logger.debug(
          `[CommunityInvestor] Skipping neutral or empty token mention: "${extractedRec.quote}"`
        );
        continue;
      }

      logger.debug(`[E2E TRACE] Extracted rec: ${JSON.stringify(extractedRec)}`);

      let resolvedToken: { address: string; chain: SupportedChain; ticker?: string } | null = null;
      if (extractedRec.isTicker) {
        resolvedToken = await communityInvestorService.resolveTicker(
          extractedRec.tokenMentioned,
          DEFAULT_CHAIN,
          recentMessagesForContext
        );
      } else if (
        extractedRec.tokenMentioned.length > 20 &&
        extractedRec.tokenMentioned.match(/^[a-zA-Z0-9]+$/)
      ) {
        resolvedToken = {
          address: extractedRec.tokenMentioned,
          chain: DEFAULT_CHAIN,
          ticker: undefined,
        }; // Assume address-like strings are on default chain for now
      } else {
        logger.debug(
          `[CommunityInvestor] Invalid address-like token: ${extractedRec.tokenMentioned}`
        );
        logger.debug(
          `[E2E TRACE] Token mention ${extractedRec.tokenMentioned} not considered a valid address format.`
        );
      }
      logger.debug(
        `[E2E TRACE] resolvedToken for "${extractedRec.quote}": ${JSON.stringify(resolvedToken)}`
      );

      if (!resolvedToken) {
        logger.warn(`[CommunityInvestor] Could not resolve token for: "${extractedRec.quote}".`);
        logger.debug(`[E2E TRACE] Skipping rec due to unresolved token: "${extractedRec.quote}"`);
        continue;
      }

      logger.debug(`[E2E TRACE] Attempting to get token API data for ${resolvedToken.address}`);
      const tokenAPIData = await communityInvestorService.getTokenAPIData(
        resolvedToken.address,
        resolvedToken.chain
      );
      logger.debug(
        `[E2E TRACE] tokenAPIData for ${resolvedToken.address}: ${JSON.stringify(tokenAPIData)}`
      );
      const priceAtRecommendation = tokenAPIData?.currentPrice; // Use current price as of message time

      const recTimestamp = createdAt || Date.now();
      const existingRecent = userProfile.recommendations.find(
        (r) =>
          r.tokenAddress === resolvedToken!.address &&
          r.recommendationType === (extractedRec.sentiment === 'positive' ? 'BUY' : 'SELL') &&
          recTimestamp - r.timestamp < RECENT_REC_DUPLICATION_TIMEFRAME_MS
      );
      logger.debug(
        `[E2E TRACE] Existing recent duplicate check. Target: ${resolvedToken.address}, Type: ${extractedRec.sentiment === 'positive' ? 'BUY' : 'SELL'}`
      );
      if (existingRecent) {
        logger.debug(`[CommunityInvestor] Skipping duplicate rec for ${resolvedToken.address}`);
        logger.debug(
          `[E2E TRACE] Found existing recent duplicate for ${resolvedToken.address}. Skipping.`
        );
        continue;
      }

      const newRecommendation: Recommendation = {
        id: asUUID(uuidv4()),
        userId: currentMessageSenderId,
        messageId:
          messageId ||
          asUUID(createUniqueUuid(runtime, `${currentMessageSenderId}-${recTimestamp}`)),
        timestamp: recTimestamp,
        tokenTicker: resolvedToken.ticker?.toUpperCase(),
        tokenAddress: resolvedToken.address,
        chain: resolvedToken.chain,
        recommendationType: extractedRec.sentiment === 'positive' ? 'BUY' : 'SELL',
        conviction: extractedRec.conviction,
        rawMessageQuote: extractedRec.quote,
        priceAtRecommendation: priceAtRecommendation, // Store price at time of recommendation
        processedForTradeDecision: false,
      };

      logger.debug(`[E2E TRACE] newRecommendation created: ${JSON.stringify(newRecommendation)}`);

      userProfile.recommendations.unshift(newRecommendation);
      if (userProfile.recommendations.length > MAX_RECOMMENDATIONS_IN_PROFILE)
        userProfile.recommendations.pop();
      profileUpdated = true;
      logger.debug(
        `[E2E TRACE] profileUpdated is now true. Profile recommendation count: ${userProfile.recommendations.length}`
      );
      logger.info(
        `[CommunityInvestor] Added ${newRecommendation.recommendationType} rec for user ${currentMessageSenderId}, token ${newRecommendation.tokenAddress}`
      );

      await runtime.createTask({
        name: 'PROCESS_TRADE_DECISION',
        description: `Process trade decision for rec ${newRecommendation.id}`,
        metadata: { recommendationId: newRecommendation.id, userId: currentMessageSenderId },
        tags: ['communityInvestor', 'tradeDecision'],
        roomId: roomId,
        worldId: componentWorldId, // Use the determined worldId
        entityId: currentMessageSenderId,
      });
      logger.debug(
        `[CommunityInvestor] Created PROCESS_TRADE_DECISION task for rec ID ${newRecommendation.id}`
      );
    }
    logger.debug(`[E2E TRACE] After loop, profileUpdated: ${profileUpdated}`);
    if (profileUpdated) {
      logger.debug(`[E2E TRACE] profileUpdated is true. Checking if userProfileComponent exists.`);
      if (userProfileComponent) {
        logger.debug(`[E2E TRACE] Attempting to update component ${userProfileComponent.id}`);
        await runtime.updateComponent({
          ...userProfileComponent,
          data: userProfile,
        });
        logger.debug(
          `[CommunityInvestor] Updated component ${userProfileComponent.id} for ${currentMessageSenderId}`
        );
      } else {
        const newComponentId = asUUID(uuidv4());
        logger.debug(`[E2E TRACE] Attempting to create new component with id ${newComponentId}`);
        await runtime.createComponent({
          id: newComponentId,
          entityId: currentMessageSenderId,
          agentId: agentId,
          worldId: componentWorldId,
          roomId: roomId,
          sourceEntityId: agentId,
          type: TRUST_MARKETPLACE_COMPONENT_TYPE,
          createdAt: Date.now(),
          data: userProfile,
        });
        logger.info(`[CommunityInvestor] Created new component for ${currentMessageSenderId}`);
      }
    }
  } catch (error) {
    logger.error('[CommunityInvestor] Error in messageReceivedHandler:', error);
  } finally {
    onComplete?.();
  }
};

export const events = {
  [EventType.MESSAGE_RECEIVED]: [
    async (payload: MessagePayload) => {
      if (!payload.callback) {
        logger.error('No callback provided for message');
        return;
      }
      await messageReceivedHandler({
        runtime: payload.runtime,
        message: payload.message,
        callback: payload.callback,
        onComplete: payload.onComplete,
      });
    },
  ],
};
