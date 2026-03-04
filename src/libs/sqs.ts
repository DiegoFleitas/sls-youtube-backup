import type { SQSEvent } from "aws-lambda";
import * as AWS from "aws-sdk";

// TODO: comment this out if you don't want to see the logs
AWS.config.logger = console;

/** Local mock has same shape as ReceiveMessageResult for handler compatibility */
export type SQSMessagesResult =
  | AWS.SQS.ReceiveMessageResult
  | SQSEvent
  | { Messages?: AWS.SQS.Message[] };

export async function getSQSMessages(
  event: SQSEvent | { Messages?: AWS.SQS.Message[] }
): Promise<SQSMessagesResult> {
  if (process.env.IS_LOCAL) {
    return event;
  }

  const queueUrl = process.env.SQS_QUEUE_URL;
  if (!queueUrl) {
    throw new Error("SQS_QUEUE_URL is not set");
  }

  const sqs = new AWS.SQS({ region: "us-east-1" });
  return sqs
    .receiveMessage({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
    })
    .promise();
}

export async function sendSQSMessage(videoId: string): Promise<void> {
  const queueUrl = process.env.SQS_QUEUE_URL;
  if (!queueUrl) {
    throw new Error("SQS_QUEUE_URL is not set");
  }

  const sqs = new AWS.SQS({ region: "us-east-1" });
  try {
    const data = await sqs
      .sendMessage({
        QueueUrl: queueUrl,
        MessageBody: videoId,
      })
      .promise();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}
