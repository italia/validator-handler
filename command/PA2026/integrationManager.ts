"use strict";

import { dbRoot } from "../../database/connection";
import { integrationController } from "../../controller/PA2026/integrationController";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const command = yargs(hideBin(process.argv))
  .usage("Usage: --type <type>")
  .option("type", {
    describe: "Tipo di integrazione da eseguire",
    type: "string",
    demandOption: true,
    choices: ["create", "update"],
  }).argv;

dbRoot
  .authenticate()
  .then(async () => {
    const operation: string = command.type;
    console.log("[TOKEN MANAGER]: OPERATION - ", operation);

    try {
      const result = await new integrationController(dbRoot).createOrUpdate(
        operation
      );
      console.log(
        "[TOKEN MANAGER]: Amount of entity " + operation + ": " + result.length
      );
    } catch (e) {
      console.log("[TOKEN MANAGER]: EXCEPTION - ", e);
    }
  })
  .catch((err) => {
    console.error("Error: ", err);
    process.exit(1);
  });
