"use strict";

import { dbRoot } from "../../database/connection";
import { integrationController } from "../../controller/PA2026/integrationController";

//TODO: Questo comando prima fa create, poi update poi terza query

dbRoot
  .authenticate()
  .then(async () => {
    try {
      console.log("[TOKEN MANAGER]: START");

      const createResult = await new integrationController(dbRoot).create()
      const updateResult = await new integrationController(dbRoot).update()

      console.log(
        "[TOKEN MANAGER]: Amount of entity creaded: " + createResult.length
      );
      console.log(
        "[TOKEN MANAGER]: Amount of entity creaded: " + updateResult.length
      );
    } catch (e) {
      console.log("[TOKEN MANAGER]: EXCEPTION - ", e);
    }
  })
  .catch((err) => {
    console.error("Error: ", err);
    process.exit(1);
  });
