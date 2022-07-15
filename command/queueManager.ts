"use strict";

import dotenv from "dotenv";
dotenv.config();

import { dbQM } from "../database/connection";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { QueryTypes } from "sequelize";
import dateFormat from "dateformat";
import { define as entityDefine } from "../database/models/entity";
import { define as jobDefine } from "../database/models/job";
import { Queue } from "bullmq";
import { Entity } from "../types/models";
import { preserveReasons } from "../database/models/job";

const command = yargs(hideBin(process.argv))
  .usage(
    "Usage: --maxItems <maxItems> --passedOlderThanDays <passedOlderThanDays> --failedOlderThanDays <failedOlderThanDays>"
  )
  .option("maxItems", {
    describe: "Numero massimo di entity da analizzare",
    type: "integer",
    demandOption: true,
    default: 100,
  })
  .option("passedOlderThanDays", {
    describe:
      "Giorni dopo i quali le entity con Job che ha fornito risultato PASSED vengono riaccodate per essere scansionate",
    type: "integer",
    demandOption: true,
    default: 28,
  })
  .option("failedOlderThanDays", {
    describe:
      "Giorni dopo i quali le entity con Job che ha fornito risultato FAILED vengono riaccodate per essere scansionate",
    type: "integer",
    demandOption: true,
    default: 14,
  })
  .option("asservationOlderThanDays", {
    describe:
      "Giorni dopo i quali le entity asseverate vengono riaccodate per essere scansionate",
    type: "integer",
    demandOption: true,
    default: 28,
  }).argv;

dbQM
  .authenticate()
  .then(async () => {
    const crawlerQueue: Queue = new Queue("crawler-queue", {
      connection: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
      },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    });

    const passedOlderThanDays: number = parseInt(command.passedOlderThanDays);
    const failedOlderThanDays: number = parseInt(command.failedOlderThanDays);
    const asservationOlderThanDays: number = parseInt(
      command.asservationOlderThanDays
    );
    const maxItems: number = parseInt(command.maxItems);

    const firstTimeEntityToBeAnalyzed = await getFirstTimeEntityToBeAnalyzed(
      maxItems
    );

    let rescanEntityToBeAnalyzed = [];
    let gapLimit: number = maxItems - firstTimeEntityToBeAnalyzed.length;
    if (gapLimit > 0) {
      rescanEntityToBeAnalyzed = await getRescanEntityToBeAnalyzed(
        passedOlderThanDays,
        failedOlderThanDays,
        gapLimit
      );
    }

    let rescanEntityAsseveratedToBeAnalyzed = [];
    gapLimit = gapLimit - rescanEntityToBeAnalyzed.length;
    if (gapLimit > 0) {
      rescanEntityAsseveratedToBeAnalyzed =
        await getRescanEntityAsseveratedToBeAnalyzed(
          asservationOlderThanDays,
          gapLimit
        );
    }

    console.log(
      "TOTAL ENTITIES",
      [
        ...firstTimeEntityToBeAnalyzed,
        ...rescanEntityToBeAnalyzed,
        ...rescanEntityAsseveratedToBeAnalyzed,
      ].length
    );
    console.log("FIRST TIME ENTITIES", firstTimeEntityToBeAnalyzed.length);
    console.log("RESCAN ENTITIES", rescanEntityToBeAnalyzed.length);
    console.log(
      "RESCAN ASSEVERATED ENTITIES",
      rescanEntityAsseveratedToBeAnalyzed.length
    );

    if (firstTimeEntityToBeAnalyzed.length > 0) {
      await generateJobs(
        firstTimeEntityToBeAnalyzed,
        crawlerQueue,
        true,
        preserveReasons[0]
      );
    }

    if (rescanEntityToBeAnalyzed.length > 0) {
      await generateJobs(rescanEntityToBeAnalyzed, crawlerQueue, false);
    }

    if (rescanEntityAsseveratedToBeAnalyzed.length > 0) {
      await generateJobs(
        rescanEntityAsseveratedToBeAnalyzed,
        crawlerQueue,
        false
      );
    }

    const counts = await crawlerQueue.getJobCounts(
      "wait",
      "completed",
      "failed"
    );
    console.log("QUEUE STATUS", counts);

    process.exit(0);
  })
  .catch((err) => {
    console.error("Error: ", err);
    process.exit(1);
  });

const getFirstTimeEntityToBeAnalyzed = async (limit: number) => {
  let returnValues = [];

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
};

const getRescanEntityToBeAnalyzed = async (
  passedOlderThanDays: number,
  failedOlderThanDays: number,
  limit: number
) => {
  let returnValues = [];

  const passedDate = new Date();
  passedDate.setDate(passedDate.getDate() + passedOlderThanDays);

  const failedDate = new Date();
  failedDate.setDate(failedDate.getDate() + failedOlderThanDays);

  const rescanEntityToBeAnalyzed = await dbQM.query(
    `SELECT E.id\
                 FROM "Entities" AS E\
                 JOIN "Jobs" J1 ON (E.id = J1.entity_id)\
                 LEFT OUTER JOIN "Jobs" J2 ON (E.id = J2.entity_id AND\
                 (J1."updatedAt" < J2."updatedAt" OR (J1."updatedAt" = J2."updatedAt" AND J1.id < J2.id)))\
                 WHERE E.enable = TRUE AND E."asseverationJobId" IS NULL AND J2.id IS NULL 
                    AND (J1.status='ERROR' 
                        OR (J1.status = 'PASSED' AND DATE(J1."updatedAt") > DATE(:passedDate))\
                        OR (J1.status = 'FAILED' AND DATE(J1."updatedAt") > DATE(:failedDate))\
                    )\
                 ORDER BY J1.status DESC, J1."updatedAt" LIMIT :limit`,
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
};

const getRescanEntityAsseveratedToBeAnalyzed = async (
  jobOlderThanDays: number,
  limit: number
) => {
  let returnValues = [];

  const filterDate = new Date();
  filterDate.setDate(filterDate.getDate() + jobOlderThanDays);

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
