/**
 * Real e2e: HTTP → queuePlaylistBackup → ElasticMQ SQS → backupVideos.
 * Requires ElasticMQ running and SQS_QUEUE_URL + SQS_ENDPOINT_URL set (e.g. from .env.e2e).
 * Stack-only: axios is mocked so no YouTube/Wayback API keys needed.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import axios from "axios";
import { main as backupVideosMain } from "../src/functions/backupVideos/handler";
import { main as queuePlaylistBackupMain } from "../src/functions/queuePlaylistBackup/handler";
import { getSQSMessages } from "../src/libs/sqs";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const runE2E =
  !!process.env.SQS_QUEUE_URL && !!process.env.SQS_ENDPOINT_URL;

const describeE2E = runE2E ? describe : describe.skip;

describeE2E("e2e queue to backup (real SQS)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Use real SQS (no IS_LOCAL); keep queue endpoint from env
    process.env = { ...originalEnv };
    delete process.env.IS_LOCAL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("flow: POST queuePlaylistBackup enqueues video IDs, backupVideos polls and processes one", async () => {
    const playlistId = "PLtest123";
    const videoId = "vid-e2e-1";

    // 1) queuePlaylistBackup: YouTube playlist items (one video)
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        items: [{ snippet: { resourceId: { videoId } } }],
      },
    });

    const apiEvent: APIGatewayProxyEvent = {
      body: JSON.stringify({ playlistId }),
      headers: { "Content-Type": "application/json" },
      multiValueHeaders: {},
      httpMethod: "POST",
      isBase64Encoded: false,
      path: "/queuePlaylistBackup",
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as APIGatewayProxyEvent["requestContext"],
      resource: "",
    };

    const queueResult = (await (queuePlaylistBackupMain as unknown as (
      e: APIGatewayProxyEvent,
      c: unknown
    ) => Promise<APIGatewayProxyResult>)(apiEvent, {} as never)) as APIGatewayProxyResult;

    expect(queueResult.statusCode).toBe(200);
    const queueBody = JSON.parse(queueResult.body ?? "{}");
    expect(queueBody.message).toEqual([videoId]);

    // 2) backupVideos: will poll SQS and get the message; mock YouTube + Wayback
    mockedAxios.get.mockResolvedValueOnce({
      data: { items: [{ id: videoId }] },
    });
    // Wayback availability API: not yet archived
    mockedAxios.get.mockResolvedValueOnce({
      data: { archived_snapshots: { closest: { available: false } } },
      status: 200,
    });
    // Wayback save: success
    mockedAxios.get.mockResolvedValueOnce({ status: 200 });

    const backupResult = (await (backupVideosMain as unknown as (
      e: unknown,
      c: unknown
    ) => Promise<{ status: string; processed?: number }>)({}, {} as never)) as {
      status: string;
      processed?: number;
    };

    expect(backupResult.status).toBe("ok");
    expect(backupResult.processed).toBe(1);

    // 3) Verify the message was deleted from SQS (not just made invisible)
    const afterPoll = (await getSQSMessages({} as never)) as {
      Messages?: unknown[];
    };
    expect(afterPoll.Messages ?? []).toHaveLength(0);
  });
});
