import { middyfy } from "@libs/lambda";
import type { ValidatedEventAPIGatewayProxyEvent } from "@libs/apiGateway";
import { formatJSONResponse } from "@libs/apiGateway";
import { TwitterService } from "@libs/twitterService";
import { TweetRepository } from "../../../repositories/tweetRepository";
import { TweetItem } from "../../../model/TweetItem";

interface formattedJSONResponse {
  statusCode: number;
  body: string;
}

const pollTwitterFeed: ValidatedEventAPIGatewayProxyEvent<void> = async (
  _event
): Promise<formattedJSONResponse> => {
  try {
    const TS = new TwitterService();
    const db = new TweetRepository();

    const response = await TS.getTweets();
    const tweets: TweetItem[] = response.data.map(tweet => {
      return <TweetItem>{
        id: tweet.id,
        text: tweet.text,
        sent: false,
        createdAt: tweet.created_at,
      };
    });

    if (!tweets) {
      return formatJSONResponse({
        message: "no tweets",
      });
    }

    for (const tweet of tweets) {
      await db.createTweet(tweet);
    }

    return formatJSONResponse({
      message: "success",
    });
  } catch (err) {
    console.error(err);
    return formatJSONResponse({
      statusCode: 500,
      message: err,
    });
  }
};

export const main = middyfy(pollTwitterFeed);
