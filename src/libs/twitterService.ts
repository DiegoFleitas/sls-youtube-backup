import { EventEmitter } from "events";

export class TwitterService extends EventEmitter {
  emitNewTweet(data) {
    this.emit("new-tweet", data);
  }
}