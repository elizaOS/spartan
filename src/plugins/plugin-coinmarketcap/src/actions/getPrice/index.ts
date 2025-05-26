import {
    logger,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    type Action,
} from "@elizaos/core";
import { validateCoinMarketCapConfig } from "../../environment";
import { priceExamples } from "./examples";
import { createPriceService } from "./service";
import { getPriceTemplate } from "./template";
import type { GetPriceContent } from "./types";
import { isGetPriceContent } from "./validation";

export default {
    name: "GET_PRICE",
    similes: [
        "CHECK_PRICE",
        "PRICE_CHECK",
        "GET_CRYPTO_PRICE",
        "CHECK_CRYPTO_PRICE",
        "GET_TOKEN_PRICE",
        "CHECK_TOKEN_PRICE",
    ],
    // eslint-disable-next-line
    validate: async (runtime: IAgentRuntime, _message: Memory) => {
        await validateCoinMarketCapConfig(runtime);
        return true;
    },
    description: "Get the current price of a cryptocurrency from CoinMarketCap",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        logger.log("Starting CoinMarketCap GET_PRICE handler...");

        // Initialize or update state
        let currentState = state;
        if (!currentState) {
            currentState = (await runtime.composeState(message)) as State;
        } else {
            //currentState = await runtime.updateRecentMessageState(currentState);
        }

        try {
            // Compose and generate price check content
            const priceContext = composeContext({
                state: currentState,
                template: getPriceTemplate,
            });

            /*
            const content = (await generateObjectDeprecated({
                runtime,
                context: priceContext,
                modelClass: ModelClass.SMALL,
            })) as unknown as GetPriceContent;
            */
            const content = await runtime.useModel(ModelType.OBJECT_SMALL, {
              prompt: priceContext,
            });

            // Validate content
            if (!isGetPriceContent(content)) {
                throw new Error("Invalid price check content");
            }

            // Get price from CoinMarketCap
            const config = await validateCoinMarketCapConfig(runtime);

            const priceService = createPriceService(
                config.COINMARKETCAP_API_KEY
            );

            try {
                const priceData = await priceService.getPrice(
                    content.symbol,
                    content.currency
                );
                logger.success(
                    `Price retrieved successfully! ${content.symbol}: ${priceData.price} ${content.currency.toUpperCase()}`
                );

                if (callback) {
                    callback({
                        text: `The current price of ${content.symbol} is ${priceData.price} ${content.currency.toUpperCase()}`,
                        content: {
                            symbol: content.symbol,
                            currency: content.currency,
                            ...priceData,
                        },
                    });
                }

                return true;
            } catch (error) {
                logger.error("Error in GET_PRICE handler:", error);
                if (callback) {
                    callback({
                        text: `Error fetching price: ${error.message}`,
                        content: { error: error.message },
                    });
                }
                return false;
            }
        } catch (error) {
            logger.error("Error in GET_PRICE handler:", error);
            if (callback) {
                callback({
                    text: `Error fetching price: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }
    },
    examples: priceExamples,
} as Action;
