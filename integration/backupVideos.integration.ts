import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import axios from "axios";
import { main } from "../src/functions/backupVideos/handler";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

/** Build a minimal SQSEvent from an array of message bodies. */
function makeSQSEvent(
  messages: { messageId: string; body: string }[]
): SQSEvent {
  return {
    Records: messages.map((m) => ({
      messageId: m.messageId,
      receiptHandle: `rh-${m.messageId}`,
      body: m.body,
      attributes: {} as never,
      messageAttributes: {},
      md5OfBody: "",
      eventSource: "aws:sqs",
      eventSourceARN: "arn:aws:sqs:us-east-1:000000000000:video-backup-queue",
      awsRegion: "us-east-1",
    })),
  };
}

const invoke = (event: SQSEvent) =>
  (
    main as unknown as (
      e: SQSEvent,
      c: unknown
    ) => Promise<SQSBatchResponse>
  )(event, {} as never);

describe("backupVideos integration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      YOUTUBE_DATA_API_KEY: "test-key",
      WAYBACK_MACHINE_API_KEY: "test:secret",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns empty batchItemFailures when Records array is empty", async () => {
    const result = await invoke(makeSQSEvent([]));
    expect(result.batchItemFailures).toHaveLength(0);
  });

  it("returns empty batchItemFailures when all record bodies are empty", async () => {
    const result = await invoke(
      makeSQSEvent([{ messageId: "msg1", body: "" }])
    );
    expect(result.batchItemFailures).toHaveLength(0);
  });

  it("does not retry when video is not found on YouTube (permanent)", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { items: [] } });
    const result = await invoke(
      makeSQSEvent([{ messageId: "msg1", body: "nonexistent" }])
    );
    expect(result.batchItemFailures).toHaveLength(0);
  });

  it("does not retry when video is already archived", async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: { items: [{ id: "vid123" }] } })
      .mockResolvedValueOnce({
        data: { archived_snapshots: { closest: { available: true } } },
      });
    const result = await invoke(
      makeSQSEvent([{ messageId: "msg1", body: "vid123" }])
    );
    expect(result.batchItemFailures).toHaveLength(0);
  });

  it("does not retry on successful Wayback save", async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: { items: [{ id: "shF8Sv-OswM" }] } })
      .mockResolvedValueOnce({ data: { archived_snapshots: {} } })
      .mockResolvedValueOnce({ status: 200 });
    const result = await invoke(
      makeSQSEvent([{ messageId: "msg1", body: "shF8Sv-OswM" }])
    );
    expect(result.batchItemFailures).toHaveLength(0);
  });

  it("adds to batchItemFailures when Wayback save returns non-200 (transient)", async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: { items: [{ id: "vid123" }] } })
      .mockResolvedValueOnce({ data: { archived_snapshots: {} } })
      .mockResolvedValueOnce({ status: 500 });
    const result = await invoke(
      makeSQSEvent([{ messageId: "msg1", body: "vid123" }])
    );
    expect(result.batchItemFailures).toEqual([{ itemIdentifier: "msg1" }]);
  });

  it("adds to batchItemFailures when processVideo throws unexpectedly", async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: { items: [{ id: "vid123" }] } })
      .mockRejectedValueOnce(new Error("Network error"));
    const result = await invoke(
      makeSQSEvent([{ messageId: "msg1", body: "vid123" }])
    );
    expect(result.batchItemFailures).toEqual([{ itemIdentifier: "msg1" }]);
  });

  it("handles mixed outcomes: success, not-found (no retry), Wayback failure (retry)", async () => {
    // YouTube returns vid1 and vid3 — vid2 not found (permanent, no retry)
    // Concurrent processing: both availability checks fire before either save call,
    // so mock order is: availability-vid1, availability-vid3, save-vid1, save-vid3.
    mockedAxios.get
      .mockResolvedValueOnce({
        data: { items: [{ id: "vid1" }, { id: "vid3" }] },
      })
      .mockResolvedValueOnce({ data: { archived_snapshots: {} } }) // vid1 availability
      .mockResolvedValueOnce({ data: { archived_snapshots: {} } }) // vid3 availability
      .mockResolvedValueOnce({ status: 200 })                      // vid1 save (success)
      .mockResolvedValueOnce({ status: 500 });                     // vid3 save (transient fail)

    const result = await invoke(
      makeSQSEvent([
        { messageId: "msg1", body: "vid1" },
        { messageId: "msg2", body: "vid2" },
        { messageId: "msg3", body: "vid3" },
      ])
    );

    expect(result.batchItemFailures).toEqual([{ itemIdentifier: "msg3" }]);
  });
});
