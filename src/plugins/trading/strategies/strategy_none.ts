import type { IAgentRuntime } from '@elizaos/core';

import { acquireService, askLlmObject } from '../utils';

export async function noneStrategy(runtime: IAgentRuntime) {
  const service = await acquireService(runtime, 'TRADER_STRATEGY', 'no trading strategy');
  const infoService = await acquireService(runtime, 'TRADER_DATAPROVIDER', 'no trading info');

  const me = {
    name: 'No trading strategy',
  };
  const hndl = await service.register_strategy(me);

  // ok which wallets do we need to set up listeners on?
}
