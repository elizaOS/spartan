import {
    type Action,
    type ActionExample,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    ModelType,
    type State,
    composePromptFromState,
    logger,
    createUniqueUuid,
    parseJSONObjectFromText,
} from '@elizaos/core';
import {
    PublicKey,
} from '@solana/web3.js';
import { v4 as uuidv4 } from 'uuid';
import { UUID } from 'crypto';
import { SOLANA_SERVICE_NAME } from '../constants';
import { HasEntityIdFromMessage, getAccountFromMessage, takeItPrivate, takeItPrivate2, askLlmObject } from '../utils';

/**
 * Interface representing the content of a token scam check request.
 *
 * @interface TokenScamCheckContent
 * @extends Content
 * @property {string | null} tokenAddress - The address of the token to check for scam status
 */
interface TokenScamCheckContent extends Content {
    tokenAddress: string | null;
}

/**
 * Template for determining which token to check for scam status.
 */
const tokenAddressTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Recent Messages:
{{recentMessages}}

Extract the following information about the requested token scam check:
- Token address to check for scam status (if user specifies a specific token address, otherwise use null)

Example responses:
If user specifies a token address:
\`\`\`json
{
    "tokenAddress": "So11111111111111111111111111111111111111112"
}
\`\`\`

If user asks "is this token a scam?" without specifying an address:
\`\`\`json
{
    "tokenAddress": null
}
\`\`\`

If user asks about a specific token by name or symbol, try to extract the address from context:
\`\`\`json
{
    "tokenAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
}
\`\`\`

Do NOT include any thinking, reasoning, or <think> sections in your response.
Go directly to the JSON response format without any preamble or explanation.

IMPORTANT: Your response must ONLY contain the json block above. Do not include any text, thinking, or reasoning before or after this JSON block. Start your response immediately with { and end with }.`;

/**
 * Interface for RugCheck API response
 */
interface RugCheckResponse {
    mint: string;
    tokenProgram: string;
    creator: string;
    creatorBalance: number;
    token: {
        mintAuthority: string | null;
        supply: number;
        decimals: number;
        isInitialized: boolean;
        freezeAuthority: string | null;
    };
    tokenMeta: {
        name: string;
        symbol: string;
        uri: string;
        mutable: boolean;
        updateAuthority: string;
    };
    topHolders: Array<{
        address: string;
        amount: number;
        decimals: number;
        pct: number;
        uiAmount: number;
        uiAmountString: string;
        owner: string;
        insider: boolean;
    }>;
    freezeAuthority: string | null;
    mintAuthority: string | null;
    risks: Array<{
        name: string;
        value: string;
        description: string;
        score: number;
        level: string;
    }>;
    score: number;
    score_normalised: number;
    fileMeta: {
        description: string;
        name: string;
        symbol: string;
        image: string;
    };
    totalMarketLiquidity: number;
    totalStableLiquidity: number;
    totalLPProviders: number;
    totalHolders: number;
    price: number;
    rugged: boolean;
    tokenType: string;
    transferFee: {
        pct: number;
        maxAmount: number;
        authority: string;
    };
    knownAccounts: Record<string, {
        name: string;
        type: string;
    }>;
    events: any[];
    verification: any;
    graphInsidersDetected: number;
    insiderNetworks: any;
    detectedAt: string;
    creatorTokens: any;
}

export default {
    name: 'TOKEN_SCAM',
    similes: [
        'TOKEN_SCAM_CHECK',
        'TOKEN_SCAM_QUERY',
        'TOKEN_SCAM_LOOKUP',
        'TOKEN_SCAM_INFO',
        'TOKEN_SCAM_DETAILS',
        'TOKEN_SCAM_REPORT',
        'TOKEN_SCAM_STATUS',
        'TOKEN_SCAM_OVERVIEW',
        'TOKEN_SCAM_VIEW',
        'TOKEN_SCAM_DISPLAY',
        'TOKEN_SCAM_SHOW',
        'TOKEN_RISK_CHECK',
        'TOKEN_RISK_QUERY',
        'TOKEN_RISK_LOOKUP',
        'TOKEN_RISK_INFO',
        'TOKEN_RISK_DETAILS',
        'TOKEN_RISK_REPORT',
        'TOKEN_RISK_STATUS',
        'TOKEN_RISK_OVERVIEW',
        'TOKEN_RISK_VIEW',
        'TOKEN_RISK_DISPLAY',
        'TOKEN_RISK_SHOW',
        'RUGCHECK',
        'RUGCHECK_TOKEN',
        'RUGCHECK_QUERY',
        'RUGCHECK_LOOKUP',
        'RUGCHECK_INFO',
        'RUGCHECK_DETAILS',
        'RUGCHECK_REPORT',
        'RUGCHECK_STATUS',
        'RUGCHECK_OVERVIEW',
        'RUGCHECK_VIEW',
        'RUGCHECK_DISPLAY',
        'RUGCHECK_SHOW',
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        if (!await HasEntityIdFromMessage(runtime, message)) {
            console.warn('TOKEN_SCAM validate - author not found')
            return false
        }

        const account = await getAccountFromMessage(runtime, message)
        if (!account) return false;

        return true;
    },
    description: 'Check if a specific Solana token is a scam or has high risk using the RugCheck API.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: Memory[] = []
    ): Promise<boolean> => {
        logger.log('TOKEN_SCAM Starting token scam check handler...');

        const sourcePrompt = composePromptFromState({
            state: state,
            template: tokenAddressTemplate,
        });
        const sourceResult = await askLlmObject(runtime, { prompt: sourcePrompt }, ['tokenAddress']);
        console.log('TOKEN_SCAM sourceResult', sourceResult)


        const account = await getAccountFromMessage(runtime, message)
        if (!account) {
            console.log('TOKEN_SCAM no account found')
            return false
        }

        // Check if token address was provided
        if (!sourceResult.tokenAddress) {
            console.log('TOKEN_SCAM no token address provided')
            callback?.(takeItPrivate(runtime, message, 'Please provide a specific token address to check for scam status. For example: "Is token So11111111111111111111111111111111111111112 a scam?"'))
            return true
        }

        // Validate token address format
        try {
            new PublicKey(sourceResult.tokenAddress)
        } catch (error) {
            console.log('TOKEN_SCAM invalid token address format', sourceResult.tokenAddress)
            callback?.(takeItPrivate(runtime, message, 'Invalid token address format. Please provide a valid Solana token address.'))
            return true
        }

        // Call RugCheck API
        let rugCheckData: RugCheckResponse | null = null
        try {
            const response = await fetch(`https://api.rugcheck.xyz/v1/tokens/${sourceResult.tokenAddress}/report`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`RugCheck API error: ${response.status} ${response.statusText}`);
            }

            rugCheckData = await response.json() as RugCheckResponse;
            console.log('TOKEN_SCAM rugCheckData', rugCheckData)
        } catch (error) {
            console.error('TOKEN_SCAM error calling RugCheck API', error)
            callback?.(takeItPrivate(runtime, message, 'Error retrieving token scam check data. Please try again.'))
            return true
        }

        if (!rugCheckData) {
            console.log('TOKEN_SCAM no data returned from RugCheck API')
            callback?.(takeItPrivate(runtime, message, 'No data available for this token address.'))
            return true
        }

        // Format the response based on actual API structure
        let scamReport = `🔍 **Token Scam Check Report**\n\n`
        scamReport += `**Token Information:**\n`
        scamReport += `• Name: ${rugCheckData.tokenMeta?.name || 'Unknown'}\n`
        scamReport += `• Symbol: ${rugCheckData.tokenMeta?.symbol || 'Unknown'}\n`
        scamReport += `• Address: ${rugCheckData.mint}\n`
        scamReport += `• Holders: ${rugCheckData.totalHolders?.toLocaleString() || 'Unknown'}\n`
        scamReport += `• Price: $${rugCheckData.price?.toFixed(6) || 'Unknown'}\n`
        scamReport += `• Market Cap: $${(rugCheckData.price * rugCheckData.token.supply / Math.pow(10, rugCheckData.token.decimals))?.toLocaleString() || 'Unknown'}\n\n`

        scamReport += `**Risk Assessment:**\n`
        scamReport += `• Risk Score: ${Math.min(rugCheckData.score || 0, 100)}/100\n`
        scamReport += `• Risk Level: ${rugCheckData.risks?.[0]?.level?.toUpperCase() || 'Unknown'}\n`

        if (rugCheckData.risks && rugCheckData.risks.length > 0) {
            scamReport += `• Risk Flags: ${rugCheckData.risks.map(r => r.name).join(', ')}\n`
        }
        scamReport += '\n'

        scamReport += `**Liquidity Analysis:**\n`
        scamReport += `• Total Market Liquidity: $${rugCheckData.totalMarketLiquidity?.toLocaleString() || 'Unknown'}\n`
        scamReport += `• Total Stable Liquidity: $${rugCheckData.totalStableLiquidity?.toLocaleString() || 'Unknown'}\n\n`

        scamReport += `**Contract Security:**\n`
        scamReport += `• Mint Authority: ${rugCheckData.mintAuthority ? '❌ Active' : '✅ Disabled'}\n`
        scamReport += `• Freeze Authority: ${rugCheckData.freezeAuthority ? '❌ Active' : '✅ Disabled'}\n`
        scamReport += `• Rugged: ${rugCheckData.rugged ? '🚨 Yes' : '✅ No'}\n\n`

        // Determine if it's likely a scam
        const cappedScore = Math.min(rugCheckData.score || 0, 100);
        const isLikelyScam = cappedScore >= 70 || rugCheckData.rugged || (rugCheckData.risks?.[0]?.level?.toLowerCase() === 'danger');
        const scamVerdict = isLikelyScam ? '🚨 **HIGH RISK - LIKELY A SCAM**' : '✅ **LOW RISK - APPEARS LEGITIMATE**';

        scamReport += `**Verdict:** ${scamVerdict}\n\n`

        if (isLikelyScam) {
            scamReport += `⚠️ **WARNING:** This token shows multiple red flags and should be avoided. Consider it a potential scam.\n`
        } else {
            scamReport += `✅ **SAFE:** This token appears to be legitimate based on the analysis.\n`
        }

        console.log('TOKEN_SCAM scamReport', scamReport)

        // Send response using takeItPrivate2
        takeItPrivate2(runtime, message, scamReport, callback)

        return true;
    },

    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Is this token a scam? So11111111111111111111111111111111111111111',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll check if that token is a scam for you.',
                    actions: ['TOKEN_SCAM'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Check if this token is safe: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Let me analyze that token for potential scam indicators.',
                    actions: ['TOKEN_SCAM'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Rugcheck this token for me',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I need a specific token address to perform a rugcheck analysis.',
                    actions: ['TOKEN_SCAM'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Is SOL a scam token?',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll check SOL\'s scam status for you.',
                    actions: ['TOKEN_SCAM'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'What\'s the risk level of this token?',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Please provide the token address you\'d like me to analyze for risk.',
                    actions: ['TOKEN_SCAM'],
                },
            },
        ],
    ] as ActionExample[][],
} as Action; 