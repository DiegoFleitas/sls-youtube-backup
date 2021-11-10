import { EventEmitter } from "events";
import { TWITTER_BEARER_TOKEN } from "../../secrets";
import * as request from 'request';

export class TwitterService extends EventEmitter {
  emitNewTweet(data) {
    this.emit("new-tweet", data);
  }

  async getTweets(userId: string = '882945467881074688'): Promise<any> {
    const options = {
      'method': 'GET',
      'url': `https://api.twitter.com/2/users/${userId}/tweets?tweet.fields=created_at`,
      'headers': {
        'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
      }
    };
    return request(options, (error, response) => {
      if (error) throw new Error(error);
      return response.body;
    });
  }

}