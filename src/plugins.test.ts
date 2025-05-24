import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { TestCase } from '@elizaos/core';
import {
  AgentRuntime,
  type Character,
  type IAgentRuntime,
  type TestSuite,
  logger,
  stringToUuid,
} from '@elizaos/core';
import dotenv from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import project from './index';

dotenv.config({ path: '../../.env' });

const TEST_TIMEOUT = 300000;

const defaultCharacter: Character = project.agents[0].character;

const elizaOpenAIFirst: Character = {
  ...project.agents[0].character,
  name: 'ElizaOpenAIFirst',
  plugins: [
    '@elizaos/plugin-sql',
    '@elizaos/plugin-openai', // OpenAI first, embedding size = 1536
    '@elizaos/plugin-elevenlabs',
    '@elizaos/plugin-pdf',
    '@elizaos/plugin-video-understanding',
    '@elizaos/plugin-storage-s3',
  ],
};

const agentRuntimes = new Map<string, IAgentRuntime>();

// Initialize runtime for a character
/**
 * Asynchronously initializes the runtime for a given character with the provided configuration.
 *
 * @param {Character} character - The character for which the runtime is being initialized.
 * @returns {Promise<IAgentRuntime>} A promise that resolves to the initialized agent runtime.
 */
async function initializeRuntime(character: Character): Promise<IAgentRuntime> {
  logger.info(`Initializing runtime for character: ${character.name}`);
  try {
    character.id = stringToUuid(character.name);

    logger.info(`[${character.name}] Creating AgentRuntime instance...`);
    const runtime = new AgentRuntime({
      character,
      fetch: async (url: string | RequestInfo | URL, options: RequestInit) => {
        logger.debug(`[${character.name}] Test fetch: ${url}`);
        return fetch(url, options);
      },
    });
    logger.info(`[${character.name}] AgentRuntime instance created.`);

    const envPath = path.join(process.cwd(), '.env');

    let postgresUrl: string | undefined = undefined; // Initialize as undefined
    let currentPath = envPath;
    let depth = 0;
    const maxDepth = 10;

    logger.info(`[${character.name}] Searching for POSTGRES_URL in .env files...`);
    while (depth < maxDepth && currentPath.includes(path.sep)) {
      if (fs.existsSync(currentPath)) {
        logger.debug(`[${character.name}] Checking .env file at: ${currentPath}`);
        const env = fs.readFileSync(currentPath, 'utf8');
        const envVars = env.split('\n').filter((line) => line.trim() !== '');
        const postgresUrlLine = envVars.find((line) => line.startsWith('POSTGRES_URL='));
        if (postgresUrlLine) {
          postgresUrl = postgresUrlLine.split('=')[1].trim();
          logger.info(`[${character.name}] Found POSTGRES_URL: ${postgresUrl}`);
          break;
        }
      }
      const currentDir = path.dirname(currentPath);
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) { // Reached root or invalid path
        logger.warn(`[${character.name}] Reached directory root or invalid path while searching for .env.`);
        break;
      }
      currentPath = path.join(parentDir, '.env');
      depth++;
    }
    if (!postgresUrl) {
      logger.info(`[${character.name}] POSTGRES_URL not found in .env files. Proceeding without it (implies PGlite/SQLite).`);
    }

    let dataDir = './elizadb';
    try {
      const homeDir = os.homedir();
      const elizaDir = path.join(homeDir, '.eliza');
      const elizaDbDir = path.join(elizaDir, 'db');
      logger.info(`[${character.name}] Setting up database directory at: ${elizaDbDir}`);
      if (!fs.existsSync(elizaDir)) {
        logger.info(`[${character.name}] Creating .eliza directory at: ${elizaDir}`);
        fs.mkdirSync(elizaDir, { recursive: true });
      }
      if (!fs.existsSync(elizaDbDir)) {
        logger.info(`[${character.name}] Creating .eliza/db directory at: ${elizaDbDir}`);
        fs.mkdirSync(elizaDbDir, { recursive: true });
      }
      dataDir = elizaDbDir;
      logger.info(`[${character.name}] Using database directory: ${dataDir}`);
    } catch (error: any) {
      logger.error(`[${character.name}] Error setting up database directory: ${error.message}. Using default: ${dataDir}`);
    }

    const options = { dataDir, postgresUrl };
    logger.info(`[${character.name}] Database adapter options: ${JSON.stringify(options)}`);

    logger.info(`[${character.name}] Importing @elizaos/plugin-sql...`);
    const drizzleAdapter = await import('@elizaos/plugin-sql');
    logger.info(`[${character.name}] Creating database adapter...`);
    const adapter = drizzleAdapter.createDatabaseAdapter(options, runtime.agentId);
    if (!adapter) {
      logger.error(`[${character.name}] No database adapter found in default drizzle plugin.`);
      throw new Error('No database adapter found in default drizzle plugin');
    }
    logger.info(`[${character.name}] Database adapter created. Registering with runtime...`);
    runtime.registerDatabaseAdapter(adapter);
    logger.info(`[${character.name}] Database adapter registered.`);

    logger.info(`[${character.name}] Initializing runtime (this will run migrations)...`);
    await runtime.initialize();
    logger.info(`[${character.name}] Runtime initialized successfully.`);

    agentRuntimes.set(character.name, runtime);
    logger.info(`Runtime setup complete for character: ${character.name}`);
    return runtime;
  } catch (error: any) {
    logger.error(`Failed to initialize test runtime for ${character.name}:`, error);
    throw error;
  }
}

// Initialize the runtimes
beforeAll(async () => {
  const characters = [defaultCharacter, elizaOpenAIFirst];

  for (const character of characters) {
    const config = await initializeRuntime(character);
    agentRuntimes.set(character.name, config);
  }
}, TEST_TIMEOUT);

// Cleanup after all tests
afterAll(async () => {
  for (const [characterName] of agentRuntimes.entries()) {
    try {
      logger.info(`Cleaned up ${characterName}`);
    } catch (error) {
      logger.error(`Error during cleanup for ${characterName}:`, error);
    }
  }
});

// Test suite for each character
describe('Multi-Character Plugin Tests', () => {
  // Test each character from the project
  for (const agent of project.agents) {
    it(`should run tests for ${agent.character.name}`, async () => {
      console.log(`\n--- Starting tests for ${agent.character.name} ---`);
      const runtime = agentRuntimes.get(agent.character.name);
      expect(runtime, `Runtime not found for ${agent.character.name}. Check beforeAll initialization.`).toBeDefined();
      if (!runtime) return;

      const testRunner = new TestRunner(runtime);
      await testRunner.runTestsForCharacter(agent.character);
      testRunner.logTestSummary(); // Log summary per character
      console.log(`--- Finished tests for ${agent.character.name} ---\n`);
      // Optionally, assert on testRunner.stats if needed for overall pass/fail
      // expect(testRunner.stats.failed).toBe(0);
    }, TEST_TIMEOUT);
  }

  // Special test case for ElizaOpenAIFirst if not in project.agents or for specific checks
  if (!project.agents.some(a => a.character.name === elizaOpenAIFirst.name)) {
    it(`should run tests for ${elizaOpenAIFirst.name} (1536 dimension)`, async () => {
      console.log(`\n--- Starting tests for ${elizaOpenAIFirst.name} ---`);
      const runtime = agentRuntimes.get(elizaOpenAIFirst.name);
      expect(runtime, `Runtime not found for ${elizaOpenAIFirst.name}. Check beforeAll initialization.`).toBeDefined();
      if (!runtime) return;

      const testRunner = new TestRunner(runtime);
      await testRunner.runTestsForCharacter(elizaOpenAIFirst);
      testRunner.logTestSummary();
      console.log(`--- Finished tests for ${elizaOpenAIFirst.name} ---\n`);
      // expect(testRunner.stats.failed).toBe(0);
    }, TEST_TIMEOUT);
  }
});

/**
 * Interface representing test statistics.
 * @interface
 * @property {number} total - Total number of tests.
 * @property {number} passed - Number of tests that passed.
 * @property {number} failed - Number of tests that failed.
 * @property {number} skipped - Number of tests that were skipped.
 */
interface TestStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

/**
 * Represents the result of a test.
 * @typedef {Object} TestResult
 * @property {string} file - The file where the test was executed.
 * @property {string} suite - The test suite name.
 * @property {string} name - The name of the test.
 * @property {"passed" | "failed"} status - The status of the test, can be either "passed" or "failed".
 * @property {Error} [error] - Optional error object if the test failed.
 */
interface TestResult {
  file: string;
  suite: string;
  name: string;
  status: 'passed' | 'failed';
  error?: Error;
}

/**
 * Enumeration representing the status of a test.
 * @enum {string}
 * @readonly
 * @property {string} Passed - Indicates that the test has passed.
 * @property {string} Failed - Indicates that the test has failed.
 */
enum TestStatus {
  Passed = 'passed',
  Failed = 'failed',
}

/**
 * TestRunner class for running plugin tests and handling test results.
 * * @class TestRunner
 */
class TestRunner {
  private runtime: IAgentRuntime;
  private stats: TestStats;
  private testResults: Map<string, TestResult[]> = new Map();

  /**
   * Constructor function for creating a new instance of the class.
   *
   * @param {IAgentRuntime} runtime - The runtime environment for the agent.
   */
  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.stats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
    };
  }

  /**
   * Runs all test suites for the plugins associated with a given character.
   *
   * @param {Character} character - The character whose plugin tests are to be run.
   * @returns {Promise<void>} A promise that resolves when all tests for the character are complete.
   */
  public async runTestsForCharacter(character: Character): Promise<void> {
    logger.info(`[TestRunner] Running tests for character: ${character.name}`);
    if (!character.plugins || character.plugins.length === 0) {
      logger.info(`[TestRunner] No plugins found for character ${character.name}. Skipping tests.`);
      return;
    }

    // Ensure project.plugins is available and is an array
    if (!project.plugins || !Array.isArray(project.plugins)) {
      logger.error('[TestRunner] project.plugins is not defined or not an array. Cannot run plugin tests.');
      return;
    }

    for (const pluginNameInCharacterConfig of character.plugins) {
      // Find the plugin definition from the global project.plugins array
      // This assumes plugin names in character.plugins match a name property in project.plugins
      // or a convention like `@elizaos/plugin-name` maps to `plugin-name`.
      const pluginDefinition = project.plugins.find(p => {
        if (!p || typeof p.name !== 'string') return false;
        // Direct match, or match without @scope/ prefix if that's how names are stored
        return p.name === pluginNameInCharacterConfig ||
               p.name === pluginNameInCharacterConfig.replace(/^@[\w-]+\//, '') || // Removes scope like @elizaos/
               `@elizaos/${p.name}` === pluginNameInCharacterConfig || // Common convention
               `@elizaos-plugins/${p.name}` === pluginNameInCharacterConfig; // Another convention
      });

      if (pluginDefinition && pluginDefinition.testSuite) {
        const testSuite: TestSuite = pluginDefinition.testSuite;
        if (testSuite && testSuite.tests && Array.isArray(testSuite.tests)) {
          logger.info(`[TestRunner] Running test suite "${testSuite.name}" for plugin: ${pluginDefinition.name}`);
          this.stats.total += testSuite.tests.length;

          for (const testCase of testSuite.tests) {
            if (testCase && typeof testCase.name === 'string' && typeof testCase.fn === 'function') {
              logger.info(`[TestRunner] Executing test case: ${testCase.name}`);
              await this.runTestCase(testCase, pluginDefinition.name, testSuite.name);
            } else {
              logger.warn(`[TestRunner] Invalid test case found in suite "${testSuite.name}" for plugin "${pluginDefinition.name}". Skipping.`);
              this.stats.skipped++; // Optionally count as skipped
            }
          }
        } else {
          logger.info(`[TestRunner] No valid tests found in test suite "${testSuite.name}" for plugin: ${pluginDefinition.name}`);
        }
      } else {
        logger.warn(`[TestRunner] Plugin definition or test suite not found for: ${pluginNameInCharacterConfig}`);
      }
    }
    logger.info(`[TestRunner] Finished running tests for character: ${character.name}`);
  }

  /**
   * Asynchronously runs a test case and updates the test results accordingly.
   *
   * @param {TestCase} test - The test case to run.
   * @param {string} file - The file the test case belongs to.
   * @param {string} suite - The suite the test case belongs to.
   * @returns {Promise<void>} - A Promise that resolves once the test case has been run.
   */
  private async runTestCase(test: TestCase, file: string, suite: string): Promise<void> {
    const startTime = performance.now();
    try {
      await test.fn(this.runtime);
      this.stats.passed++;
      const duration = performance.now() - startTime;
      logger.info(`✓ ${test.name} (${Math.round(duration)}ms)`);
      this.addTestResult(file, suite, test.name, TestStatus.Passed);
    } catch (error) {
      this.stats.failed++;
      logger.error(`✗ ${test.name}`);
      logger.error(error);
      this.addTestResult(file, suite, test.name, TestStatus.Failed, error as Error);
    }
  }

  /**
   * Add a test result to the testResults map.
   * @param {string} file - The file being tested.
   * @param {string} suite - The test suite name.
   * @param {string} name - The test name.
   * @param {TestStatus} status - The status of the test (passed, failed, skipped, etc.).
   * @param {Error} [error] - The error object if the test failed.
   */
  private addTestResult(
    file: string,
    suite: string,
    name: string,
    status: TestStatus,
    error?: Error
  ) {
    if (!this.testResults.has(file)) {
      this.testResults.set(file, []);
    }
    this.testResults.get(file)?.push({ file, suite, name, status, error });
  }

  /**
   * Runs a test suite, logging the name of the suite and running each test case.
   *
   * @param {TestSuite} suite - The test suite to run.
   * @param {string} file - The file containing the test suite.
   * @returns {Promise<void>}
   */
  private async runTestSuite(suite: TestSuite, file: string): Promise<void> {
    logger.info(`\nTest suite: ${suite.name}`);
    for (const test of suite.tests) {
      this.stats.total++;
      await this.runTestCase(test, file, suite.name);
    }
  }

  /**
   * Runs tests for all plugins in the runtime and returns the test statistics.
   * @returns {Promise<TestStats>} The test statistics object.
   */
  public async runPluginTests(): Promise<TestStats> {
    console.log('*** Running plugin tests...');
    const plugins = this.runtime.plugins;

    for (const plugin of plugins) {
      try {
        logger.info(`Running tests for plugin: ${plugin.name}`);
        const pluginTests = plugin.tests;
        // Handle both single suite and array of suites
        const testSuites = Array.isArray(pluginTests) ? pluginTests : [pluginTests];

        for (const suite of testSuites) {
          if (suite) {
            const fileName = `${plugin.name} test suite`;
            await this.runTestSuite(suite, fileName);
          }
        }
      } catch (error) {
        logger.error(`Error in plugin ${plugin.name}:`, error);
        throw error;
      }
    }

    this.logTestSummary();
    if (this.stats.failed > 0) {
      throw new Error('An error occurred during plugin tests.');
    }
    return this.stats;
  }

  /**
   * Logs the summary of test results in the console with colors for each section.
   */
  private logTestSummary(): void {
    const COLORS = {
      reset: '\x1b[0m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      gray: '\x1b[90m',
      bold: '\x1b[1m',
      underline: '\x1b[4m',
    };

    const colorize = (text: string, color: keyof typeof COLORS, bold = false): string => {
      return `${bold ? COLORS.bold : ''}${COLORS[color]}${text}${COLORS.reset}`;
    };

    const printSectionHeader = (title: string, color: keyof typeof COLORS) => {
      console.log(colorize(`\n${'⎯'.repeat(25)}  ${title} ${'⎯'.repeat(25)}\n`, color, true));
    };

    const printTestSuiteSummary = () => {
      printSectionHeader('Test Suites', 'cyan');

      let failedTestSuites = 0;
      this.testResults.forEach((tests, file) => {
        const failed = tests.filter((t) => t.status === 'failed').length;
        const total = tests.length;

        if (failed > 0) {
          failedTestSuites++;
          console.log(` ${colorize('❯', 'yellow')} ${file} (${total})`);
        } else {
          console.log(` ${colorize('✓', 'green')} ${file} (${total})`);
        }

        const groupedBySuite = new Map<string, TestResult[]>();
        tests.forEach((t) => {
          if (!groupedBySuite.has(t.suite)) {
            groupedBySuite.set(t.suite, []);
          }
          groupedBySuite.get(t.suite)?.push(t);
        });

        groupedBySuite.forEach((suiteTests, suite) => {
          const failed = suiteTests.filter((t) => t.status === 'failed').length;
          if (failed > 0) {
            console.log(`   ${colorize('❯', 'yellow')} ${suite} (${suiteTests.length})`);
            suiteTests.forEach((test) => {
              const symbol =
                test.status === 'passed' ? colorize('✓', 'green') : colorize('×', 'red');
              console.log(`     ${symbol} ${test.name}`);
            });
          } else {
            console.log(`   ${colorize('✓', 'green')} ${suite} (${suiteTests.length})`);
          }
        });
      });

      return failedTestSuites;
    };

    const printFailedTests = () => {
      printSectionHeader('Failed Tests', 'red');

      this.testResults.forEach((tests) => {
        tests.forEach((test) => {
          if (test.status === 'failed') {
            console.log(` ${colorize('FAIL', 'red')} ${test.file} > ${test.suite} > ${test.name}`);
            console.log(` ${colorize(`AssertionError: ${test.error?.message}`, 'red')}`);
            console.log(`\n${colorize('⎯'.repeat(66), 'red')}\n`);
          }
        });
      });
    };

    const printTestSummary = (failedTestSuites: number) => {
      printSectionHeader('Test Summary', 'cyan');

      console.log(
        ` ${colorize('Test Suites:', 'gray')} ${
          failedTestSuites > 0 ? colorize(`${failedTestSuites} failed | `, 'red') : ''
        }${colorize(
          `${this.testResults.size - failedTestSuites} passed`,
          'green'
        )} (${this.testResults.size})`
      );
      console.log(
        ` ${colorize('      Tests:', 'gray')} ${
          this.stats.failed > 0 ? colorize(`${this.stats.failed} failed | `, 'red') : ''
        }${colorize(`${this.stats.passed} passed`, 'green')} (${this.stats.total})`
      );
    };

    const failedTestSuites = printTestSuiteSummary();
    if (this.stats.failed > 0) {
      printFailedTests();
    }
    printTestSummary(failedTestSuites);
  }
}
