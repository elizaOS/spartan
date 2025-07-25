import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { getDataFromMessage } from '../../autonomous-trader/utils'
import { parseDateFilterFromMessage, applyDateFilterToAccount, formatDateFilterText } from '../../autonomous-trader/providers/date_filter'

/**
 * Provider for account details and summary
 * Provides account-level information including all metawallets
 */
export const userProvider: Provider = {
    name: 'USER_DETAILS',
    description: 'User registration information like email address and if theyre verified and ready to use services',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('USER_DETAILS')

        let userStr = ''

        // DM or public?
        const isDM = message.content.channelType?.toUpperCase() === 'DM'
        const componentData = await getDataFromMessage(runtime, message)
        if (isDM) {
          // do we have an registration
          // email set
          // is it registered
          //console.log('USER_DETAILS component', componentData)
          // address, verified
          if (componentData.address) {
            userStr += 'registered with email address: ' + componentData.address + '\n'
            userStr += 'email address verified: ' + (componentData.verified ? 'verified' : 'awaiting verification') + '\n'
          } else {
            userStr += 'user has not registered' + '\n'
          }
        } else {
          if (componentData.address && componentData.verified) {
            userStr += 'user is registered' + '\n'
          } else {
            userStr += 'user has not registered' + '\n'
          }
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