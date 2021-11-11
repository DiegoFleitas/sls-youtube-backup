import { middyfy } from "@libs/lambda";
import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/apiGateway';
import { formatJSONResponse } from "@libs/apiGateway";
import { TwitterService } from "@libs/twitterService";
import { DiscordService } from "@libs/discordService";

interface formattedJSONResponse {
  statusCode: number;
  body: string;
}

const sendTweetToDiscord: ValidatedEventAPIGatewayProxyEvent<void> = async (_event): Promise<formattedJSONResponse> => {
  try {
    const DS = new DiscordService();
    const TS = new TwitterService();

    TS.on("new-tweet", async (message) => {
      const response = await DS.postMessage(message);
      return formatJSONResponse({
        message: JSON.stringify(response),
      });
    });
  } catch (err) {
    console.error(err);
    return formatJSONResponse({
      statusCode: 500,
      message: err,
    });
  }
};

export const main = middyfy(sendTweetToDiscord);