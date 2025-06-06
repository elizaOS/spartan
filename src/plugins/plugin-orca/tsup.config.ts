import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    '@elizaos/core',
    'buffer',
    'safe-buffer',
    'bs58',
    'events',
    '@solana/web3.js',
    'dotenv', // Externalize dotenv to prevent bundling
    '@reflink/reflink',
    'agentkeepalive',
    'safe-buffer',
    'base-x',
    'bs58',
    'borsh',
    '@solana/buffer-layout',
    'stream',
    'buffer',
    'querystring',
    'zod',
    'node:fs', // Externalize fs to use Node.js built-in module
    'node:https',
    'node:path', // Externalize other built-ins if necessary
    'node:http',
    '@elizaos/cli',
  ],
});
