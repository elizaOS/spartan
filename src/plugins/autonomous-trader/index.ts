import type { Plugin, IAgentRuntime, ServiceTypeName } from '@elizaos/core';

import { verifyHolder } from "./actions/act_holder_verify";
import spartanNews from "./actions/act_spartan_news";

// account provider had this
import { holderProvider } from "./providers/holder";
import { instructionsProvider } from "./providers/instructions";
import { linksProvider } from "./providers/links";
import { newsProvider } from "./providers/spartan_news";
import { SpartanNewsService } from "./services/spartanNewsService";
import { newsRoutes } from "./routes/news";

export const autonomousTraderPlugin: Plugin = {
  name: 'autonomous-trader',
  description: 'Spartan Autonomous trading agent plugin',
  evaluators: [],
  providers: [instructionsProvider, holderProvider, linksProvider, newsProvider],
  actions: [
    verifyHolder,
    spartanNews,
  ],
  services: [SpartanNewsService],
  routes: newsRoutes,
  init: async (_config, runtime: IAgentRuntime) => {
    const fifteenMinutes = 15 * 60 * 1000;

    runtime
      .getServiceLoadPromise(SpartanNewsService.serviceType as ServiceTypeName)
      .then(async () => {
        const service = runtime.getService(
          SpartanNewsService.serviceType as ServiceTypeName,
        ) as SpartanNewsService | undefined;
        if (!service) {
          runtime.logger.warn('[autonomous-trader] SpartanNewsService unavailable during init');
          return;
        }
        await service.ensureNewsTask(fifteenMinutes);
      })
      .catch((error) => {
        runtime.logger.error('[autonomous-trader] Failed to schedule Spartan news task', error);
      });
  },
};

export default autonomousTraderPlugin;
