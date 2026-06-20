// eslint-disable-next-line no-var
var mockSend: jest.Mock;

jest.mock("@aws-sdk/client-sqs", () => {
  mockSend = jest.fn();
  return {
    SQSClient: jest.fn(() => ({ send: mockSend })),
    SendMessageBatchCommand: jest.fn((input: unknown) => input),
  };
});

import { sendSQSMessages } from "./sqs";

const QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/123/test-queue";

describe("sendSQSMessages", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, SQS_QUEUE_URL: QUEUE_URL };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws when SQS_QUEUE_URL is not set", async () => {
    delete process.env.SQS_QUEUE_URL;
    await expect(sendSQSMessages(["vid1"])).rejects.toThrow(
      "SQS_QUEUE_URL is not set"
    );
  });

  it("sends all IDs in a single batch when ≤ 10", async () => {
    mockSend.mockResolvedValueOnce({
      Successful: [{ Id: "0" }, { Id: "1" }],
      Failed: [],
    });
    await sendSQSMessages(["vid1", "vid2"]);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith({
      QueueUrl: QUEUE_URL,
      Entries: [
        { Id: "0", MessageBody: "vid1" },
        { Id: "1", MessageBody: "vid2" },
      ],
    });
  });

  it("sends multiple batches when > 10 IDs", async () => {
    mockSend.mockResolvedValue({ Successful: [], Failed: [] });
    const ids = Array.from({ length: 12 }, (_, i) => `vid${i}`);
    await sendSQSMessages(ids);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("throws on partial failure and names the failed video IDs", async () => {
    mockSend.mockResolvedValueOnce({
      Successful: [],
      Failed: [
        { Id: "0", Code: "ThrottlingException", Message: "Rate exceeded" },
      ],
    });
    await expect(sendSQSMessages(["vid-failing"])).rejects.toThrow(
      "SQS batch send partially failed: 1 message(s) not enqueued (vid-failing)"
    );
  });

  it("throws on partial failure in a later batch", async () => {
    mockSend
      .mockResolvedValueOnce({ Successful: [], Failed: [] })
      .mockResolvedValueOnce({
        Successful: [],
        Failed: [{ Id: "0", Code: "ThrottlingException" }],
      });
    const ids = Array.from({ length: 12 }, (_, i) => `vid${i}`);
    await expect(sendSQSMessages(ids)).rejects.toThrow("vid10");
  });
});
