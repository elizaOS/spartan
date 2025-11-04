/**
 * API Handler for executing tool calls and managing API requests
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { MCPConfig, ToolConfig, Logger, PromptConfig } from './types.js';
import { CacheManager } from './cache.js';

export class APIHandler {
  private client: AxiosInstance;
  private config: MCPConfig;
  private cache: CacheManager;
  private logger: Logger;
  private requestCount: number = 0;
  private lastResetTime: number = Date.now();

  constructor(config: MCPConfig, cache: CacheManager, logger: Logger) {
    this.config = config;
    this.cache = cache;
    this.logger = logger;

    // Create axios instance with base configuration
    this.client = axios.create({
      baseURL: config.api.base_url,
      timeout: config.api.timeout || 10000,
      headers: config.api.headers || {}
    });

    // Add authentication if configured
    this.setupAuthentication();

    // Add request/response interceptors
    this.setupInterceptors();
  }

  private setupAuthentication(): void {
    if (!this.config.auth || this.config.auth.type === 'none') {
      return;
    }

    const auth = this.config.auth;
    const apiKey = auth.key_env ? process.env[auth.key_env] : undefined;

    if (auth.required && !apiKey) {
      throw new Error(`Authentication required but ${auth.key_env} not found in environment`);
    }

    if (apiKey) {
      if (auth.type === 'api_key' && auth.key_location === 'header' && auth.key_name) {
        this.client.defaults.headers.common[auth.key_name] = apiKey;
        this.logger.info(`Authentication configured: ${auth.type} via ${auth.key_location}`);
      } else if (auth.type === 'bearer') {
        this.client.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;
        this.logger.info('Authentication configured: Bearer token');
      }
    }
  }

  private setupInterceptors(): void {
    // Request interceptor for logging and rate limiting
    this.client.interceptors.request.use(
      async (config) => {
        // Check rate limit
        await this.checkRateLimit();

        this.logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
          params: config.params,
          data: config.data
        });

        return config;
      },
      (error) => {
        this.logger.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug(`API Response: ${response.status}`, {
          url: response.config.url,
          data: response.data
        });
        return response;
      },
      async (error) => {
        this.logger.error('API Error:', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });

        // Retry logic if configured
        if (this.shouldRetry(error)) {
          return this.retryRequest(error);
        }

        return Promise.reject(error);
      }
    );
  }

  private async checkRateLimit(): Promise<void> {
    if (!this.config.api.rate_limit) {
      return;
    }

    const now = Date.now();
    const elapsed = now - this.lastResetTime;
    const resetInterval = 60000; // 1 minute

    // Reset counter if a minute has passed
    if (elapsed >= resetInterval) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    // Check if we've exceeded the rate limit
    if (this.requestCount >= this.config.api.rate_limit.requests_per_minute) {
      const waitTime = resetInterval - elapsed;
      this.logger.warn(`Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastResetTime = Date.now();
    }

    this.requestCount++;
  }

  private shouldRetry(error: any): boolean {
    if (!this.config.error_handling?.retry_on_failure) {
      return false;
    }

    // Retry on network errors or 5xx status codes
    return !error.response || (error.response.status >= 500 && error.response.status < 600);
  }

  private async retryRequest(error: any, attempt: number = 1): Promise<any> {
    const maxRetries = this.config.error_handling?.max_retries || 3;

    if (attempt >= maxRetries) {
      return Promise.reject(error);
    }

    const baseDelay = this.config.error_handling?.retry_delay_ms || 1000;
    const delay = this.config.error_handling?.exponential_backoff
      ? baseDelay * Math.pow(2, attempt - 1)
      : baseDelay;

    this.logger.info(`Retrying request (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms`);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      return await this.client.request(error.config);
    } catch (retryError) {
      return this.retryRequest(retryError, attempt + 1);
    }
  }

  async executeTool(tool: ToolConfig, args: Record<string, any>): Promise<any> {
    const cacheKey = `tool:${tool.name}:${JSON.stringify(args)}`;

    // Check cache if enabled
    if (this.config.cache?.enabled) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for ${tool.name}`);
        return cached;
      }
    }

    // Build request configuration
    const requestConfig: AxiosRequestConfig = {
      method: tool.endpoint.method,
      url: this.buildPath(tool.endpoint.path, args),
    };

    // Add query parameters
    if (tool.endpoint.params) {
      requestConfig.params = this.buildParams(tool.endpoint.params, args);
    }

    // Add request body
    if (tool.endpoint.body && (tool.endpoint.method === 'POST' || tool.endpoint.method === 'PUT')) {
      requestConfig.data = this.buildBody(tool.endpoint.body, args);
    }

    // Add custom headers
    if (tool.endpoint.headers) {
      requestConfig.headers = tool.endpoint.headers;
    }

    // Execute request
    const response = await this.client.request(requestConfig);

    // Cache result if enabled
    if (this.config.cache?.enabled) {
      this.cache.set(cacheKey, response.data, this.config.cache.ttl_seconds);
    }

    return response.data;
  }

  private buildPath(pathTemplate: string, args: Record<string, any>): string {
    let path = pathTemplate;
    
    // Replace path parameters like /coins/{id}
    const pathParams = path.match(/\{(\w+)\}/g);
    if (pathParams) {
      for (const param of pathParams) {
        const key = param.slice(1, -1); // Remove { }
        if (args[key] !== undefined) {
          path = path.replace(param, String(args[key]));
        }
      }
    }

    return path;
  }

  private buildParams(paramsTemplate: Record<string, string>, args: Record<string, any>): Record<string, any> {
    const params: Record<string, any> = {};

    for (const [key, template] of Object.entries(paramsTemplate)) {
      const value = this.resolveTemplate(template, args);
      if (value !== undefined && value !== null && value !== '') {
        params[key] = value;
      }
    }

    return params;
  }

  private buildBody(bodyTemplate: Record<string, string>, args: Record<string, any>): Record<string, any> {
    const body: Record<string, any> = {};

    for (const [key, template] of Object.entries(bodyTemplate)) {
      const value = this.resolveTemplate(template, args);
      if (value !== undefined && value !== null) {
        body[key] = value;
      }
    }

    return body;
  }

  private resolveTemplate(template: string, args: Record<string, any>): any {
    // Handle template strings like "{variable}"
    const match = template.match(/^\{(\w+)\}$/);
    if (match) {
      const key = match[1];
      return args[key];
    }

    // Return as-is if not a template
    return template;
  }

  async fetchResource(uri: string): Promise<any> {
    // Parse URI and fetch appropriate data
    // For now, return cached data based on URI
    const cacheKey = `resource:${uri}`;
    return this.cache.get(cacheKey) || { message: 'Resource not yet implemented' };
  }

  async generatePrompt(prompt: PromptConfig, args: Record<string, any>): Promise<any[]> {
    // Generate prompt messages based on configuration
    // This is a placeholder implementation
    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Executing prompt: ${prompt.name} with arguments: ${JSON.stringify(args)}`
        }
      }
    ];
  }
}

export function createAPIHandler(config: MCPConfig, cache: CacheManager, logger: Logger): APIHandler {
  return new APIHandler(config, cache, logger);
}

