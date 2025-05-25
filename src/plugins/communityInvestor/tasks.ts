import { type IAgentRuntime, type Task, type TaskWorker, logger, type UUID } from '@elizaos/core';
import { CommunityInvestorService } from './service';
import {
  ServiceType,
  type UserTrustProfile,
  type TradeDecisionInput,
  TRUST_MARKETPLACE_COMPONENT_TYPE,
} from './types';

export const PROCESS_TRADE_DECISION_TASK_NAME = 'PROCESS_TRADE_DECISION';

const processTradeDecisionTaskWorker: TaskWorker = {
  name: PROCESS_TRADE_DECISION_TASK_NAME,
  execute: async (
    runtime: IAgentRuntime,
    options: Record<string, unknown>,
    task: Task
  ): Promise<void> => {
    const { recommendationId, userId } = options as unknown as TradeDecisionInput;
    const agentId = runtime.agentId;
    const pluginComponentWorldId = task.worldId as UUID;

    logger.info(
      `[TaskWorker:${PROCESS_TRADE_DECISION_TASK_NAME}] Starting for rec: ${recommendationId}, user: ${userId}, components expected in world: ${pluginComponentWorldId}`
    );

    if (!recommendationId || !userId) {
      logger.error(
        `[TaskWorker:${PROCESS_TRADE_DECISION_TASK_NAME}] Missing recommendationId or userId in task options. Task ID: ${task.id}`
      );
      await runtime.deleteTask(task.id as UUID);
      return;
    }

    const service = runtime.getService<CommunityInvestorService>(ServiceType.COMMUNITY_INVESTOR);
    if (!service) {
      logger.error(
        `[TaskWorker:${PROCESS_TRADE_DECISION_TASK_NAME}] CommunityInvestorService not found.`
      );
      // Optionally, requeue task or mark as failed after retries
      return;
    }

    try {
      const componentResult = await runtime.getComponent(
        userId,
        TRUST_MARKETPLACE_COMPONENT_TYPE,
        pluginComponentWorldId,
        agentId
      );
      let userProfile: UserTrustProfile | null = null;
      if (componentResult?.data) {
        userProfile = componentResult.data as UserTrustProfile;
      }

      if (!userProfile) {
        logger.warn(
          `[TaskWorker:${PROCESS_TRADE_DECISION_TASK_NAME}] UserProfile not found for user ${userId}. Cannot process trade decision.`
        );
        await runtime.deleteTask(task.id as UUID);
        return;
      }

      const recommendation = userProfile.recommendations.find((rec) => rec.id === recommendationId);
      if (!recommendation) {
        logger.warn(
          `[TaskWorker:${PROCESS_TRADE_DECISION_TASK_NAME}] Recommendation ${recommendationId} not found in profile for user ${userId}.`
        );
        await runtime.deleteTask(task.id as UUID);
        return;
      }

      if (recommendation.processedForTradeDecision) {
        logger.info(
          `[TaskWorker:${PROCESS_TRADE_DECISION_TASK_NAME}] Recommendation ${recommendationId} already processed. Deleting task.`
        );
        await runtime.deleteTask(task.id as UUID);
        return;
      }

      // Check user trade cooldown
      const now = Date.now();
      const cooldownMs = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
      if (
        userProfile.lastTradeDecisionMadeTimestamp &&
        now - userProfile.lastTradeDecisionMadeTimestamp < cooldownMs
      ) {
        logger.info(
          `[TaskWorker:${PROCESS_TRADE_DECISION_TASK_NAME}] User ${userId} is on trade cooldown. Re-evaluating later (or marking rec as processed without action).`
        );
        // Decide if we want to requeue, or just mark as processed without acting.
        // For now, mark as processed to avoid continuous requeuing for cooldown.
        recommendation.processedForTradeDecision = true;
        // Update the profile with the processed recommendation
        if (componentResult && userProfile) {
          await runtime.updateComponent({ ...componentResult, data: userProfile });
        }
        await runtime.deleteTask(task.id as UUID);
        return;
      }

      // Ensure trust score is up-to-date
      await service.calculateUserTrustScore(userId, runtime);

      // Fetch the profile again to get the latest score
      const updatedComponentResult = await runtime.getComponent(
        userId,
        TRUST_MARKETPLACE_COMPONENT_TYPE,
        pluginComponentWorldId,
        agentId
      );
      let updatedUserProfile: UserTrustProfile | null = null;
      if (updatedComponentResult?.data) {
        updatedUserProfile = updatedComponentResult.data as UserTrustProfile;
      }

      if (!updatedUserProfile) {
        logger.error(
          `[TaskWorker:${PROCESS_TRADE_DECISION_TASK_NAME}] Failed to refetch UserProfile for user ${userId} after score calculation.`
        );
        await runtime.deleteTask(task.id as UUID);
        return;
      }
      const finalTrustScore = updatedUserProfile.trustScore;
      const updatedRecommendation = updatedUserProfile.recommendations.find(
        (rec) => rec.id === recommendationId
      );

      // Decision Logic
      if (finalTrustScore > 10) {
        // POSITIVE_TRADE_THRESHOLD
        logger.info(
          `[TaskWorker:${PROCESS_TRADE_DECISION_TASK_NAME}] SIMULATING TRADE for rec ${recommendationId} (User: ${userId}, Trust: ${finalTrustScore.toFixed(2)}, Type: ${recommendation.recommendationType})`
        );
        // In a real system, this is where you'd trigger the actual trade execution logic
        // For example: await tradingPlatformService.executeTrade(recommendation);
        updatedUserProfile.lastTradeDecisionMadeTimestamp = now;
        // Log the simulated trade in a specific table/memory if needed
      } else if (finalTrustScore < -5) {
        // NEUTRAL_MARGIN
        logger.info(
          `[TaskWorker:${PROCESS_TRADE_DECISION_TASK_NAME}] HOLDING (AVOIDING) rec ${recommendationId} (User: ${userId}, Trust: ${finalTrustScore.toFixed(2)}, Type: ${recommendation.recommendationType}) - Low trust score.`
        );
      } else {
        logger.info(
          `[TaskWorker:${PROCESS_TRADE_DECISION_TASK_NAME}] HOLDING (NEUTRAL) on rec ${recommendationId} (User: ${userId}, Trust: ${finalTrustScore.toFixed(2)}, Type: ${recommendation.recommendationType}) - Neutral trust score.`
        );
      }

      if (updatedRecommendation) {
        updatedRecommendation.processedForTradeDecision = true;
      }

      if (updatedComponentResult && updatedUserProfile) {
        await runtime.updateComponent({ ...updatedComponentResult, data: updatedUserProfile });
      }
      logger.info(
        `[TaskWorker:${PROCESS_TRADE_DECISION_TASK_NAME}] Completed processing for rec ${recommendationId}.`
      );
      await runtime.deleteTask(task.id as UUID);
    } catch (error) {
      logger.error(
        `[TaskWorker:${PROCESS_TRADE_DECISION_TASK_NAME}] Error processing task ${task.id}:`,
        error
      );
      // Consider a retry mechanism or dead-letter queue for failed tasks
      // For now, we'll delete to prevent loops on persistent errors
      try {
        await runtime.deleteTask(task.id as UUID);
      } catch (deleteError) {
        logger.error(
          `[TaskWorker:${PROCESS_TRADE_DECISION_TASK_NAME}] Critical error: Failed to delete task ${task.id} after error:`,
          deleteError
        );
      }
    }
  },
};

// Array of task workers to be registered by the plugin
export const communityInvestorTaskWorkers: TaskWorker[] = [processTradeDecisionTaskWorker];
