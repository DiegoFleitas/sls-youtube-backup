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
pnpm test                    # unit tests (Jest)
pnpm run test:backupVideos   # invoke backupVideos Lambda locally
pnpm run test:queuePlaylistBackup
```

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
