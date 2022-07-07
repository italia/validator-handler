"use strict";

import { audits as municipalityAudits } from "../storage/municipalityAudits";
import { audits as schoolAudits } from "../storage/schoolAudits";

const cleanMunicipalityJSONReport = async (jsonResult: string) => {
  const parsedResult = JSON.parse(jsonResult);

  const userExperienceFailAudits = await getFailAuditByClusterGroup(
    parsedResult,
    municipalityAudits,
    "informed-citizen",
    "user-experience"
  );
  let userExperienceStatus = true;
  if (userExperienceFailAudits.length > 0) {
    userExperienceStatus = false;
  }

  const functionFailAudits = await getFailAuditByClusterGroup(
    parsedResult,
    municipalityAudits,
    "informed-citizen",
    "function"
  );
  let functionStatus = true;
  if (functionFailAudits.length > 0) {
    functionStatus = false;
  }

  const legislationFailAudits = await getFailAuditByClusterGroup(
    parsedResult,
    municipalityAudits,
    "informed-citizen",
    "legislation"
  );
  let legislationStatus = true;
  if (legislationFailAudits.length > 0) {
    legislationStatus = false;
  }

  const securityFailAudits = await getFailAuditByClusterGroup(
    parsedResult,
    municipalityAudits,
    "informed-citizen",
    "security"
  );
  let securityStatus = true;
  if (securityFailAudits.length > 0) {
    securityStatus = false;
  }

  const performanceScore = await getPerformanceScore(parsedResult);
  let performanceStatus = true;
  if (performanceScore < 0.5) {
    performanceStatus = false;
  }

  let informedCitizenStatus = false;
  if (
    userExperienceStatus &&
    functionStatus &&
    legislationStatus &&
    securityStatus &&
    performanceStatus
  ) {
    informedCitizenStatus = true;
  }

  const activeCitizenFailAudits = await getFailAuditByClusterGroup(
    parsedResult,
    municipalityAudits,
    "active-citizen"
  );
  let activeCitizenStatus = true;
  if (activeCitizenFailAudits.length > 0) {
    activeCitizenStatus = false;
  }

  const recommendationsFailAudits = await getFailAuditByClusterGroup(
    parsedResult,
    municipalityAudits,
    "recommendations"
  );
  let recommendationsStatus = true;
  if (recommendationsFailAudits.length > 0) {
    recommendationsStatus = false;
  }

  return {
    "cittadino-informato": {
      status: informedCitizenStatus,

      groups: {
        "esperienza-utente": {
          status: userExperienceStatus,
          failAudit: userExperienceFailAudits,
        },
        funzionalita: {
          status: functionStatus,
          failAudit: functionFailAudits,
        },
        normativa: {
          status: legislationStatus,
          failAudit: legislationFailAudits,
        },
        sicurezza: {
          status: securityStatus,
          failAudit: securityFailAudits,
        },
        prestazioni: {
          status: performanceStatus,
        },
      },
    },

    "cittadino-attivo": {
      status: activeCitizenStatus,
      failAudit: activeCitizenFailAudits,
    },

    raccomandazioni: {
      status: recommendationsStatus,
      failAudit: recommendationsFailAudits,
    },
  };
};

const cleanSchoolJSONReport = async (jsonResult: string) => {
  const parsedResult = JSON.parse(jsonResult);

  const userExperienceFailAudits = await getFailAuditByClusterGroup(
    parsedResult,
    schoolAudits,
    "compliance-criteria",
    "user-experience"
  );
  let userExperienceStatus = true;
  if (userExperienceFailAudits.length > 0) {
    userExperienceStatus = false;
  }

  const legislationFailAudits = await getFailAuditByClusterGroup(
    parsedResult,
    schoolAudits,
    "compliance-criteria",
    "legislation"
  );
  let legislationStatus = true;
  if (legislationFailAudits.length > 0) {
    legislationStatus = false;
  }

  const securityFailAudits = await getFailAuditByClusterGroup(
    parsedResult,
    schoolAudits,
    "compliance-criteria",
    "security"
  );
  let securityStatus = true;
  if (securityFailAudits.length > 0) {
    securityStatus = false;
  }

  const performanceScore = await getPerformanceScore(parsedResult);
  let performanceStatus = true;
  if (performanceScore < 0.5) {
    performanceStatus = false;
  }

  let complianceCriteriaStatus = false;
  if (
    userExperienceStatus &&
    legislationStatus &&
    securityStatus &&
    performanceStatus
  ) {
    complianceCriteriaStatus = true;
  }

  const recommendationsFailAudits = await getFailAuditByClusterGroup(
    parsedResult,
    schoolAudits,
    "recommendations"
  );
  let recommendationsStatus = true;
  if (recommendationsFailAudits.length > 0) {
    recommendationsStatus = false;
  }

  return {
    "criteri-conformita": {
      status: complianceCriteriaStatus,

      groups: {
        "esperienza-utente": {
          status: userExperienceStatus,
          failAudit: userExperienceFailAudits,
        },
        normativa: {
          status: legislationStatus,
          failAudit: legislationFailAudits,
        },
        sicurezza: {
          status: securityStatus,
          failAudit: securityFailAudits,
        },
        prestazioni: {
          status: performanceStatus,
        },
      },
    },

    raccomandazioni: {
      status: recommendationsStatus,
      failAudit: recommendationsFailAudits,
    },
  };
};

const getFailAuditByClusterGroup = async (
  jsonResult,
  audits,
  cluster,
  group = ""
) => {
  let auditsToGet: string[];
  if (group !== "") {
    auditsToGet = audits[cluster][group] ?? ["error"];
  } else {
    auditsToGet = audits[cluster] ?? ["error"];
  }

  if (!("audits" in jsonResult)) {
    return auditsToGet;
  }

  const failAudits = [];
  for (const auditId of auditsToGet) {
    let auditScore = 0;
    if (
      jsonResult.audits[auditId] !== undefined &&
      "score" in jsonResult.audits[auditId]
    ) {
      auditScore = jsonResult.audits[auditId].score ?? 0;
    }

    if (auditScore < 0.5) {
      failAudits.push(auditId);
    }
  }

  return failAudits;
};

const getPerformanceScore = async (jsonResult) => {
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

const isPassedReport = async (jsonReport, type: string): Promise<boolean> => {
  let passed = false;

  switch (type) {
    case "municipality":
      // eslint-disable-next-line
      const informedCitizenStatus = jsonReport["cittadino-informato"].status;

      // eslint-disable-next-line
      const activeCitizenStatus = jsonReport["cittadino-attivo"].status;

      // eslint-disable-next-line
      const recommendationsMunicipalityStatus =
        jsonReport["raccomandazioni"].status;

      if (
        informedCitizenStatus &&
        activeCitizenStatus &&
        recommendationsMunicipalityStatus
      ) {
        passed = true;
      }
      break;
    case "school":
      // eslint-disable-next-line
      const complianceCriteriaStatus = jsonReport["criteri-conformita"].status;

      // eslint-disable-next-line
      const recommendationsSchoolStatus = jsonReport["raccomandazioni"].status;

      if (complianceCriteriaStatus && recommendationsSchoolStatus) {
        passed = true;
      }
      break;
    default:
      passed = false;
  }

  return passed;
};

export { cleanMunicipalityJSONReport, cleanSchoolJSONReport, isPassedReport };
