import type { SQSEvent } from "aws-lambda";
import axios from "axios";
import { middyfy } from "../../libs/lambda";
import { getSQSMessages, deleteSQSMessages } from "../../libs/sqs";

const waybackSaveAPI = "https://web.archive.org/save/";
const waybackAvailabilityAPI = "https://archive.org/wayback/available";
const youtubeAPIBase = "https://www.googleapis.com/youtube/v3/videos";

interface BackupResult {
  status: "ok" | "error";
  message?: string;
  processed?: number;
}

interface AvailabilityResponse {
  archived_snapshots?: {
    closest?: {
      available?: boolean;
    };
  };
}

type MsgOutcome = {
  deleteMsg: boolean;
  counted: boolean;
  receiptHandle?: string;
};

async function processVideo(
  videoId: string,
  receiptHandle: string | undefined,
  existingIds: Set<string>
): Promise<MsgOutcome> {
  if (!existingIds.has(videoId)) {
    console.log({
      status: "skip",
      message: `Video ${videoId} not found on YouTube`,
    });
    // Permanent failure — retrying won't help, delete the message
    return { deleteMsg: true, counted: false, receiptHandle };
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
    return { deleteMsg: true, counted: true, receiptHandle };
  }

  // validateStatus prevents axios from throwing on non-2xx so we can inspect
  // the status and decide whether to delete the message or leave it for retry.
  const waybackResponse = await axios.get(`${waybackSaveAPI}${youtubeUrl}`, {
    headers: { Authorization: `LOW ${process.env.WAYBACK_MACHINE_API_KEY}` },
    timeout: 30_000,
    validateStatus: () => true,
  });
  if (waybackResponse.status !== 200) {
    // Transient failure — leave in queue for retry via visibility timeout
    console.log({
      status: waybackResponse.status,
      message: `Error backing up ${youtubeUrl} to the Wayback Machine`,
    });
    return { deleteMsg: false, counted: false };
  }

  console.log({
    status: 200,
    message: `Successfully backed up ${youtubeUrl} to the Wayback Machine`,
  });
  return { deleteMsg: true, counted: true, receiptHandle };
}

const backupVideos = async (
  event: SQSEvent | { Messages?: { Body?: string }[] }
): Promise<BackupResult | void> => {
  try {
    const queueResponse = await getSQSMessages(event);

    if (
      !queueResponse ||
      !("Messages" in queueResponse) ||
      !queueResponse.Messages
    ) {
      console.log(queueResponse);
      const result: BackupResult = {
        status: "error",
        message: "No messages found in queue",
      };
      console.log(result);
      return result;
    }

    const allMessages = queueResponse.Messages as {
      Body?: string;
      ReceiptHandle?: string;
    }[];
    // Keep messages and videoIds in sync so empty-body messages go to DLQ
    // rather than being permanently deleted as "not found on YouTube".
    const messages = allMessages.filter((m) => m.Body);
    const videoIds = messages.map((m) => m.Body as string);

    if (videoIds.length === 0) {
      return { status: "ok", processed: 0 };
    }

    // Single batch request: videos.list accepts up to 50 comma-separated ids (1 quota unit).
    // Encode each ID individually to avoid encoding the comma separator.
    const idsParam = videoIds.map(encodeURIComponent).join(",");
    const youtubeResponse = await axios.get(
      `${youtubeAPIBase}?id=${idsParam}&key=${process.env.YOUTUBE_DATA_API_KEY}`,
      { timeout: 10_000 }
    );
    const existingIds = new Set(
      (youtubeResponse.data.items as { id: string }[]).map((item) => item.id)
    );

    // Process all videos concurrently — SQS delivers at most 10 at once
    const outcomes = await Promise.allSettled(
      messages.map((msg) =>
        processVideo(msg.Body as string, msg.ReceiptHandle, existingIds)
      )
    );

    let processed = 0;
    const toDelete: { Id: string; ReceiptHandle: string }[] = [];

    for (let i = 0; i < outcomes.length; i++) {
      const outcome = outcomes[i];
      if (outcome.status === "fulfilled") {
        const { deleteMsg, counted, receiptHandle } = outcome.value;
        if (counted) processed++;
        if (deleteMsg && receiptHandle) {
          toDelete.push({ Id: String(i), ReceiptHandle: receiptHandle });
        }
      } else {
        console.error(
          `Unexpected error processing message ${i}:`,
          outcome.reason
        );
      }
    }

    if (!process.env.IS_LOCAL && toDelete.length > 0) {
      try {
        await deleteSQSMessages(toDelete);
      } catch (deleteError) {
        // Messages will be re-processed after visibility timeout expires.
        // The Wayback availability check prevents duplicate archives.
        console.error("Failed to delete processed SQS messages:", deleteError);
      }
    }

    return { status: "ok", processed };
  } catch (error) {
    console.error(error);
    return { status: "error", message: "Internal server error" };
  }
};

export const main = middyfy(backupVideos);
