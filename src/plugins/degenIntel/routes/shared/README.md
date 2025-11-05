# Shared Route Utilities

Following the pattern from `packages/server/src/api/shared/`

## Files

### template-utils.ts
- Path resolution (`frontendDist`, `frontendNewDist`)
- Template loading (`getIndexTemplate()` - lazy-loaded)
- HTML manipulation (`injectBase()`)

### index.ts
- Re-exports all shared utilities
- Provides convenient access to common modules (fs, fsp, path, ejs)

## Pattern

Minimal shared utilities - specific logic is inlined where used.

For example, `getAccountType()` is inlined in `frontend.routes.ts` since it's only used there.

## Usage

```typescript
import { frontendDist, getIndexTemplate, injectBase, fs, path, ejs } from './shared';
```
