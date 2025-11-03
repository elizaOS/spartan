#!/usr/bin/env bun
/**
 * Self-contained build script for ElizaOS projects
 *
 * - Starts Vite build in the background (to web-dist/)
 * - Runs tsc --noEmit and Bun.build in parallel
 * - If anything fails, Vite is terminated and the script exits non-zero
 */

import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { $ } from 'bun';

function fmt(ns: bigint) {
  const ms = Number(ns) / 1e6;
  return ms < 1000 ? `${ms.toFixed(2)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

const VITE_OUTDIR = 'dist'; // web-dist?
const NODE_OUTDIR = 'dist';

async function cleanBuild(...dirs: string[]) {
  for (const dir of dirs) {
    if (existsSync(dir)) {
      await rm(dir, { recursive: true, force: true });
      console.log(`✓ Cleaned ${dir} directory`);
    }
  }
}

// 👉 run TypeScript type-checker first (no emit)
// We still *start* Vite immediately (background), but if typecheck fails we kill Vite and exit.
async function typecheck(viteProc?: Bun.Subprocess) {
  const t0 = Bun.nanoseconds();
  console.log('▶︎ Type-checking with tsc…');
  try {
    await $`tsc --noEmit -p tsconfig.typecheck.json`;
    const dt = Bun.nanoseconds() - t0;
    console.log(`⏱️  Type-check done in ${fmt(dt)}`);
  } catch (err) {
    const dt = Bun.nanoseconds() - t0;
    console.error(`✖ Type-check failed after ${fmt(dt)}`);
    // kill vite if it's running
    try { viteProc?.kill('SIGTERM'); } catch { }
    process.exit(1);
  }
}

function startViteBuild(): { proc: Bun.Subprocess; exited: Promise<number> } {
  console.log('🎛️  Starting Vite build (background)…');
  // Use bunx to ensure local vite is used; send stdio to terminal.
  const proc = Bun.spawn({
    cmd: ['bunx', '-y', 'vite', 'build', '--outDir', VITE_OUTDIR, '--emptyOutDir'],
    stdout: 'inherit',
    stderr: 'inherit',
    env: {
      ...process.env,
      // Put any env flags you want Vite to see here
      // e.g. VITE_BUILD_MODE: 'production'
    },
  });
  const exited = proc.exited; // Promise<number>
  exited.then((code) => {
    if (code === 0) {
      console.log(`✅ Vite build finished successfully → ${VITE_OUTDIR}/`);
    } else {
      console.error(`✖ Vite build failed with exit code ${code}`);
    }
  });
  return { proc, exited };
}

async function buildNodeBundle() {
  console.log('📦 Bundling with Bun…');
  const result = await Bun.build({
    entrypoints: ['./src/index.ts'],
    outdir: `./${NODE_OUTDIR}`,
    target: 'node',
    format: 'esm',
    sourcemap: true,
    minify: false,
    external: [
      'dotenv',
      'fs',
      'path',
      'https',
      'node:*',
      '@elizaos/core',
      '@elizaos/plugin-bootstrap',
      '@elizaos/plugin-sql',
      '@elizaos/cli',
      'zod',
    ],
    naming: {
      entry: '[dir]/[name].[ext]',
    },
  });

  if (!result.success) {
    console.error('✗ Bun build failed:', result.logs);
    return { success: false, outputs: [] as typeof result.outputs };
  }

  const totalSize = result.outputs.reduce((sum, o) => sum + o.size, 0);
  const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
  console.log(`✓ Built ${result.outputs.length} file(s) - ${sizeMB}MB`);
  return result;
}

async function build() {
  const start = performance.now();
  console.log('🚀 Building project...');

  // Clean both outputs up front to avoid races
  await cleanBuild(NODE_OUTDIR, VITE_OUTDIR);

  // Kick off Vite immediately (background)
  const { proc: viteProc, exited: viteExited } = startViteBuild();

  // Run typecheck + (Bun bundle + d.ts) in parallel
  console.log('Starting build tasks…');

  const typecheckPromise = typecheck(viteProc);

  const bunBundlePromise = (async () => {
    const buildResult = await buildNodeBundle();
    return buildResult;
  })();

  const dtsPromise = (async () => {
    console.log('📝 Generating TypeScript declarations…');
    try {
      await $`tsc --emitDeclarationOnly --incremental --project ./tsconfig.build.json`.quiet();
      console.log('✓ TypeScript declarations generated');
      return { success: true };
    } catch {
      console.warn('⚠ Failed to generate TypeScript declarations');
      console.warn('  This is usually due to test files or type errors.');
      return { success: false };
    }
  })();

  // Wait for typecheck + Bun bundle + d.ts
  const [_, bunResult, dtsResult] = await Promise.all([
    typecheckPromise,
    bunBundlePromise,
    dtsPromise,
  ]);

  // If Bun bundle failed, stop Vite and bail out
  if (!bunResult.success) {
    try { viteProc.kill('SIGTERM'); } catch { }
    // Ensure vite exits (don’t hang)
    await Promise.race([viteExited, new Promise((r) => setTimeout(r, 2000))]);
    return false;
  }

  // Now wait for Vite to finish; if it fails, treat as overall failure
  const viteCode = await viteExited;
  if (viteCode !== 0) {
    return false;
  }

  const elapsed = ((performance.now() - start) / 1000).toFixed(2);
  console.log(`✅ Build complete! (${elapsed}s)`);
  return true;
}

// Execute the build
build()
  .then((success) => {
    if (!success) {
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Build script error:', error);
    process.exit(1);
  });
