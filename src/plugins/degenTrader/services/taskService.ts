import { type IAgentRuntime, logger, type Task, type UUID } from '@elizaos/core';
import { BuyService } from './execution/buyService';
import { SellService } from './execution/sellService';
import { ServiceTypes, type SellSignalMessage } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class TaskService {
  private runtime: IAgentRuntime;
  private buyService: BuyService;
  private sellService: SellService;

  constructor(runtime: IAgentRuntime, buyService: BuyService, sellService: SellService) {
    this.runtime = runtime;
    this.buyService = buyService;
    this.sellService = sellService;
  }

  async registerTasks(): Promise<void> {
    this.runtime.registerTaskWorker({
      name: 'EXECUTE_BUY_ORDER',
      execute: async (runtime: IAgentRuntime, options: { [key: string]: unknown }, task: Task) => {
        logger.info('Handling EXECUTE_BUY_ORDER task', task.id, task.metadata);
      },
      validate: async () => true,
    });
    this.runtime.registerTaskWorker({
      name: 'EXECUTE_SELL',
      execute: async (runtime: IAgentRuntime, options: { [key: string]: unknown }, task: Task) => {
        logger.info('Handling EXECUTE_SELL task', {
          id: task.id,
          metadata: task.metadata,
          tags: task.tags,
        });
        if (
          task.metadata &&
          typeof task.metadata.positionId === 'string' &&
          typeof task.metadata.tokenAddress === 'string' &&
          typeof task.metadata.amount === 'string'
        ) {
          const sellParams = task.metadata as any;

          const sellSignalForService: SellSignalMessage & { expectedOutAmount?: string } = {
            positionId: sellParams.positionId as UUID,
            tokenAddress: sellParams.tokenAddress,
            amount: sellParams.amount,
            slippage: typeof sellParams.slippage === 'number' ? sellParams.slippage : undefined,
            isSimulation:
              typeof sellParams.isSimulation === 'boolean' ? sellParams.isSimulation : undefined,
            reason: typeof sellParams.reason === 'string' ? sellParams.reason : undefined,
            expectedOutAmount:
              typeof sellParams.expectedAmount === 'string' ? sellParams.expectedAmount : undefined,
          };
          await this.sellService.executeSell(sellSignalForService);
        } else {
          logger.error('EXECUTE_SELL task missing or invalid core metadata for SellSignalMessage', {
            taskId: task.id,
            metadata: task.metadata,
          });
        }
      },
      validate: async () => true,
    });
  }

  async createSellTask(params: {
    positionId: string;
    tokenAddress: string;
    amount: string;
    entityId: string;
    currentBalance: string;
    walletAddress: string;
    sellRecommenderId: string;
    reason: string;
    expectedAmount?: string;
    isSimulation?: boolean;
    slippage?: number;
  }): Promise<{ success: boolean; taskId?: string; error?: string }> {
    try {
      logger.info('Creating sell task', {
        tokenAddress: params.tokenAddress,
        amount: params.amount,
      });

      const taskCreationPayload: Pick<
        Task,
        'name' | 'description' | 'tags' | 'metadata' | 'worldId' | 'roomId' | 'entityId'
      > & { updatedAt?: number } = {
        name: 'EXECUTE_SELL',
        description: `Sell ${params.amount} of ${params.tokenAddress} for ${params.reason}`,
        tags: ['degen_trader', ServiceTypes.DEGEN_TRADING, 'SELL_ORDER'],
        worldId: this.runtime.agentId,
        roomId: this.runtime.agentId,
        entityId: params.entityId as UUID,
        metadata: {
          ...params,
          appTaskStatus: 'queued',
          appTaskTimeout: 300,
          appTaskExecuteAt: Date.now(),
        },
        updatedAt: Date.now(),
      };

      const taskId = await this.runtime.createTask(taskCreationPayload as Task);

      logger.info('Sell task created successfully', { taskId });
      return { success: true, taskId: taskId as string };
    } catch (error) {
      logger.error('Error creating sell task', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
