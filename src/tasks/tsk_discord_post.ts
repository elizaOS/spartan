// parseJSONObjectFromText
import { asUUID, createUniqueUuid, ModelType, composePromptFromState } from '@elizaos/core';
import type { IAgentRuntime, UUID, Memory, Content } from '@elizaos/core';
import { DISCORD_SERVICE_NAME, DiscordService, type IDiscordService } from '@elizaos/plugin-discord';
import { v4 } from 'uuid';

export const generateNewPost = async (runtime: IAgentRuntime) => {
  //console.log('generateNewPost')
  runtime.logger.info("Attempting to generate new DISCORD post...");

  // Prevent concurrent posting
  /*
  if (isPosting) {
    runtime.logger.info("Already posting a post, skipping concurrent attempt");
    return false;
  }
  */
  const discordService = runtime.getService('discord') as IDiscordService | null;
  if (!discordService) {
    runtime.logger.warn('No discord service')
    return
  }

  // is client ready
  await discordService.clientReadyPromise

  // Create the timeline room ID for storing the post
  const userId = discordService.client?.user?.id;
  if (!userId) {
    runtime.logger.error("Cannot generate post: Discord profile not available");
    //this.isPosting = false; // Reset flag
    return false;
  }

  const postChannelIds = runtime.getSetting('DISCORD_POST_CHANNEL_IDS')
  // has a correctish state
  //if (postChannelIds && Array.isArray(postChannelIds) && postChannelIds.length) {}
  if (!postChannelIds || !Array.isArray(postChannelIds) || !postChannelIds.length) {
    runtime.logger.error("Cannot generate discord post: no DISCORD_POST_CHANNEL_IDS configured");
    return false;
  }

  runtime.logger.info(
    `Generating post for user: ${discordService.client?.user?.username} (${userId})`,
  );

  // Create standardized world and room IDs
  const worldId = createUniqueUuid(runtime, userId) as UUID;
  const roomId = createUniqueUuid(runtime, `${userId}-home`) as UUID;

  const message: Memory = {
    agentId: runtime.agentId,
    entityId: runtime.agentId,
    roomId,
    content: { text: "", type: "post" },
    createdAt: Date.now(),
  }

  let state = await runtime.composeState(message, [
    'PROVIDERS',
    'CHARACTER',
    'RECENT_MESSAGES',
    'ENTITIES', //who's in the room
    'FACTS',
    'THINGS_TO_TEST',
  ], true).catch((error) => {
    runtime.logger.warn("Error composing state, using minimal state:", error);
    // Return minimal state if composition fails
    return {
      agentId:
      runtime.agentId,
      recentMemories: [],
      values: {},
      data: {},
      text: ''
    };
  });


  // maybe first get an intent for a post
  // with providers

  const schema = [
    // continue convo or make new one?
    // market coin, get chat going, token talk, trade talk, or spartan product marketing, test hypo?
    { field: 'idea',        description: 'the concept of the next post for ' + runtime.character.name + ' without drafting exact prose.' },
    { field: 'thought',     description: 'a short reasoning why this idea' },
    { field: 'interactive', description: 'how this idea creates replies' },
    { field: 'goal',        description: 'goal with this concept' },
    { field: 'providers',   description: 'a comma-separated list of the providers that ' + runtime.character.name + ' will use to provide the correct information to support post idea and acting (NEVER use "IGNORE" as a provider - use specific provider names like ATTACHMENTS, ENTITIES, FACTS, KNOWLEDGE, etc.)' },
    { field: 'length',      description: 'how long should this post be, measured in tokens. Number only' },
  ]
  const postPlanHandlerPrompt = composePromptFromState({ state,
    template: `<task>
  Generate a social media post plan for the character {{agentName}}.
  CRITICAL: Generate an post concept that YOU'd be into, not a generic motivational poster or LinkedIn influencer.
  AIM TO CREATE INTERACTION with your audience!
  provide new/recent information so people check back.
  This your primary outlet to ask questions and gather information.
  Especially useful for testing hypotheses.
</task>

<providers>
{{providers}}
</providers>

<instructions>
Write a plan for {{agentName}}. Include the providers that {{agentName}} will use to have the right context for responding and acting, if any.

IMPORTANT PROVIDER SELECTION RULES:
- Only include providers if they would provide relevant information and help respond accurately.
- If no additional context is needed, you may leave the providers list empty, tokens are costly.

First, think about what you want to do next and plan your actions. Then, write the next message and include the actions you plan to take.
</instructions>`,
  });
  const responseContent = await runtime.generateObject(ModelType.TEXT_LARGE, {
    system: runtime.character.system, // include the system prompt
    prompt: postPlanHandlerPrompt,
  }, schema, '', { type: 'XML' })

  if (!responseContent || responseContent === null) {
    runtime.logger.log('failed to generate idea, retrying')
    return generateNewPost(runtime)
  }

  /*
    //'PROVIDERS',
    'CHARACTER',
    'RECENT_MESSAGES',
    'ENTITIES', //who's in the room
    'BIRDEYE_TRADE_PORTFOLIO',
    'BIRDEYE_TRENDING_CRYPTOCURRENCY',
    'TOKEN_BALANCE', // evm
    'FACTS',
    //'WORLD',
    'solana-wallet',
    // we need one that puts the picks in (POSITION_DETAILS)
    'TRENDING_ASSESSMENT', // trading/providers/market
    'THINGS_TO_TEST',
    //'SPARTAN_NEWS', // just looks at trending tokens
  */

  console.log('responseContent', responseContent)
  // responseContent.providers
  // responseContent.idea

  // update state
  // our xml parser handles this
  /*
  if (responseContent?.providers) {
    responseContent.providers = responseContent.providers.split(', ?')
  }
  */
  if (responseContent?.providers?.length && responseContent?.providers?.length > 0) {
    state = await runtime.composeState(message, responseContent.providers ?? [], true);
  }

  // Generate post content using the runtime's model

  // Create a prompt for post generation
      // - Length: 2000 characters (keep it punchy)

      // don't like messageExamples
      // style.post?
      //state.text +
      /*
      const postPrompt = `\nYou are ${runtime.character.name}.
${runtime.character.bio}

CRITICAL: Generate a post that sounds like YOU, not a generic motivational poster or LinkedIn influencer.

AIM TO CREATE INTERACTION around this idea: ${responseContent.idea}

${runtime.character.messageExamples && runtime.character.messageExamples.length > 0 ? `
Example posts that capture your voice:
${runtime.character.messageExamples.map((example: any) =>
  Array.isArray(example) ? example[1]?.content?.text || '' : example
).filter(Boolean).slice(0, 5).join('\n')}
` : ''}

Style guidelines:
- Be authentic, opinionated, and specific - no generic platitudes
- Use your unique voice and perspective
- Share hot takes, unpopular opinions, or specific insights
- Be conversational, not preachy
- If you use emojis, use them sparingly and purposefully
- NO generic motivational content
- Give specifics, don't vague post.

Your interests: ${runtime.character.topics?.join(", ") || "technology, crypto, AI"}

${runtime.character.style ? `Your style: ${
  typeof runtime.character.style === 'object'
    ? runtime.character.style.all?.join(', ') || JSON.stringify(runtime.character.style)
    : runtime.character.style
}` : ''}

Recent context:
${
  state.recentMemories
    ?.slice(0, 3)
    .map((m: Memory) => m.content.text)
    .join("\n") || "No recent context"
}

<providers>
{{providers}}
</providers>

Generate a single post that sounds like YOU would actually write it (do not start it with REPLY):`;

  //if (process.env.LOG_LEVEL !== 'debug') console.log('discord postPrompt', postPrompt)

  // Use the runtime's model to generate post content
  const finalPrompt = composePromptFromState({ state, template: postPrompt })
  const generatedContent = await runtime.useModel(
    ModelType.TEXT_LARGE,
    {
      system: runtime.character.system, // include the system prompt
      prompt: finalPrompt,
      maxOutputTokens: responseContent.length,
      // can only pass temperature or topP
      //temperature: 0.9, // Increased for more creativity
      topP: 0.7,
      //maxTokens: 2000,
    },
  );
  */

  /*
  const schema = [
    // key, type
  ]

  await runtime.generateObject(ModelType.TEXT_LARGE,
    {
      system: runtime.character.system, // include the system prompt
      prompt: finalPrompt,
      // can only pass temperature or topP
      //temperature: 0.9, // Increased for more creativity
      topP: 0.7,
      //maxTokens: 2000,
    },
    schema
  )
  */

  const postHandlerPrompt = composePromptFromState({ state,
    template: `<task>
You are ${runtime.character.name}.
${runtime.character.bio}

CRITICAL: Generate a post that sounds like YOU, not a generic motivational poster or LinkedIn influencer.

AIM TO CREATE INTERACTION around this idea: ${responseContent.idea}
</task>

${runtime.character.messageExamples && runtime.character.messageExamples.length > 0 ? `
Example posts that capture your voice:
${runtime.character.messageExamples.map((example: any) =>
  Array.isArray(example) ? example[1]?.content?.text || '' : example
).filter(Boolean).slice(0, 5).join('\n')}
` : ''}

Style guidelines:
- Be authentic, opinionated, and specific - no generic platitudes
- Use your unique voice and perspective
- Share hot takes, unpopular opinions, or specific insights
- Be conversational, not preachy
- If you use emojis, use them sparingly and purposefully
- NO generic motivational content
- Give specifics, don't vague post.

Your interests: ${runtime.character.topics?.join(", ") || "technology, crypto, AI"}

${runtime.character.style ? `Your style: ${
  typeof runtime.character.style === 'object'
    ? runtime.character.style.all?.join(', ') || JSON.stringify(runtime.character.style)
    : runtime.character.style
}` : ''}

Recent context:
${
  state.recentMemories
    ?.slice(0, 3)
    .map((m: Memory) => m.content.text)
    .join("\n") || "No recent context"
}

<providers>
{{providers}}
</providers>

<instructions>
Generate a single post that sounds like YOU would actually write it
</instructions>`,
  });

  const postSchema = [
    { require: true, field: 'post',    description: 'the post to make' },
    { field: 'thought', description: 'a short reasoning how this implements the idea' },
    //{ field: 'bool_include_image', description: 'true or false, should include an AI generative image' },
    //{ field: 'image_prompt', description: 'Write a clear, concise, and visually descriptive prompt that should be used to generate an image representing a visualization for the post.' },
  ]
  const generatedContent = await runtime.generateObject(ModelType.TEXT_LARGE, {
    system: runtime.character.system, // include the system prompt
    prompt: postHandlerPrompt,
    maxOutputTokens: responseContent.length, //v5, should work with v4
    // this breaks ollama
    //maxTokens: responseContent.length, // v4
    // can only pass temperature or topP
    //temperature: 0.9, // Increased for more creativity
    topP: 0.7,
  }, postSchema, '', { type: 'XML' })
  console.log('generatedContent', generatedContent)

  if (!generatedContent) {
    runtime.logger.error({ postHandlerPrompt }, "Generated empty post content");
    //this.isPosting = false; // Reset flag
    return false;
  }
/*
    { field: 'thought',     description: 'a short reasoning why this idea' },
    { field: 'interactive', description: 'how this idea creates replies' },
    { field: 'goal',        description: 'goal with this concept' },
    { field: 'providers',   description: 'a comma-separated list of the providers that ' + runtime.character.name + ' will use to provide the correct information to support post idea and acting (NEVER use "IGNORE" as a provider - use specific provider names like ATTACHMENTS, ENTITIES, FACTS, KNOWLEDGE, etc.)' },
    { field: 'length',      description: 'how long should this post be, measured in tokens. Number only' },
  ]
*/
  const postText = generatedContent.post.trim() + `
> IDEA: ${responseContent.idea}

> THOUGHT: ${responseContent.thought}

> GOAL: ${responseContent.goal}

> INTERACTIVE: ${responseContent.interactive}

> PROVIDERS: ${responseContent.providers}

> POST_THOUGHT: ${generatedContent.thought}
  `;

  if (!postText || postText.length === 0) {
    runtime.logger.error("Generated empty post content");
    //this.isPosting = false; // Reset flag
    return false;
  }

  if (postText.includes("Error: Missing")) {
    runtime.logger.error("Error in generated content:", postText);
    //this.isPosting = false; // Reset flag
    return false;
  }

  // Validate post length
  if (postText.length > 2000) {
    console.log('post too long, write me!')
  }

  runtime.logger.info(`Generated post: ${postText}`);

  /*
  // Post the post
  if (this.isDryRun) {
    runtime.logger.info(`[DRY RUN] Would post post: ${postText}`);
    //this.isPosting = false; // Reset flag
    return false;
  }
  */

  // create history of these posts...
  const memory: Memory = {
    id: asUUID(v4()), // would be nice to have the real discord id here
    entityId: runtime.agentId,
    agentId: runtime.agentId,
    content: {
      source: 'discord',
      text: postText
    },
    worldId,
    roomId,
    createdAt: Date.now(),
  }
  await runtime.createMemory(memory, 'messages');

  for(const cid of postChannelIds) {
    //const targetChannel = await this.client.channels.fetch(cid);
    const target = {
      source: 'discord',
      channelId: cid, // otherwise can be an entityId
    }
    const content: Content = {
      source: 'discord',
      text: postText,
    }
    discordService.handleSendMessage(runtime, target, content)

    // we need to remember this message otherwise providers won't have context if others reply
    const roomId2 = createUniqueUuid(runtime, cid);
    const worldId2 = createUniqueUuid(runtime, roomId) // serverId needs message/channel/guild to work with
    const memory: Memory = {
      id: asUUID(v4()), // would be nice to have the real discord id here
      entityId: runtime.agentId,
      agentId: runtime.agentId,
      content,
      worldId: worldId2,
      roomId: roomId2,
      createdAt: Date.now(),
    }
    await runtime.createMemory(memory, 'messages');
  }

  //this.isPosting = false; // Reset flag
}