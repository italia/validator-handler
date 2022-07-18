import {dbQM} from "../database/connection";
import {QueryTypes} from "sequelize";
import {Entity} from "../types/models";
import {define as entityDefine} from "../database/models/entity";
import {define as jobDefine} from "../database/models/job";
import dateFormat from "dateformat";

const getFirstTimeEntityToBeAnalyzed = async (limit: number) => {
  let returnValues = [];

  try {
    const firstTimeEntityToBeAnalyzed = await dbQM.query(
      'SELECT E.id FROM "Entities" as E LEFT JOIN "Jobs" as J ON E.id = J.entity_id WHERE J.id IS NULL AND E.enable = TRUE LIMIT :limit',
      {
        replacements: { limit: limit },
        type: QueryTypes.RAW,
      }
    );

    if (firstTimeEntityToBeAnalyzed[0].length > 0) {
      returnValues = firstTimeEntityToBeAnalyzed[0];
    }

    return returnValues;
  } catch (e) {
    return returnValues;
  }
};

const getRescanEntityToBeAnalyzed = async (
  passedOlderThanDaysParam: string,
  failedOlderThanDaysParam: string,
  limit: number
) => {
  let returnValues = [];

  try {
    let passedOlderThanDays: number = parseInt(passedOlderThanDaysParam);
    let failedOlderThanDays: number = parseInt(failedOlderThanDaysParam);

    const passedDate = new Date();
    passedDate.setDate(passedDate.getDate() - passedOlderThanDays);

    const failedDate = new Date();
    failedDate.setDate(failedDate.getDate() - failedOlderThanDays);



    const rescanEntityToBeAnalyzed = await dbQM.query(
      `SELECT E.id as "ENTITY_ID", J.id as "jobID", J.status as "STATUS", J.end_at as "DATE"
           FROM "Entities" as E JOIN "Jobs" AS J on E.id = J.entity_id
           WHERE E.enable = TRUE AND E."asseverationJobId" IS NULL AND
              (
                  (J.status = 'ERROR') OR
                  (J.status = 'PASSED' AND DATE(J."end_at") < DATE(:passedDate) OR
                  (J.status = 'FAILED' AND DATE(J."end_at") < DATE(:failedDate)
              )
           AND J.id = (
             SELECT max(J2.id)
             FROM "Entities" as E2 JOIN "Jobs" J2 ON E2.id = J2.entity_id
             WHERE E.id = J2.entity_id
            )
           LIMIT :limit`,
      {
        replacements: {
          limit: limit,
          passedDate: dateFormat(passedDate, "yyyy-mm-dd"),
          failedDate: dateFormat(failedDate, "yyyy-mm-dd"),
        },
        type: QueryTypes.RAW,
      }
    );

    if (rescanEntityToBeAnalyzed[0].length > 0) {
      returnValues = rescanEntityToBeAnalyzed[0];
    }

    return returnValues;
  } catch (e) {
    return returnValues
  }
};

const getRescanEntityAsseveratedToBeAnalyzed = async (
  jobOlderThanDaysParam: string,
  limit: number
) => {
  let returnValues = [];

  try {
    let asservationOlderThanDays: number = parseInt(
      jobOlderThanDaysParam
    );

    const filterDate = new Date();
    filterDate.setDate(filterDate.getDate() + asservationOlderThanDays);

    const rescanEntityToBeAnalyzed = await dbQM.query(
      `SELECT E.id\
                 FROM "Entities" AS E\
                 JOIN "Jobs" J1 ON (E.id = J1.entity_id)\
                 WHERE E.enable = TRUE AND E."asseverationJobId" IS NOT NULL
                    AND DATE(J1."updatedAt") > DATE(:filterDate)
                 ORDER BY J1.status DESC, J1."updatedAt" LIMIT :limit`,
      {
        replacements: {
          limit: limit,
          filterDate: dateFormat(filterDate, "yyyy-mm-dd"),
        },
        type: QueryTypes.RAW,
      }
    );

    if (rescanEntityToBeAnalyzed[0].length > 0) {
      returnValues = rescanEntityToBeAnalyzed[0];
    }

    return returnValues;
  } catch (e) {
    return returnValues
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
      };

      //TODO: Push a PA2026
      //TODO: Quelli che hanno la reason "prima scansione" sono quelli a cui mando i dati della prima scansione e scansione N
      //TODO: Quelli 1 e N sono popolati con gli stessi valori
      if (preserve) {
        createObj.preserve = true;
        createObj.preserve_reason = preserve_reason;
      }

      //TODO: se non sono in una prima scansione mandare solo i campi N

      const jobObj = await jobDefine(dbQM, false).create(createObj);
      const parsedJob = jobObj.toJSON();

      await crawlerQueue.add("job", { id: parsedJob.id });
    } catch (e) {
      console.log(e);
    }
  }
};

export { getFirstTimeEntityToBeAnalyzed, getRescanEntityToBeAnalyzed, getRescanEntityAsseveratedToBeAnalyzed, generateJobs }