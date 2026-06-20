# sls-youtube-backup

Serverless app that backs up a YouTube playlist to the Wayback Machine via two Lambda functions + SQS.

This file is the primary instruction source. `CLAUDE.md` also exists but may be stale — trust AGENTS.md first, then verify against code.

## Commands

```bash
pnpm test                   # unit tests (src/**/*.test.ts) with --ci
pnpm run test:integration   # integration tests (integration/*.integration.ts)
pnpm run test:e2e           # e2e (e2e/*.e2e.ts), skipped if SQS_QUEUE_URL unset

pnpm run lint               # eslint src/ --ext .ts
pnpm run lint:fix

pnpm run test:backupVideos            # sls invoke local --function backupVideos
pnpm run test:queuePlaylistBackup     # sls invoke local --function queuePlaylistBackup

pnpm run deploy:dev          # sls deploy (default stage: dev)
pnpm run remove:dev          # sls remove

# Single test file:
npx jest --config jest.config.js src/libs/apiGateway.test.ts
```

No `typecheck` script exists. `tsc` is not run in CI. If you add it, create a script and add it to CI between lint and test.

**Validation order:** `lint` → `test` → `test:integration`. CI follows this order. E2E is local-only.

## Architecture

- **`src/functions/queuePlaylistBackup/handler.ts`** — HTTP POST. Receives `{playlistId}`, paginates YouTube `playlistItems.list` (50/req), enqueues each video ID as a separate SQS message via `sendSQSMessages` (batches of 10).
- **`src/functions/backupVideos/handler.ts`** — Lift ESM worker. Receives an `SQSEvent` (up to 10 messages per invocation via `batchSize: 10`), batch-fetches YouTube `videos.list`, checks Wayback Machine availability, saves unarchived videos, returns `SQSBatchResponse`. Messages in `batchItemFailures` are retried by AWS; the rest are auto-deleted.
- Queue: `video-backup-queue` — `serverless-lift` construct with `worker: backupVideos`. Lift wires the SQS event-source mapping; no cron trigger needed. URL injected via `${construct:video-backup-queue.queueUrl}`.
- Bundling: `serverless-esbuild` (individual per function, target node20, sourcemaps on).
- SQS client (`src/libs/sqs.ts`): only `sendSQSMessages` is exported. When `SQS_ENDPOINT_URL` or `AWS_ENDPOINT_URL` is set, connects to that endpoint with dummy creds (for ElasticMQ); otherwise real AWS.
- Middy wraps both handlers (`@middy/core` + `@middy/http-json-body-parser`). The body is already parsed when the handler receives it.

## Test quirks

- Integration tests run handlers directly (no Lambda runtime). axios is mocked; no `IS_LOCAL` needed since the handler takes an `SQSEvent` directly.
- E2E requires ElasticMQ: `docker compose -f docker-compose.e2e.yml up -d`. axios is mocked (no API keys needed for stack-only flow). The test enqueues via `queuePlaylistBackup`, reads messages from ElasticMQ, builds an `SQSEvent`, then calls `backupVideos`.
- E2E tests are auto-skipped when `SQS_QUEUE_URL` or `SQS_ENDPOINT_URL` is unset.
- Test fixtures live in `src/mocks/` (JSON for `sls invoke local`).

## Known issues

- `model/videoItem.ts` and `model/videoSchema.ts` exist at the repo root but are not imported by any runtime code.

## Env vars

| Variable | Required for | Notes |
|----------|-------------|-------|
| `YOUTUBE_DATA_API_KEY` | Deploy + `sls invoke local` | Google Cloud YouTube Data API v3 |
| `WAYBACK_MACHINE_API_KEY` | Deploy + `sls invoke local` | `accesskey:secret` from archive.org/account/s3.php |
| `SQS_QUEUE_URL` | E2E / real AWS | Set by Lift in AWS; manual for E2E |
| `SQS_ENDPOINT_URL` | E2E | ElasticMQ endpoint for local E2E |

Env files are loaded by `serverless-dotenv-plugin` — `.env.development` for dev, `.env.production` for production. `.env.e2e` is for manual E2E only.
