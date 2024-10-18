"use strict";

import { dbRoot, dbWS } from "../database/connection.js";
import {
  callPatch,
  callQuery,
  pushResult,
} from "../controller/PA2026/integrationController.js";
import { allowedMunicipalitySubTypes } from "../database/models/entity.js";
import { entityController } from "../controller/entityController.js";
import { Entity, Job } from "../types/models.js";
import { jobController } from "../controller/jobController.js";
import {
  preserveReasons,
  define as jobDefine,
} from "../database/models/job.js";
import { Op } from "sequelize";
import { getFile } from "../controller/s3Controller.js";

dbRoot
  .authenticate()
  .then(async () => {
    try {
      console.log("[PA2026 MANAGER]: START");

      const createResult = await create();
      console.log("[PA2026 MANAGER]: CREATE RESULT - ", createResult);

      const updateResult = await update();
      console.log("[PA2026 MANAGER]: UPDATE RESULT - ", updateResult);

      const forcedScanResult = await forcedScanEntities();
      console.log("[PA2026 MANAGER]: FORCED SCAN RESULT - ", forcedScanResult);

      const asseverationResult = await asseveration();
      console.log(
        "[PA2026 MANAGER]: ASSEVERATION RESULT - ",
        asseverationResult
      );

      await sendRetryJobInSendError();

      console.log("[PA2026 MANAGER]: FINISH");
    } catch (e) {
      console.log("[PA2026 MANAGER]: EXCEPTION - ", e.toString());
    }
  })
  .catch((err) => {
    console.error("Error: ", err);
    process.exit(1);
  });

const create = async () => {
  const createQuery =
    "SELECT id,Url_Sito_Internet__c, Pacchetto_1_4_1__c, ID_Crawler__c " +
    "FROM outfunds__Funding_Request__c " +
    "WHERE outfunds__Status__c ='Finanziata' " +
    "AND outfunds__FundingProgram__r.RecordType.DeveloperName='Misura_141' " +
    "AND Url_Sito_Internet__c !=null " +
    "AND ID_Crawler__c=null";
  const returnIds = [];

  try {
    const createResult = await callQuery(createQuery);

    if (!createResult) {
      throw new Error("Empty values from create query");
    }

    const records = createResult?.records;
    if (records.length <= 0) {
      return [];
    }

    for (const record of records) {
      try {
        const externalId = record.Id ?? "";
        let entity: Entity = await new entityController(dbWS).retrieve(
          externalId
        );

        if (!entity) {
          const packet = record?.Pacchetto_1_4_1__c ?? "";
          const [type, subtype] = await calculateTypeSubtype(packet);

          const url = record.Url_Sito_Internet__c ?? "";

          entity = await new entityController(dbWS).create({
            external_id: externalId,
            url: url,
            enable: true,
            type: type,
            subtype: subtype,
            forcedScan: false,
          });

          if (!entity) {
            throw new Error(
              "Create entity failed for entity external id: " + externalId
            );
          }
        }

        await callPatch(
          { ID_Crawler__c: entity.id },
          process.env.PA2026_UPDATE_RECORDS_PATH.replace(
            "{external_entity_id}",
            entity.external_id
          )
        );

        returnIds.push(entity.id);
      } catch (e) {
        console.log("CREATE QUERY FOR-STATEMENT EXCEPTION: ", e.toString());
      }
    }
  } catch (e) {
    console.log("CREATE QUERY EXCEPTION: ", e.toString());
  }

  return returnIds;
};

const update = async () => {
  const updateQuery =
    "SELECT id,Url_Sito_Internet__c, Pacchetto_1_4_1__c, ID_Crawler__c " +
    "FROM outfunds__Funding_Request__c " +
    "WHERE outfunds__Status__c ='Finanziata' " +
    "AND outfunds__FundingProgram__r.RecordType.DeveloperName='Misura_141' " +
    "AND Url_Sito_Internet__c !=null " +
    "AND ID_Crawler__c!=null " +
    "AND Controllo_URL__c=false ";

  const returnIds = [];

  try {
    const updateResult = await callQuery(updateQuery);

    if (!updateResult) {
      throw new Error("Empty values from create query");
    }

    const records = updateResult?.records;
    if (records.length <= 0) {
      return [];
    }

    for (const record of records) {
      try {
        const externalId = record.Id ?? "";
        const url = record.Url_Sito_Internet__c ?? "";

        const entity: Entity = await new entityController(dbWS).retrieve(
          externalId
        );

        if (!entity) {
          throw new Error("Entity not found: " + externalId);
        }

        const updateEntity = await entity.update({
          url: url,
        });

        returnIds.push(updateEntity.id);
      } catch (e) {
        console.log("UPDATE QUERY FOR-STATEMENT EXCEPTION: ", e.toString());
      }
    }
  } catch (e) {
    console.log("UPDATE QUERY EXCEPTION: ", e.toString());
  }

  return returnIds;
};

const asseveration = async () => {
  const asseverationQuery =
    "SELECT id, Codice_amministrativo__c, ID_Crawler__c, ID_Crawler_Job_definitiva__c, Stato_Progetto__c " +
    "FROM outfunds__Funding_Request__c " +
    "WHERE Stato_Progetto__c IN ('COMPLETATO', 'RESPINTO', 'IN LIQUIDAZIONE', 'LIQUIDATO', 'ANNULLATO', 'RINUNCIATO') " +
    "AND Progetto_Terminato__c=false AND ID_Crawler__c != null";
  const returnIds = [];
  try {
    const asseverationResult = await callQuery(asseverationQuery);

    if (!asseverationResult) {
      throw new Error("Empty values from create query");
    }

    const records = asseverationResult?.records;
    if (records.length <= 0) {
      return [];
    }

    for (const record of records) {
      try {
        const externalId = record.Id ?? "";
        let asseverationJobId =
          parseInt(record.ID_Crawler_Job_definitiva__c) ?? null;
        const projectState = record.Stato_Progetto__c ?? "";

        const entity: Entity = await new entityController(dbWS).retrieve(
          externalId
        );
        if (!entity) {
          throw new Error(
            "Retrieve entity failed for entity external id: " + externalId
          );
        }

        let entityUpdateObj = {
          enable: false,
          asseverationJobId: null,
        };
        let updateJob = {};
        if (
          projectState !== "RESPINTO" &&
          projectState !== "ANNULLATO" &&
          projectState !== "RINUNCIATO"
        ) {
          if (!asseverationJobId) {
            throw new Error(
              "Asseveration job id from PA2026 is null for entity: " + entity.id
            );
          }

          const job: Job = await new jobController(
            dbWS
          ).getJobFromIdAndEntityId(asseverationJobId, entity.id);

          if (!job) {
            throw new Error(
              "Job not found for entity: " +
                entity.id +
                " with jobId: " +
                asseverationJobId
            );
          }

          updateJob = await job.update({
            preserve: true,
            preserve_reason: preserveReasons[1],
          });

          if (!updateJob) {
            throw new Error("Job update fail");
          }

          if (projectState === "IN VERIFICA") {
            asseverationJobId = null;
          }

          entityUpdateObj = {
            enable: true,
            asseverationJobId: asseverationJobId,
          };
        }

        const entityUpdated = await entity.update(entityUpdateObj);
        if (!entityUpdated) {
          throw new Error("Entity update failed");
        }

        if (entityUpdated && updateJob) {
          await callPatch(
            { Progetto_Terminato__c: true },
            process.env.PA2026_UPDATE_RECORDS_PATH.replace(
              "{external_entity_id}",
              entityUpdated.external_id
            )
          );
        }

        returnIds.push(entityUpdated.id);
      } catch (e) {
        console.log(
          "ASSEVERATION QUERY FOR-STATEMENT EXCEPTION: ",
          e.toString()
        );
      }
    }
  } catch (e) {
    console.log("ASSEVERATION QUERY EXCEPTION: ", e.toString());
  }
  return returnIds;
};

const calculateTypeSubtype = async (packet) => {
  let type;
  let subtype;
  if (packet === "Cittadino Informato") {
    type = "municipality";
    subtype = allowedMunicipalitySubTypes[0];
  } else if (packet === "Cittadino Attivo e Informato") {
    type = "municipality";
    subtype = allowedMunicipalitySubTypes[1];
  } else {
    type = "school";
    subtype = null;
  }

  return [type, subtype];
};

const sendRetryJobInSendError = async () => {
  try {
    const date = new Date();
    date.setHours(
      date.getHours() - parseInt(process.env.SEND_RETRY_JOB_IN_ERROR)
    );

    const jobs: Job[] = await jobDefine(dbWS).findAll({
      where: {
        [Op.and]: [
          {
            [Op.or]: [{ status: "PASSED" }, { status: "FAILED" }],
          },
          {
            [Op.or]: [
              { data_sent_status: "ERROR" },
              {
                [Op.and]: [
                  { data_sent_status: null },
                  { end_at: { [Op.lt]: date } },
                ],
              },
            ],
          },
        ],
      },
    });

    for (const job of jobs) {
      try {
        let s3FilePath = job.s3_html_url;
        if (!s3FilePath) {
          continue;
        }

        if (s3FilePath.startsWith("http")) {
          s3FilePath = new URL(s3FilePath).pathname;
        }

        s3FilePath = s3FilePath.substring(1);

        const file: string = await getFile(s3FilePath);
        if (!file) {
          continue;
        }

        await pushResult(job, job.json_result, job.status === "PASSED", file);
      } catch (e) {
        console.log("SEND RETRY JOB FOR-STATEMENT EXCEPTION: ", e.toString());
      }
    }
  } catch (e) {
    console.log("SEND RETRY JOB EXCEPTION: ", e.toString());
  }
};

const forcedScanEntities = async () => {
  const forcedScanEntitiesQuery =
    "SELECT id,Url_Sito_Internet__c, Pacchetto_1_4_1__c, ID_Crawler__c " +
    "FROM outfunds__Funding_Request__c  " +
    "WHERE outfunds__Status__c ='Finanziata' " +
    "AND outfunds__FundingProgram__r.RecordType.DeveloperName='Misura_141'  " +
    "AND Url_Sito_Internet__c !=null " +
    "AND Da_Scansionare__c=true";

  const returnIds = [];

  try {
    const scanFromPA2026Result = await callQuery(forcedScanEntitiesQuery);

    if (!scanFromPA2026Result) {
      throw new Error("Empty values from create query");
    }

    const records = scanFromPA2026Result?.records;
    if (records.length <= 0) {
      return [];
    }

    for (const record of records) {
      try {
        const externalId = record.Id ?? "";
        const entity: Entity = await new entityController(dbWS).retrieve(
          externalId
        );

        if (!entity) {
          throw new Error("Entity not found: " + externalId);
        }

        const updateEntity = await entity.update({
          forcedScan: true,
        });

        returnIds.push(updateEntity.id);

        await callPatch(
          {
            Da_Scansionare__c: false,
            Da_Scansionare_Data_Scansione__c: new Date().getTime(),
          },
          process.env.PA2026_UPDATE_RECORDS_PATH.replace(
            "{external_entity_id}",
            entity.external_id
          )
        );
      } catch (e) {
        console.log(
          "FORCED SCAN QUERY FOR-STATEMENT EXCEPTION: ",
          e.toString()
        );
      }
    }
  } catch (e) {
    console.log("FORCED SCAN QUERY EXCEPTION: ", e.toString());
  }

  return returnIds;
};
