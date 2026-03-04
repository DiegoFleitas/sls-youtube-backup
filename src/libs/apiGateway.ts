import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Handler,
} from "aws-lambda";
import type { FromSchema, JSONSchema } from "json-schema-to-ts";

type ValidatedAPIGatewayProxyEvent<S extends JSONSchema> = Omit<
  APIGatewayProxyEvent,
  "body"
> & {
  body: FromSchema<S>;
};
export type ValidatedEventAPIGatewayProxyEvent<S extends JSONSchema> = Handler<
  ValidatedAPIGatewayProxyEvent<S>,
  APIGatewayProxyResult
>;

export const formatJSONResponse = (
  response: Record<string, unknown>,
  statusCode = 200
) => {
  return {
    statusCode,
    body: JSON.stringify(response),
  };
};
