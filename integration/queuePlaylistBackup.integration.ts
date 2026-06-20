import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import axios from "axios";
import { main } from "../src/functions/queuePlaylistBackup/handler";

/** Call handler without callback so we get the promise result (Middy resolves with it). */
const invoke = (event: APIGatewayProxyEvent) =>
  (main as unknown as (e: APIGatewayProxyEvent, c: unknown) => Promise<APIGatewayProxyResult>)(event, {} as never);

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock("../src/libs/sqs", () => ({
  sendSQSMessage: jest.fn().mockResolvedValue(undefined),
}));

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
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
    ...overrides,
  };
}

describe("queuePlaylistBackup integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when body has no playlistId", async () => {
    const event = makeEvent({ body: JSON.stringify({}) });
    const result = await invoke(event);
    expect(result?.statusCode).toBe(400);
    const body = JSON.parse(result?.body ?? "{}");
    expect(body.message).toBe("No playlist ID provided");
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it("returns 400 when body is null", async () => {
    const event = makeEvent({ body: null });
    const result = await invoke(event);
    expect(result?.statusCode).toBe(400);
    const body = JSON.parse(result?.body ?? "{}");
    expect(body.message).toBe("No playlist ID provided");
  });

  it("returns 200 and enqueues video IDs when YouTube API returns playlist items", async () => {
    const playlistId = "PLtest123";
    const videoIds = ["vid1", "vid2"];
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        items: videoIds.map((id) => ({
          snippet: { resourceId: { videoId: id } },
        })),
      },
    });

    // Body as object simulates Middy json body parser output
    const event = makeEvent({
      body: { playlistId } as unknown as string,
    });
    const result = await invoke(event);

    expect(result?.statusCode).toBe(200);
    const body = JSON.parse(result?.body ?? "{}");
    expect(body.message).toEqual(videoIds);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining(`playlistId=${playlistId}`)
    );

    const { sendSQSMessage } = await import("../src/libs/sqs");
    expect(sendSQSMessage).toHaveBeenCalledTimes(2);
    expect(sendSQSMessage).toHaveBeenCalledWith("vid1");
    expect(sendSQSMessage).toHaveBeenCalledWith("vid2");
  });

  it("returns 500 when YouTube API throws", async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error("Network error"));
    const event = makeEvent({
      body: { playlistId: "PLfail" } as unknown as string,
    });
    const result = await invoke(event);
    expect(result?.statusCode).toBe(500);
    const body = JSON.parse(result?.body ?? "{}");
    expect(body.message).toBe("Internal server error");
  });
});
