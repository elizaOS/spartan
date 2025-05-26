import type { Action, IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { addHeader, composeActionExamples, formatActionNames, formatActions, logger } from '@elizaos/core';
import type { Sentiment } from '../types';

/**
 * Provider for Twitter Sentiment
 *
 * @typedef {import('./Provider').Provider} Provider
 * @typedef {import('./Runtime').IAgentRuntime} IAgentRuntime
 * @typedef {import('./Memory').Memory} Memory
 * @typedef {import('./State').State} State
 * @typedef {import('./Action').Action} Action
 *
 * @type {Provider}
 * @property {string} name - The name of the provider
 * @property {string} description - Description of the provider
 * @property {number} position - The position of the provider
 * @property {Function} get - Asynchronous function to get actions that validate for a given message
 *
 * @param {IAgentRuntime} runtime - The agent runtime
 * @param {Memory} message - The message memory
 * @param {State} state - The state of the agent
 * @returns {Object} Object containing data, values, and text related to actions
 */
export const sentimentProvider: Provider = {
  name: 'CRYPTOTWITTER_MARKET_SENTIMENT',
  description: 'Information about the current cryptocurrency twitter sentiment',
  dynamic: true,
  get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    // Get all sentiments
    const sentimentData = (await runtime.getCache<Sentiment[]>('sentiments')) || [];
    if (!sentimentData.length) {
      logger.warn('No sentiment data found');
      return null;
    }

    let sentiments = '\nCurrent cryptocurrency market data:';
    let idx = 1;
    for (const sentiment of sentimentData) {
      if (!sentiment?.occuringTokens?.length) continue;
      sentiments += `ENTRY ${idx}\nTIME: ${sentiment.timeslot}\nTOKEN ANALYSIS:\n`;
      for (const token of sentiment.occuringTokens) {
        sentiments += `${token.token} - Sentiment: ${token.sentiment}\n${token.reason}\n`;
      }
      sentiments += '\n-------------------\n';
      idx++;
    }

    //console.log('intel:provider - sentimentData', sentiments)

    const data = {
      sentimentData,
    };

    const values = {};

    // Combine all text sections
    const text = sentiments + '\n';

    return {
      data,
      values,
      text,
    };
  },
};
