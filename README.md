# Sarambabot

A serverless application that backups a youtube playlist into the wayback machine

# Before starting

You'll need to:

- an AWS account to set up the serverless project
- create a new app in Google Cloud console to be able to use Youtube Data API v3
- create a Wayback Machine account to request access keys for their S3-like API

## Running tests

```
npm run test:backupVideos
npm run test:queuePlaylistBackup
```

## Fixing code style

```
npx eslint ./src/** --fix
```

## Deploying

```
npm run deploy:dev
```

## Cleaning up

```
npm run remove:dev
```

## Other
