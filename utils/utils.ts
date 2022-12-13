"use strict";
import { ValidationError } from "jsonschema";
import { Job } from "../types/models";
import { auditDictionary } from "pa-website-validator/dist/storage/auditDictionary";

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
  isFirstScan: boolean
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

    const initialBody = [];
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
          //(initialBody[`Cittadino_Attivo_${key}__c`] =
          //  cleanJsonResult["cittadino-attivo"].status),
          (initialBody[`Funzionalita_${key}__c`] = functionObj.status),
          //(initialBody[`Cittadino_Attivo_${key}_Descrizione__c`] =
          //  getFailAudits(cleanJsonResult["cittadino-attivo"].audits)
          //    .map((x) => mapAuditTitle(x))
          //    .join(" | ") ?? ""),
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
    console.log("MAP PA2026 BODY EXCEPTION: ", e.toString());
  }
};

export { arrayChunkify, mapValidationErrors, mapPA2026Body };
