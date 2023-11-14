"use strict";

import dotenv from "dotenv";
dotenv.config();

import { dbQM } from "../database/connection";

import Redis from "ioredis";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Queue } from "bullmq";
import { preserveReasons } from "../database/models/job";
import { jobController } from "../controller/jobController";
import {
  getFirstTimeEntityToBeAnalyzed,
  getRescanEntityToBeAnalyzed,
  getRescanEntityAsseveratedToBeAnalyzed,
  generateJobs,
  getForcedRescanEntitiesToBeAnalyzed,
  getFirstTimeForcedEntityToBeAnalyzed,
  manageEntitiesInErrorJobs,
} from "../controller/queueManagerController";

const command = yargs(hideBin(process.argv))
  .usage(
    "Usage: " +
      "--maxItems <maxItems> " +
      "--passedOlderThanDays <passedOlderThanDays> " +
      "--failedOlderThanDays <failedOlderThanDays> " +
      "--manualScanLogic"
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
  })
  .option("manualScanLogic", {
    describe:
      "Flag per permettere solo alle entity flaggate come 'da scansionare' di entrare in coda di scansione",
    type: "bool",
    demandOption: true,
    default: false,
  }).argv;

dbQM
  .authenticate()
  .then(async () => {
    console.log("[QUEUE MANAGER]: start");

    const crawlerQueue: Queue = new Queue("crawler-queue", {
      connection: new Redis.Cluster([
        {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT),
        },
      ]),
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
      prefix: "{1}",
    });

    const inProgressJobInError = await new jobController(
      dbQM
    ).manageInProgressJobInError();
    console.log(
      'MANAGE IN PROGRESS JOB IN "ERROR": ',
      inProgressJobInError.length
    );

    const inPendingJob = await new jobController(dbQM).managePendingJobs(
      crawlerQueue
    );
    console.log('MANAGE JOB IN "PENDING": ', inPendingJob.length);

    const manualScanLogic = command.manualScanLogic;

    let entityInErrorJob = [];
    if (manualScanLogic) {
      entityInErrorJob = await manageEntitiesInErrorJobs();
      console.log(
        'MANAGE ENTITY WITH LAST JOB IN "ERROR": ',
        entityInErrorJob.length
      );
    }

    let gapLimit: number = parseInt(command.maxItems);

    let firstTimeEntityToBeAnalyzed = [];
    if (command.passedOlderThanDays > 0 || command.failedOlderThanDays) {
      firstTimeEntityToBeAnalyzed = await getFirstTimeEntityToBeAnalyzed(
        gapLimit
      );

      gapLimit = gapLimit - firstTimeEntityToBeAnalyzed.length;
    }

    let firstTimeForcedEntityToBeAnalyzed = [];
    if (gapLimit > 0 && manualScanLogic) {
      firstTimeForcedEntityToBeAnalyzed =
        await getFirstTimeForcedEntityToBeAnalyzed(gapLimit);

      gapLimit = gapLimit - firstTimeForcedEntityToBeAnalyzed.length;
    }

    let forcedRescanEntitiesToBeAnalyzed = [];
    if (gapLimit > 0 && manualScanLogic) {
      forcedRescanEntitiesToBeAnalyzed =
        await getForcedRescanEntitiesToBeAnalyzed(gapLimit);

      gapLimit = gapLimit - forcedRescanEntitiesToBeAnalyzed.length;
    }

    let rescanEntityToBeAnalyzed = [];
    if (
      gapLimit > 0 &&
      (command.passedOlderThanDays > 0 || command.failedOlderThanDays)
    ) {
      rescanEntityToBeAnalyzed = await getRescanEntityToBeAnalyzed(
        command.passedOlderThanDays,
        command.failedOlderThanDays,
        gapLimit
      );

      gapLimit = gapLimit - rescanEntityToBeAnalyzed.length;
    }

    let rescanEntityAsseveratedToBeAnalyzed = [];
    if (gapLimit > 0 && command.asservationOlderThanDays > 0) {
      rescanEntityAsseveratedToBeAnalyzed =
        await getRescanEntityAsseveratedToBeAnalyzed(
          command.asservationOlderThanDays,
          gapLimit
        );
    }

    if (
      firstTimeEntityToBeAnalyzed.length > 0 ||
      firstTimeForcedEntityToBeAnalyzed.length > 0
    ) {
      await generateJobs(
        [...firstTimeEntityToBeAnalyzed, ...firstTimeForcedEntityToBeAnalyzed],
        crawlerQueue,
        true,
        preserveReasons[0]
      );
    }

    rescanEntityToBeAnalyzed = rescanEntityToBeAnalyzed.filter(
      (elem) => !firstTimeEntityToBeAnalyzed.find(({ id }) => elem.id === id)
    );

    rescanEntityAsseveratedToBeAnalyzed =
      rescanEntityAsseveratedToBeAnalyzed.filter(
        (elem) => !firstTimeEntityToBeAnalyzed.find(({ id }) => elem.id === id)
      );

    if (
      rescanEntityToBeAnalyzed.length > 0 ||
      rescanEntityAsseveratedToBeAnalyzed.length > 0 ||
      forcedRescanEntitiesToBeAnalyzed.length > 0 ||
      entityInErrorJob.length > 0
    ) {
      await generateJobs(
        [
          ...rescanEntityToBeAnalyzed,
          ...rescanEntityAsseveratedToBeAnalyzed,
          ...forcedRescanEntitiesToBeAnalyzed,
          ...entityInErrorJob,
        ],
        crawlerQueue,
        false
      );
    }

    console.log("FIRST TIME ENTITIES", firstTimeEntityToBeAnalyzed.length);

    console.log(
      "FIRST TIME FORCED ENTITIES",
      firstTimeForcedEntityToBeAnalyzed.length
    );

    console.log(
      "FORCED RESCAN ENTITIES",
      forcedRescanEntitiesToBeAnalyzed.length
    );
    console.log(
      "RESCAN ENTITIES TO BE ANALYZED",
      rescanEntityToBeAnalyzed.length
    );
    console.log(
      "RESCAN ASSEVERATED ENTITIES",
      rescanEntityAsseveratedToBeAnalyzed.length
    );

    const counts = await crawlerQueue.getJobCounts(
      "wait",
      "completed",
      "failed"
    );
    console.log("QUEUE STATUS", counts);

    console.log("[QUEUE MANAGER]: finish");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error: ", err);
    process.exit(1);
  });
