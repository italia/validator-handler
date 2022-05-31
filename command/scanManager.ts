"use strict";


import { db } from "../database/connection";
import { define as jobDefine } from "../database/models/job";
import { run } from "pa-website-validator/dist/controller/launchLighthouse";
import { logLevels } from "pa-website-validator/dist/controller/launchLighthouse";
import { Job } from "../types/models";
import { Model } from "sequelize";
import {
  upload as s3Upload,
  empty as s3Delete,
} from "../controller/s3Controller";
import { Queue } from 'bullmq';

db.authenticate()
  .then(async () => {
    console.log(`[DB-SYNC]: Database ${db.getDatabaseName()} connected!`);

    const crawlerQueue = new Queue('crawler-queue', { connection: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
      }});

    do {
      //TODO: pescare dalla coda gli ID (in loop)
      let jobId = 0

      const jobObj: Model<Job, Job> = await jobDefine().findByPk(jobId);
      if (jobObj !== null && jobObj.toJSON().status === 'PENDING') {
          scan(jobObj)
      }

      let contr = true
    } while(contr)

  })
  .catch((err) => {
    console.error("[DB-SYNC]: Unable to connect to the database:", err);
  });

const scan = async (jobObj) => {
  await jobObj.update({
    status: "IN_PROGRESS",
    start_at: Date.now(),
  });

  const jobObjParsed = jobObj.toJSON();

  const type = jobObjParsed.type;
  const scanUrl = jobObjParsed.scan_url;
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
      jobObjParsed.id, //TODO: correggere firma metodo
      jobObjParsed.entity_id, //TODO: correggere firma metodo
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
  const parsedResult = JSON.parse(jsonResult)
  const categoryResults = parsedResult.categories
  const auditResults = parsedResult.audits

  let categoryResultsMappedValues = []
  let key: any
  let value: any

  for ([key, value] of Object.entries(categoryResults)) {
      categoryResultsMappedValues.push({
        id: value?.id ?? '',
        title: value?.title ?? '',
        description: value?.description ?? '',
        score: value?.score ?? ''
      })
  }

  //TODO: completare integrazione
  let auditResultsMappedValues = []
  for ([key, value] of Object.entries(auditResults)) {
      let mappedObject = {
        headings: [],
        items: []
      }

      const headings = value?.details?.headings
      if (Boolean(headings)) {
        for([key, value] of Object.entries(headings)) {
          mappedObject.headings.push({
            text: value.text ?? ''
          })
        }
      }

      const items = value?.details?.items
      if (Boolean(items)) {
        for([key, value] of Object.entries(items)) {
          mappedObject.items.push({
            [key]: value ?? ''
          })
        }
      }

      auditResultsMappedValues.push({
        id: value?.id ?? '',
        title: value?.title ?? '',
        description: value?.description ?? '',
        score: value?.score ?? '',
        details: mappedObject
      })
  }

  console.log(auditResultsMappedValues)

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