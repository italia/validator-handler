"use strict";

import dotenv from "dotenv";
dotenv.config();

import { call } from "../../utils/https-request";
import { response } from "../../types/https-request";
import qs from "qs";
import { tokenController } from "./tokenController";
import { dbSM, dbWS } from "../../database/connection";
import { Job, Token } from "../../types/models";
import { entityController } from "../entityController";
import {
  define as jobDefine,
  preserveReasons,
} from "../../database/models/job";
import {
  calculatePassedAuditPercentage,
  mapPA2026Body,
  mapPA2026BodyUrlNotExists,
} from "../../utils/utils";

const retrieveToken = async () => {
  try {
    const result: response = await call(
      "post",
      process.env.PA2026_HOST,
      process.env.PA2026_AUTH_PATH,
      {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      qs.stringify({
        grant_type: process.env.PA2026_AUTH_GRANT_TYPE,
        client_id: process.env.PA2026_AUTH_CLIENT_ID,
        client_secret: process.env.PA2026_AUTH_CLIENT_SECRET,
        username: process.env.PA2026_AUTH_USERNAME,
        password: process.env.PA2026_AUTH_PASSWORD,
      })
    );

    if (result?.statusCode === 200) {
      return {
        value: result.data.access_token ?? "",
        instanceUrl: result.data.instance_url ?? "",
      };
    }

    return null;
  } catch (e) {
    console.log("RETRIEVE EXCEPTION", e.toString());
    return null;
  }
};

const callQuery = async (query: string, retry = 3) => {
  if (retry <= 0) {
    return null;
  }

  try {
    const tokenObj: Token = await new tokenController(dbWS).retrieve();

    const path = process.env.PA2026_QUERY_PATH + "/?q=" + query;
    const result = await call("get", tokenObj.instanceUrl, path, {
      Authorization: "Bearer " + tokenObj.value,
    });

    if (result?.statusCode === 200) {
      return result.data;
    } else if (result?.statusCode === 401) {
      await new tokenController(dbWS).create();
    }
  } catch (e) {
    console.log("CALL QUERY EXCEPTION: ", e.toString());
  }

  return await callQuery(query, retry - 1);
};

const callPatch = async (body: object, path: string, retry = 3) => {
  if (retry <= 0) {
    return null;
  }

  try {
    const tokenValues = await new tokenController(dbWS).retrieve();

    const result = await call(
      "patch",
      tokenValues.instanceUrl,
      path,
      {
        Authorization: "Bearer " + tokenValues.value,
        "Content-Type": "application/json",
      },
      body
    );

    if (result?.statusCode >= 200 && result?.statusCode <= 204) {
      return result?.data ?? {};
    } else if (result?.statusCode === 401) {
      await new tokenController(dbWS).create();
    }
  } catch (e) {
    console.log("CALL PATCH EXCEPTION: ", e.toString());
  }

  return await callPatch(body, path, retry - 1);
};

const callPostFileUpload = async (file: string, path: string, retry = 3) => {
  if (retry <= 0) {
    return null;
  }

  try {
    const tokenValues = await new tokenController(dbWS).retrieve();

    const result = await call(
      "post",
      tokenValues.instanceUrl,
      path,
      {
        Authorization: "Bearer " + tokenValues.value,
        "X-PrettyPrint": "1",
        "Content-Type": "text/html",
      },
      file,
      true
    );

    if (result?.statusCode >= 200 && result?.statusCode <= 204) {
      return result?.data ?? {};
    } else if (result?.statusCode === 401) {
      await new tokenController(dbWS).create();
    }
  } catch (e) {
    console.log("CALL POST FILE UPLOAD EXCEPTION: ", e.toString());
  }

  return await callPostFileUpload(file, path, retry - 1);
};

const pushResult = async (
  job: Job,
  cleanJsonReport,
  generalStatus: boolean,
  htmlReportFile: string
) => {
  try {
    const entity = await new entityController(dbSM).retrieveByPk(job.entity_id);

    const isFirstScan =
      job.preserve && job.preserve_reason === preserveReasons[0];

    const passedAuditsPercentage = await calculatePassedAuditPercentage(
      job,
      cleanJsonReport
    );

    let scanBody = await mapPA2026Body(
      job,
      cleanJsonReport,
      generalStatus,
      false,
      passedAuditsPercentage
    );

    if (isFirstScan) {
      const firsScanBody = await mapPA2026Body(
        job,
        cleanJsonReport,
        generalStatus,
        true,
        passedAuditsPercentage
      );

      scanBody = {
        ...scanBody,
        ...firsScanBody,
      };

      const countJobsFromEntityId = await jobDefine(dbSM).count({
        where: {
          entity_id: entity.id,
        },
      });

      if (countJobsFromEntityId > 1) {
        scanBody = firsScanBody;
      }
    }

    const result = await callPatch(
      scanBody,
      process.env.PA2026_UPDATE_RECORDS_PATH.replace(
        "{external_entity_id}",
        entity.external_id
      )
    );

    //Warn: API returns empty string when it success
    if (result !== "") {
      throw new Error("Send data failed");
    }

    const uploadResult = await callPostFileUpload(
      htmlReportFile,
      process.env.PA2026_UPLOAD_FILE_PATH.replace(
        "{external_entity_id}",
        entity.external_id
      ).replace("{scan_number}", isFirstScan ? "1" : "N")
    );

    if (uploadResult !== "") {
      throw new Error("Upload report failed");
    }

    await job.update({
      data_sent_status: "COMPLETED",
      data_sent_date: new Date(),
    });
  } catch (e) {
    console.log("PUSH RESULT EXCEPTION: ", e.toString());

    await job.update({
      data_sent_status: "ERROR",
      data_sent_date: new Date(),
    });
  }
};

const pushResultUrlNotExists = async (job: Job) => {
  try {
    const entity = await new entityController(dbSM).retrieveByPk(job.entity_id);

    const scanBody = await mapPA2026BodyUrlNotExists();

    const result = await callPatch(
      scanBody,
      process.env.PA2026_UPDATE_RECORDS_PATH.replace(
        "{external_entity_id}",
        entity.external_id
      )
    );

    //Warn: API returns empty string when it success
    if (result !== "") {
      throw new Error("Send data failed");
    }

    await job.update({
      data_sent_status: "COMPLETED",
      data_sent_date: new Date(),
    });
  } catch (e) {
    console.log("PUSH RESULT EXCEPTION", e.toString());

    await job.update({
      data_sent_status: "ERROR",
      data_sent_date: new Date(),
    });
  }
};

export {
  retrieveToken,
  callQuery,
  callPatch,
  pushResult,
  pushResultUrlNotExists,
};
