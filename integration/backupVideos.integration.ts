import axios from "axios";
import { main } from "../src/functions/backupVideos/handler";
import { getSQSMessages, deleteSQSMessages } from "../src/libs/sqs";

jest.mock("axios");
jest.mock("../src/libs/sqs", () => ({
  getSQSMessages: jest.fn(),
  deleteSQSMessages: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockGetSQSMessages = getSQSMessages as jest.Mock;
const mockDeleteSQSMessages = deleteSQSMessages as jest.Mock;

type BackupResult =
  | { status: "ok"; processed: number }
  | { status: "error"; message: string; processed?: number };

const invoke = (event: unknown) =>
  (main as unknown as (e: unknown, c: unknown) => Promise<BackupResult | void>)(
    event,
    {} as never
  );

describe("backupVideos integration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // IS_LOCAL=true gates the deleteSQSMessages call — keeps existing tests simple
    process.env = { ...originalEnv, IS_LOCAL: "true" };
    // Default: getSQSMessages passes through whatever event the handler receives
    mockGetSQSMessages.mockImplementation(async (event: unknown) => event);
    mockDeleteSQSMessages.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns error when event has no Messages", async () => {
    const result = await invoke({});
    expect(result).toEqual({
      status: "error",
      message: "No messages found in queue",
    });
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it("returns ok with processed 0 when Messages is empty", async () => {
    const result = await invoke({ Messages: [] });
    expect(result).toEqual({ status: "ok", processed: 0 });
  });

  it("skips missing video and returns processed 0", async () => {
    const videoId = "nonexistent";
    mockedAxios.get.mockResolvedValueOnce({ data: { items: [] } });

    const result = await invoke({ Messages: [{ Body: videoId }] });

    expect(result).toEqual({ status: "ok", processed: 0 });
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining(videoId),
      expect.any(Object)
    );
  });

  it("continues processing after a missing video and counts the successful one", async () => {
    const missingId = "nonexistent";
    const validId = "shF8Sv-OswM";
    mockedAxios.get.mockResolvedValueOnce({ data: { items: [{ id: validId }] } });
    mockedAxios.get.mockResolvedValueOnce({
      data: { archived_snapshots: { closest: { available: false } } },
      status: 200,
    });
    mockedAxios.get.mockResolvedValueOnce({ status: 200 });

    const result = await invoke({
      Messages: [{ Body: missingId }, { Body: validId }],
    });

    expect(result).toEqual({ status: "ok", processed: 1 });
  });

  it("returns ok and processed count when backup succeeds", async () => {
    const videoId = "shF8Sv-OswM";
    mockedAxios.get.mockResolvedValueOnce({ data: { items: [{ id: videoId }] } });
    mockedAxios.get.mockResolvedValueOnce({
      data: { archived_snapshots: { closest: { available: false } } },
      status: 200,
    });
    mockedAxios.get.mockResolvedValueOnce({ status: 200 });

    const result = await invoke({ Messages: [{ Body: videoId }] });

    expect(result).toEqual({ status: "ok", processed: 1 });
    expect(mockedAxios.get).toHaveBeenCalledTimes(3);
  });

  it("skips already-archived video and counts it as processed", async () => {
    const videoId = "shF8Sv-OswM";
    mockedAxios.get.mockResolvedValueOnce({ data: { items: [{ id: videoId }] } });
    mockedAxios.get.mockResolvedValueOnce({
      data: { archived_snapshots: { closest: { available: true } } },
      status: 200,
    });

    const result = await invoke({ Messages: [{ Body: videoId }] });

    expect(result).toEqual({ status: "ok", processed: 1 });
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it("leaves message in queue when Wayback save fails and returns ok with processed 0", async () => {
    const videoId = "vid123";
    mockedAxios.get.mockResolvedValueOnce({ data: { items: [{ id: videoId }] } });
    mockedAxios.get.mockResolvedValueOnce({
      data: { archived_snapshots: { closest: { available: false } } },
      status: 200,
    });
    mockedAxios.get.mockResolvedValueOnce({ status: 500 });

    const result = await invoke({ Messages: [{ Body: videoId }] });

    expect(result).toEqual({ status: "ok", processed: 0 });
  });

  it("returns internal server error when an unexpected error is thrown", async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error("Unexpected"));
    const result = await invoke({ Messages: [{ Body: "vid" }] });
    expect(result).toEqual({
      status: "error",
      message: "Internal server error",
    });
  });

  describe("message deletion (IS_LOCAL not set)", () => {
    beforeEach(() => {
      process.env = { ...originalEnv, SQS_QUEUE_URL: "https://sqs.test/q" };
    });

    it("deletes message after successful backup", async () => {
      const videoId = "shF8Sv-OswM";
      const receiptHandle = "rh-success";
      mockedAxios.get.mockResolvedValueOnce({ data: { items: [{ id: videoId }] } });
      mockedAxios.get.mockResolvedValueOnce({
        data: { archived_snapshots: { closest: { available: false } } },
        status: 200,
      });
      mockedAxios.get.mockResolvedValueOnce({ status: 200 });

      const result = await invoke({
        Messages: [{ Body: videoId, ReceiptHandle: receiptHandle }],
      });

      expect(result).toEqual({ status: "ok", processed: 1 });
      expect(mockDeleteSQSMessages).toHaveBeenCalledWith([
        { Id: "0", ReceiptHandle: receiptHandle },
      ]);
    });

    it("deletes message for already-archived video", async () => {
      const videoId = "shF8Sv-OswM";
      const receiptHandle = "rh-archived";
      mockedAxios.get.mockResolvedValueOnce({ data: { items: [{ id: videoId }] } });
      mockedAxios.get.mockResolvedValueOnce({
        data: { archived_snapshots: { closest: { available: true } } },
        status: 200,
      });

      await invoke({ Messages: [{ Body: videoId, ReceiptHandle: receiptHandle }] });

      expect(mockDeleteSQSMessages).toHaveBeenCalledWith([
        { Id: "0", ReceiptHandle: receiptHandle },
      ]);
    });

    it("deletes message for video not found on YouTube (permanent failure)", async () => {
      const videoId = "gone";
      const receiptHandle = "rh-gone";
      mockedAxios.get.mockResolvedValueOnce({ data: { items: [] } });

      await invoke({ Messages: [{ Body: videoId, ReceiptHandle: receiptHandle }] });

      expect(mockDeleteSQSMessages).toHaveBeenCalledWith([
        { Id: "0", ReceiptHandle: receiptHandle },
      ]);
    });

    it("does not delete message when Wayback save fails (transient — leave for retry)", async () => {
      const videoId = "vid123";
      const receiptHandle = "rh-retry";
      mockedAxios.get.mockResolvedValueOnce({ data: { items: [{ id: videoId }] } });
      mockedAxios.get.mockResolvedValueOnce({
        data: { archived_snapshots: { closest: { available: false } } },
        status: 200,
      });
      mockedAxios.get.mockResolvedValueOnce({ status: 500 });

      await invoke({ Messages: [{ Body: videoId, ReceiptHandle: receiptHandle }] });

      expect(mockDeleteSQSMessages).not.toHaveBeenCalled();
    });

    it("returns ok and logs error when deleteSQSMessages throws", async () => {
      const videoId = "shF8Sv-OswM";
      mockedAxios.get.mockResolvedValueOnce({ data: { items: [{ id: videoId }] } });
      mockedAxios.get.mockResolvedValueOnce({
        data: { archived_snapshots: { closest: { available: false } } },
        status: 200,
      });
      mockedAxios.get.mockResolvedValueOnce({ status: 200 });
      mockDeleteSQSMessages.mockRejectedValueOnce(new Error("SQS blip"));

      const result = await invoke({
        Messages: [{ Body: videoId, ReceiptHandle: "rh-blip" }],
      });

      // Delete failure must not propagate — messages will retry after visibility timeout
      expect(result).toEqual({ status: "ok", processed: 1 });
    });
  });
});
