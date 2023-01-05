import axios, { AxiosRequestConfig } from "axios";
import { parseTitleWBM } from "./utils";

const WBMACHINE_BASEURL = "https://web.archive.org/web/20180405195407oe_/";
const WBMACHINE_URL = `${WBMACHINE_BASEURL}http://wayback-fakeurl.archive.org/yt/`;

export class WaybackMachineService {
  async postMessage(message: string): Promise<any> {
    message += " @here";
    const options: AxiosRequestConfig<any> = {
      method: "post",
      url: `https://waybackMachineapp.com/api/v6/channels/${process.env.WAYBACKMACHINE_CHANNEL_ID}/messages`,
      headers: {
        Authorization: process.env.WAYBACKMACHINE_AUTHORIZATION_HEADER,
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

  /**
   * Filters deleted videos on playlist and download them from Wayback machine if possible.
   * ex: https://web.archive.org/web/20130720113437oe_/http://wayback-fakeurl.archive.org/yt/7VcYz6KZtqs
   * It also parses the title of such pages to get the video title.
   * ex: https://web.archive.org/web/20130720113437oe_/http://youtube.com/watch?v=7VcYz6KZtqs
   */
  // TODO: adapt this script
  async searchDeletedVideosOnWBM() {
    // FIXME: this doesn't work
    const deletedVideosList = [];
    deletedVideosList.forEach((vid, key) => {
      const promise = new Promise((resolve, reject) => {
        // recover video title
        const titleUrl = `${WBMACHINE_BASEURL}${vid.link}`;
        console.log(titleUrl);
        // FIXME: not following redirects
        axios
          .request(
            // { url: titleUrl, followAllRedirects: true },
            { url: titleUrl }
          )
          .then((response) => {
            console.log("statusCode:", response && response.status);

            if (response.status !== 200) {
              console.error("error:", response);
            }

            const title = parseTitleWBM(response.data);
            const filename = title;
            const message = title
              ? `Title of [Deleted video] #${key} is: ${filename}`
              : `none of the regex matched for #${key}`;
            console.log(message);
            resolve(filename);
          });
      }).then((filename) => {
        // download video and name it with the recovered title
        const downloadUrl = `${WBMACHINE_BASEURL}${vid.id}`;
        console.log(downloadUrl);
        axios
          .request(
            // { url: downloadUrl, followAllRedirects: true },
            // FIXME: not following redirects
            { url: downloadUrl }
          )
          .then((response) => {
            if (response.status !== 200) {
              const message = `[Deleted video] was not found #${key}`;
              console.log("error:", message);
            }

            // TODO: implement found use case
          });
      });
    });
  }
}
