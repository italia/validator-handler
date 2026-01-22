"use strict";

import dotenv from "dotenv";
dotenv.config();

import { dbQM } from "../database/connection.js";

import Redis from "ioredis";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Queue } from "bullmq";
import { preserveReasons } from "../database/models/job.js";
import { jobController } from "../controller/jobController.js";
import {
  generateJobs,
  getForcedRescanEntitiesToBeAnalyzed,
  getFirstTimeForcedEntityToBeAnalyzed,
  manageEntitiesInErrorJobs,
} from "../controller/queueManagerController.js";

const command = yargs(hideBin(process.argv)).usage(
  "Usage: " + "--maxItems <maxItems> ",
).argv;

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
      dbQM,
    ).manageInProgressJobInError();
    console.log(
      'MANAGE IN PROGRESS JOB IN "ERROR": ',
      inProgressJobInError.length,
    );

    const inPendingJob = await new jobController(dbQM).managePendingJobs(
      crawlerQueue,
    );
    console.log('MANAGE JOB IN "PENDING": ', inPendingJob.length);

    let entityInErrorJob = [];
    entityInErrorJob = await manageEntitiesInErrorJobs();
    console.log(
      'MANAGE ENTITY WITH LAST JOB IN "ERROR": ',
      entityInErrorJob.length,
    );

    let gapLimit: number = parseInt(command.maxItems);

    let firstTimeForcedEntityToBeAnalyzed = [];
    if (gapLimit > 0) {
      firstTimeForcedEntityToBeAnalyzed =
        await getFirstTimeForcedEntityToBeAnalyzed(gapLimit);

      gapLimit = gapLimit - firstTimeForcedEntityToBeAnalyzed.length;
    }

    let forcedRescanEntitiesToBeAnalyzed = [];
    if (gapLimit > 0) {
      forcedRescanEntitiesToBeAnalyzed =
        await getForcedRescanEntitiesToBeAnalyzed(gapLimit);

      gapLimit = gapLimit - forcedRescanEntitiesToBeAnalyzed.length;
    }

    if (firstTimeForcedEntityToBeAnalyzed.length > 0) {
      await generateJobs(
        [...firstTimeForcedEntityToBeAnalyzed],
        crawlerQueue,
        true,
        preserveReasons[0],
      );
    }

    forcedRescanEntitiesToBeAnalyzed = forcedRescanEntitiesToBeAnalyzed.filter(
      (elem) =>
        !firstTimeForcedEntityToBeAnalyzed.find(({ id }) => elem.id === id),
    );

    if (
      forcedRescanEntitiesToBeAnalyzed.length > 0 ||
      entityInErrorJob.length > 0
    ) {
      await generateJobs(
        [...forcedRescanEntitiesToBeAnalyzed, ...entityInErrorJob],
        crawlerQueue,
        false,
      );
    }

    console.log(
      "FIRST TIME FORCED ENTITIES",
      firstTimeForcedEntityToBeAnalyzed.length,
    );

    console.log(
      "FORCED RESCAN ENTITIES",
      forcedRescanEntitiesToBeAnalyzed.length,
    );

    const counts = await crawlerQueue.getJobCounts(
      "wait",
      "completed",
      "failed",
    );
    console.log("QUEUE STATUS", counts);

    console.log("[QUEUE MANAGER]: finish");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error: ", err);
    process.exit(1);
  });
