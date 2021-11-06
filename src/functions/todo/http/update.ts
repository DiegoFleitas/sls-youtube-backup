import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda";
import { TodoItem } from "../model/todoItem";
import { TodoService } from "../services/todoServices";
import { formatJSONResponse } from '@libs/apiGateway';

const update: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const { id } = event.pathParameters;
    
    const todoService = new TodoService();
    const body: Object = event.body;
    const todo: Partial<TodoItem> = {...body, id};

    const todoUpdated = await todoService.updateTodo(todo);

    return formatJSONResponse({
        statusCode: 200,
        message: JSON.stringify({
            item: todoUpdated
        }),
        event,
    });
}

export { update };
