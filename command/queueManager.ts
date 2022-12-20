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
} from "../controller/queueManagerController";

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
    console.log("[QUEUE MANAGER]: start");

    //TODO: re-integrare Redis-Cluster
    const crawlerQueue: Queue = new Queue("crawler-queue", {
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
      },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    });

    const inProgressJobInError = await new jobController(
      dbQM
    ).manageInProgressJobInError();
    console.log('MANAGE JOB IN "ERROR": ', inProgressJobInError.length);

    const inPendingJob = await new jobController(dbQM).managePendingJobs(
      crawlerQueue
    );
    console.log('MANAGE JOB IN "PENDING": ', inPendingJob.length);

    const maxItems: number = parseInt(command.maxItems);

    const firstTimeEntityToBeAnalyzed = await getFirstTimeEntityToBeAnalyzed(
      maxItems
    );

    let rescanEntityToBeAnalyzed = [];
    let gapLimit: number = maxItems - firstTimeEntityToBeAnalyzed.length;
    if (gapLimit > 0) {
      rescanEntityToBeAnalyzed = await getRescanEntityToBeAnalyzed(
        command.passedOlderThanDays,
        command.failedOlderThanDays,
        gapLimit
      );
    }

    let rescanEntityAsseveratedToBeAnalyzed = [];
    gapLimit = gapLimit - rescanEntityToBeAnalyzed.length;
    if (gapLimit > 0) {
      rescanEntityAsseveratedToBeAnalyzed =
        await getRescanEntityAsseveratedToBeAnalyzed(
          command.asservationOlderThanDays,
          gapLimit
        );
    }

    if (firstTimeEntityToBeAnalyzed.length > 0) {
      await generateJobs(
        firstTimeEntityToBeAnalyzed,
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
      rescanEntityAsseveratedToBeAnalyzed.length > 0
    ) {
      await generateJobs(
        [...rescanEntityToBeAnalyzed, ...rescanEntityAsseveratedToBeAnalyzed],
        crawlerQueue,
        false
      );
    }

    console.log("FIRST TIME ENTITIES", firstTimeEntityToBeAnalyzed.length);
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
