# Plan: Upgrade Serverless v2 → v3

Upgrade to Serverless Framework v3 so that `serverless-lift` peer dependencies are satisfied and the `strict-peer-dependencies=false` workaround in `.npmrc` can be removed.

**Status:** Upgrade applied. Serverless 3.40.0 and @serverless/typescript 3.38.0 installed; `.npmrc` workaround removed; lint and unit tests pass. Deploy to dev/prod and run invoke-local when ready.

---

## Prerequisites

- [ ] On latest Serverless v2 (you have `^2.23.0`; lockfile has 2.72.4 — good).
- [ ] Node.js ≥ 12.13.0 (you use ≥18 — good).
- [ ] Fix any existing deprecation warnings when running `sls deploy` or `sls offline` on v2 (run once and note warnings).

---

## Phase 1: Dependencies

### 1.1 Bump Serverless and plugins in `package.json`

| Package | Current | Target | Notes |
|---------|---------|--------|--------|
| `serverless` | `^2.23.0` | `^3.0.0` | Core framework v3. |
| `@serverless/typescript` | `^2.23.0` | `^3.0.0` | Use v3 types for framework v3 (if available); otherwise keep and verify. |
| `serverless-dotenv-plugin` | `^3.10.0` | keep or `^3.12.0` | Supports v3. |
| `serverless-esbuild` | `^1.17.1` | keep | v1.x supports Serverless v3. |
| `serverless-lift` | `^1.21.0` | keep | Declares peer `serverless: ^3 \|\| ^4`. |
| `serverless-offline` | `^8.2.0` | keep | Supports v3. |

### 1.2 Install and resolve

```bash
# Remove workaround temporarily to verify peer deps after upgrade
# (comment out or remove strict-peer-dependencies in .npmrc)

pnpm install
```

If peer dependency errors appear, fix with compatible versions; do not re-enable `strict-peer-dependencies=false` unless necessary for an unrelated plugin.

---

## Phase 2: Configuration

### 2.1 `serverless.yml`

- [ ] Set framework version:
  - Change `frameworkVersion: "2"` → `frameworkVersion: "3"`.
- [ ] Confirm no v3-deprecated options are used (e.g. old CLI option style; your file uses standard `provider`, `functions`, `custom`, `plugins`, `constructs` — no known removals).
- [ ] If you use `--param` or custom CLI options in scripts, switch to v3 style:
  - v3: options at end; use `--param="key=value"` instead of free-form `--foo=bar`.

### 2.2 Scripts in `package.json`

Your scripts already use options at the end (e.g. `npx sls deploy --stage production`). Only change if you use:

- `sls --verbose deploy` → `sls deploy --verbose`
- Custom options → `--param="key=value"` where applicable.

---

## Phase 3: Code and types

- [ ] Run `pnpm run lint` and fix any new issues.
- [ ] If `@serverless/typescript` v3 is used, fix type errors in `serverless.ts` or config (if any).
- [ ] Ensure no code relies on deprecated v2 runtime or plugin APIs (your handlers use standard Lambda + SQS; no changes expected).

---

## Phase 4: Remove peer-deps workaround

- [ ] After a successful `pnpm install` with Serverless v3 and no peer errors, remove or simplify `.npmrc`:
  - Remove the line `strict-peer-dependencies=false`.
  - Remove or shorten the comment about serverless-lift/legacy-peer-deps.
- [ ] Run `pnpm install` again and confirm no peer dependency warnings for `serverless` / `serverless-lift`.

---

## Phase 5: Testing

### 5.1 Local

- [ ] `pnpm run test` (unit tests).
- [ ] `pnpm run test:queuePlaylistBackup` (invoke local).
- [ ] `pnpm run test:backupVideos` (invoke local).
- [ ] `pnpm run lint` (and `lint:fix` if needed).
- [ ] Optional: run `serverless offline` and hit the HTTP endpoint for `queuePlaylistBackup`.

### 5.2 Deploy (non-production first)

- [ ] Deploy to dev: `pnpm run deploy:dev`.
- [ ] Smoke-test: trigger `queuePlaylistBackup` (e.g. HTTP) and confirm the worker/queue and `backupVideos` behavior (e.g. schedule or manual invoke).
- [ ] If all good, deploy to production: `pnpm run deploy:prod` and smoke-test there.

---

## Phase 6: Cleanup and docs

- [ ] Update `README.md` if it mentions Serverless or Node version (e.g. “Serverless v2” → “Serverless v3”).
- [ ] Commit in a single upgrade PR or split: 1) deps + config, 2) .npmrc removal, 3) README.

---

## Rollback

If issues appear in production:

1. Revert the Serverless and plugin version bumps in `package.json`.
2. Set `frameworkVersion: "2"` again in `serverless.yml`.
3. Run `pnpm install`.
4. Re-add `strict-peer-dependencies=false` to `.npmrc` if needed.
5. Redeploy dev/prod from the reverted state.

---

## Checklist summary

| Step | Action |
|------|--------|
| 1 | Resolve deprecation warnings on current v2 deploy. |
| 2 | Bump `serverless` to `^3.0.0` (and optionally `@serverless/typescript` to `^3.0.0`) in `package.json`. |
| 3 | Set `frameworkVersion: "3"` in `serverless.yml`. |
| 4 | Run `pnpm install` and fix any peer/version issues. |
| 5 | Remove `strict-peer-dependencies=false` from `.npmrc`. |
| 6 | Lint, unit tests, invoke local, then deploy to dev and test. |
| 7 | Deploy to prod and update README. |
