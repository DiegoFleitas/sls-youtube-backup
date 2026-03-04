import type { SQSEvent } from "aws-lambda";
import axios from "axios";
import { middyfy } from "../../libs/lambda";
import { getSQSMessages } from "../../libs/sqs";

const waybackAPI = "https://web.archive.org/save/";
const youtubeAPI = "https://www.googleapis.com/youtube/v3/videos?id=";

interface BackupResult {
  status: "ok" | "error";
  message?: string;
  processed?: number;
}

const backupVideos = async (
  event: SQSEvent | { Messages?: { Body?: string }[] }
): Promise<BackupResult | void> => {
  try {
    const queueResponse = await getSQSMessages(event);

    if (!queueResponse || !("Messages" in queueResponse) || !queueResponse.Messages) {
      console.log(queueResponse);
      const result: BackupResult = { status: "error", message: "No messages found in queue" };
      console.log(result);
      return result;
    }

    const videoIds = queueResponse.Messages.map(
      (message) => (message as { Body?: string }).Body ?? ""
    ).filter(Boolean);

    let processed = 0;
    for (const videoId of videoIds) {
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const waybackUrl = `${waybackAPI}${youtubeUrl}`;

      const youtubeResponse = await axios.get(
        `${youtubeAPI}${videoId}&key=${process.env.YOUTUBE_DATA_API_KEY}`
      );
      if (youtubeResponse.data.items.length === 0) {
        const result: BackupResult = {
          status: "error",
          message: `Video with ID ${videoId} not found`,
          processed,
        };
        console.log(result);
        return result;
      }

      // video exists, check if backup exists too
      const checkUrl = `https://web.archive.org/web/20130720113437oe_/http://wayback-fakeurl.archive.org/yt/${videoId}`;
      const waybackCheckResponse = await axios.get(checkUrl);
      if (waybackCheckResponse.status === 200) {
        console.log({
          status: 200,
          message: `Video has been backed up to the Wayback Machine already: ${checkUrl}`,
        });
        processed++;
        continue;
      }

      // video exists & backup doesn't, proceed to backup
      const waybackResponse = await axios.get(waybackUrl, {
        headers: {
          Authorization: `LOW ${process.env.WAYBACK_MACHINE_API_KEY}`,
        },
      });
      if (waybackResponse.status !== 200) {
        console.log(waybackResponse);
        const result: BackupResult = {
          status: "error",
          message: `Error backing up ${youtubeUrl} to the Wayback Machine`,
          processed,
        };
        console.log(result);
        return result;
      }

      console.log({
        status: 200,
        message: `Successfully backed up ${youtubeUrl} to the Wayback Machine`,
      });
      processed++;
    }

    return { status: "ok", processed };
  } catch (error) {
    console.error(error);
    return { status: "error", message: "Internal server error" };
  }
};

export const main = middyfy(backupVideos);
