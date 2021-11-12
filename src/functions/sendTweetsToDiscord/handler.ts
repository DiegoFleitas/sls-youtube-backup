import { middyfy } from "@libs/lambda";
import type { ValidatedEventAPIGatewayProxyEvent } from "@libs/apiGateway";
import { formatJSONResponse } from "@libs/apiGateway";
import { DiscordService } from "@libs/discordService";
import { TweetItem } from "model/tweetItem";
import { TweetRepository } from "../../../repositories/tweetRepository";

interface formattedJSONResponse {
  statusCode: number;
  body: string;
}

const sendTweetsToDiscord: ValidatedEventAPIGatewayProxyEvent<any> = async (
  event,
  _context
): Promise<formattedJSONResponse> => {
  try {
    // console.log(typeof event, event);
    const tweetsToForward = <TweetItem[]><unknown> event;
    const DS = new DiscordService();
    const db = new TweetRepository();
    
    // do one
    tweetsToForward.splice(1);

    tweetsToForward.forEach(async (tweet) => {
      // console.log(tweet.text)
      // await DS.postMessage(tweet.text);
      tweet.sent = 1;
      await db.updateTweet(tweet);
    });

    return formatJSONResponse({
      message: "Successfully sent tweets to discord",
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
