import type { IAgentRuntime } from '@elizaos/core';

import { acquireService } from '../../autonomous-trader/utils';

export async function noneStrategy(runtime: IAgentRuntime) {
  const service = await acquireService(runtime, 'TRADER_STRATEGY', 'no trading strategy');

  const me = {
    name: 'No trading strategy',
  };
  const hndl = await service.register_strategy(me);

  // ok which wallets do we need to set up listeners on?
}
