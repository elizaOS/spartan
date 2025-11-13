import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { composePromptFromState, ModelType } from '@elizaos/core';
import type { SpartanNewsService } from '../services/spartanNewsService';

interface SpartanNewsContent {
  timeFrame: string | null;
  category: string | null;
  limit: number | null;
}

const newsRequestTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Recent Messages:
{{recentMessages}}

Extract the following information about the requested Spartan news report:
- Time frame for analysis (if user specifies "last 7 days", "24 hours", "this month", etc., otherwise use null)
- Category of news (if user specifies "trending", "performance", "analytics", "holders", etc., otherwise use null)
- Limit of tokens to include (if user specifies a number like "top 5", "10 tokens", etc., otherwise use null)

Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the JSON response format without any preamble or explanation.

IMPORTANT: Your response must ONLY contain the json block above. Do not include any text, thinking, or reasoning before or after this JSON block. Start your response immediately with { and end with }.`;

export const newsProvider: Provider = {
  name: 'SPARTAN_NEWS',
  description: 'Provide the latest Spartan news recon for context.',
  dynamic: true,
  get: async (runtime: IAgentRuntime, _message: Memory, state: State) => {
    const service = runtime.getService('SPARTAN_NEWS_SERVICE') as SpartanNewsService | undefined;
    if (!service) {
      const fallback = 'Spartan news service unavailable.';
      return {
        data: { spartanNews: fallback },
        values: {},
        text: `${fallback}\n`,
      };
    }

    const sourcePrompt = composePromptFromState({
      state,
      template: newsRequestTemplate,
    });

    const content = (await runtime.useModel(ModelType.OBJECT_LARGE, {
      prompt: sourcePrompt,
    })) as SpartanNewsContent | null;

    const article =
      (await service.generateAndStoreArticle({
        timeFrame: content?.timeFrame,
        category: content?.category,
        limit: content?.limit,
      })) || (await service.getRecentArticles(1).then((items) => items[0] ?? null));

    if (!article) {
      const fallback = 'No Spartan recon ready yet.';
      return {
        data: { spartanNews: fallback },
        values: {},
        text: `${fallback}\n`,
      };
    }

    return {
      data: { spartanNews: article.body },
      values: {
        spartanNewsSummary: article.summary,
        spartanNewsCategory: article.category,
      },
      text: `${article.body}\n`,
    };
  },
};

