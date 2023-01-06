import axios from "axios";
import { middyfy } from "../../libs/lambda";
import { formatJSONResponse } from "../../libs/apiGateway";
import { getSQSMessages } from "../../libs/sqs";

const waybackAPI = "https://web.archive.org/save/";
const youtubeAPI = "https://www.googleapis.com/youtube/v3/videos?id=";

const backupVideos = async (event) => {
  try {
    const queueResponse = await getSQSMessages(event);

    const videoIds = queueResponse.Messages.map((message: any) => message.Body);

    for (const videoId of videoIds) {
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const waybackUrl = `${waybackAPI}${youtubeUrl}`;

      const youtubeResponse = await axios.get(
        `${youtubeAPI}${videoId}&key=${process.env.YOUTUBE_DATA_API_KEY}`
      );
      if (youtubeResponse.data.items.length < 0) {
        return formatJSONResponse({
          status: 500,
          message: `Video with ID ${videoId} not found`,
        });
      }

      // video exists, check if backup exists too
      const checkUrl = `https://web.archive.org/web/20130720113437oe_/http://wayback-fakeurl.archive.org/yt/${videoId}`;
      const waybackCheckResponse = await axios.get(checkUrl);
      if (waybackCheckResponse.status == 200) {
        return formatJSONResponse({
          status: 200,
          message: `Video has been backed up to the Wayback Machine already: ${checkUrl}`,
        });
      }

      // video exists & backup doesn't, proceed to backup
      const waybackResponse = await axios.get(waybackUrl, {
        headers: {
          Authorization: `LOW ${process.env.WAYBACK_MACHINE_API_KEY}`,
        },
      });
      if (waybackResponse.status !== 200) {
        console.log(waybackResponse);
        return formatJSONResponse({
          status: 500,
          message: `Error backing up ${youtubeUrl} to the Wayback Machine`,
        });
      }

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
