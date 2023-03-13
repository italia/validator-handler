"use strict";

import { dirname } from "path";
import { readFileSync } from "fs";
import { ValidationError } from "jsonschema";
import { Job } from "../types/models";
import { auditDictionary } from "pa-website-validator/dist/storage/auditDictionary";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

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
  if (id in auditDictionary) return auditDictionary[id].title;
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

    const initialBody = [];
    initialBody[`Nome_file_${key}__c`] =
      `report_scansione_` +
      new Date().toISOString().split("T")[0] +
      "_id_" +
      job.id +
      (isFirstScan ? "_prima_scansione" : "");
    initialBody[`Data_scansione_fallita__c`] = null;
    initialBody[`URL_scansione_fallita__c`] = null;
    initialBody[`Versione_Crawler_${key}__c`] =
      packageJSON?.dependencies["pa-website-validator"]?.split("#")[1] ?? "";
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

const urlExists = async (url) => {
  try {
    let statusCode = undefined;
    const response = await axios.get(url);
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

export {
  arrayChunkify,
  mapValidationErrors,
  mapPA2026Body,
  calculatePassedAuditPercentage,
  urlExists,
  mapPA2026BodyUrlNotExists,
};
