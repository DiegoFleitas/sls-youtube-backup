A serverless application to backup a youtube playlist into the wayback machine

## Before starting

You'll need:

- an AWS account to set up the serverless project
- to create a new app in Google Cloud console to be able to use Youtube Data API v3
- to create a Wayback Machine account to request access keys for their S3-like API

Set `WAYBACK_MACHINE_API_KEY` to your access key and secret in one string: `accesskey:secret` (from [archive.org/account/s3.php](https://archive.org/account/s3.php)).

## Setup

Install dependencies with [pnpm](https://pnpm.io/) (or npm):

```bash
pnpm install
```

## Running tests

```bash
pnpm test                      # unit tests (Jest)
pnpm run test:integration      # integration tests (handlers with mocked YouTube, SQS, Wayback)
pnpm run test:backupVideos     # invoke backupVideos Lambda locally
pnpm run test:queuePlaylistBackup
```

**Integration tests** run the full handler logic with mocked external services (no real API keys or AWS needed).

### Real E2E locally

Run the full flow (HTTP → queue → worker) against a local ElasticMQ SQS:

1. Start ElasticMQ:

   ```bash
   docker compose -f docker-compose.e2e.yml up -d
   ```

2. Set env (e.g. copy `.env.e2e.example` to `.env.e2e` and source it or export):

   - `SQS_QUEUE_URL=http://localhost:9324/000000000000/video-backup-queue`
   - `SQS_ENDPOINT_URL=http://localhost:9324`

3. Run e2e tests:

   ```bash
   pnpm run test:e2e
   ```

   The e2e suite is skipped when `SQS_QUEUE_URL` or `SQS_ENDPOINT_URL` is unset, so CI can run without ElasticMQ. Stack-only e2e mocks YouTube and Wayback (no API keys). For full e2e with real APIs, set `YOUTUBE_DATA_API_KEY` and `WAYBACK_MACHINE_API_KEY` and adjust the e2e test to not mock axios.

## Linting

```bash
pnpm run lint        # check only
pnpm run lint:fix    # check and fix
```

## Deploying

```bash
pnpm run deploy:dev
```

## Cleaning up

```bash
pnpm run remove:dev
```

## Other

- [Wayback Machine - Get Your S3-Like API Keys](https://archive.org/account/s3.php)
- [Youtube Data API Reference](https://developers.google.com/youtube/v3/docs)
