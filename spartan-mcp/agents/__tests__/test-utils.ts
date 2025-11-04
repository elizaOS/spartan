/**
 * Test Utilities for Analytics Agent Tests
 * 
 * Shared mocks, fixtures, and helper functions for testing
 */

import { vi } from 'vitest';

/**
 * Mock Anthropic response for tool use
 */
export function createToolUseResponse(toolName: string, input: Record<string, any>, id = 'tool_1') {
  return {
    stop_reason: 'tool_use',
    content: [
      {
        type: 'tool_use',
        id,
        name: toolName,
        input
      }
    ]
  };
}

/**
 * Mock Anthropic response for end turn
 */
export function createEndTurnResponse(text: string) {
  return {
    stop_reason: 'end_turn',
    content: [
      {
        type: 'text',
        text
      }
    ]
  };
}

/**
 * Create a mock payment fetch function
 */
export function createMockPaymentFetch() {
  return vi.fn().mockImplementation((url: string, options?: any) => {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
      headers: new Headers()
    });
  });
}

/**
 * Create a mock Anthropic client
 */
export function createMockAnthropicClient() {
  return {
    messages: {
      create: vi.fn()
    }
  };
}

/**
 * Create a mock account
 */
export function createMockAccount(address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0') {
  return {
    address
  };
}

/**
 * Mock market analytics data
 */
export const mockMarketAnalyticsData = {
  topGainers: [
    { symbol: 'SOL', change_24h: 15.2, price: 145.32, volume: 1250000000 },
    { symbol: 'BONK', change_24h: 12.8, price: 0.000023, volume: 45000000 },
    { symbol: 'JUP', change_24h: 8.5, price: 1.23, volume: 78000000 }
  ],
  topLosers: [
    { symbol: 'RAY', change_24h: -8.5, price: 3.21, volume: 32000000 },
    { symbol: 'ORCA', change_24h: -5.2, price: 2.15, volume: 18000000 }
  ],
  marketCap: 2500000000,
  volume24h: 750000000,
  sentiment: 'bullish',
  dominance: {
    SOL: 45.2,
    USDC: 15.8,
    other: 39.0
  }
};

/**
 * Mock news feed data
 */
export const mockNewsFeedData = {
  articles: [
    {
      title: 'Solana DeFi TVL reaches new all-time high',
      source: 'CoinDesk',
      url: 'https://example.com/news/1',
      timestamp: '2024-01-10T10:00:00Z',
      category: 'defi',
      summary: 'Total value locked in Solana DeFi protocols surpassed $5 billion'
    },
    {
      title: 'New Solana DEX launches with innovative AMM',
      source: 'The Block',
      url: 'https://example.com/news/2',
      timestamp: '2024-01-10T09:30:00Z',
      category: 'protocol',
      summary: 'Revolutionary automated market maker promises better execution'
    },
    {
      title: 'Jupiter aggregator processes $1B in daily volume',
      source: 'Decrypt',
      url: 'https://example.com/news/3',
      timestamp: '2024-01-10T08:00:00Z',
      category: 'market',
      summary: 'Leading Solana DEX aggregator hits major milestone'
    }
  ]
};

/**
 * Mock sentiment analysis data
 */
export const mockSentimentData = {
  overall_sentiment: 'bullish',
  sentiment_score: 0.72,
  confidence: 0.85,
  sources: {
    social_media: 0.68,
    news: 0.75,
    on_chain: 0.78
  },
  trending_topics: [
    'solana defi growth',
    'new token launches',
    'institutional adoption'
  ],
  timeframe: '24h'
};

/**
 * Mock trending tokens data
 */
export const mockTrendingTokensData = {
  trending: [
    {
      symbol: 'BONK',
      rank: 1,
      volume_change_24h: 245.5,
      price_change_24h: 12.8,
      social_mentions: 15420,
      trending_score: 9.2
    },
    {
      symbol: 'WIF',
      rank: 2,
      volume_change_24h: 178.3,
      price_change_24h: 8.5,
      social_mentions: 12350,
      trending_score: 8.7
    },
    {
      symbol: 'MYRO',
      rank: 3,
      volume_change_24h: 156.2,
      price_change_24h: 6.3,
      social_mentions: 9870,
      trending_score: 8.1
    }
  ],
  timeframe: '24h',
  chain: 'solana'
};

/**
 * Mock whale activity data
 */
export const mockWhaleActivityData = {
  transactions: [
    {
      hash: '0xabc123...',
      wallet: '0x742d35...',
      token: 'SOL',
      value_usd: 1250000,
      type: 'buy',
      timestamp: '2024-01-10T10:15:00Z',
      exchange: 'Jupiter'
    },
    {
      hash: '0xdef456...',
      wallet: '0x123abc...',
      token: 'BONK',
      value_usd: 850000,
      type: 'sell',
      timestamp: '2024-01-10T10:10:00Z',
      exchange: 'Raydium'
    },
    {
      hash: '0xghi789...',
      wallet: '0x456def...',
      token: 'JUP',
      value_usd: 620000,
      type: 'buy',
      timestamp: '2024-01-10T10:05:00Z',
      exchange: 'Orca'
    }
  ],
  total_volume_24h: 45000000,
  unique_whales: 156,
  min_value_usd: 100000
};

/**
 * Mock token analysis data
 */
export const mockTokenAnalysisData = {
  token_address: 'So11111111111111111111111111111111111111112',
  symbol: 'SOL',
  name: 'Wrapped SOL',
  risk_score: 1,
  liquidity_score: 10,
  holder_concentration: 'low',
  top_holders: [
    { address: '0x123...', percentage: 2.5 },
    { address: '0x456...', percentage: 1.8 },
    { address: '0x789...', percentage: 1.2 }
  ],
  price_impact: {
    '10k_usd': 0.01,
    '100k_usd': 0.05,
    '1m_usd': 0.15
  },
  security_audit: {
    verified_contract: true,
    open_source: true,
    audit_status: 'passed',
    known_vulnerabilities: []
  },
  market_metrics: {
    market_cap: 65000000000,
    fdv: 85000000000,
    volume_24h: 2500000000,
    liquidity: 500000000
  },
  recommendations: [
    'highly liquid token',
    'established project with strong fundamentals',
    'low risk for trading',
    'suitable for large position sizes'
  ],
  risks: [],
  overall_rating: 'excellent',
  depth: 'standard'
};

/**
 * Setup common environment variables for tests
 */
export function setupTestEnvironment() {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-123';
  process.env.WALLET_PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001';
  process.env.SPARTAN_BACKEND_URL = 'http://localhost:2096';
}

/**
 * Clean up environment after tests
 */
export function cleanupTestEnvironment(originalEnv: NodeJS.ProcessEnv) {
  process.env = originalEnv;
}

/**
 * Create a complete mock API response
 */
export function createMockAPIResponse(data: any, status = 200, ok = true) {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers({
      'Content-Type': 'application/json',
      'X-Payment-Status': 'verified'
    })
  };
}

/**
 * Create a mock error response
 */
export function createMockErrorResponse(message: string, status = 500) {
  return {
    ok: false,
    status,
    json: async () => ({ error: message }),
    text: async () => JSON.stringify({ error: message }),
    headers: new Headers({
      'Content-Type': 'application/json'
    })
  };
}

/**
 * Simulate a complete conversation turn
 */
export async function simulateConversationTurn(
  mockClient: any,
  toolResponses: any[],
  finalText: string
) {
  // Setup tool use responses
  for (const toolResponse of toolResponses) {
    mockClient.messages.create.mockResolvedValueOnce(toolResponse);
  }

  // Setup final text response
  mockClient.messages.create.mockResolvedValueOnce(
    createEndTurnResponse(finalText)
  );
}

/**
 * Assert tool was called with correct parameters
 */
export function assertToolCalled(
  mockFetch: any,
  endpoint: string,
  options?: {
    method?: string;
    body?: any;
    params?: Record<string, string>;
  }
) {
  const calls = mockFetch.mock.calls;
  const matchingCall = calls.find((call: any[]) => {
    const url = call[0];
    return url.includes(endpoint);
  });

  expect(matchingCall).toBeDefined();

  if (options?.method) {
    const callOptions = matchingCall[1];
    expect(callOptions?.method).toBe(options.method);
  }

  if (options?.body) {
    const callOptions = matchingCall[1];
    const body = JSON.parse(callOptions?.body || '{}');
    expect(body).toMatchObject(options.body);
  }

  return matchingCall;
}

/**
 * Create system prompt for testing
 */
export const SPARTAN_SYSTEM_PROMPT = `you're spartan, defi warlord with full market intelligence access

capabilities:
- real-time defi news
- market sentiment analysis
- whale wallet tracking
- trending tokens with analytics
- deep token analysis
- portfolio optimization
- market overview and metrics
- ai trading signals
- defi protocol analysis

analysis doctrine:
- data only, no speculation without disclaimer
- security risks called out immediately
- recommendations are actionable or worthless
- context matters, read the market
- admit when you dont know

communication rules:
- be direct and brief
- no emojis, no exclamations, no question marks
- say the quiet part out loud
- no crypto jargon or shill bs
- no metaphors or analogies
- separate key points with double newlines
- never apologize
- if giving financial advice say "not financial advice"

format:
most important info first
key metrics upfront
risks before opportunities
clear recommendations based on data`;

