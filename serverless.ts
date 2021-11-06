import type { AWS } from '@serverless/typescript';

import getCityInfo from '@functions/getCityInfo';
import { createTodo, deleteTodo, updateTodo, getAllTodos } from '@functions/todo';

import dynamoDbConfig from 'resources/dynamodb';

// CloudFormation JSON template
const serverlessConfiguration: AWS = {
  service: 'serverless-todos-rest-api',
  frameworkVersion: '2',
  custom: {
    esbuild: {
      bundle: true,
      minify: false,
      sourcemap: true,
      exclude: ['aws-sdk'],
      target: 'node14',
      define: { 'require.resolve': undefined },
      platform: 'node',
    },
  },
  plugins: [
    'serverless-esbuild',
    'serverless-iam-roles-per-function'
  ],
  provider: {
    name: 'aws',
    runtime: 'nodejs14.x',
    apiGateway: {
      minimumCompressionSize: 1024,
      shouldStartNameWithService: true,
    },
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      TODOS_TABLE: 'todo-list-table'
    },
    lambdaHashingVersion: '20201221',
  },
  // package functions individually
  package: {
    individually: true
  },
  // import the function via paths
  functions: { 
    getCityInfo, createTodo, deleteTodo, updateTodo, getAllTodos
  },
  resources: dynamoDbConfig
};

module.exports = serverlessConfiguration;
