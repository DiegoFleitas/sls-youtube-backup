import { DISCORD_AUTHORIZATION_HEADER } from "../../secrets";
import * as request from "request";

export class DiscordService {
  async postMessage(
    message: string,
    channelId = "906427104286109746"
  ): Promise<any> {
    message += " @here";
    const options = {
      method: "POST",
      url: `https://discordapp.com/api/v6/channels/${channelId}/messages`,
      headers: {
        Authorization: DISCORD_AUTHORIZATION_HEADER,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: message,
        allowed_mentions: { parse: ["users"] },
      }),
    };
    request(options, (error, response) => {
      if (error) throw new Error(error);
      console.log(response.body);
    });
  }
}
