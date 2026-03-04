import type { APIGatewayProxyEvent } from "aws-lambda";
import axios from "axios";
import { middyfy } from "../../libs/lambda";
import { formatJSONResponse } from "../../libs/apiGateway";
import { sendSQSMessage } from "../../libs/sqs";

interface YouTubePlaylistItem {
  snippet: { resourceId: { videoId: string } };
}

interface PlaylistItemsResponse {
  items: YouTubePlaylistItem[];
  nextPageToken?: string;
}

const queuePlaylistBackup = async (event: APIGatewayProxyEvent) => {
  try {
    // Extract the playlist ID from the event data
    const body = event.body as { playlistId?: string } | null;
    const playlistId = body?.playlistId;
    if (!playlistId) {
      console.log(event);
      return formatJSONResponse({ message: "No playlist ID provided" }, 400);
    }

    const apiKey = process.env.YOUTUBE_DATA_API_KEY;
    const videoIds: string[] = [];
    let pageToken: string | undefined;

    // Paginate: fetch up to 50 items per request (1 quota unit per page)
    do {
      const params = new URLSearchParams({
        part: "snippet",
        playlistId,
        maxResults: "50",
        key: apiKey ?? "",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`;
      const response = await axios.get<PlaylistItemsResponse>(url);

      const pageIds = (response.data.items ?? []).map(
        (item) => item.snippet.resourceId.videoId
      );
      videoIds.push(...pageIds);
      pageToken = response.data.nextPageToken;
    } while (pageToken);

    // Send each video ID to the SQS queue as a separate message
    for (const videoId of videoIds) {
      await sendSQSMessage(videoId);
    }

    // Return the array of video IDs
    return formatJSONResponse({
      message: videoIds,
    });
  } catch (err) {
    console.error(err);
    return formatJSONResponse({ message: "Internal server error" }, 500);
  }
};

export const main = middyfy(queuePlaylistBackup);
