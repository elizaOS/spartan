import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { createUniqueUuid } from '@elizaos/core';
import { getDataFromMessage } from '../../autonomous-trader/utils'
import { parseDateFilterFromMessage, applyDateFilterToAccount, formatDateFilterText } from '../../autonomous-trader/providers/date_filter'

/**
 * Provider for account details and summary
 * Provides account-level information including all metawallets
 */
export const marketProvider: Provider = {
    name: 'TRENDING_ASSESSMENT',
    description: 'Assessment of trending market',
    // always there for posts
    //dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('TRENDING_ASSESSMENT')

        let marketStr = ''

        const roomId = createUniqueUuid(runtime, 'strategy_llm');
        const memories = await runtime.getMemories({
          agentId: runtime.agentId,
          // entityId is agentId
          roomId,
          // maybe it should be the last 3, so you can seeing if it's shift?
          count: 1,
          unique: true,
          tableName: 'trendingConditions',
        });
        //console.log('memories', memories)
        if (memories.length) {
          marketStr = 'Last trending token analysis:\n' + memories[0].content.text
        }

        console.log('holderStr', marketStr)

        const data = {
            marketDetails: marketStr
        };

        const values = {};

        const text = marketStr + '\n';

        return {
            data,
            values,
            text,
        };
    },
};