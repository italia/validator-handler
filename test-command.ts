"use strict";

import { dbQM, dbRoot } from "./database/connection";
import { define as jobDefine } from "./database/models/job";
import { v4 } from "uuid";
import { entityController } from "./controller/entityController";
import { integrationController } from "./controller/PA2026/integrationController";

dbRoot
  .authenticate()
  .then(async () => {
    const result = await new integrationController(dbRoot).create();
    /* const status = [
      "IN_PROGRESS",
      "PENDING",
      "ERROR",
      "PASSED",
      "FAILED",
    ]

    let date = new Date()
    date.setDate( date.getDate() -1 );

    for (let i = 0; i < 100; i++) {
      const entity = await new entityController(dbRoot).create({
        external_id: v4(),
        url: "http://drupal-comuni.local",
        enable: true,
        type: "municipality",
        subtype: "municipality-informed-citizen",
      })
    }

    for (let i = 1; i < 1000; i++) {
      let newDate = new Date(date.getTime() + (1000 * 10 * i))
      let newDate2 = new Date(date.getTime() + (1000 * 30 * i))

      const createObj = {
        entity_id: Math.floor(Math.random() * (100) + 1),
        start_at: newDate.getTime(),
        end_at: newDate2.getTime(),
        scan_url: "http://drupal-comuni.local",
        type: "municipality",
        status: status[Math.floor(Math.random() * status.length)],
        s3_html_url: null,
        s3_json_url: null,
        json_result: null,
        preserve: false,
        preserve_reason: null,
      };

      const jobObj = await jobDefine(dbQM, false).create(createObj);
    } */
  })
  .catch((err) => {
    console.error("Error: ", err);
    process.exit(1);
  });
