import * as AWS from "aws-sdk";

// TODO: comment this out if you don't want to see the logs
AWS.config.logger = console;

export async function getSQSMessages(event) {
  if (process.env.IS_LOCAL) {
    return event;
  }

  const sqs = new AWS.SQS({ region: "us-east-1" });

  return sqs
    .receiveMessage({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MaxNumberOfMessages: 1,
    })
    .promise();
}

export async function sendSQSMessage(videoId) {
  const sqs = new AWS.SQS({ region: "us-east-1" });

  const params = {
    QueueUrl: process.env.SQS_QUEUE_URL,
    MessageBody: videoId,
  };

  try {
    const data = await sqs.sendMessage(params).promise();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}
