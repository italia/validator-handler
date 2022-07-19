"use strict";

import { dbRoot, dbWS } from "../database/connection";
import {
  callPatch,
  callQuery,
} from "../controller/PA2026/integrationController";
import { allowedMunicipalitySubTypes } from "../database/models/entity";
import { entityController } from "../controller/entityController";
import { Entity, Job } from "../types/models";
import { jobController } from "../controller/jobController";
import { preserveReasons, define as jobDefine } from "../database/models/job";
import { Op } from "sequelize";
import { sendToPA2026 } from "./scanManager";

dbRoot
  .authenticate()
  .then(async () => {
    try {
      console.log("[PA2026 MANAGER]: START");
    } catch (e) {
      console.log("[PA2026 MANAGER]: EXCEPTION - ", e);
    }
  })
  .catch((err) => {
    console.error("Error: ", err);
    process.exit(1);
  });

const create = async () => {
  const createQuery =
    "SELECT id,Url_Sito_Internet__c, Codice_amministrativo__c, Pacchetto_1_4_1__c, ID_Crawler__c " +
    "FROM outfunds__Funding_Request__c " +
    "WHERE outfunds__Status__c ='Finanziata' " +
    "AND outfunds__FundingProgram__r.RecordType.DeveloperName='Misura_141' " +
    "AND Url_Sito_Internet__c !=null " +
    "AND ID_Crawler__c=null " +
    "AND Attivita_completata__c= true ";
  const returnIds = [];

  try {
    const createResult = await callQuery(createQuery);

    if (!createResult) {
      throw new Error("Empty values from create query");
    }

    const records = createResult.data.records;
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
          });

          if (!entity) {
            throw new Error("Create entity failed");
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
        console.log(
          "CREATE QUERY FOR-STATEMENT EXCEPTION: ",
          JSON.stringify(e)
        );
      }
    }
  } catch (e) {
    console.log("CREATE QUERY EXCEPTION: ", JSON.stringify(e));
  }

  return returnIds;
};

const update = async () => {
  const updateQuery =
    "SELECT id,Url_Sito_Internet__c, Codice_amministrativo__c, Pacchetto_1_4_1__c, ID_Crawler__c " +
    "FROM outfunds__Funding_Request__c " +
    "WHERE outfunds__Status__c ='Finanziata' " +
    "AND outfunds__FundingProgram__r.RecordType.DeveloperName='Misura_141' " +
    "AND Url_Sito_Internet__c !=null " +
    "AND ID_Crawler__c!=null " +
    "AND Stato_Progetto__c= ’COMPLETATO’ " +
    "AND Controllo_URL__c=false ";
  const returnIds = [];

  try {
    const updateResult = await callQuery(updateQuery);

    if (!updateResult) {
      throw new Error("Empty values from create query");
    }

    const records = updateResult.data.records;
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
          throw new Error("Create entity failed");
        }

        const updateEntity = await entity.update({
          url: url,
        });

        returnIds.push(updateEntity.id);
      } catch (e) {
        console.log(
          "UPDATE QUERY FOR-STATEMENT EXCEPTION: ",
          JSON.stringify(e)
        );
      }
    }
  } catch (e) {
    console.log("UPDATE QUERY EXCEPTION: ", JSON.stringify(e));
  }

  return returnIds;
};

const asseveration = async () => {
  const asseverationQuery =
    "SELECT id, Codice_amministrativo__c, ID_Crawler__c, ID_Crawler_Job_definitiva__c, Stato_Progetto__c " +
    "FROM outfunds__Funding_Request__c " +
    "WHERE Stato_Progetto__c IN ('IN VERIFICA', 'RESPINTO', 'IN LIQUIDAZIONE', 'LIQUIDATO', 'ANNULLATO', 'RINUNCIATO') " +
    "AND Progetto_Terminato__c=false ";
  const returnIds = [];
  try {
    const asseverationResult = await callQuery(asseverationQuery);

    if (!asseverationResult) {
      throw new Error("Empty values from create query");
    }

    const records = asseverationResult.data.records;
    if (records.length <= 0) {
      return [];
    }

    for (const record of records) {
      try {
        const externalId = record.Id ?? "";
        const asseverationJobId = record.ID_Crawler_Job_definitiva__c ?? "";
        const projectState = record.Stato_Progetto__c ?? "";

        const entity: Entity = await new entityController(dbWS).retrieve(
          externalId
        );
        if (!entity) {
          throw new Error("Retrieve entity failed");
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
          const job: Job = await new jobController(dbWS).getJobFromIdAndEntityId(
            asseverationJobId,
            entity.id
          );

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
          "UPDATE QUERY FOR-STATEMENT EXCEPTION: ",
          JSON.stringify(e)
        );
      }
    }
  } catch (e) {
    console.log("UPDATE QUERY EXCEPTION: ", JSON.stringify(e));
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

const sendRetryJobInError = async () => {
  const date = new Date();
  date.setHours(date.getHours() - 1);

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
                { end_date: { [Op.lt]: date } },
              ],
            },
          ],
        },
      ],
    },
  });

  for (const job of jobs) {
    await sendToPA2026(job, job.json_result, job.status === "PASSED");
  }
};
