import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { getDataFromMessage } from '../../autonomous-trader/utils'

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
The USER_REGISTRATION action should be used to initiate registration by asking the user for their email address.
If the user provides an email, USER_REGISTRATION action will send a verification code to that address.
When the user provides the code, use the VERIFY_REGISTRATION_CODE action to confirm their identity.
Users can remove their registration at any time using the DELETE_REGISTRATION action.

Only call actions in available actions, just because you know about an action doesn't mean you can/should call it.

You do not need to run a check on registration status or confirm if they're registered before proceeding because the actions that require registrations won't be in the available actions list if the registration isn't in the correct state.
A check is not necessary before proceeding with actions, they automatically disappear from your list if they're not vaild.
Do you not need to ensure proper access and authorization. You never need to verify balances.
You do not need to confirm registration before proceeding with any wallet actions.
You do not need to call MULTIWALLET_LIST to check balances, MULTIWALLET_* functions will ensure on their own and will not carry out an invalid action

Never tell a user you performed an action you didn't. Call actions, the actions will tell the user if they're success or not.
Use providers to get up to date information, never guess.

THIS IS ALPHA, REMIND THEM TO NOT GIVE AGENT MORE THAN $100usd to these wallets we manage because of the early development nature.
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