import { SendMessageBatchCommand, SQSClient } from "@aws-sdk/client-sqs";

const REGION = "us-east-1";

/** Uses custom endpoint when SQS_ENDPOINT_URL or AWS_ENDPOINT_URL is set (e.g. ElasticMQ). */
function buildSQSClient(): SQSClient {
  const endpoint = process.env.SQS_ENDPOINT_URL ?? process.env.AWS_ENDPOINT_URL;
  const config: ConstructorParameters<typeof SQSClient>[0] = { region: REGION };
  if (endpoint) {
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
