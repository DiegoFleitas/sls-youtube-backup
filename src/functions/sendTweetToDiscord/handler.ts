// import "source-map-support/register";

// // import { middyfy } from "@libs/lambda";
// import { TwitterService } from "@libs/twitterService";
// import { DiscordService } from "@libs/discordService";

// async function sendTweetToDiscord(): Promise<any> {
//   try {
//     const DS = new DiscordService();

//     TwitterService.on("new-tweet", async (message) => {
//       console.log("an event occurred!");
//       await DS.postMessage(message);
//     });
//   } catch (ex) {
//     console.error(ex);
//   }
// };

// // export const handler = middyfy(sendTweetToDiscord);
