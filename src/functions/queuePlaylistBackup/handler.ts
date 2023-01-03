import axios from "axios";
import * as AWS from "aws-sdk";
import { middyfy } from "../../libs/lambda";
import { formatJSONResponse } from "../../libs/apiGateway";

const sqs = new AWS.SQS();

const queuePlaylistBackup = async (event: { playlistId: string }) => {
  try {
    // Extract the playlist ID from the event data
    const playlistId = event.playlistId;

    // Build the URL for the playlist API endpoint
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&key=${process.env.YOUTUBE_DATA_API_KEY}`;

    // Make an HTTPS GET request to the URL using Axios
    const response = await axios.get(url);

    // Extract the video IDs from the response data
    const videoIds = response.data.items.map(
      (item) => item.snippet.resourceId.videoId
    );

    // Send each video ID to the SQS queue as a separate message
    for (const videoId of videoIds) {
      const params = {
        QueueUrl: process.env.SQS_QUEUE_URL,
        MessageBody: videoId,
      };
      await sqs.sendMessage(params).promise();
    }

    // Return the array of video IDs
    return formatJSONResponse({
      message: videoIds,
    });
  } catch (err) {
    console.log(err);
    return formatJSONResponse({
      statusCode: 500,
      message: err,
    });
  }
};

export const main = middyfy(queuePlaylistBackup);
