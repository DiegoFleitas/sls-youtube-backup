import { middyfy } from "@libs/lambda";
import type { ValidatedEventAPIGatewayProxyEvent } from "@libs/apiGateway";
import { formatJSONResponse } from "@libs/apiGateway";
import { TwitterService } from "@libs/twitterService";
import { TweetRepository } from "../../../repositories/tweetRepository";
import { TweetItem } from "../../../model/TweetItem";
import * as AWS from "aws-sdk";

interface formattedJSONResponse {
  statusCode: number;
  body: string;
}

const pollTwitterFeed: ValidatedEventAPIGatewayProxyEvent<void> = async (
  _event,
  _context
): Promise<formattedJSONResponse> => {
  try {
    const TS = new TwitterService();
    const db = new TweetRepository();

    const response = await TS.getTweets();
    const tweets: TweetItem[] = response.data.map((tweet) => {
      return <TweetItem>{
        id: tweet.id,
        text: tweet.text,
        sent: 0,
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

    const tweetsToForward = await db.getAllNotSentTweets();
    console.log(tweetsToForward);
    if (tweetsToForward.length > 0) {
      const lambda = new AWS.Lambda({
        region: `${process.env.REGION}`,
      });
      lambda.invoke(
        {
          FunctionName: `${process.env.LAMBDA_SEND_TWEETS_TO_DISCORD}`,
          InvocationType: "Event",
          LogType: "Tail",
          Payload: JSON.stringify(tweetsToForward),
        },
        (error, _data) => {
          if (error) {
            console.log(error);
          }
        }
      );
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
