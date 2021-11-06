import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda";
import { TodoService } from "../services/todoServices";
import { formatJSONResponse } from '@libs/apiGateway';

const _delete: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const { id } = event.pathParameters;

    const todoService = new TodoService();
    await todoService.deleteTodoById(id);

    return formatJSONResponse({
        statusCode: 200,
        message: JSON.stringify({
            DeletedItem: id
        }),
        event,
    });
}

export { _delete };
