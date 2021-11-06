import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { formatJSONResponse } from '@libs/apiGateway';

// service
import { TodoService } from '../services/todoServices';

const list: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
    const todoService = new TodoService();
    const items = await todoService.getAllTodos();

    return formatJSONResponse({
        statusCode: 201,
        message: items,
        event,
    });
}

export { list };
