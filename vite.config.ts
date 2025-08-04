/// <reference types="vitest" />
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  //base: '/degen-intel/',
  base: './', // since we're injecting the base tag now (seems smarter than hardcoding the agent & plugin name)
  //base: '/api/agents/Spartan/plugins/spartan-intel/',
  build: {
    emptyOutDir: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    timers: 'fake',
  },
});