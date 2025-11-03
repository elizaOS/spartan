import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { getDataFromMessage } from '../../autonomous-trader/utils'

/**
 * Provider for account details and summary
 * Provides account-level information including all metawallets
 */
export const linksProvider: Provider = {
    name: 'SPARTAN_LINKS',
    description: 'Provides links address of Spartan as a service',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('SPARTAN_LINKS')

        let linksStr = `
Website: https://spartan.elizaos/ai/
Link tree: https://bento.me/SpartanVersus
X/Twitter: https://x.com/SpartanVersus
Farcaster: https://farcaster.xyz/SpartanVersus
Source code: https://github.com/elizaos/spartan
elizaOS github: https://github.com/elizaos/eliza
Terms of Use: https://spartan.elizaos.ai/tc.html
Privacy Policy: https://spartan.elizaos.ai/pp.html
`

        console.log('linksStr', linksStr)

        const data = {
            spartanLinks: linksStr
        };

        const values = {};

        const text = linksStr + '\n';

        return {
            data,
            values,
            text,
        };
    },
};