import type { APIGatewayProxyEvent } from "aws-lambda";
import axios from "axios";
import { middyfy } from "../../libs/lambda";
import { formatJSONResponse } from "../../libs/apiGateway";
import { sendSQSMessage } from "../../libs/sqs";

interface YouTubePlaylistItem {
  snippet: { resourceId: { videoId: string } };
}

const queuePlaylistBackup = async (event: APIGatewayProxyEvent) => {
  try {
    // Extract the playlist ID from the event data
    const body = event.body as { playlistId?: string } | null;
    const playlistId = body?.playlistId;
    if (!playlistId) {
      console.log(event);
      return formatJSONResponse(
        { message: "No playlist ID provided" },
        400
      );
    }

    // Build the URL for the playlist API endpoint
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&key=${process.env.YOUTUBE_DATA_API_KEY}`;

    // Make an HTTPS GET request to the URL using Axios
    const response = await axios.get(url);

    // Extract the video IDs from the response data
    const videoIds = (response.data.items as YouTubePlaylistItem[]).map(
      (item) => item.snippet.resourceId.videoId
    );

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
    return formatJSONResponse(
      { message: "Internal server error" },
      500
    );
  }
};

export const main = middyfy(queuePlaylistBackup);
