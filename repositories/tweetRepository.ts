import type { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { TweetItem } from '../model/tweetItem';
import * as AWS from 'aws-sdk';

// Log AWS SDK calls
AWS.config.logger = console;

export class TweetRepository {
    constructor(
        private readonly docClient: DocumentClient = new AWS.DynamoDB.DocumentClient(),
        private readonly tweetTable = process.env.TWEETS_TABLE
    ) {}

    async getAllTweets(): Promise<TweetItem[]> {
        const result = await this.docClient.scan({
            TableName: this.tweetTable
        }).promise();
        return result.Items as TweetItem[];
    }

    async createTweet(tweet: TweetItem): Promise<TweetItem> {
      try {
        await this.docClient.put({
          TableName: this.tweetTable,
          Item: tweet,
          ConditionExpression: 'attribute_not_exists(id)'
        }).promise();
        return tweet;
      } catch (e) {
        if (e.code !== "ConditionalCheckFailedException") {
          throw e;
        }
      }
    }

    async updateTweet(partialTweet: Partial<TweetItem>): Promise<TweetItem> {
        const { id, text, sent } = partialTweet;
        const updated = await this.docClient.update({
            TableName: this.tweetTable,
            Key: { 'id': id },
            UpdateExpression: 'set #text = :text, sent = :sent, createdAt = :createdAt',
            ExpressionAttributeNames: {
                '#text': 'text'
            },
            ExpressionAttributeValues: {
                ':text': text,
                ':sent': sent,
                ':createdAt': new Date().toISOString()
            },
            ReturnValues: 'ALL_NEW'
        }).promise();
        return updated.Attributes as TweetItem;
    }

    async deleteTweetById(id: string) {
        return this.docClient.delete({
            TableName: this.tweetTable,
            Key: { 'id': id }
        }).promise();
    }

    // note batches don't support conditionals inside the update expression
    async saveTweets(tweets: TweetItem[]): Promise<any> {
      const batch = tweets.map(tweet => {
        return <any> {
          PutRequest: { 
            Item: tweet
          }
        };
      });
      return await this.docClient.batchWrite({
          RequestItems: {
            [this.tweetTable]: batch
          }
      }).promise();
    }
}