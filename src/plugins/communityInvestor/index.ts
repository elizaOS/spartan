import type { Plugin, IAgentRuntime, Route, TestCase } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { CommunityInvestorService } from './service';
import { allCommunityInvestorPluginTests } from './tests';
import { communityInvestorRoutes } from './routes';
import { events } from './events';

// AgentPanel interface defined locally as before
export interface AgentPanel {
  name: string;
  path: string;
  component: string;
  icon?: string;
  public?: boolean;
}

// Removed getLeaderboardHandler and local communityInvestorRoutes definition from here
// They are now correctly defined in routes.ts

/**
 * Plugin representing the Community Investor Plugin for Eliza.
 * Includes evaluators, actions, and services for community investment functionality.
 */
export const communityInvestorPlugin: Plugin = {
  name: 'community-investor',
  description: 'A plugin for community-driven investment alpha and trust scoring.',
  config: {
    BIRDEYE_API_KEY: '',
    DEXSCREENER_API_KEY: '',
    HELIUS_API_KEY: '',
    PROCESS_TRADE_DECISION_INTERVAL_HOURS: '1',
    METRIC_REFRESH_INTERVAL_HOURS: '24',
    USER_TRADE_COOLDOWN_HOURS: '12',
    SCAM_PENALTY: '-100',
    SCAM_CORRECT_CALL_BONUS: '100',
    MAX_RECOMMENDATIONS_IN_PROFILE: '50',
  },
  async init(config: Record<string, string>, runtime?: IAgentRuntime) {
    logger.info('Community Investor Plugin Initializing...');
    if (runtime) {
      logger.info(`Community Investor Plugin initialized for agent: ${runtime.agentId}`);
    }
    logger.info('Community Investor Plugin initialized.');
  },
  services: [CommunityInvestorService],
  routes: communityInvestorRoutes,
  events,
  tests: [allCommunityInvestorPluginTests],
};

export const panels: AgentPanel[] = [
  {
    name: 'Trust Marketplace',
    path: 'display',
    component: 'LeaderboardPanelPage',
    icon: 'UsersRound',
    public: true,
  },
];

export default communityInvestorPlugin;
export * from './types';
