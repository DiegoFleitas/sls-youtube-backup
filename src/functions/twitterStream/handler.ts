import "source-map-support/register";

import { TWITTER_BEARER_TOKEN } from "../../../secrets";
import { TwitterService } from "@libs/twitterService";
import * as express from "express";
import * as bodyParser from "body-parser";
import * as util from "util";
import * as request from "request";
import * as socketIo from "socket.io";
import * as http from "http";
import * as serverless from "serverless-http";

const app = express();
const port = process.env.PORT || 3000;
const post = util.promisify(request.post);
const get = util.promisify(request.get);

/**
 * Configure Express.js Middleware
 */

// Enable CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("x-powered-by", "serverless-express");
  next();
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const server = http.createServer(app);
const io = socketIo(server);

let timeout = 0;

const streamURL =
  "https://api.twitter.com/2/tweets/search/stream?tweet.fields=context_annotations&expansions=author_id";
const rulesURL = `https://api.twitter.com/2/tweets/search/stream/rules`;

const errorMessage = {
  title: "Please Wait",
  detail: "Waiting for new Tweets to be posted...",
};

const authMessage = {
  title: "Could not authenticate",
  details: [
    `Please make sure your bearer token is correct. 
      If using Glitch, remix this app and add it to the .env file`,
  ],
  type: "https://developer.twitter.com/en/docs/authentication",
};

const sleep = async (delay) => {
  return new Promise((resolve) => setTimeout(() => resolve(true), delay));
};

app.get("/", (req, res, next) => {
  return res.status(200).json({
    message: "Hello from root!",
  });
});

app.get("/hello", (req, res, next) => {
  return res.status(200).json({
    message: "Hello from path!",
  });
});

// get current rules for stream
app.get("/api/rules", async (req, res) => {
  // res.status(400).send(authMessage);

  if (!TWITTER_BEARER_TOKEN) {
    res.status(400).send(authMessage);
  }

  const requestConfig = {
    url: rulesURL,
    auth: {
      bearer: TWITTER_BEARER_TOKEN,
    },
    json: true,
  };

  try {
    const response = await get(requestConfig);

    if (response.statusCode !== 200) {
      if (response.statusCode === 403) {
        res.status(403).send(response.body);
      } else {
        throw new Error(response.body.error.message);
      }
    }

    res.send(response);
  } catch (e) {
    res.send(e);
  }
});

// create rules for stream
app.post("/api/rules", async (req, res) => {
  if (!TWITTER_BEARER_TOKEN) {
    res.status(400).send(authMessage);
  }

  const twitterHandle = "GearSekando1000"; // OnePieceFans community admin

  const requestConfig = {
    url: rulesURL,
    auth: {
      bearer: TWITTER_BEARER_TOKEN,
    },
    // json: req.body,
    body: `{
      "add": [
        {"value": "from:${twitterHandle}"}
      ]
    }`,
  };

  try {
    const response = await post(requestConfig);

    if (response.statusCode === 200 || response.statusCode === 201) {
      res.send(response);
    } else {
      throw new Error(response);
    }
  } catch (e) {
    res.send(e);
  }
});

// create stream
const streamTweets = (socket) => {
  let stream;

  const config = {
    url: streamURL,
    auth: {
      bearer: TWITTER_BEARER_TOKEN,
    },
    timeout: 31000,
  };

  try {
    const stream = request.get(config);

    stream
      .on("data", (data) => {
        try {
          const json = JSON.parse(data);
          if (json.connection_issue) {
            socket.emit("error", json);
            reconnect(stream, socket);
          } else {
            if (json.data) {
              socket.emit("tweet", json);
            } else {
              socket.emit("authError", json);
            }
          }
        } catch (e) {
          socket.emit("heartbeat");
        }
      })
      .on("error", (error) => {
        // Connection timed out
        socket.emit("error", errorMessage);
        reconnect(stream, socket);
      });
  } catch (e) {
    socket.emit("authError", authMessage);
  }
};

const reconnect = async (stream, socket) => {
  timeout++;
  stream.abort();
  await sleep(2 ** timeout * 1000);
  streamTweets(socket);
};

io.on("connection", async (socket) => {
  try {
    io.emit("connect", "Client connected");
    const stream = streamTweets(io);
  } catch (e) {
    io.emit("authError", authMessage);
  }
});

// listen to event
io.on("tweet", (arg) => {
  console.log("new tweet", arg);
  TwitterService.emitNewTweet(arg);
});

app.use((req, res, next) => {
  return res.status(404).send("Not Found");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

server.listen(port, () => console.log(`Listening on port ${port}`));

// export const main = serverless(app);
module.exports.main = serverless(app);
