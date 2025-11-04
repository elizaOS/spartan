/**
 * Spartan MCP Gateway
 * 
 * Main entry point for the MCP server that provides access to DeFi data
 * through the Model Context Protocol.
 * 
 * Usage:
 *   spartan-mcp --config=path/to/config.yaml
 *   bun run src/index.ts --config=configs/coingecko-config-wrapper.yaml
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MCPConfig } from './types.js';
import { createAPIHandler } from './api-handler.js';
import { createCacheManager } from './cache.js';
import { createLogger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Parse command line arguments
 */
function parseArgs(): { configPath: string } {
  const args = process.argv.slice(2);
  const configArg = args.find(arg => arg.startsWith('--config='));

  if (!configArg) {
    console.error('Error: --config argument is required');
    console.error('Usage: spartan-mcp --config=path/to/config.yaml');
    process.exit(1);
  }

  const configPath = configArg.split('=')[1];
  return { configPath };
}

/**
 * Load and parse configuration file
 */
function loadConfig(configPath: string): MCPConfig {
  try {
    const configContent = readFileSync(configPath, 'utf-8');
    const config = parseYaml(configContent) as MCPConfig;
    return config;
  } catch (error) {
    console.error(`Error loading config from ${configPath}:`, error);
    process.exit(1);
  }
}

/**
 * Main server function
 */
async function main(): Promise<void> {
  const { configPath } = parseArgs();
  const config = loadConfig(configPath);

  const logger = createLogger(config.logging || {});
  const cache = createCacheManager(config.cache || { enabled: false, ttl_seconds: 300, max_entries: 100 });
  const apiHandler = createAPIHandler(config, cache, logger);

  logger.info(`Starting ${config.name} v${config.version}`);
  logger.info(`Description: ${config.description}`);

  // Create MCP server
  const server = new Server(
    {
      name: config.name,
      version: config.version,
    },
    {
      capabilities: {
        tools: config.server.capabilities.tools === true || typeof config.server.capabilities.tools === 'object' ? (typeof config.server.capabilities.tools === 'boolean' ? {} : config.server.capabilities.tools) : undefined,
        resources: config.server.capabilities.resources === true || typeof config.server.capabilities.resources === 'object' ? (typeof config.server.capabilities.resources === 'boolean' ? {} : config.server.capabilities.resources) : undefined,
        prompts: config.server.capabilities.prompts === true || typeof config.server.capabilities.prompts === 'object' ? (typeof config.server.capabilities.prompts === 'boolean' ? {} : config.server.capabilities.prompts) : undefined
      },
    }
  );

  // Register tool listing handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug('Received ListTools request');

    return {
      tools: config.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.input_schema
      }))
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    logger.info(`Tool called: ${name}`, { arguments: args });

    try {
      const tool = config.tools.find(t => t.name === name);

      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      const result = await apiHandler.executeTool(tool, args || {});

      logger.info(`Tool ${name} completed successfully`);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error(`Tool ${name} failed:`, error);

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  });

  // Register resource handlers if enabled
  if (config.server.capabilities.resources && config.resources) {
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      logger.debug('Received ListResources request');

      return {
        resources: config.resources!.map(resource => ({
          uri: resource.uri,
          name: resource.name,
          description: resource.description,
          mimeType: 'application/json'
        }))
      };
    });

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      logger.info(`Resource requested: ${uri}`);

      try {
        const resource = config.resources!.find(r => r.uri === uri);

        if (!resource) {
          throw new Error(`Unknown resource: ${uri}`);
        }

        // Fetch resource data (implement based on URI scheme)
        const data = await apiHandler.fetchResource(uri);

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        logger.error(`Resource ${uri} failed:`, error);
        throw error;
      }
    });
  }

  // Register prompt handlers if enabled
  if (config.server.capabilities.prompts && config.prompts) {
    server.setRequestHandler(ListPromptsRequestSchema, async () => {
      logger.debug('Received ListPrompts request');

      return {
        prompts: config.prompts!.map(prompt => ({
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments
        }))
      };
    });

    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      logger.info(`Prompt requested: ${name}`);

      try {
        const prompt = config.prompts!.find(p => p.name === name);

        if (!prompt) {
          throw new Error(`Unknown prompt: ${name}`);
        }

        // Generate prompt content based on configuration
        const messages = await apiHandler.generatePrompt(prompt, args || {});

        return {
          description: prompt.description,
          messages
        };
      } catch (error) {
        logger.error(`Prompt ${name} failed:`, error);
        throw error;
      }
    });
  }

  // Create transport
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);

  logger.info(`${config.name} is now running`);
  logger.info(`Available tools: ${config.tools.length}`);
  if (config.resources) {
    logger.info(`Available resources: ${config.resources.length}`);
  }
  if (config.prompts) {
    logger.info(`Available prompts: ${config.prompts.length}`);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

