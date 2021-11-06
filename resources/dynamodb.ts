const dynamoDbConfig = {
  Resources: {
    TodosDynamoDBTable: {
      Type: "AWS::DynamoDB::Table",
      Properties: {
        TableName: "${self:provider.environment.TODOS_TABLE}",
        AttributeDefinitions:[
          { AttributeName: 'id', AttributeType: 'S' }
        ],
        KeySchema: [
          { AttributeName: 'id', KeyType: 'HASH'}
        ],
        // DynamoDB On-Demand
        BillingMode: 'PAY_PER_REQUEST',
      },
    }
  }
};

export default dynamoDbConfig;
