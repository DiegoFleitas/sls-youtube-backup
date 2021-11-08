import * as EventEmitter from "events";

class TwitterService extends EventEmitter {
  emitNewTweet(data) {
    this.emit("new-tweet", data);
  }
}

export default TwitterService;