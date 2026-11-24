import type { APIGatewayProxyEvent } from "aws-lambda";
import axios from "axios";
import { middyfy } from "../../libs/lambda";
import { formatJSONResponse } from "../../libs/apiGateway";
import { sendSQSMessages } from "../../libs/sqs";
import { summariseError } from "../../libs/logError";

interface YouTubePlaylistItem {
  snippet: { resourceId: { videoId: string } };
}

interface PlaylistItemsResponse {
  items: YouTubePlaylistItem[];
  nextPageToken?: string;
}

/** SYB-01: a playlist id is an opaque [A-Za-z0-9_-] token, never a URL or path. */
const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{10,60}$/;

/** BL-SLS-04: bound the fan-out a single request may cause. */
const DEFAULT_MAX_VIDEOS_PER_REQUEST = 200;

/** BL-SLS-03: the client timeout must stay below the function timeout (30 s). */
const YOUTUBE_REQUEST_TIMEOUT_MS = 5_000;

function maxVideosPerRequest(): number {
  const configured = Number(process.env.MAX_VIDEOS_PER_REQUEST);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_VIDEOS_PER_REQUEST;
}

/**
 * BL-SLS-01: optional entitlement allowlist. When ALLOWED_PLAYLIST_IDS is set,
 * only those playlists may be enumerated, so "back up a playlist" means "back
 * up one of the owner's playlists". An empty value keeps the previous
 * behaviour (any public playlist) and should not be used in production.
 */
function isPlaylistAllowed(playlistId: string): boolean {
  const allowlist = (process.env.ALLOWED_PLAYLIST_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return allowlist.length === 0 || allowlist.includes(playlistId);
}

const queuePlaylistBackup = async (event: APIGatewayProxyEvent) => {
  try {
    // Extract the playlist ID from the event data
    const body = event.body as { playlistId?: string } | null;
    const playlistId = body?.playlistId;
    if (!playlistId) {
      return formatJSONResponse({ message: "No playlist ID provided" }, 400);
    }
    if (!PLAYLIST_ID_PATTERN.test(playlistId)) {
      return formatJSONResponse({ message: "Invalid playlist ID" }, 400);
    }
    if (!isPlaylistAllowed(playlistId)) {
      return formatJSONResponse({ message: "Playlist not permitted" }, 403);
    }

    const apiKey = process.env.YOUTUBE_DATA_API_KEY;
    const maxVideos = maxVideosPerRequest();
    const videoIds: string[] = [];
    let pageToken: string | undefined;
    let truncated = false;

    // Paginate: fetch up to 50 items per request (1 quota unit per page)
    do {
      const params = new URLSearchParams({
        part: "snippet",
        playlistId,
        maxResults: "50",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`;
      // SYB-02: the API key travels in a header, never in the URL, so a
      // serialised axios error cannot carry the credential into the logs.
      const response = await axios.get<PlaylistItemsResponse>(url, {
        headers: apiKey ? { "X-Goog-Api-Key": apiKey } : {},
        timeout: YOUTUBE_REQUEST_TIMEOUT_MS,
      });

      const pageIds = (response.data.items ?? []).map(
        (item) => item.snippet.resourceId.videoId
      );
      videoIds.push(...pageIds);
      pageToken = response.data.nextPageToken;

      if (videoIds.length >= maxVideos) {
        truncated = videoIds.length > maxVideos || Boolean(pageToken);
        videoIds.length = Math.min(videoIds.length, maxVideos);
        break;
      }
    } while (pageToken);

    // Send all video IDs to SQS in batches of 10
    await sendSQSMessages(videoIds);

    // Return the array of video IDs
    return formatJSONResponse({
      message: videoIds,
      count: videoIds.length,
      truncated,
    });
  } catch (err) {
    // SYB-02: never log the raw error object — it can contain a credential.
    console.error({
      message: "queuePlaylistBackup failed",
      ...summariseError(err),
    });
    return formatJSONResponse({ message: "Internal server error" }, 500);
  }
};

export const main = middyfy(queuePlaylistBackup);
