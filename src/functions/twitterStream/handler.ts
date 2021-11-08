// import "source-map-support/register";

import * as express from 'express';
import * as http from "http";
import * as serverless from "serverless-http";
import { APIGatewayProxyHandler } from "aws-lambda";

const app = express();
const port = process.env.PORT || 3000;

const server: http.Server = http.createServer(app);

app.get("/hello", (_req: express.Request<any>, res: express.Response<any>) => {
  return res.status(200).json({
    message: "Hello from path!",
  });
});

server.listen(port, () => console.log(`Listening on port ${port}`));

export const main: APIGatewayProxyHandler = serverless(app) as APIGatewayProxyHandler;
// module.exports.main = serverless(app);
