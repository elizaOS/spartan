# Analytics Agent Test Suite

Comprehensive test suite for the Spartan Analytics Agent, covering unit tests, integration tests, and end-to-end flows.

## Test Structure

```
agents/__tests__/
├── analytics-agent.test.ts           # Unit tests
├── analytics-agent.integration.test.ts # Integration tests
├── test-utils.ts                      # Shared test utilities
└── README.md                          # This file
```

## Test Coverage

### Unit Tests (`analytics-agent.test.ts`)

Tests individual components and functions:

1. **Tool Definitions**
   - Validates all 6 analytics tools are defined
   - Checks tool schemas are valid
   - Verifies required fields

2. **API Endpoint Routing**
   - URL construction for each tool
   - Query parameter handling
   - POST body construction

3. **Tool Execution**
   - Correct API calls for each tool
   - Response parsing
   - Error handling

4. **x402 Payment Protocol**
   - Payment fetch wrapper
   - Wallet account creation
   - Default wallet key handling

5. **Anthropic SDK Integration**
   - Client creation with payment fetch
   - Tool use response handling
   - End turn response handling

6. **Conversation Loop**
   - Single tool call flow
   - Multiple tool calls in sequence
   - Max iterations limit

7. **Environment Configuration**
   - Environment variable handling
   - Default values
   - Custom configuration

8. **Error Handling**
   - API errors
   - Network errors
   - JSON parsing errors
   - Unknown tools

9. **System Prompt**
   - Spartan personality
   - Capabilities listing
   - Communication rules

### Integration Tests (`analytics-agent.integration.test.ts`)

Tests complete workflows:

1. **Complete Conversation Flow**
   - Simple market analysis request
   - Multi-tool comprehensive analysis
   - Message construction

2. **Token Analysis Deep Dive**
   - POST request for token analysis
   - Deep analysis flow

3. **Error Recovery**
   - Graceful API error handling
   - Payment protocol failures
   - Retry logic

4. **x402 Payment Headers**
   - Payment header inclusion
   - Custom wallet configuration

5. **Rate Limiting**
   - Rate limit error handling
   - Retry after rate limit

## Running Tests

### Run All Tests
```bash
bun test
# or
npm test
```

### Run Specific Test File
```bash
bun test analytics-agent.test.ts
bun test analytics-agent.integration.test.ts
```

### Run in Watch Mode
```bash
bun test --watch
# or
npm run test:watch
```

### Run with Coverage
```bash
bun test --coverage
```

## Test Utilities

The `test-utils.ts` file provides:

### Mock Creators
- `createMockPaymentFetch()` - Mock x402-wrapped fetch
- `createMockAnthropicClient()` - Mock Anthropic SDK client
- `createMockAccount()` - Mock wallet account
- `createToolUseResponse()` - Mock tool use response
- `createEndTurnResponse()` - Mock end turn response
- `createMockAPIResponse()` - Mock API response
- `createMockErrorResponse()` - Mock error response

### Mock Data
- `mockMarketAnalyticsData` - Sample market analytics
- `mockNewsFeedData` - Sample news feed
- `mockSentimentData` - Sample sentiment analysis
- `mockTrendingTokensData` - Sample trending tokens
- `mockWhaleActivityData` - Sample whale activity
- `mockTokenAnalysisData` - Sample token analysis

### Helpers
- `setupTestEnvironment()` - Set environment variables
- `cleanupTestEnvironment()` - Restore environment
- `simulateConversationTurn()` - Simulate conversation
- `assertToolCalled()` - Assert tool was called correctly

## Mocked Dependencies

### External Packages
- `@anthropic-ai/sdk` - Anthropic AI SDK
- `viem/accounts` - Ethereum account management
- `x402-fetch` - Payment protocol wrapper

### Why Mock?
1. **Isolation** - Test agent logic without external dependencies
2. **Speed** - No real API calls, tests run instantly
3. **Reliability** - No network issues or rate limits
4. **Cost** - No API usage charges during testing
5. **Determinism** - Predictable test outcomes

## Writing New Tests

### Example: Adding a New Tool Test

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { executeToolCall } from './analytics-agent.test';

describe('New Tool Tests', () => {
  let mockPaymentFetch: any;

  beforeEach(() => {
    mockPaymentFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'test' })
    });
  });

  it('should execute new tool correctly', async () => {
    const result = await executeToolCall(
      'spartan_new_tool',
      { param: 'value' },
      mockPaymentFetch,
      'http://localhost:2096'
    );

    expect(mockPaymentFetch).toHaveBeenCalledWith(
      'http://localhost:2096/api/new-endpoint?param=value'
    );
    expect(result).toEqual({ data: 'test' });
  });
});
```

### Example: Adding an Integration Test

```typescript
import { describe, it, expect } from 'vitest';
import { createToolUseResponse, createEndTurnResponse } from './test-utils';

describe('New Integration Flow', () => {
  it('should complete new workflow', async () => {
    // Mock tool use
    mockAnthropicClient.messages.create
      .mockResolvedValueOnce(
        createToolUseResponse('spartan_new_tool', { param: 'value' })
      )
      .mockResolvedValueOnce(
        createEndTurnResponse('Workflow complete')
      );

    // Mock API response
    mockPaymentFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: 'success' })
    });

    // Execute and verify...
  });
});
```

## Best Practices

### 1. Arrange-Act-Assert Pattern
```typescript
it('should do something', () => {
  // Arrange - Setup
  const input = 'test';
  const expected = 'result';

  // Act - Execute
  const result = doSomething(input);

  // Assert - Verify
  expect(result).toBe(expected);
});
```

### 2. Clear Test Names
Use descriptive test names that explain what is being tested:
- ✅ `should construct correct URL for market analytics`
- ❌ `test URL construction`

### 3. Test One Thing
Each test should verify one specific behavior:
- ✅ Separate tests for different error types
- ❌ One test for all errors

### 4. Use Test Utilities
Leverage shared utilities to reduce duplication:
```typescript
import { mockMarketAnalyticsData, createMockAPIResponse } from './test-utils';

const response = createMockAPIResponse(mockMarketAnalyticsData);
```

### 5. Clean Up After Tests
Always restore environment and clear mocks:
```typescript
afterEach(() => {
  process.env = originalEnv;
  vi.clearAllMocks();
});
```

## Debugging Tests

### Run Single Test
```bash
bun test -t "should execute market analytics tool"
```

### Enable Debug Logging
```typescript
import { createLogger } from '../src/logger';

beforeEach(() => {
  process.env.LOG_LEVEL = 'debug';
});
```

### Inspect Mock Calls
```typescript
console.log('Mock calls:', mockPaymentFetch.mock.calls);
console.log('Mock results:', mockPaymentFetch.mock.results);
```

## CI/CD Integration

Tests are designed to run in CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Run tests
  run: bun test --coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```

## Test Data

All mock data is designed to be realistic and representative of actual API responses:

- **Market data** - Reflects real Solana DeFi metrics
- **Token addresses** - Valid format (though not necessarily real)
- **Timestamps** - ISO 8601 format
- **Prices** - Realistic ranges for tokens

## Troubleshooting

### Tests Fail After Dependency Update
```bash
# Clear cache and reinstall
rm -rf node_modules
bun install
bun test
```

### Mock Not Working
Ensure mocks are defined before importing:
```typescript
vi.mock('@anthropic-ai/sdk');  // ✅ Before other imports
import Anthropic from '@anthropic-ai/sdk';
```

### Environment Variables Not Set
Check that `setupTestEnvironment()` is called:
```typescript
beforeEach(() => {
  setupTestEnvironment();
});
```

## Contributing

When adding new features to the analytics agent:

1. Write tests first (TDD approach)
2. Add unit tests for new functions
3. Add integration tests for new flows
4. Update test utilities if needed
5. Run full test suite before committing
6. Ensure coverage stays above 80%

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Anthropic SDK Docs](https://github.com/anthropics/anthropic-sdk-typescript)
- [x402 Payment Protocol](https://github.com/x402/x402-fetch)
- [Viem Documentation](https://viem.sh/)

---

**Built with Spartan's tactical precision. Test everything, assume nothing.**

