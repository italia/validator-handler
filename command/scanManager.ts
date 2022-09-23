"use strict";

import dotenv from "dotenv";
dotenv.config();

import Redis from "ioredis";
import { dbSM } from "../database/connection";
import { define as jobDefine } from "../database/models/job";
import { run } from "pa-website-validator/dist/controller/launchLighthouse";
import { logLevels } from "pa-website-validator/dist/controller/launchLighthouse";
import { Job } from "../types/models";
import {
  upload as s3Upload,
  empty as s3Delete,
} from "../controller/s3Controller";
import { Worker, Job as bullJob } from "bullmq";
import { v4 } from "uuid";
import {
  cleanMunicipalityJSONReport,
  cleanSchoolJSONReport,
  isPassedReport,
} from "../controller/auditController";
import { jobController } from "../controller/jobController";
import { pushResult } from "../controller/PA2026/integrationController";

dbSM
  .authenticate()
  .then(async () => {
    console.log("[SCAN MANAGER]: start");

    const worker: Worker = new Worker("crawler-queue", null, {
      lockDuration: 10000000,
      connection: new Redis.Cluster([
        {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT),
        },
      ]),
      prefix: "{1}",
    });
    const token = v4();
    let job: bullJob;

    while ((job = await worker.getNextJob(token)) !== undefined) {
      console.log("JOB START FOR jobID: ", job.data.id);
      const result = await scan(job.data.id);

      if (result) {
        await job.moveToCompleted("completed", token, false);
      } else {
        await job.moveToFailed(new Error("error"), token);
      }
    }

    await worker.close();

    console.log("[SCAN MANAGER]: finish");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error: ", err);
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
    const lighthouseResult = await run(
      jobObjParsed.scan_url,
      jobObjParsed.type,
      "online",
      logLevels.display_none,
      false
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

    await pushResult(job, jsonResult, status);

    const jobDeleted = await new jobController(dbSM).cleanJobs(
      jobObjParsed.entity_id
    );
    console.log("JOB DELETED: ", jobDeleted);

    return true;
  } catch (e) {
    console.log("SCAN EXCEPTION: ", e.toString());

    await jobObj.update({
      status: "ERROR",
      end_at: Date.now(),
    });

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

    //TODO: Integrazione completata - In attesa di bucket S3 per testing
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
