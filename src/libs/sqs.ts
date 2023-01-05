import { SQS } from "aws-sdk";

export async function getSQSMessages(event) {
  if (process.env.IS_LOCAL) {
    return event;
  }

  const sqs = new SQS({ region: "us-east-1" });

  return sqs
    .receiveMessage({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MaxNumberOfMessages: 10,
    })
    .promise();
}
