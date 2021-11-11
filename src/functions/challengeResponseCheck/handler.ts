import { middyfy } from "@libs/lambda";
import type { ValidatedEventAPIGatewayProxyEvent } from "@libs/apiGateway";
import { formatJSONResponse } from "@libs/apiGateway";
import * as crypto from "crypto";
import { TWITTER_API_KEY_SECRET } from "../../../secrets";

const challengeResponseCheck: ValidatedEventAPIGatewayProxyEvent<void> = async (
  event
): Promise<any> => {
  try {
    const crcToken = event.pathParameters ? event.pathParameters.crc_token : "";
    // console.log('crcToken', crcToken);

    const consumerSecret = TWITTER_API_KEY_SECRET;
    const hmac = crypto
      .createHmac("sha256", consumerSecret)
      .update(crcToken)
      .digest("base64");

    // console.log('hmac', hmac);
    return {
      statusCode: 200,
      body: JSON.stringify({ response_token: `sha256=${hmac}` }),
    };
  } catch (err) {
    console.error(err);
    return formatJSONResponse({
      statusCode: 500,
      message: err,
    });
  }
};

export const main = middyfy(challengeResponseCheck);
