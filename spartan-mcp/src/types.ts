/**
 * Type definitions for Spartan MCP Gateway
 */

export interface MCPConfig {
  name: string;
  description: string;
  version: string;
  server: ServerConfig;
  api: APIConfig;
  auth?: AuthConfig;
  tools: ToolConfig[];
  resources?: ResourceConfig[];
  prompts?: PromptConfig[];
  error_handling?: ErrorHandlingConfig;
  cache?: CacheConfig;
  logging?: LoggingConfig;
}

export interface ServerConfig {
  transport: 'stdio' | 'sse';
  capabilities: {
    tools?: { [x: string]: unknown; listChanged?: boolean } | boolean;
    resources?: { [x: string]: unknown; listChanged?: boolean; subscribe?: boolean } | boolean;
    prompts?: { [x: string]: unknown; listChanged?: boolean } | boolean;
  };
}

export interface APIConfig {
  base_url: string;
  rate_limit?: {
    requests_per_minute: number;
    burst: number;
  };
  timeout?: number;
  headers?: Record<string, string>;
}

export interface AuthConfig {
  type: 'api_key' | 'bearer' | 'basic' | 'none';
  key_name?: string;
  key_location?: 'header' | 'query' | 'body';
  key_env?: string;
  required?: boolean;
}

export interface ToolConfig {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, PropertySchema>;
    required?: string[];
  };
  endpoint: EndpointConfig;
}

export interface PropertySchema {
  type: string;
  description?: string;
  default?: any;
  items?: PropertySchema;
}

export interface EndpointConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  params?: Record<string, string>;
  body?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface ResourceConfig {
  uri: string;
  name: string;
  description: string;
}

export interface PromptConfig {
  name: string;
  description: string;
  arguments?: ArgumentConfig[];
}

export interface ArgumentConfig {
  name: string;
  description: string;
  required: boolean;
}

export interface ErrorHandlingConfig {
  retry_on_failure?: boolean;
  max_retries?: number;
  retry_delay_ms?: number;
  exponential_backoff?: boolean;
}

export interface CacheConfig {
  enabled: boolean;
  ttl_seconds: number;
  max_entries: number;
  cache_key_prefix?: string;
}

export interface LoggingConfig {
  level?: 'debug' | 'info' | 'warn' | 'error';
  format?: 'text' | 'json';
  include_timestamps?: boolean;
  include_context?: boolean;
  include_performance_metrics?: boolean;
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface Logger {
  debug: (message: string, meta?: any) => void;
  info: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  error: (message: string, error?: any) => void;
}

