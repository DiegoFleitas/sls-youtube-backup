import axios from "axios";
import { SQS } from "aws-sdk";
import { middyfy } from "../../libs/lambda";
import { formatJSONResponse } from "../../libs/apiGateway";

const waybackAPI: string = "https://web.archive.org/save/";
const youtubeAPI: string = "https://www.googleapis.com/youtube/v3/videos?id=";

const sqs = new SQS({ region: "us-east-1" });

const backupVideos = async () => {
  try {
    const queueResponse = await sqs
      .receiveMessage({
        QueueUrl: process.env.SQS_QUEUE_URL,
        MaxNumberOfMessages: 10,
      })
      .promise();

    if (!queueResponse?.Messages) {
      return formatJSONResponse({
        message: "No videos to backup",
      });
    }

    const videoIds = queueResponse.Messages.map((message: any) => message.Body);

    for (const videoId of videoIds) {
      const youtubeUrl: string = `https://www.youtube.com/watch?v=${videoId}`;
      const waybackUrl: string = `${waybackAPI}${youtubeUrl}`;

      const youtubeResponse = await axios.get(youtubeAPI);
      if (youtubeResponse.data.items.length < 0) {
        console.error(`Video with ID ${videoId} not found`);
      }

      // video exists, proceed with backup
      const waybackResponse = await axios.get(waybackUrl);
      if (waybackResponse.status !== 200) {
        return formatJSONResponse({
          status: 500,
          message: `Error backing up ${youtubeUrl} to the Wayback Machine`,
        });
      }

      console.log(waybackResponse);

      return formatJSONResponse({
        status: 500,
        message: `Successfully backed up ${youtubeUrl} to the Wayback Machine`,
      });
    }
  } catch (error) {
    console.log(error);
    return formatJSONResponse({
      status: 500,
      message: error,
    });
  }
};

export const main = middyfy(backupVideos);
