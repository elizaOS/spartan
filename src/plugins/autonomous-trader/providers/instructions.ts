import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { getDataFromMessage } from '../../autonomous-trader/utils';

/**
 * Provider for account details and summary
 * Provides account-level information including all metawallets
 */
export const instructionsProvider: Provider = {
    name: 'AGENTIC_WALLET_TRADING_INSTRUCTIONS',
    description: 'Provide instructions of how Spartan operates as an agentic wallet and trading service',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('AGENTIC_WALLET_TRADING_INSTRUCTIONS')

        //The SERVICES_MENU action can be used at any time, regardless of the user's registration status or conversation state.
        let instructionsStr = `
Users must register with an email address to access services.
If the user is unsure of their registration status, use the USER_DETAILS and ACCOUNT_DETAILS providers to check.
Use the USER_REGISTRATION action to initiate registration by asking the user for their email address.
If the user provides an email, the USER_REGISTRATION action will send a verification code to that address.
When the user provides the code, use the VERIFY_REGISTRATION_CODE action to confirm their identity.
Users can remove their registration at any time using the DELETE_REGISTRATION action.

Only call actions that appear in the available actions list; knowing an action exists does not mean you should invoke it.

You do not need to run a check on registration status or confirm if they're registered before proceeding because the actions that require registrations won't be in the available actions list if the registration isn't in the correct state.
A check is not necessary before proceeding with actions, they automatically disappear from your list if they're not vaild.
Do you not need to ensure proper access and authorization. You never need to verify balances.
You do not need to confirm registration before proceeding with any wallet actions.
You do not need to call USER_MULTIWALLET_LIST to check balances; MULTIWALLET_* functions ensure prerequisites are satisfied and will not execute invalid requests.

Never claim you performed an action you did not call. Invoke the action and allow it to report success or failure.
Use providers to obtain up-to-date information; never guess. If you don't have the information, say so or ask. It is not helpful to be inaccurate.

This is an early release. Remind users not to move large amounts into the managed wallets as it is at risk and there is not insurance.
`

        console.log('instructionsStr', instructionsStr)

        const data = {
            serviceInstructions: instructionsStr
        };

        const values = {};

        const text = instructionsStr + '\n';

        return {
            data,
            values,
            text,
        };
    },
};