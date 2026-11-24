import { SendMessageBatchCommand, SQSClient } from "@aws-sdk/client-sqs";

const DEFAULT_REGION = "us-east-1";

/** Loopback endpoints are the only ones allowed to run without SigV4 signing. */
function isLoopbackEndpoint(endpoint: string): boolean {
  return /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(
    endpoint
  );
}

/**
 * SYB-09: only an explicit SQS_ENDPOINT_URL (the documented E2E override)
 * redirects the client, and only to a loopback endpoint; the region comes from
 * the runtime environment instead of a hardcoded literal.
 */
function buildSQSClient(): SQSClient {
  const region = process.env.REGION ?? process.env.AWS_REGION ?? DEFAULT_REGION;
  const config: ConstructorParameters<typeof SQSClient>[0] = { region };

  const endpoint = process.env.SQS_ENDPOINT_URL;
  if (endpoint) {
    if (!isLoopbackEndpoint(endpoint)) {
      throw new Error(
        "SQS_ENDPOINT_URL must point at a loopback HTTP endpoint (E2E only)"
      );
    }
    config.endpoint = endpoint;
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "local",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "local",
    };
  }
  return new SQSClient(config);
}

const sqsClient = buildSQSClient();

/** Sends video IDs to SQS in batches of 10 (SQS batch limit). */
export async function sendSQSMessages(videoIds: string[]): Promise<void> {
  const queueUrl = process.env.SQS_QUEUE_URL;
  if (!queueUrl) {
    throw new Error("SQS_QUEUE_URL is not set");
  }

  for (let i = 0; i < videoIds.length; i += 10) {
    const batch = videoIds.slice(i, i + 10);
    const result = await sqsClient.send(
      new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: batch.map((id, j) => ({ Id: String(j), MessageBody: id })),
      })
    );
    if (result.Failed?.length) {
      const failedIds = result.Failed.map((f) => videoIds[i + Number(f.Id)]);
      throw new Error(
        `SQS batch send partially failed: ${
          result.Failed.length
        } message(s) not enqueued (${failedIds.join(", ")})`
      );
    }
  }
}
