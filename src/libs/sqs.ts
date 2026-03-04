import type { SQSEvent } from "aws-lambda";
import {
  ReceiveMessageCommand,
  type ReceiveMessageCommandOutput,
  SQSClient,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";

const REGION = "us-east-1";

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

  const client = new SQSClient({ region: REGION });
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

  const client = new SQSClient({ region: REGION });
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
