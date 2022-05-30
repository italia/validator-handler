import dotenv from "dotenv";
dotenv.config();

import express from "express";
import bodyParser from "body-parser";
const port = process.env.PORT || 3000;
import router from "./routes/routes";
import { db } from "./database/connection";

const app = express();

app.use(bodyParser.json());
app.use("/", router);

db.authenticate()
  .then(async () => {
    //@ts-ignore
    app.listen(port, async function (req, res) {
      console.log(`[WEBSERVER]: Server is listening on port ${port}!`);
      console.log(`[WEBSERVER]: Database ${db.getDatabaseName()} connected!`);
    });
  })
  .catch((err) => {
    console.error("[WEBSERVER]: Unable to connect to the database:", err);
  });
