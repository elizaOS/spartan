import { logger } from '@elizaos/core';
import type {
  Evaluator,
  IAgentRuntime,
  Memory,
  State,
} from '@elizaos/core';

export const tokenSnifferEvaluator: Evaluator = {
  name: 'TOKEN_SNIFFER',
  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    try {
      const solanaService = runtime.getService('chain_solana');
      if (!solanaService) {
        return false;
      }

      const pks = await (solanaService as any).detectPubkeysFromString(message.content?.text ?? '');
      return pks && pks.length > 0;
    } catch (error) {
      runtime.logger.error('Error in tokenSnifferEvaluator validate:', String(error));
      return false;
    }
  },
  description: 'Does blockchain address discovery',
  handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    try {
      runtime.logger.info('TOKEN_SNIFFER processing:', message.content?.text);

      const chainService = runtime.getService('INTEL_CHAIN');
      if (chainService) {
        const addies = await (chainService as any).detectAddressesFromString(message.content?.text);
        runtime.logger.info('TOKEN_SNIFFER - INTEL_CHAIN addresses:', addies);
      }

      const solanaService = runtime.getService('chain_solana');
      if (!solanaService) {
        runtime.logger.warn('Solana service not available');
        return;
      }

      const pks = await (solanaService as any).detectPubkeysFromString(message.content?.text ?? '');
      if (!pks || pks.length === 0) {
        runtime.logger.info('No Solana addresses detected');
        return;
      }

      const types = await Promise.all(pks.map((a: string) => (solanaService as any).getAddressType(a)));
      const tokens: string[] = [];

      for (const i in pks) {
        const address = pks[i];
        const type = types[i];
        if (type === 'Token') {
          tokens.push(address);
        } else {
          runtime.logger.info(`Address ${address} is type: ${type}`);
        }
      }

      runtime.logger.info('TOKEN_SNIFFER - found mint CAs:', tokens.join(', '));
    } catch (error) {
      runtime.logger.error('Error in tokenSnifferEvaluator handler:', String(error));
    }
  },
  examples: [],
};
