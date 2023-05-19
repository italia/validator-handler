"use strict";

import dotenv from "dotenv";
dotenv.config();

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { dbSM } from "../database/connection";
import { define as jobDefine } from "../database/models/job";
import { run } from "pa-website-validator/dist/controller/launchLighthouse";
import { logLevels } from "pa-website-validator/dist/controller/launchLighthouse";
import { Job } from "../types/models";
import {
  upload as s3Upload,
  empty as s3Delete,
} from "../controller/s3Controller";
import {
  cleanMunicipalityJSONReport,
  cleanSchoolJSONReport,
  isPassedReport,
} from "../controller/auditController";
import { jobController } from "../controller/jobController";
import {
  pushResult,
  pushResultUrlNotExists,
} from "../controller/PA2026/integrationController";
import { urlExists } from "../utils/utils";
import psList from "ps-list";
import treeKill from "tree-kill";

const command = yargs(hideBin(process.argv))
  .usage("Usage: " + "--jobId <jobId> ")
  .option("jobId", {
    describe: "Id del job",
    type: "integer",
    demandOption: true,
  }).argv;

dbSM
  .authenticate()
  .then(async () => {
    const idJob = parseInt(command.jobId);
    console.log("[SCAN MANAGER ITEM]: start for jobID: " + idJob);

    const result = await scan(idJob);

    if (result) {
      process.exit(0);
    }

    process.exit(1);
  })
  .catch((err) => {
    console.error("[SCAN MANAGER ITEM] - Error: ", err);
    process.exit(1);
  });

const scan = async (jobId) => {
  const jobObj: Job | null = await jobDefine(dbSM).findByPk(jobId);

  try {
    if (jobObj === null || jobObj.toJSON().status !== "PENDING") {
      return false;
    }

    await jobObj.update({
      status: "IN_PROGRESS",
      start_at: Date.now(),
    });

    const jobObjParsed = jobObj.toJSON();
    const urlToBeScanned = jobObjParsed.scan_url;

    const urlToBeScannedExists = await urlExists(urlToBeScanned);
    if (!urlToBeScannedExists) {
      await pushResultUrlNotExists(jobObj, urlToBeScanned);
      throw new Error("Scan URL does not exists");
    }

    const lighthouseResult = await run(
      urlToBeScanned,
      jobObjParsed.type,
      "online",
      logLevels.display_none,
      false,
      "",
      "",
      false,
      "all"
    );

    if (!lighthouseResult.status) {
      throw new Error("Empty lighthouse result");
    }

    let jsonResult = {};
    if (jobObjParsed.type === "municipality") {
      jsonResult = await cleanMunicipalityJSONReport(
        lighthouseResult.data.jsonReport
      );
    } else if (jobObjParsed.type === "school") {
      jsonResult = await cleanSchoolJSONReport(
        lighthouseResult.data.jsonReport
      );
    }

    const uploadResult = await uploadFiles(
      jobObjParsed.id,
      jobObjParsed.entity_id,
      lighthouseResult.data.htmlReport,
      lighthouseResult.data.jsonReport,
      JSON.stringify(jsonResult)
    );

    if (!uploadResult.status) {
      throw new Error("Upload error");
    }

    const status = await isPassedReport(
      jsonResult,
      jobObjParsed.type,
      jobObjParsed.entity_id
    );

    const job: Job = await jobObj.update({
      status: status ? "PASSED" : "FAILED",
      end_at: Date.now(),
      json_result: jsonResult,
      s3_json_url: uploadResult.jsonLocationUrl,
      s3_html_url: uploadResult.htmlLocationUrl,
      s3_clean_json_result_url: uploadResult.cleanJsonLocationUrl,
    });

    if (!job) {
      throw new Error("Update job failed");
    }

    await pushResult(job, jsonResult, status, lighthouseResult.data.htmlReport);

    const jobDeleted = await new jobController(dbSM).cleanJobs(
      jobObjParsed.entity_id
    );
    console.log("[SCAN MANAGER ITEM] - JOB DELETED: ", jobDeleted);

    const pidKilled = await killProcessByName("Chromium");
    console.log("[SCAN MANAGER ITEM] - PID KILLED: ", pidKilled);

    return true;
  } catch (e) {
    console.log("[SCAN MANAGER ITEM] - SCAN EXCEPTION: ", e.toString());

    await jobObj.update({
      status: "ERROR",
      end_at: Date.now(),
    });

    const pidKilled = await killProcessByName("Chromium");
    console.log("[SCAN MANAGER ITEM] - PID KILLED: ", pidKilled);

    return false;
  }
};

const uploadFiles = async (
  jobId: number,
  entityId: number,
  htmlReport: string,
  jsonReport: string,
  cleanJsonReport: string
): Promise<{
  status: boolean;
  htmlLocationUrl: string | null;
  jsonLocationUrl: string | null;
  cleanJsonLocationUrl: string | null;
}> => {
  try {
    if (parseInt(process.env.BYPASS_S3_UPLOAD) === 1) {
      return {
        status: true,
        htmlLocationUrl: "/" + entityId + "/" + jobId + "/" + "report.html",
        jsonLocationUrl: "/" + entityId + "/" + jobId + "/" + "report.json",
        cleanJsonLocationUrl:
          "/" + entityId + "/" + jobId + "/" + "summary.json",
      };
    }

    const htmlLocationUrl = await s3Upload(
      htmlReport,
      entityId + "/" + jobId + "/" + "report.html"
    );
    const jsonLocationUrl = await s3Upload(
      jsonReport,
      entityId + "/" + jobId + "/" + "report.json"
    );
    const cleanJsonLocationUrl = await s3Upload(
      cleanJsonReport,
      entityId + "/" + jobId + "/" + "summary.json"
    );

    if (
      htmlLocationUrl === null ||
      jsonLocationUrl === null ||
      cleanJsonLocationUrl === null
    ) {
      throw new Error("Empty result from S3");
    }

    return {
      status: true,
      htmlLocationUrl: htmlLocationUrl,
      jsonLocationUrl: jsonLocationUrl,
      cleanJsonLocationUrl: cleanJsonLocationUrl,
    };
  } catch (ex) {
    if (Boolean(entityId) && Boolean(jobId)) {
      await s3Delete(entityId + "/" + jobId);
    }

    return {
      status: false,
      htmlLocationUrl: null,
      jsonLocationUrl: null,
      cleanJsonLocationUrl: null,
    };
  }
};

const killProcessByName = async (name: string) => {
  const pidKilled = [];

  try {
    const list = await psList();

    for (const element of list) {
      try {
        if (element.name === name) {
          await treeKill(element.pid);
          pidKilled.push(element.pid);
        }
      } catch (e) {
        console.log(
          "[SCAN MANAGER ITEM] - KILL PROCESS ELEMENT IN ERROR: ",
          element
        );
        console.log(
          "[SCAN MANAGER ITEM] - KILL PROCESS FOR-STATEMENT EXCEPTION: ",
          e
        );
      }
    }

    return pidKilled;
  } catch (e) {
    console.log("[SCAN MANAGER ITEM] - KILL PROCESS EXCEPTION: ", e);

    return pidKilled;
  }
};
