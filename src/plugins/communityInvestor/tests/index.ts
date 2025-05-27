import type { TestSuite, TestCase } from '@elizaos/core';
import { serviceTestSuite } from './service';
import { eventsTestSuite } from './events';
import { trustScoreTestSuite } from './trustScore';
import { communityInvestorE2ETestSuite } from './communityInvestor.e2e';

const allTestCases: TestCase[] = [
  ...serviceTestSuite.tests,
  ...eventsTestSuite.tests,
  ...trustScoreTestSuite.tests,
  ...communityInvestorE2ETestSuite.tests,
];

export const allCommunityInvestorPluginTests: TestSuite = {
  name: 'CommunityInvestor Plugin - All Tests',
  tests: allTestCases,
};
