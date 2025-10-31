import type { Plugin, IAgentRuntime } from '@elizaos/core';

import { verifyHolder } from "./actions/act_holder_verify";
//import { verifyDiscord } from "./actions/act_discord_verify";
// FIXME: remove/change holder address

// convert to providers
//import { servicesMenu } from "./actions/act_menu";
//import { actionFrequentlyAsked } from "./actions/act_faq";
//import { actionLinks } from "./actions/act_links";
//import spartanNews from "./actions/act_spartan_news";

// odi utility
//import { devFix } from "./actions/devfix";

// account provider had this
import { holderProvider } from "./providers/holder";
import { instructionsProvider } from "./providers/instructions";
//import { newsProvider } from "./providers/spartan_news";
import { linksProvider } from "./providers/links";

export const autonomousTraderPlugin: Plugin = {
  name: 'autonomous-trader',
  description: 'Spartan Autonomous trading agent plugin',
  evaluators: [],
  // newsProvider,
  providers: [instructionsProvider, holderProvider, linksProvider],
  // spartanNews
  actions: [
    verifyHolder,
    //verifyDiscord
  ],
  services: [],
  init: async (_, runtime: IAgentRuntime) => {
    //console.log('autonomous-trader init');

    /*
    //
    // MARK: tasks init
    //

    const worldId = runtime.agentId; // this is global data for the agent
    // wait for this.adapter is available
    const taskReadyPromise = new Promise(resolve => {
      runtime.initPromise.then(async () => {

        // first, get all tasks with all tags and delete them
        const tasks = await runtime.getTasks({
          tags: ['queue', 'repeat', 'autonomous-trader'],
        });
        for (const task of tasks) {
          if (task.id) {
            await runtime.deleteTask(task.id);
          }
        }
        resolve(void 0)
      })
    })
    */
  }
};

export default autonomousTraderPlugin;
