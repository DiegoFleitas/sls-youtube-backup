// import "source-map-support/register";

import { middyfy } from "@libs/lambda";
import { formatJSONResponse } from "@libs/apiGateway";
import { TwitterService } from "@libs/twitterService";
import { DiscordService } from "@libs/discordService";

interface formattedJSONResponse {
  statusCode: number;
  body: string;
}

const sendTweetToDiscord = async (_event): Promise<formattedJSONResponse> => {
  try {
    const DS = new DiscordService();
    const TS = new TwitterService();

    TS.on("new-tweet", async (message) => {
      console.log("an event occurred!");
      await DS.postMessage(message);
    });

    return formatJSONResponse({
      message: "success",
    });
  } catch (err) {
    return formatJSONResponse({
      statusCode: 500,
      message: err.getMessage(),
    });
  }
};

export const main = middyfy(sendTweetToDiscord);