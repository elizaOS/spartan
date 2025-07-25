import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { getDataFromMessage } from '../../autonomous-trader/utils'
import { parseDateFilterFromMessage, applyDateFilterToAccount, formatDateFilterText } from '../../autonomous-trader/providers/date_filter'

/**
 * Provider for account details and summary
 * Provides account-level information including all metawallets
 */
export const holderProvider: Provider = {
    name: 'HOLDER_DETAILS',
    description: 'User holder information like are they holding enough degenai or ai16z to use premium strategies',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('HOLDER_DETAILS')

        let holderStr = ''

        // DM or public?
        const isDM = message.content.channelType?.toUpperCase() === 'DM'
        //const componentData = await getDataFromMessage(runtime, message)
        if (isDM) {
        } else {
        }
        console.log('holderStr', holderStr)

        const data = {
            userDetails: holderStr
        };

        const values = {};

        const text = holderStr + '\n';

        return {
            data,
            values,
            text,
        };
    },
};