import type { SQSEvent } from "aws-lambda";
import {
  ReceiveMessageCommand,
  type ReceiveMessageCommandOutput,
  SQSClient,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";

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

/** Local mock has same shape as ReceiveMessageCommandOutput for handler compatibility */
export type SQSMessagesResult =
  | ReceiveMessageCommandOutput
  | SQSEvent
  | { Messages?: { Body?: string }[] };

export async function getSQSMessages(
  event: SQSEvent | { Messages?: { Body?: string }[] }
): Promise<SQSMessagesResult> {
  if (process.env.IS_LOCAL) {
    return event;
  }

  const queueUrl = process.env.SQS_QUEUE_URL;
  if (!queueUrl) {
    throw new Error("SQS_QUEUE_URL is not set");
  }

  const client = sqsClient;
  const result = await client.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
    })
  );
  return result;
}

export async function sendSQSMessage(videoId: string): Promise<void> {
  const queueUrl = process.env.SQS_QUEUE_URL;
  if (!queueUrl) {
    throw new Error("SQS_QUEUE_URL is not set");
  }

  const client = sqsClient;
  try {
    const result = await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: videoId,
      })
    );
    console.log(result);
  } catch (error) {
    console.error(error);
  }
}
