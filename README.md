# sls-youtube-backup

Backs up a YouTube playlist to the [Wayback Machine](https://web.archive.org/) using two Lambda functions and SQS.

## How it works

```
POST /queuePlaylistBackup
         │
         ▼
┌──────────────────────────┐      ┌────────────────────┐
│  queuePlaylistBackup     │─────▶│  SQS               │
│  (HTTP Lambda)           │      │  video-backup-queue│
│  • Paginates YouTube     │      └─────────┬──────────┘
│    playlistItems.list    │                │ event-source
│  • Enqueues each videoId │                │ mapping (Lift)
└──────────────────────────┘                ▼
                                  ┌────────────────────┐
                                  │  backupVideos      │
                                  │  (SQS worker)      │
                                  │  • Batch-fetches   │
                                  │    videos.list     │
                                  │  • Checks archive  │
                                  │  • Submits new     │
                                  └────────────────────┘
```

## Project structure

```
src/
  functions/
    backupVideos/handler.ts         # SQS worker — receives SQSEvent, archives videos
    queuePlaylistBackup/handler.ts  # HTTP Lambda — paginates YouTube, enqueues IDs
  libs/
    sqs.ts                          # sendSQSMessages helper (batch send)
    apiGateway.ts                   # API Gateway response helpers
    lambda.ts                       # Middy handler factory
    handlerResolver.ts              # local invoke shim
    utils.ts                        # shared utilities
  mocks/                            # JSON fixtures for sls invoke local
integration/                        # handler integration tests (no Lambda runtime)
e2e/                                # full-stack tests against ElasticMQ
model/                              # VideoItem interface and schema (unused by runtime)
```

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20 and [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) (E2E tests only)
- AWS credentials
- YouTube Data API v3 key (from Google Cloud)
- Wayback Machine API key (from [archive.org/account/s3.php](https://archive.org/account/s3.php))

## Setup

```bash
pnpm install
```

Create `.env.development`:

| Variable | Description |
|---|---|
| `YOUTUBE_DATA_API_KEY` | YouTube Data API v3 key from Google Cloud |
| `WAYBACK_MACHINE_API_KEY` | `accesskey:secret` from [archive.org/account/s3.php](https://archive.org/account/s3.php) |

## Testing

```bash
pnpm test                    # unit tests
pnpm run test:integration    # integration tests (no real APIs or AWS needed)
```

### E2E tests

Runs the queue flow against a local [ElasticMQ](https://github.com/softwaremill/elasticmq) instance. YouTube and Wayback calls are mocked, so no API keys needed.

1. Start ElasticMQ:

   ```bash
   docker compose -f docker-compose.e2e.yml up -d
   ```

2. Set the queue env vars:

   ```bash
   export SQS_QUEUE_URL=http://localhost:9324/000000000000/video-backup-queue
   export SQS_ENDPOINT_URL=http://localhost:9324
   ```

3. Run:

   ```bash
   pnpm run test:e2e
   ```

> [!NOTE]
> E2E tests are skipped when `SQS_QUEUE_URL` or `SQS_ENDPOINT_URL` are unset, so CI runs without Docker.

### Local invocation

Run each function locally with mock fixtures:

```bash
pnpm run test:backupVideos
pnpm run test:queuePlaylistBackup
```

## Linting

```bash
pnpm run lint        # check
pnpm run lint:fix    # check and fix
```

## Deploying

```bash
pnpm run deploy:dev    # deploy to the dev stage
pnpm run remove:dev    # tear down the dev stack

pnpm run deploy:prod   # deploy to production
pnpm run remove:prod   # tear down production
```

## References

- [YouTube Data API v3](https://developers.google.com/youtube/v3/docs)
- [Wayback Machine S3-like API Keys](https://archive.org/account/s3.php)
- [Serverless Framework](https://www.serverless.com/framework/docs)
- [serverless-lift](https://github.com/getlift/lift)
