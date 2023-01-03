import { EventEmitter } from "events";
import axios, { AxiosRequestConfig } from "axios";

export class YoutubeService extends EventEmitter {
  emitNewVideo(data) {
    this.emit("new-video", data);
  }

  async getVideos(userId = "882945467881074688"): Promise<any> {
    const options: AxiosRequestConfig<any> = {
      url: `https://api.youtube.com/2/users/${userId}/videos?video.fields=created_at`,
      headers: {
        Authorization: `Bearer ${process.env.YOUTUBE_DATA_API_KEY}`,
      },
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
