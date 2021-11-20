import { DISCORD_AUTHORIZATION_HEADER, DISCORD_CHANNEL_ID } from "../../secrets";
import axios, { AxiosRequestConfig } from "axios";

export class DiscordService {
  async postMessage(
    message: string
  ): Promise<any> {
    message += " @here";
    const options: AxiosRequestConfig<any> = {
      method: "post",
      url: `https://discordapp.com/api/v6/channels/${DISCORD_CHANNEL_ID}/messages`,
      headers: {
        Authorization: DISCORD_AUTHORIZATION_HEADER,
        "Content-Type": "application/json",
      },
      data: JSON.stringify({
        content: message,
        allowed_mentions: { parse: ["users"] },
      }),
    };
    return axios
      .request(options)
      .then((response) => {
        return response.data;
      })
      .catch((error) => {
        console.log(error);
        return error;
      });
  }
}
