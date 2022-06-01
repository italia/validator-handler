"use strict";

import { dbRoot } from "./connection";
import { syncTable as entitySyncTable } from "./models/entity";
import { syncTable as jobSyncTable } from "./models/job";
import { syncTable as userSyncTable } from "./models/user";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const syncCommand = yargs(hideBin(process.argv))
  .usage("Usage: --tablename <tablename>")
  .option("tablename", {
    describe: "Table to be synched - use 'all' to sync all the database",
    type: "string",
    demandOption: true,
    choices: ["all", "entity", "job", "user"],
  }).argv;

dbRoot.authenticate()
  .then(async () => {
    console.log(`[DB-SYNC]: Database ${dbRoot.getDatabaseName()} connected!`);
    console.log("[DB-SYNC]: Database sync start");

    switch (syncCommand.tablename) {
      case "entity":
        await entitySyncTable(dbRoot);
        break;
      case "job":
        await jobSyncTable(dbRoot);
        break;
      case "user":
        await userSyncTable(dbRoot);
        break;
      case "all":
        await entitySyncTable(dbRoot);
        await jobSyncTable(dbRoot);
        await userSyncTable(dbRoot);
        break;
      default:
        console.log("[DB-SYNC]: No table synched");
    }

    console.log("[DB-SYNC]: Database sync finish");
  })
  .catch((err) => {
    console.error("[DB-SYNC]: Unable to connect to the database:", err);
  });
