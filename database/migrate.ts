"use strict";

import { dbRoot } from "./connection";
import { syncTable as entitySyncTable } from "./models/entity.js";
import { syncTable as jobSyncTable } from "./models/job.js";
import { syncTable as userSyncTable } from "./models/user.js";
import { syncTable as tokenSyncTable } from "./models/token.js";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const syncCommand = yargs(hideBin(process.argv))
  .usage("Usage: --tablename <tablename>")
  .option("tablename", {
    describe: "Table to be synched - use 'all' to sync all the database",
    type: "string",
    demandOption: true,
    choices: ["all", "entity", "job", "user", "token"],
  }).argv;

dbRoot
  .authenticate()
  .then(async () => {
    console.log(`[DB-SYNC]: Database ${dbRoot.getDatabaseName()} connected!`);
    console.log("[DB-SYNC]: Database sync start");

    switch (syncCommand.tablename) {
      case "entity":
        await entitySyncTable(dbRoot);
        console.log("[DB-SYNC]: Entity table synched");
        break;
      case "job":
        await jobSyncTable(dbRoot);
        console.log("[DB-SYNC]: Job table synched");
        break;
      case "user":
        await userSyncTable(dbRoot);
        console.log("[DB-SYNC]: User table synched");
        break;
      case "token":
        await tokenSyncTable(dbRoot);
        console.log("[DB-SYNC]: Token table synched");
        break;
      case "all":
        await entitySyncTable(dbRoot);
        console.log("[DB-SYNC]: Entity table synched");

        await jobSyncTable(dbRoot);
        console.log("[DB-SYNC]: Job table synched");

        await userSyncTable(dbRoot);
        console.log("[DB-SYNC]: User table synched");

        await tokenSyncTable(dbRoot);
        console.log("[DB-SYNC]: Token table synched");
        break;
      default:
        console.log("[DB-SYNC]: No table synched");
    }

    console.log("[DB-SYNC]: Database sync finish");
  })
  .catch((err) => {
    console.error("[DB-SYNC]: Unable to connect to the database:", err);
  });
