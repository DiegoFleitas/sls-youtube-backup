import axios from "axios";
import { main } from "../src/functions/backupVideos/handler";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

type BackupResult = { status: "ok"; processed: number } | { status: "error"; message: string; processed?: number };

/** Call handler without callback so we get the promise result. */
const invoke = (event: unknown) =>
  (main as unknown as (e: unknown, c: unknown) => Promise<BackupResult | void>)(event, {} as never);

describe("backupVideos integration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, IS_LOCAL: "true" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns error when event has no Messages", async () => {
    const event = {};
    const result = await invoke(event);
    expect(result).toEqual({
      status: "error",
      message: "No messages found in queue",
    });
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it("returns ok with processed 0 when Messages is empty", async () => {
    const event = { Messages: [] };
    const result = await invoke(event);
    expect(result).toEqual({ status: "ok", processed: 0 });
  });

  it("returns error when video is not found on YouTube", async () => {
    const videoId = "nonexistent";
    mockedAxios.get.mockResolvedValueOnce({ data: { items: [] } });

    const event = {
      Messages: [{ Body: videoId }],
    };
    const result = await invoke(event);

    expect(result).toEqual({
      status: "error",
      message: `Video with ID ${videoId} not found`,
      processed: 0,
    });
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining(videoId)
    );
  });

  it("returns ok and processed count when backup succeeds", async () => {
    const videoId = "shF8Sv-OswM";
    // YouTube API returns the video
    mockedAxios.get.mockResolvedValueOnce({
      data: { items: [{ id: videoId }] },
    });
    // Wayback check returns non-200 so we proceed to save (e.g. 404)
    mockedAxios.get.mockResolvedValueOnce({ status: 404 });
    // Wayback save succeeds
    mockedAxios.get.mockResolvedValueOnce({ status: 200 });

    const event = {
      Messages: [{ Body: videoId }],
    };
    const result = await invoke(event);

    expect(result).toEqual({ status: "ok", processed: 1 });
    expect(mockedAxios.get).toHaveBeenCalledTimes(3);
  });

  it("returns error when Wayback save fails", async () => {
    const videoId = "vid123";
    mockedAxios.get.mockResolvedValueOnce({
      data: { items: [{ id: videoId }] },
    });
    mockedAxios.get.mockResolvedValueOnce({ status: 404 });
    mockedAxios.get.mockResolvedValueOnce({ status: 500 });

    const event = {
      Messages: [{ Body: videoId }],
    };
    const result = await invoke(event);

    expect(result).toEqual({
      status: "error",
      message: expect.stringContaining("Error backing up"),
      processed: 0,
    });
  });

  it("returns internal server error when an unexpected error is thrown", async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error("Unexpected"));
    const event = {
      Messages: [{ Body: "vid" }],
    };
    const result = await invoke(event);
    expect(result).toEqual({
      status: "error",
      message: "Internal server error",
    });
  });
});
