import { dbQM, dbWS } from "../database/connection.js";
import { QueryTypes } from "sequelize";
import { Entity } from "../types/models.js";
import { define as entityDefine } from "../database/models/entity.js";
import { define as jobDefine } from "../database/models/job.js";
import { entityController } from "./entityController.js";
import { callPatch } from "./PA2026/integrationController.js";

const manageEntitiesInErrorJobs = async () => {
  const returnValues = [];

  try {
    const querySql = `SELECT J."entity_id"
            FROM "Jobs" as J
            WHERE J.status = 'ERROR'
            AND J.id IN (
                SELECT MAX(J2.id)
                FROM "Jobs" as J2
                GROUP BY J2."entity_id"
            )
            `;

    const inErrorEntities = await dbQM.query(querySql, {
      type: QueryTypes.RAW,
    });

    for (let i = 0; i < inErrorEntities[0].length; i++) {
      const entity: Entity | null = await new entityController(
        dbWS
      ).retrieveById(inErrorEntities[0][i]["entity_id"]);

      if (!entity) {
        continue;
      }

      try {
        await callPatch(
          {
            Da_Scansionare_Data_Scansione__c: new Date().getTime(),
          },
          process.env.PA2026_UPDATE_RECORDS_PATH.replace(
            "{external_entity_id}",
            entity.external_id
          )
        );
      } catch (e) {
        console.log("FOR: ENTITY IN ERROR JOBS: ", e.toString());
        continue;
      }

      returnValues.push(entity);
    }

    return returnValues;
  } catch (e) {
    console.log("ERROR: MANAGE IN ERROR JOB");
    return returnValues;
  }
};

const getFirstTimeForcedEntityToBeAnalyzed = async (limit: number) => {
  let returnValues = [];

  try {
    const querySql = `SELECT E.id
            FROM "Entities" as E
            WHERE 0 = (
                SELECT count(*)
                FROM "Jobs" as J
                WHERE J.entity_id = E.id
                AND J.status != 'ERROR'
            )
            AND E."forcedScan" = TRUE
            AND E.enable = TRUE
            LIMIT :limit
            `;

    const firstTimeEntityToBeAnalyzed = await dbQM.query(querySql, {
      replacements: { limit: limit },
      type: QueryTypes.RAW,
    });

    if (firstTimeEntityToBeAnalyzed[0].length > 0) {
      returnValues = firstTimeEntityToBeAnalyzed[0];
    }

    return returnValues;
  } catch (e) {
    return returnValues;
  }
};

const getForcedRescanEntitiesToBeAnalyzed = async (limit: number) => {
  let returnValues = [];

  try {
    const querySql = `SELECT E.id
            FROM "Entities" as E
            WHERE 0 < (
                SELECT count(*)
                FROM "Jobs" as J
                WHERE J.entity_id = E.id 
                AND J.status != 'ERROR'
            )
            AND
            0 = (
                SELECT count(*)
                FROM "Jobs" as J
                WHERE J.entity_id = E.id 
                AND 
                (
                  J.status = 'PENDING' OR
                  J.status = 'IN_PROGRESS'
                )
            )
            AND E."forcedScan" = TRUE
            AND E.enable = TRUE
            LIMIT :limit`;

    const forcedEntityToBeRescanned = await dbQM.query(querySql, {
      replacements: { limit: limit },
      type: QueryTypes.RAW,
    });

    if (forcedEntityToBeRescanned[0].length > 0) {
      returnValues = forcedEntityToBeRescanned[0];
    }

    return returnValues;
  } catch (e) {
    return returnValues;
  }
};

const generateJobs = async (
  entities,
  crawlerQueue,
  preserve = false,
  preserve_reason = null
): Promise<void> => {
  for (const entity of entities) {
    try {
      const entityObj: Entity = await entityDefine(dbQM).findByPk(entity.id);
      if (entityObj === null) {
        continue;
      }

      const entityParse = entityObj.toJSON();

      const createObj = {
        entity_id: entityParse.id,
        start_at: null,
        end_at: null,
        scan_url: entityParse.url,
        type: entityParse.type,
        status: "PENDING",
        s3_html_url: null,
        s3_json_url: null,
        json_result: null,
        preserve: false,
        preserve_reason: null,
        data_sent_status: null,
      };

      if (preserve) {
        createObj.preserve = true;
        createObj.preserve_reason = preserve_reason;
      }

      const jobObj = await jobDefine(dbQM, false).create(createObj);
      const parsedJob = jobObj.toJSON();

      await crawlerQueue.add("job", { id: parsedJob.id });
    } catch (e) {
      console.log("QUEUE MANAGER EXCEPTION: ", e.toString());
    }
  }
};

export {
  manageEntitiesInErrorJobs,
  getFirstTimeForcedEntityToBeAnalyzed,
  getForcedRescanEntitiesToBeAnalyzed,
  generateJobs,
};
