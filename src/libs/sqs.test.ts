// var is hoisted so it's accessible inside the jest.mock factory below
// eslint-disable-next-line no-var
var mockSend: jest.Mock;

jest.mock("@aws-sdk/client-sqs", () => {
  mockSend = jest.fn();
  return {
    SQSClient: jest.fn(() => ({ send: mockSend })),
    // Return input as-is so tests can assert on what was passed to send()
    ReceiveMessageCommand: jest.fn((input: unknown) => input),
    SendMessageBatchCommand: jest.fn((input: unknown) => input),
    DeleteMessageBatchCommand: jest.fn((input: unknown) => input),
  };
});

import { getSQSMessages, sendSQSMessages, deleteSQSMessages } from "./sqs";

const QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/123/test-queue";

describe("getSQSMessages", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns event directly when IS_LOCAL is set", async () => {
    process.env.IS_LOCAL = "true";
    const event = { Messages: [{ Body: "vid1" }] };
    const result = await getSQSMessages(event as never);
    expect(result).toBe(event);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("throws when SQS_QUEUE_URL is not set", async () => {
    delete process.env.IS_LOCAL;
    delete process.env.SQS_QUEUE_URL;
    await expect(getSQSMessages({} as never)).rejects.toThrow(
      "SQS_QUEUE_URL is not set"
    );
  });

  it("calls ReceiveMessageCommand with queue URL and max 10 messages", async () => {
    delete process.env.IS_LOCAL;
    process.env.SQS_QUEUE_URL = QUEUE_URL;
    const messages = [{ Body: "vid1", ReceiptHandle: "rh1" }];
    mockSend.mockResolvedValueOnce({ Messages: messages });

    const result = await getSQSMessages({} as never);

    expect(mockSend).toHaveBeenCalledWith({
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 10,
    });
    expect(result).toEqual({ Messages: messages });
  });
});

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
        // Ids are batch-local (0-based within each 10-message chunk)
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
        // Id "0" in the second batch = global index 10 → vid10
        Failed: [{ Id: "0", Code: "ThrottlingException" }],
      });
    const ids = Array.from({ length: 12 }, (_, i) => `vid${i}`);
    await expect(sendSQSMessages(ids)).rejects.toThrow("vid10");
  });
});

describe("deleteSQSMessages", () => {
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
    await expect(
      deleteSQSMessages([{ Id: "0", ReceiptHandle: "rh1" }])
    ).rejects.toThrow("SQS_QUEUE_URL is not set");
  });

  it("sends a single delete batch with the correct entries", async () => {
    mockSend.mockResolvedValueOnce({});
    const entries = [
      { Id: "0", ReceiptHandle: "rh1" },
      { Id: "1", ReceiptHandle: "rh2" },
    ];
    await deleteSQSMessages(entries);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith({
      QueueUrl: QUEUE_URL,
      Entries: entries,
    });
  });

  it("batches deletions when > 10 entries", async () => {
    mockSend.mockResolvedValue({});
    const entries = Array.from({ length: 11 }, (_, i) => ({
      Id: String(i),
      ReceiptHandle: `rh${i}`,
    }));
    await deleteSQSMessages(entries);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});
