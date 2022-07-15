"use strict";

import { dbRoot } from "./database/connection";

dbRoot
  .authenticate()
  .then(async () => {
    console.log("Temporary test command");
  })
  .catch((err) => {
    console.error("Error: ", err);
    process.exit(1);
  });
