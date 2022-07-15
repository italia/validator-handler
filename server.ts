import dotenv from "dotenv";
dotenv.config();

import express from "express";
import bodyParser from "body-parser";
import cron from "node-cron";
const port = process.env.PORT || 3000;
import router from "./routes/routes";
import { dbWS } from "./database/connection";
import { run as runUpdateToken } from "./cron/pa2026TokenCron";

import basicAuth from "express-basic-auth";
const basicAuthMiddleware = basicAuth({
  challenge: true,
  users: { [process.env.BASIC_AUTH_USERNAME]: process.env.BASIC_AUTH_PASSWORD },
});

import { options } from "./swagger/config";
import swaggerJSDoc from "swagger-jsdoc";
const swaggerSpec = swaggerJSDoc(options);
import swaggerUi from "swagger-ui-express";

const app = express();

app.use(bodyParser.json());
app.use(
  "/docs",
  basicAuthMiddleware,
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec)
);
app.use("/", router);

dbWS
  .authenticate()
  .then(async () => {
    app.listen(port, async function () {
      console.log(`[WEBSERVER]: Server is listening on port ${port}!`);
      console.log(`[WEBSERVER]: Database ${dbWS.getDatabaseName()} connected!`);

      //* At minute 0 of every hour */
      await cron.schedule("0 * * * *", async () => {
        await runUpdateToken();
      });
    });
  })
  .catch((err) => {
    console.error("[WEBSERVER]: Unable to connect to the database:", err);
  });
