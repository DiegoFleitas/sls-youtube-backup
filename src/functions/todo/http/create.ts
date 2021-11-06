import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/apiGateway';
import { APIGatewayProxyResult } from 'aws-lambda';
import { formatJSONResponse } from '@libs/apiGateway';


// model
import { createTodoSchema } from '../model/todoSchema';

// services
import { TodoService } from '../services/todoServices';


const create: ValidatedEventAPIGatewayProxyEvent<typeof createTodoSchema> = async (event): Promise<APIGatewayProxyResult> => {
    const { name } = event.body;

    const todoService = new TodoService();
    const todo = await todoService.createTodo(name);
    
    return formatJSONResponse({
        statusCode: 201,
        message: JSON.stringify({
            item: todo
        }),
        event,
    });
}

export { create };
