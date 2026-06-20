import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import axios from "axios";
import { middyfy } from "../../libs/lambda";

const waybackSaveAPI = "https://web.archive.org/save/";
const waybackAvailabilityAPI = "https://archive.org/wayback/available";
const youtubeAPIBase = "https://www.googleapis.com/youtube/v3/videos";

interface AvailabilityResponse {
  archived_snapshots?: {
    closest?: {
      available?: boolean;
    };
  };
}

type MsgOutcome = {
  shouldRetry: boolean;
  counted: boolean;
};

async function processVideo(
  videoId: string,
  existingIds: Set<string>
): Promise<MsgOutcome> {
  if (!existingIds.has(videoId)) {
    console.log({
      status: "skip",
      message: `Video ${videoId} not found on YouTube`,
    });
    // Permanent — retrying won't help, let AWS delete the message
    return { shouldRetry: false, counted: false };
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const availabilityResponse = await axios.get<AvailabilityResponse>(
    `${waybackAvailabilityAPI}?url=${encodeURIComponent(youtubeUrl)}`,
    { timeout: 15_000 }
  );
  if (availabilityResponse.data.archived_snapshots?.closest?.available) {
    console.log({
      status: 200,
      message: `Video already archived: ${youtubeUrl}`,
    });
    return { shouldRetry: false, counted: true };
  }

  // validateStatus prevents axios throwing on non-2xx so we can inspect the
  // status and decide whether to retry rather than always retrying on throw.
  const waybackResponse = await axios.get(`${waybackSaveAPI}${youtubeUrl}`, {
    headers: { Authorization: `LOW ${process.env.WAYBACK_MACHINE_API_KEY}` },
    timeout: 30_000,
    validateStatus: () => true,
  });
  if (waybackResponse.status !== 200) {
    console.log({
      status: waybackResponse.status,
      message: `Error backing up ${youtubeUrl} to the Wayback Machine`,
    });
    // Transient — return to queue for retry via visibility timeout
    return { shouldRetry: true, counted: false };
  }

  console.log({
    status: 200,
    message: `Successfully backed up ${youtubeUrl} to the Wayback Machine`,
  });
  return { shouldRetry: false, counted: true };
}

const backupVideos = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  // Filter records with no body so they reach the DLQ rather than being
  // silently dropped as "not found on YouTube".
  const records = event.Records.filter((r) => r.body);
  const videoIds = records.map((r) => r.body);

  if (videoIds.length === 0) {
    return { batchItemFailures: [] };
  }

  // Encode each ID individually — encodeURIComponent on the joined string
  // encodes commas as %2C, breaking multi-ID YouTube lookups.
  const idsParam = videoIds.map(encodeURIComponent).join(",");
  const youtubeResponse = await axios.get(
    `${youtubeAPIBase}?id=${idsParam}&key=${process.env.YOUTUBE_DATA_API_KEY}`,
    { timeout: 10_000 }
  );
  const existingIds = new Set(
    (youtubeResponse.data.items as { id: string }[]).map((item) => item.id)
  );

  const outcomes = await Promise.allSettled(
    records.map((record) => processVideo(record.body, existingIds))
  );

  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];
  let processed = 0;

  for (let i = 0; i < outcomes.length; i++) {
    const outcome = outcomes[i];
    if (outcome.status === "fulfilled") {
      const { shouldRetry, counted } = outcome.value;
      if (counted) processed++;
      if (shouldRetry) {
        batchItemFailures.push({ itemIdentifier: records[i].messageId });
      }
    } else {
      console.error(
        `Unexpected error processing message ${i}:`,
        outcome.reason
      );
      batchItemFailures.push({ itemIdentifier: records[i].messageId });
    }
  }

  console.log({ processed, retrying: batchItemFailures.length });
  return { batchItemFailures };
};

export const main = middyfy(backupVideos);
