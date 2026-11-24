import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import axios from "axios";
import { middyfy } from "../../libs/lambda";
import { summariseError } from "../../libs/logError";

const waybackSaveAPI = "https://web.archive.org/save/";
const waybackAvailabilityAPI = "https://archive.org/wayback/available";
const youtubeAPIBase = "https://www.googleapis.com/youtube/v3/videos";

/**
 * SYB-08 / BL-SLS-01: the queue body is untrusted input. Only YouTube's id
 * charset may reach an outbound URL, so `#`, `?`, `&`, `/` and `..` cannot
 * reshape the request path.
 */
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

interface AvailabilityResponse {
  archived_snapshots?: {
    closest?: {
      available?: boolean;
      timestamp?: string;
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
  if (!VIDEO_ID_PATTERN.test(videoId)) {
    console.log({
      status: "skip",
      message: "Rejected malformed video id",
      videoIdLength: videoId.length,
    });
    // Permanent and untrusted — retrying cannot help.
    return { shouldRetry: false, counted: false };
  }

  if (!existingIds.has(videoId)) {
    console.log({
      status: "skip",
      message: `Video ${videoId} not found on YouTube`,
    });
    // Permanent — retrying won't help, let AWS delete the message
    return { shouldRetry: false, counted: false };
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // BL-SLS-06: classify the availability call instead of letting a 4xx throw
  // into the retry path. 4xx resolves here; 5xx/timeouts still reject.
  const availabilityResponse = await axios.get<AvailabilityResponse>(
    `${waybackAvailabilityAPI}?url=${encodeURIComponent(youtubeUrl)}`,
    { timeout: 15_000, validateStatus: (status) => status < 500 }
  );
  if (availabilityResponse.data.archived_snapshots?.closest?.available) {
    console.log({
      status: 200,
      message: `Video already archived: ${youtubeUrl}`,
      snapshotTimestamp:
        availabilityResponse.data.archived_snapshots.closest.timestamp,
    });
    return { shouldRetry: false, counted: true };
  }

  // validateStatus prevents axios throwing on non-2xx so we can inspect the
  // status and decide whether to retry rather than always retrying on throw.
  const waybackResponse = await axios.get(`${waybackSaveAPI}${youtubeUrl}`, {
    headers: { Authorization: `Bearer ${process.env.WAYBACK_MACHINE_API_KEY}` },
    timeout: 30_000,
    validateStatus: () => true,
  });
  const saveStatus = waybackResponse.status;
  if (saveStatus !== 200) {
    const transient = saveStatus === 429 || saveStatus >= 500;
    console.log({
      status: saveStatus,
      classification: transient ? "transient" : "permanent",
      message: `Error backing up ${youtubeUrl} to the Wayback Machine`,
    });
    // 400 (e.g. a malformed URL) will never succeed on retry; 429/5xx will.
    return { shouldRetry: transient, counted: false };
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
  // SYB-02: the API key travels in a header, never in the URL.
  const apiKey = process.env.YOUTUBE_DATA_API_KEY;
  const youtubeResponse = await axios.get(`${youtubeAPIBase}?id=${idsParam}`, {
    headers: apiKey ? { "X-Goog-Api-Key": apiKey } : {},
    timeout: 10_000,
  });
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
      // SYB-02: summarised, never the raw error (which may embed a URL).
      console.error({
        message: `Unexpected error processing message ${i}`,
        ...summariseError(outcome.reason),
      });
      batchItemFailures.push({ itemIdentifier: records[i].messageId });
    }
  }

  console.log({ processed, retrying: batchItemFailures.length });
  return { batchItemFailures };
};

export const main = middyfy(backupVideos);
