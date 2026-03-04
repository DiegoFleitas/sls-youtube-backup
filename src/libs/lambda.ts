import type { APIGatewayProxyResult } from "aws-lambda";
import middy from "@middy/core";
import middyJsonBodyParser from "@middy/http-json-body-parser";

/** Wraps a Lambda handler with Middy; accepts any event shape (API Gateway or SQS). */
export const middyfy = <TEvent = unknown>(
  handler: (event: TEvent, context: unknown) => Promise<APIGatewayProxyResult | void>
) => {
  return middy(handler as (event: unknown, context: unknown) => Promise<APIGatewayProxyResult | void>).use(middyJsonBodyParser());
};
