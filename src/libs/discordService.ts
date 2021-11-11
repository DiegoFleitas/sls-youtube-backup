import { DISCORD_AUTHORIZATION_HEADER } from "../../secrets";
import axios, { AxiosRequestConfig } from "axios";

export class DiscordService {
  async postMessage(
    message: string,
    channelId = "906427104286109746"
  ): Promise<any> {
    message += " @here";
    const options: AxiosRequestConfig<any> = {
      method: "post",
      url: `https://discordapp.com/api/v6/channels/${channelId}/messages`,
      headers: {
        Authorization: DISCORD_AUTHORIZATION_HEADER,
        "Content-Type": "application/json",
      },
      data: JSON.stringify({
        content: message,
        allowed_mentions: { parse: ["users"] },
      }),
    };
    return axios.request(options).then(response => {
      return response.data;
    }).catch(error => {
      console.log(error);
      return error;
    });
  }
}
