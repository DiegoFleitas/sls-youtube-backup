/**
 * Real e2e: HTTP → queuePlaylistBackup → ElasticMQ SQS → backupVideos.
 * Requires ElasticMQ running and SQS_QUEUE_URL + SQS_ENDPOINT_URL set.
 * Stack-only: axios is mocked so no YouTube/Wayback API keys needed.
 */
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  SQSBatchResponse,
  SQSEvent,
} from "aws-lambda";
import { ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import axios from "axios";
import { main as backupVideosMain } from "../src/functions/backupVideos/handler";
import { main as queuePlaylistBackupMain } from "../src/functions/queuePlaylistBackup/handler";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const runE2E =
  !!process.env.SQS_QUEUE_URL && !!process.env.SQS_ENDPOINT_URL;

const describeE2E = runE2E ? describe : describe.skip;

function buildSQSClient(): SQSClient {
  return new SQSClient({
    endpoint: process.env.SQS_ENDPOINT_URL,
    region: "us-east-1",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });
}

describeE2E("e2e queue to backup (real SQS)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.IS_LOCAL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("flow: queuePlaylistBackup enqueues video IDs, backupVideos processes them with no failures", async () => {
    const playlistId = "PLtest123";
    const videoId = "vid-e2e-1";

    // 1) queuePlaylistBackup: YouTube returns one video
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

    const queueResult = (await (
      queuePlaylistBackupMain as unknown as (
        e: APIGatewayProxyEvent,
        c: unknown
      ) => Promise<APIGatewayProxyResult>
    )(apiEvent, {} as never)) as APIGatewayProxyResult;

    expect(queueResult.statusCode).toBe(200);
    const queueBody = JSON.parse(queueResult.body ?? "{}");
    expect(queueBody.message).toEqual([videoId]);

    // 2) Receive from ElasticMQ and convert to SQSEvent (simulates Lambda trigger)
    const sqsClient = buildSQSClient();
    const receiveResult = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: process.env.SQS_QUEUE_URL,
        MaxNumberOfMessages: 10,
      })
    );
    expect(receiveResult.Messages ?? []).toHaveLength(1);

    const sqsEvent: SQSEvent = {
      Records: (receiveResult.Messages ?? []).map((m) => ({
        messageId: m.MessageId ?? "",
        receiptHandle: m.ReceiptHandle ?? "",
        body: m.Body ?? "",
        attributes: {} as never,
        messageAttributes: {},
        md5OfBody: m.MD5OfBody ?? "",
        eventSource: "aws:sqs",
        eventSourceARN:
          "arn:aws:sqs:us-east-1:000000000000:video-backup-queue",
        awsRegion: "us-east-1",
      })),
    };

    // 3) backupVideos: mock YouTube + Wayback, process the SQS event
    mockedAxios.get
      .mockResolvedValueOnce({ data: { items: [{ id: videoId }] } })
      .mockResolvedValueOnce({
        data: { archived_snapshots: { closest: { available: false } } },
        status: 200,
      })
      .mockResolvedValueOnce({ status: 200 });

    const backupResult = await (
      backupVideosMain as unknown as (
        e: SQSEvent,
        c: unknown
      ) => Promise<SQSBatchResponse>
    )(sqsEvent, {} as never);

    expect(backupResult.batchItemFailures).toHaveLength(0);
  });
});
