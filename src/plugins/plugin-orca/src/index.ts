import type { IAgentRuntime, Plugin, Memory, State } from '@elizaos/core';
import { positionProvider } from './providers/positionProvider';
import { managePositionActionRetriggerEvaluator } from './evaluators/repositionEvaluator';
import { managePositions } from './actions/managePositions';
import { OrcaService } from './services/srv_orca';

export const orcaPlugin: Plugin = {
  name: 'Orca LP Plugin',
  description: 'Orca LP plugin',
  evaluators: [managePositionActionRetriggerEvaluator],
  providers: [positionProvider],
  actions: [managePositions],
  services: [OrcaService],
  init: async (_, runtime: IAgentRuntime) => {
    console.log('orca init');

    new Promise<void>(async resolve => {
      resolve()
      const asking = 'orca';
      let serviceType = 'chain_solana';
      let traderChainService = runtime.getService(serviceType) as any;
      while (!traderChainService) {
        console.log(asking, 'waiting for', serviceType, 'service...');
        traderChainService = runtime.getService(serviceType) as any;
        if (!traderChainService) {
          await new Promise((waitResolve) => setTimeout(waitResolve, 1000));
        } else {
          console.log(asking, 'Acquired', serviceType, 'service...');
        }
      }

      const me = {
        name: 'Orca services',
      };
      traderChainService.registerExchange(me);

      serviceType = 'TRADER_LIQUIDITYPOOL';
      let traderLpService = runtime.getService(serviceType) as any;
      while (!traderLpService) {
        console.log(asking, 'waiting for', serviceType, 'service...');
        traderLpService = runtime.getService(serviceType) as any;
        if (!traderLpService) {
          await new Promise((waitResolve) => setTimeout(waitResolve, 1000));
        } else {
          console.log(asking, 'Acquired', serviceType, 'service...');
        }
      }

    // first, get all tasks with tags "queue", "repeat", "orca" and delete them
    const tasks = await runtime.getTasks({
      tags: ['queue', 'repeat', 'orca'],
    });

    for (const task of tasks) {
      await runtime.deleteTask(task.id);
    }

    const worldId = runtime.agentId; // this is global data for the agent

    runtime.registerTaskWorker({
      name: 'ORCA_BALANCE',
      validate: async (_runtime, _message, _state) => {
        return true; // TODO: validate after certain time
      },
      execute: async (runtime, _options, task) => {
        const memory: Memory = {
          entityId: worldId,
          roomId: worldId,
          content: {
             text: '',
          }
        }
        const state = await runtime.composeState(memory)
        managePositions.handler(runtime, memory, state)
      },
    });

    runtime.createTask({
      name: 'ORCA_BALANCE',
      description: 'Balance orca pools',
      worldId,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updateInterval: 1000 * 60 * 5, // 5 minutes
      },
      tags: ['queue', 'repeat', 'orca', 'immediate'],
    });

      console.log('orca init done');
    })
  },
};

export default orcaPlugin;