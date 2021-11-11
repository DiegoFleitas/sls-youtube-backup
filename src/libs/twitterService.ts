import { EventEmitter } from "events";
import { TWITTER_BEARER_TOKEN } from "../../secrets";
import axios, { AxiosRequestConfig } from 'axios';

export class TwitterService extends EventEmitter {
  emitNewTweet(data) {
    this.emit("new-tweet", data);
  }

  async getTweets(userId: string = '882945467881074688'): Promise<any> {
    const options: AxiosRequestConfig<any> = {
      url: `https://api.twitter.com/2/users/${userId}/tweets?tweet.fields=created_at`,
      headers: {
        Authorization: `Bearer ${TWITTER_BEARER_TOKEN}`
      }
    };
    return axios.request(options).then(response => {
      return response.data;
    }).catch(error => {
      console.log(error);
      return error;
    });
  }

}