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
import { HasEntityIdFromMessage, getAccountFromMessage, extractEmails, takeItPrivate2, askLlmObject } from '../utils';

export default {
    name: 'EMAIL_UUID',
    similes: [
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        return true;
    },
    description: 'Converts an email to UUID',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: Memory[] = []
    ): Promise<boolean> => {
        logger.log('EMAIL_UUID');
        const emails = extractEmails(message.content.text)
        const result = {}
        if (emails.length) {
          for(const e of emails) {
            result[e] = createUniqueUuid(runtime, e);
          }
        }

        // Send response using takeItPrivate2
        takeItPrivate2(runtime, message, JSON.stringify(result), callback)
        return true;
    },

    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'UUID for email@email.com',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll get that for you.',
                    actions: ['EMAIL_UUID'],
                },
            },
        ],
    ] as ActionExample[][],
} as Action;