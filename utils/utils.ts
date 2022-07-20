"use strict";
import { ValidationError } from "jsonschema";
import { Job } from "../types/models";

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

const mapPA2026Body = async (
  job: Job,
  cleanJsonResult,
  generalStatus: boolean,
  isFirstScan: boolean
) => {
  const mainObjKey =
    job.type === "municipality" ? "cittadino-informato" : "criteri-conformita";

  const raccomandationObj = cleanJsonResult["raccomandazioni"];
  const userExperienceObj = cleanJsonResult[mainObjKey]["esperienza-utente"];
  const legislationObj = cleanJsonResult[mainObjKey]["normativa"];
  const performanceObj = cleanJsonResult[mainObjKey]["prestazioni"];
  const securityObj = cleanJsonResult[mainObjKey]["sicurezza"];

  const key = isFirstScan ? "1" : "n";

  const initialBody = [];
  initialBody[`Status_Generale_${key}__c`] = generalStatus;
  (initialBody[`URL_Scansione_${key}__c`] = job.scan_url),
    (initialBody[`ID_Crawler_Job_${key}__c`] = job.id),
    (initialBody[`Esperienza_Utente_${key}__c`] = userExperienceObj.status),
    (initialBody[`Normativa_${key}__c`] = legislationObj.status),
    (initialBody[`Prestazioni_${key}__c`] = performanceObj.status),
    (initialBody[`Sicurezza_${key}__c`] = securityObj.status),
    (initialBody[`Raccomandazioni_${key}__c`] = raccomandationObj.status),
    (initialBody[`Esperienza_Utente_${key}_Descrizione__c`] = JSON.stringify(
      userExperienceObj.failAudit
    )),
    (initialBody[`Normativa_${key}_Descrizione__c`] = JSON.stringify(
      legislationObj.failAudit
    )),
    (initialBody[`Sicurezza_${key}_Descrizione__c`] = JSON.stringify(
      securityObj.failAudit
    )),
    (initialBody[`Raccomandazioni_${key}_Descrizione__c`] = JSON.stringify(
      raccomandationObj.failAudit
    ));

  switch (job.type) {
    case "municipality":
      // eslint-disable-next-line
      const functionObj = cleanJsonResult[mainObjKey]["funzionalita"];
      (initialBody[`Cittadino_Informato_${key}__c`] =
        cleanJsonResult[mainObjKey].status),
        (initialBody[`Cittadino_Attivo_${key}__c`] =
          cleanJsonResult["cittadino-attivo"].status),
        (initialBody[`Funzionalita_${key}__c`] = functionObj.status),
        (initialBody[`Cittadino_Attivo_${key}_Descrizione__c`] = JSON.stringify(
          cleanJsonResult["cittadino-attivo"].failAudit
        )),
        (initialBody[`Funzionalita_${key}_Descrizione__c`] = JSON.stringify(
          functionObj.failAudit
        ));
      break;
    case "school":
      initialBody[`Criteri_Conformita_${key}__c`] =
        cleanJsonResult[mainObjKey].status;
      break;
  }

  return Object.assign({}, initialBody);
};

export { arrayChunkify, mapValidationErrors, mapPA2026Body };
