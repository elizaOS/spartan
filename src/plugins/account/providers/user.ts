import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { getAccountFromMessage } from '../../autonomous-trader/utils'
import { parseDateFilterFromMessage, applyDateFilterToAccount, formatDateFilterText } from '../../autonomous-trader/providers/date_filter'

/**
 * Provider for account details and summary
 * Provides account-level information including all metawallets
 */
export const userProvider: Provider = {
    name: 'USER_DETAILS',
    description: 'User-level information',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('USER_DETAILS')

        let userStr = ''

        // DM or public?
        const isDM = message.content.channelType?.toUpperCase() === 'DM'
        if (isDM) {
          // do we have an registration
          // email set
          // is it registered
          const component = await getDataFromMessage(runtime, message)
          console.log('USER_DETAILS component', component)
        } else {
            userStr = 'User details are only available in private messages.'
        }
        console.log('userStr', userStr)

        const data = {
            userDetails: userStr
        };

        const values = {};

        const text = userStr + '\n';

        return {
            data,
            values,
            text,
        };
    },
};