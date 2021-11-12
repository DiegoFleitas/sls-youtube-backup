import { middyfy } from "@libs/lambda";
import type { ValidatedEventAPIGatewayProxyEvent } from "@libs/apiGateway";
import { formatJSONResponse } from "@libs/apiGateway";
import { TwitterService } from "@libs/twitterService";
import { DiscordService } from "@libs/discordService";

interface formattedJSONResponse {
  statusCode: number;
  body: string;
}

const sendTweetsToDiscord: ValidatedEventAPIGatewayProxyEvent<void> = async (
  event,
  _context
): Promise<formattedJSONResponse> => {
  try {
    console.log(typeof event, event);
    const DS = new DiscordService();
    const TS = new TwitterService();
    
    // tweetsToForward.forEach(async (tweet) => {

    // });

    // const response = await DS.postMessage('los meme');
    return formatJSONResponse({
      // message: JSON.stringify(response),
      message: JSON.stringify("success"),
    });
  } catch (err) {
    console.error(err);
    return formatJSONResponse({
      statusCode: 500,
      message: err,
    });
  }
};

export const main = middyfy(sendTweetsToDiscord);
