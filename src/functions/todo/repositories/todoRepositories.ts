import type { DocumentClient } from 'aws-sdk/clients/dynamodb';

import { TodoItem } from '../model/todoItem';
import { createDynamoDBClient } from '../utils/dynamodbSetup';

export class TodoRepository {
    constructor(
        private readonly docClient: DocumentClient = createDynamoDBClient(),
        private readonly todoTable = process.env.TODOS_TABLE
    ) {}

    async getAllTodos(): Promise<TodoItem[]> {
        const result = await this.docClient.scan({
            TableName: this.todoTable
        }).promise();
        return result.Items as TodoItem[];
    }

    async createTodo(todo: TodoItem): Promise<TodoItem> {
        await this.docClient.put({
            TableName: this.todoTable,
            Item: todo
        }).promise();
        return todo;
    }

    async updateTodo(partialTodo: Partial<TodoItem>): Promise<TodoItem> {
        const { id, name, done } = partialTodo;
        const updated = await this.docClient.update({
            TableName: this.todoTable,
            Key: { 'id': id },
            UpdateExpression: 'set #name = :name, done = :done, createdAt = :createdAt',
            ExpressionAttributeNames: {
                '#name': 'name'
            },
            ExpressionAttributeValues: {
                ':name': name,
                ':done': done,
                ':createdAt': new Date().toISOString()
            },
            ReturnValues: 'ALL_NEW'
        }).promise();
        return updated.Attributes as TodoItem;
    }

    async deleteTodoById(id: string) {
        return this.docClient.delete({
            TableName: this.todoTable,
            Key: { 'id': id }
        }).promise();
    }
}
