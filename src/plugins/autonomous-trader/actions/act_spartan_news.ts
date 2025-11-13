// @ts-nocheck
import {
  type Action,
  type ActionExample,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type ActionResult,
  ModelType,
  type State,
  composePromptFromState,
  logger,
} from '@elizaos/core';
import { HasEntityIdFromMessage, getAccountFromMessage, messageReply } from '../../autonomous-trader/utils';
import type { SpartanNewsService } from '../services/spartanNewsService';

/**
 * Interface representing the content of a Spartan news request.
 *
 * @interface SpartanNewsContent
 * @extends Content
 * @property {string | null} timeFrame - The time frame for trending analysis (e.g., '24h', '7d', '30d')
 * @property {string | null} category - The category of news to focus on (e.g., 'trending', 'performance', 'analytics')
 * @property {number | null} limit - The number of tokens to include in the report
 */
interface SpartanNewsContent {
  timeFrame: string | null;
  category: string | null;
  limit: number | null;
}

/**
 * Template for determining the type of Spartan news report to generate.
 */
const newsRequestTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Recent Messages:
{{recentMessages}}

Extract the following information about the requested Spartan news report:
- Time frame for analysis (if user specifies "last 7 days", "24 hours", "this month", etc., otherwise use null)
- Category of news (if user specifies "trending", "performance", "analytics", "holders", etc., otherwise use null)
- Limit of tokens to include (if user specifies a number like "top 5", "10 tokens", etc., otherwise use null)

Example responses:
If user asks for "trending tokens in the last 7 days":
\`\`\`json
{
    "timeFrame": "7d",
    "category": "trending",
    "limit": null
}
\`\`\`

If user asks for "top 5 performing tokens":
\`\`\`json
{
    "timeFrame": null,
    "category": "performance",
    "limit": 5
}
\`\`\`

If user just asks for "Spartan news" or "token insights":
\`\`\`json
{
    "timeFrame": null,
    "category": null,
    "limit": null
}
\`\`\`

Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the JSON response format without any preamble or explanation.

IMPORTANT: Your response must ONLY contain the json block above. Do not include any text, thinking, or reasoning before or after this JSON block. Start your response immediately with { and end with }.`;

export default {
  name: 'SPARTAN_NEWS',
  similes: [
    'SPARTAN_NEWS_REPORT',
    'SPARTAN_NEWS_INSIGHTS',
    'SPARTAN_NEWS_ANALYSIS',
    'SPARTAN_NEWS_SUMMARY',
    'SPARTAN_NEWS_UPDATE',
    'SPARTAN_NEWS_OVERVIEW',
    'SPARTAN_NEWS_DIGEST',
    'SPARTAN_NEWS_BRIEF',
    'SPARTAN_NEWS_ALERT',
    'SPARTAN_NEWS_FEED',
    'TRENDING_TOKENS',
    'TRENDING_TOKENS_REPORT',
    'TRENDING_TOKENS_INSIGHTS',
    'TRENDING_TOKENS_ANALYSIS',
    'TOKEN_INSIGHTS',
    'TOKEN_INSIGHTS_REPORT',
    'TOKEN_INSIGHTS_ANALYSIS',
    'TOKEN_MARKET_INSIGHTS',
    'TOKEN_MARKET_REPORT',
    'TOKEN_MARKET_ANALYSIS',
  ],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    if (!(await HasEntityIdFromMessage(runtime, message))) {
      logger.warn('SPARTAN_NEWS validate - author not found');
      return false;
    }

    const account = await getAccountFromMessage(runtime, message);
    if (!account) return false;

    return true;
  },
  description:
    'Generate comprehensive Spartan market recon articles with trending tokens, sentiment, and actionable insights.',
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult | void | undefined> => {
    logger.debug('SPARTAN_NEWS Starting news report handler...');

    const sourcePrompt = composePromptFromState({
      state,
      template: newsRequestTemplate,
    });

    const content = (await runtime.useModel(ModelType.OBJECT_LARGE, {
      prompt: sourcePrompt,
    })) as SpartanNewsContent | null;

    if (!content) {
      logger.warn('SPARTAN_NEWS failed to extract request parameters from conversation');
      return {
        success: false,
        error: 'Failed to extract Spartan news request parameters',
      };
    }

    const newsService = runtime.getService('SPARTAN_NEWS_SERVICE') as SpartanNewsService | undefined;
    if (!newsService) {
      logger.error('SPARTAN_NEWS service not available');
      return {
        success: false,
        error: 'Spartan news service unavailable',
      };
    }

    const article = await newsService.generateAndStoreArticle({
      timeFrame: content.timeFrame,
      category: content.category,
      limit: content.limit,
      suppressCache: true,
    });

    if (!article) {
      callback?.(
        messageReply(
          runtime,
          message,
          'Unable to craft Spartan market recon right now. Ping me again in a minute.',
        ),
      );
      return {
        success: false,
        error: 'Unable to generate Spartan news article',
      };
    }

    callback?.(messageReply(runtime, message, article.body));
    return {
      success: true,
      text: article.body,
      data: { article },
    };
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Show me Spartan news',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "Locked in. Generating today's Spartan recon.",
          actions: ['SPARTAN_NEWS'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'What are the trending tokens?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Pulling the latest momentum scan.',
          actions: ['SPARTAN_NEWS'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Show me top 5 performing tokens in the last 7 days',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Seven-day leaderboard coming up.',
          actions: ['SPARTAN_NEWS'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Give me token analytics insights',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Compiling analytics dossier.',
          actions: ['SPARTAN_NEWS'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: "What's the market sentiment for my tokens?",
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Dialing in sentiment read.',
          actions: ['SPARTAN_NEWS'],
        },
      },
    ],
  ] as ActionExample[][],
} as Action;