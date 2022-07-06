"use strict";

import { dbSM } from "./database/connection";

dbSM
  .authenticate()
  .then(async () => {
    console.log("test");
  })
  .catch((err) => {
    console.error("Error: ", err);
    process.exit(1);
  });
