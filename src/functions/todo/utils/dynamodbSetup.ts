import * as AWS from 'aws-sdk';

const createDynamoDBClient = () => {
    return new AWS.DynamoDB.DocumentClient();
}

export { createDynamoDBClient };
