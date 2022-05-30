"use strict";

import yargs from "yargs";
import { db } from "../database/connection";
import { hideBin } from "yargs/helpers";
import { define as jobDefine } from "../database/models/job";
import { run } from "pa-website-validator/dist/controller/launchLighthouse";
import { logLevels } from "pa-website-validator/dist/controller/launchLighthouse";
import { Job } from "../types/models";
import { Model } from "sequelize";
import {
  upload as s3Upload,
  empty as s3Delete,
} from "../controller/s3Controller";

const command = yargs(hideBin(process.argv))
  .usage("Usage: --spawnCode <spawnCode>")
  .option("spawnCode", {
    describe: "Spawn code dell'istanza di cui caricare i Job",
    type: "string",
    demandOption: true,
  }).argv;

db.authenticate()
  .then(async () => {
    console.log(`[DB-SYNC]: Database ${db.getDatabaseName()} connected!`);

    const jobObjs: Model<Job, Job>[] = await jobDefine().findAll({
      where: {
        spawn_code: command.spawnCode,
        status: "PENDING",
      },
    });

    for (const element of jobObjs) {
      await element.update({
        status: "IN_PROGRESS",
        start_at: Date.now(),
      });

      const jobObj: Job = element.get();

      const type = jobObj.type;
      const scanUrl = jobObj.scan_url;
      const lighthouseResult = await run(
        scanUrl,
        type,
        "online",
        logLevels.display_info,
        false
      );

      let cleanJson;
      let uploadResult = {
        status: false,
        htmlLocationUrl: null,
        jsonLocationUrl: null,
      };
      if (lighthouseResult.status) {
        cleanJson = await cleanJSONReport(lighthouseResult.data.jsonReport);
        process.exit();
        uploadResult = await uploadFiles(
          jobObj,
          lighthouseResult.data.htmlReport,
          cleanJson
        );
      }

      if (uploadResult.status) {
        await successReport(
          jobObj,
          cleanJson,
          uploadResult.jsonLocationUrl,
          uploadResult.htmlLocationUrl
        );
      } else {
        await errorReport(jobObj);
      }
    }
  })
  .catch((err) => {
    console.error("[DB-SYNC]: Unable to connect to the database:", err);
  });

const successReport = async (
  jobObj,
  cleanJsonResult: string,
  jsonUrl: string,
  htmlUrl: string
) => {
  await jobObj.update({
    status: "PASSED",
    end_at: Date.now(),
    json_result: cleanJsonResult,
    s3_json_url: jsonUrl,
    s3_html_url: htmlUrl,
  });
};

const errorReport = async (jobObj: Job) => {
  await jobObj.update({
    status: "ERROR",
    end_at: Date.now(),
  });
};

const cleanJSONReport = async (jsonResult: string): Promise<string> => {
  console.log("JSON RESULT", jsonResult);
  console.log("TYPEOF", typeof jsonResult);

  return "";
};

const uploadFiles = async (
  jobObj: Job,
  htmlReport: string,
  jsonReport: string
): Promise<{
  status: boolean;
  htmlLocationUrl: string | null;
  jsonLocationUrl: string | null;
}> => {
  try {
    const htmlLocationUrl = await s3Upload(
      htmlReport,
      jobObj.entity_id + "/" + jobObj.id + "/" + "report.html"
    );
    const jsonLocationUrl = await s3Upload(
      jsonReport,
      jobObj.entity_id + "/" + jobObj.id + "/" + "report.json"
    );

    if (htmlLocationUrl === null || jsonLocationUrl === null) {
      if (Boolean(jobObj.entity_id) && Boolean(jobObj.id)) {
        await s3Delete(jobObj.entity_id + "/" + jobObj.id);
      }

      return {
        status: false,
        htmlLocationUrl: null,
        jsonLocationUrl: null,
      };
    }

    return {
      status: true,
      htmlLocationUrl: htmlLocationUrl,
      jsonLocationUrl: jsonLocationUrl,
    };
  } catch (ex) {
    if (Boolean(jobObj.entity_id) && Boolean(jobObj.id)) {
      await s3Delete(jobObj.entity_id + "/" + jobObj.id);
    }

    return {
      status: false,
      htmlLocationUrl: null,
      jsonLocationUrl: null,
    };
  }
};
