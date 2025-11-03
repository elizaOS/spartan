import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  tsconfig: './tsconfig.build.json', // Use build-specific tsconfig
  sourcemap: true,
  clean: false, // Don't clean dist folder before building
  format: ['esm'], // Ensure you're targeting CommonJS
  dts: true, // Generate TypeScript declaration files (.d.ts) for better type support
  external: [
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
    '@elizaos/core',
    'zod',
  ],
});
