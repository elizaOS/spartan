import { type IAgentRuntime, type Plugin, type Route } from '@elizaos/core';
import { events } from './events';
import { CommunityInvestorService } from './service';
import { allCommunityInvestorPluginTests } from './tests'; // Import the aggregated test suite
import { ServiceType } from './types'; // Assuming types.ts exports ServiceType or similar for service key

// Placeholder for the actual handler logic
async function getLeaderboardHandler(req: any, res: any, runtime: IAgentRuntime) {
  try {
    const service = runtime.getService<CommunityInvestorService>(ServiceType.COMMUNITY_INVESTOR);
    if (!service) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'CommunityInvestorService not found' }));
      return;
    }
    const leaderboardData = await service.getLeaderboardData(runtime);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(leaderboardData));
  } catch (error) {
    console.error('Error fetching leaderboard data:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Failed to fetch leaderboard data',
        details: (error as Error).message,
      })
    );
  }
}

const communityInvestorRoutes: Route[] = [
  {
    type: 'GET',
    name: 'getCommunityInvestorLeaderboard',
    path: '/leaderboard', // This will be prefixed by the plugin name, e.g., /community-investor/leaderboard
    handler: getLeaderboardHandler,
    public: true, // Assuming the leaderboard is publicly accessible
  },
];

// No longer need individual TestCases defined here as they are in their respective files
// and aggregated by tests/index.ts

/**
 * Plugin representing the Community Investor Plugin for Eliza.
 * Includes evaluators, actions, and services for community investment functionality.
 */
export const communityInvestorPlugin: Plugin = {
  name: 'community-investor',
  description: 'Community Investor Plugin for Eliza',
  events,
  services: [CommunityInvestorService],
  routes: communityInvestorRoutes,
  tests: [allCommunityInvestorPluginTests], // Use the aggregated test suite
};
