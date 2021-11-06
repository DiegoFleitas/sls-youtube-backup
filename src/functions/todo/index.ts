import { handlerPath } from '@libs/handlerResolver';
import { createTodoSchema } from './model/todoSchema';

const createTodo = {
  handler: `${handlerPath(__dirname)}/handler.createTodo`,
  events: [
    {
      http: {
        method: 'post',
        path: 'todos',
        request: {
          schema: {
            'application/json': createTodoSchema 
          }
        }
      }
    }
  ],
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: [
        'dynamodb:PutItem'
      ],
      Resource: { "Fn::GetAtt" : [ "TodosDynamoDBTable", "Arn" ] }
    }
  ]
}

const getAllTodos = {
  handler: `${handlerPath(__dirname)}/handler.getAllTodos`,
  events: [
    {
      http: {
        method: 'get',
        path: 'todos',
      }
    }
  ],
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: [
        'dynamodb:Scan'
      ],
      Resource: { "Fn::GetAtt" : [ "TodosDynamoDBTable", "Arn" ] }
    }
  ]
}

const updateTodo = {
  handler: `${handlerPath(__dirname)}/handler.updateTodo`,
  events: [
    {
      http: {
        method: 'put',
        path: 'todo/{id}',
      }
    }
  ],
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: [
        'dynamodb:UpdateItem'
      ],
      Resource: { "Fn::GetAtt" : [ "TodosDynamoDBTable", "Arn" ] }
    }
  ]
}

const deleteTodo = {
  handler: `${handlerPath(__dirname)}/handler.deleteTodo`,
  events: [
    {
      http: {
        method: 'delete',
        path: 'todo/{id}',
      }
    }
  ],
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: [
        'dynamodb:DeleteItem'
      ],
      Resource: { "Fn::GetAtt" : [ "TodosDynamoDBTable", "Arn" ] }
    }
  ]
}

export { createTodo, getAllTodos, updateTodo, deleteTodo };
