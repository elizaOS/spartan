/**
 * Shared utilities index - provides a single entry point for all shared utilities
 * Follows the pattern from packages/server/src/api/shared/
 */

export * from './template-utils';

// Re-export commonly used node modules for convenience
export { default as fs } from 'node:fs';
export { default as fsp } from 'node:fs/promises';
export { default as path } from 'node:path';
export { default as ejs } from 'ejs';

