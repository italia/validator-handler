"use strict";

import { audits as municipalityAudits } from "../storage/municipalityAudits";
import { audits as schoolAudits } from "../storage/schoolAudits";
import { entityController } from "./entityController";
import { dbSM } from "../database/connection";
import { allowedMunicipalitySubTypes } from "../database/models/entity";

const cleanMunicipalityJSONReport = async (jsonResult: string) => {
  const parsedResult = JSON.parse(jsonResult);

  const userExperienceAudits = await getAuditByClusterGroup(
    parsedResult,
    municipalityAudits,
    "informed-citizen",
    "user-experience"
  );
  let userExperienceStatus = false;
  if (
    Object.keys(userExperienceAudits.passed).length > 0 &&
    Object.keys(userExperienceAudits.failed).length === 0
  ) {
    userExperienceStatus = true;
  }

  const functionAudits = await getAuditByClusterGroup(
    parsedResult,
    municipalityAudits,
    "informed-citizen",
    "function"
  );
  let functionStatus = false;
  if (
    Object.keys(functionAudits.passed).length > 0 &&
    Object.keys(functionAudits.failed).length === 0
  ) {
    functionStatus = true;
  }

  const legislationAudits = await getAuditByClusterGroup(
    parsedResult,
    municipalityAudits,
    "informed-citizen",
    "legislation"
  );
  let legislationStatus = false;
  if (
    Object.keys(legislationAudits.passed).length > 0 &&
    Object.keys(legislationAudits.failed).length === 0
  ) {
    legislationStatus = true;
  }

  const securityAudits = await getAuditByClusterGroup(
    parsedResult,
    municipalityAudits,
    "informed-citizen",
    "security"
  );
  let securityStatus = false;
  if (
    Object.keys(securityAudits.passed).length > 0 &&
    Object.keys(securityAudits.failed).length === 0
  ) {
    securityStatus = true;
  }

  const performanceScore = await getPerformanceScore(parsedResult);
  let performanceStatus = true;
  if (performanceScore < 0.5) {
    performanceStatus = false;
  }

  const informedCitizenStatus =
    userExperienceStatus &&
    functionStatus &&
    legislationStatus &&
    securityStatus &&
    performanceStatus;

  const recommendationsAudits = await getAuditByClusterGroup(
    parsedResult,
    municipalityAudits,
    "recommendations"
  );
  let recommendationsStatus = false;
  if (
    Object.keys(recommendationsAudits.passed).length > 0 &&
    Object.keys(recommendationsAudits.failed).length === 0
  ) {
    recommendationsStatus = true;
  }

  return {
    "cittadino-informato": {
      status: informedCitizenStatus,

      groups: {
        "esperienza-utente": {
          status: userExperienceStatus,
          audits: {
            ...userExperienceAudits.passed,
            ...userExperienceAudits.failed,
          },
        },
        funzionalita: {
          status: functionStatus,
          audits: { ...functionAudits.passed, ...functionAudits.failed },
        },
        normativa: {
          status: legislationStatus,
          audits: { ...legislationAudits.passed, ...legislationAudits.failed },
        },
        sicurezza: {
          status: securityStatus,
          audits: { ...securityAudits.passed, ...securityAudits.failed },
        },
        prestazioni: {
          status: performanceStatus,
        },
      },
    },

    raccomandazioni: {
      status: recommendationsStatus,
      audits: {
        ...recommendationsAudits.passed,
        ...recommendationsAudits.failed,
      },
    },
  };
};

const cleanSchoolJSONReport = async (jsonResult: string) => {
  const parsedResult = JSON.parse(jsonResult);

  const userExperienceAudits = await getAuditByClusterGroup(
    parsedResult,
    schoolAudits,
    "compliance-criteria",
    "user-experience"
  );
  let userExperienceStatus = false;
  if (
    Object.keys(userExperienceAudits.passed).length > 0 &&
    Object.keys(userExperienceAudits.failed).length === 0
  ) {
    userExperienceStatus = true;
  }

  const legislationAudits = await getAuditByClusterGroup(
    parsedResult,
    schoolAudits,
    "compliance-criteria",
    "legislation"
  );
  let legislationStatus = false;
  if (
    Object.keys(legislationAudits.passed).length > 0 &&
    Object.keys(legislationAudits.failed).length === 0
  ) {
    legislationStatus = true;
  }

  const securityAudits = await getAuditByClusterGroup(
    parsedResult,
    schoolAudits,
    "compliance-criteria",
    "security"
  );
  let securityStatus = false;
  if (
    Object.keys(securityAudits.passed).length > 0 &&
    Object.keys(securityAudits.failed).length === 0
  ) {
    securityStatus = true;
  }

  const performanceScore = await getPerformanceScore(parsedResult);
  let performanceStatus = true;
  if (performanceScore < 0.5) {
    performanceStatus = false;
  }

  const complianceCriteriaStatus =
    userExperienceStatus && legislationStatus && securityStatus;

  const recommendationsAudits = await getAuditByClusterGroup(
    parsedResult,
    schoolAudits,
    "recommendations"
  );
  let recommendationsStatus = false;
  if (
    Object.keys(recommendationsAudits.passed).length > 0 &&
    Object.keys(recommendationsAudits.failed).length === 0
  ) {
    recommendationsStatus = true;
  }

  return {
    "criteri-conformita": {
      status: complianceCriteriaStatus,

      groups: {
        "esperienza-utente": {
          status: userExperienceStatus,
          audits: {
            ...userExperienceAudits.passed,
            ...userExperienceAudits.failed,
          },
        },
        normativa: {
          status: legislationStatus,
          audits: { ...legislationAudits.passed, ...legislationAudits.failed },
        },
        sicurezza: {
          status: securityStatus,
          audits: { ...securityAudits.passed, ...securityAudits.failed },
        },
        prestazioni: {
          status: performanceStatus,
        },
      },
    },

    raccomandazioni: {
      status: recommendationsStatus,
      audits: {
        ...recommendationsAudits.passed,
        ...recommendationsAudits.failed,
      },
    },
  };
};

const getAuditByClusterGroup = async (
  jsonResult,
  audits,
  cluster,
  group = ""
) => {
  const auditList = {
    passed: {},
    failed: {},
  };

  let auditsToGet: string[];
  if (group !== "") {
    auditsToGet = audits[cluster][group] ?? null;
  } else {
    auditsToGet = audits[cluster] ?? null;
  }

  if (!("audits" in jsonResult) || auditsToGet === null) {
    return auditList;
  }

  for (const auditId of auditsToGet) {
    let auditScore = 0;
    if (
      jsonResult.audits[auditId] !== undefined &&
      "score" in jsonResult.audits[auditId]
    ) {
      auditScore = jsonResult.audits[auditId].score ?? 0;
    }

    if (auditScore < 0.5) {
      auditList.failed[auditId] = auditScore;
    } else {
      auditList.passed[auditId] = auditScore;
    }
  }

  return auditList;
};

const getPerformanceScore = async (jsonResult) => {
  if (jsonResult === undefined || jsonResult === null) {
    return 0;
  }

  if (!("categories" in jsonResult)) {
    return 0;
  }

  if (!("performance" in jsonResult.categories)) {
    return 0;
  }

  if (!("score" in jsonResult.categories.performance)) {
    return 0;
  }

  return jsonResult.categories.performance.score;
};

const isPassedReport = async (
  jsonReport,
  type: string,
  entity_id: number
): Promise<boolean> => {
  let passed = false;

  const entityObj = await new entityController(dbSM).retrieveByPk(entity_id);
  if (entityObj === null) {
    return passed;
  }

  const subtype = entityObj.subtype;
  if (!subtype && entityObj.type === "municipality") {
    return passed;
  }

  switch (type) {
    case "municipality":
      if (subtype === allowedMunicipalitySubTypes[0]) {
        // eslint-disable-next-line
        passed = jsonReport["cittadino-informato"].status;
      } else if (subtype === allowedMunicipalitySubTypes[1]) {
        // eslint-disable-next-line
        passed = jsonReport["cittadino-informato"].status;
      } else {
        passed = false;
      }
      break;
    case "school":
      // eslint-disable-next-line
      passed = jsonReport["criteri-conformita"].status;
      break;
    default:
      passed = false;
  }

  return passed;
};

export { cleanMunicipalityJSONReport, cleanSchoolJSONReport, isPassedReport };
