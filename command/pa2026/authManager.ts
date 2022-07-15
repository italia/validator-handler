"use strict";

import { dbRoot } from "../../database/connection";
import { authController } from "../../controller/pa2026/authController";
import { Token } from "../../types/models";

dbRoot
  .authenticate()
  .then(async () => {
    console.log("[TOKEN MANAGER]: START");

    try {
      const result: Token = await new authController(dbRoot).updateToken();
      console.log("[TOKEN MANAGER]: TOKEN ID - ", result.id);
    } catch (e) {
      console.log("[TOKEN MANAGER]: EXCEPTION - ", e);
    }

    console.log("[TOKEN MANAGER]: FINISH");
  })
  .catch((err) => {
    console.error("Error: ", err);
    process.exit(1);
  });
