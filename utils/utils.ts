"use strict";

import { dirname } from "path";
import { readFileSync } from "fs";
import { ValidationError } from "jsonschema";
import { Job } from "../types/models.js";
import { pa2026Mapping } from "../storage/pa2026Mapping.js";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import { format } from "date-fns";
import { Op } from "sequelize";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const __dirname = dirname(fileURLToPath(import.meta.url));

const arrayChunkify = async (
  inputArray: [],
  numberOfDesiredChuck: number,
  balanced = true
) => {
  if (numberOfDesiredChuck < 2) {
    return [inputArray];
  }

  const len = inputArray.length,
    out = [];
  let i = 0,
    size: number;

  if (len % numberOfDesiredChuck === 0) {
    size = Math.floor(len / numberOfDesiredChuck);
    while (i < len) {
      out.push(inputArray.slice(i, (i += size)));
    }
  } else if (balanced) {
    while (i < len) {
      size = Math.ceil((len - i) / numberOfDesiredChuck--);
      out.push(inputArray.slice(i, (i += size)));
    }
  } else {
    numberOfDesiredChuck--;
    size = Math.floor(len / numberOfDesiredChuck);
    if (len % size === 0) size--;
    while (i < size * numberOfDesiredChuck) {
      out.push(inputArray.slice(i, (i += size)));
    }
    out.push(inputArray.slice(size * numberOfDesiredChuck));
  }

  return out;
};

const mapValidationErrors = async (
  validationErrors: ValidationError[]
): Promise<string> => {
  const errorMessages = [];

  for (const element of validationErrors) {
    errorMessages.push(element.stack);
  }

  return errorMessages.join(" | ");
};

function mapAuditTitle(id) {
  if (id in pa2026Mapping) return pa2026Mapping[id].title;
  return id;
}

function getFailAudits(auditObject) {
  const auditIds = Object.keys(auditObject);

  const failedAuditIds = [];
  for (const auditId of auditIds) {
    if (auditObject[auditId] === 0) {
      failedAuditIds.push(auditId);
    }
  }

  return failedAuditIds;
}

const mapPA2026Body = async (
  job: Job,
  cleanJsonResult,
  generalStatus: boolean,
  isFirstScan: boolean,
  passedAuditsPercentage: string
) => {
  try {
    const mainObjKey =
      job.type === "municipality"
        ? "cittadino-informato"
        : "criteri-conformita";

    const raccomandationObj = cleanJsonResult["raccomandazioni"];
    const userExperienceObj =
      cleanJsonResult[mainObjKey].groups["esperienza-utente"];
    const legislationObj = cleanJsonResult[mainObjKey].groups["normativa"];
    const performanceObj = cleanJsonResult[mainObjKey].groups["prestazioni"];
    const securityObj = cleanJsonResult[mainObjKey].groups["sicurezza"];

    const key = isFirstScan ? "1" : "n";

    let packageJSON;
    try {
      packageJSON =
        JSON.parse(
          await readFileSync(
            path.resolve(__dirname, "../package.json")
          ).toString()
        ) ?? {};
    } catch (e) {
      packageJSON = null;
      console.log("MAP PA2026 BODY EXCEPTION 01: ", e);
    }

    const siteUrl = new URL(job.scan_url);

    const crawlerVersion =
      packageJSON?.dependencies["pa-website-validator-ng"]?.split("#")[1] ?? "";

    const initialBody = [];
    initialBody[`Nome_file_${key}__c`] =
      `Report ` +
      siteUrl.host +
      "_" +
      format(new Date(), "yyyyMMdd") +
      "_" +
      crawlerVersion +
      "_" +
      job.id +
      (isFirstScan ? "_Prima Scansione" : "");

    initialBody[`Data_scansione_fallita__c`] = null;
    initialBody[`URL_scansione_fallita__c`] = null;
    initialBody[`Versione_Crawler_${key}__c`] = crawlerVersion;
    initialBody[`Criteri_Superati_Crawler_${key}__c`] = passedAuditsPercentage;
    initialBody[`Status_Generale_${key}__c`] = generalStatus;
    initialBody[`Data_Job_Crawler_${key}__c`] = new Date(job.end_at).getTime();
    (initialBody[`URL_Scansione_${key}__c`] = job.scan_url),
      (initialBody[`ID_Crawler_Job_${key}__c`] = job.id),
      (initialBody[`Esperienza_Utente_${key}__c`] = userExperienceObj.status),
      (initialBody[`Normativa_${key}__c`] = legislationObj.status),
      (initialBody[`Prestazioni_${key}__c`] = performanceObj.status),
      (initialBody[`Sicurezza_${key}__c`] = securityObj.status),
      (initialBody[`Raccomandazioni_${key}__c`] = raccomandationObj.status),
      (initialBody[`Esperienza_Utente_${key}_Descrizione__c`] =
        getFailAudits(userExperienceObj.audits)
          .map((x) => mapAuditTitle(x))
          .join(" | ") ?? ""),
      (initialBody[`Normativa_${key}_Descrizione__c`] =
        getFailAudits(legislationObj.audits)
          .map((x) => mapAuditTitle(x))
          .join(" | ") ?? ""),
      (initialBody[`Sicurezza_${key}_Descrizione__c`] =
        getFailAudits(securityObj.audits)
          .map((x) => mapAuditTitle(x))
          .join(" | ") ?? ""),
      (initialBody[`Raccomandazioni_${key}_Descrizione__c`] =
        getFailAudits(raccomandationObj.audits)
          .map((x) => mapAuditTitle(x))
          .join(" | ") ?? "");

    switch (job.type) {
      case "municipality":
        // eslint-disable-next-line
        const functionObj = cleanJsonResult[mainObjKey].groups["funzionalita"];
        (initialBody[`Cittadino_Informato_${key}__c`] =
          cleanJsonResult[mainObjKey].status),
          (initialBody[`Funzionalita_${key}__c`] = functionObj.status),
          (initialBody[`Funzionalita_${key}_Descrizione__c`] =
            getFailAudits(functionObj.audits)
              .map((x) => mapAuditTitle(x))
              .join(" | ") ?? "");
        break;
      case "school":
        initialBody[`Criteri_Conformita_${key}__c`] =
          cleanJsonResult[mainObjKey].status;
        break;
    }

    return Object.assign({}, initialBody);
  } catch (e) {
    console.log("MAP PA2026 BODY EXCEPTION 02: ", e.toString());
  }
};

const mapPA2026BodyUrlNotExists = async (urlToBeScanned: string) => {
  const body = [];
  body[`Data_scansione_fallita__c`] = new Date().toISOString().split("T")[0];
  body[`URL_scansione_fallita__c`] = urlToBeScanned;

  return Object.assign({}, body);
};

const calculatePassedAuditPercentage = async (
  job: Job,
  cleanJsonResult
): Promise<string> => {
  let totalAudits = {};

  const mainObjKey =
    job.type === "municipality" ? "cittadino-informato" : "criteri-conformita";

  const legislationAudits =
    cleanJsonResult[mainObjKey]["groups"]["normativa"]["audits"] ?? {};
  const securityAudits =
    cleanJsonResult[mainObjKey]["groups"]["sicurezza"]["audits"] ?? {};
  const userExperienceAudits =
    cleanJsonResult[mainObjKey]["groups"]["esperienza-utente"]["audits"] ?? {};
  totalAudits = {
    ...legislationAudits,
    ...securityAudits,
    ...userExperienceAudits,
  };

  if (job.type === "municipality") {
    const functionalityAudits =
      cleanJsonResult[mainObjKey]["groups"]["funzionalita"]["audits"] ?? {};
    const performancesResult =
      cleanJsonResult[mainObjKey]["groups"]["prestazioni"]["status"] ?? 0;
    const performancesAudits = {
      "municipality-status": performancesResult === true ? 1 : 0,
    };

    totalAudits = {
      ...totalAudits,
      ...functionalityAudits,
      ...performancesAudits,
    };
  }

  let passed = 0;
  let total = 0;
  for (const auditResult of Object.values(totalAudits)) {
    total++;

    if (auditResult > 0) {
      passed++;
    }
  }

  return passed + " su " + total;
};

const urlExists = async (url: string) => {
  try {
    let statusCode = undefined;
    const response = await axios.get(url, {
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    console.log(
      `[SCAN MANAGER ITEM] - Calling URL ${url} returned: ${response.status} ${response.statusText}.`
    );
    statusCode = response.status;

    if (statusCode === undefined || statusCode < 200 || statusCode >= 400) {
      return false;
    }

    return true;
  } catch (ex) {
    console.log("Url Exists Exception: ", ex.toString());

    return false;
  }
};

const jsonToSequelizeWhere = (jsonFilter) => {
  if (!jsonFilter) {
    throw new Error("Invalid input: JSON filter is required");
  }

  if (jsonFilter.and) {
    return {
      [Op.and]: jsonFilter.and.map(jsonToSequelizeWhere),
    };
  }

  if (jsonFilter.or) {
    return {
      [Op.or]: jsonFilter.or.map(jsonToSequelizeWhere),
    };
  }

  const keys = Object.keys(jsonFilter);
  if (keys.length === 1) {
    const key = keys[0];
    const value = jsonFilter[key];

    if (typeof value === "object" && value !== null) {
      if (value.in) {
        return { [key]: { [Op.in]: value.in } };
      }
      if (value.notIn) {
        return { [key]: { [Op.notIn]: value.notIn } };
      }
      if (value.between) {
        return { [key]: { [Op.between]: value.between } };
      }
      if (value.notBetween) {
        return { [key]: { [Op.notBetween]: value.notBetween } };
      }

      if (value.gt || value.gt == 0) {
        return { [key]: { [Op.gt]: value.gt } }; // Greater than
      }
      if (value.gte || value.gte == 0) {
        return { [key]: { [Op.gte]: value.gte } }; // Greater than or equal
      }
      if (value.lt || value.lt == 0) {
        return { [key]: { [Op.lt]: value.lt } }; // Less than
      }
      if (value.lte || value.lte == 0) {
        return { [key]: { [Op.lte]: value.lte } }; // Less than or equal
      }

      if (value.like) {
        return { [key]: { [Op.like]: value.like } }; // Like
      }
      if (value.notLike) {
        return { [key]: { [Op.notLike]: value.notLike } }; // Not Like
      }

      if (value.ne || value.ne == 0) {
        return { [key]: { [Op.ne]: value.ne } }; // Not equal
      }
    }

    switch (key) {
      case "not":
        return { [Op.not]: jsonToSequelizeWhere(value) };

      default:
        return { [key]: value }; // Direct equality
    }
  }

  throw new Error("Invalid JSON structure");
};

const sanitizeInput = (input) => {
  const allowedPattern = /^[a-zA-Z0-9 _!@#$%^&*()+=.,;:'"<>?/\\|`~-]*$/;

  if (typeof input === "string" && allowedPattern.test(input)) {
    return input;
  } else if (typeof input === "string") {
    console.log(input);
    throw new Error(
      "Invalid input: Only alphanumeric characters, underscores, and hyphens are allowed."
    );
  }
  return input;
};

const preFilterPayload = (payload) => {
  let sanitizedPayload = {};

  const processObject = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map((item) => processObject(item));
    }
    if (typeof obj === "object" && obj !== null) {
      const result = {};

      for (const key in obj) {
        if (key === "external_id") {
          throw new Error(
            "'external_id' can appear only in top level 'and' object"
          );
        }
        result[key] = processObject(obj[key]);
      }
      return result;
    }
    return sanitizeInput(obj);
  };

  sanitizedPayload = processObject(payload);
  return sanitizedPayload;
};

export {
  arrayChunkify,
  mapValidationErrors,
  mapPA2026Body,
  calculatePassedAuditPercentage,
  urlExists,
  mapPA2026BodyUrlNotExists,
  jsonToSequelizeWhere,
  preFilterPayload,
};
