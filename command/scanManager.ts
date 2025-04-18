"use strict";

import dotenv from "dotenv";
dotenv.config();

import { dbSM, dbWS } from "../database/connection.js";
import { define as jobDefine } from "../database/models/job.js";
import { Entity, Job } from "../types/models.js";
import { Worker, Job as bullJob } from "bullmq";
import { v4 } from "uuid";
import { entityController } from "../controller/entityController.js";
import { upload } from "../controller/s3Controller.js";
import { spawnSync } from "child_process";

import path, { dirname } from "path";
import { fileURLToPath } from "url";
import Redis from "ioredis";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const __dirname = dirname(fileURLToPath(import.meta.url));

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const __filenameExtension = path.extname(fileURLToPath(import.meta.url));

dbSM
  .authenticate()
  .then(async () => {
    console.log("[SCAN MANAGER]: start");

    const worker: Worker = new Worker("crawler-queue", null, {
      lockDuration: 10000000,
      connection: new Redis.Cluster([
        {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT),
        },
      ]),
      prefix: "{1}",
    });

    const token = v4();
    let job: bullJob;

    while ((job = await worker.getNextJob(token)) !== undefined) {
      try {
        console.log("[SCAN MANAGER] SPAWN START..");
        if (!__filenameExtension) {
          throw new Error("Filename extension not found");
        }

        const command =
          `ulimit -c 0; node --max-old-space-size=92160 --no-warnings --experimental-modules --es-module-specifier-resolution=node --loader ts-node/esm ${__dirname}/scanManagerItem${__filenameExtension} --jobId ` +
          job.data.id;

        console.log("[SCAN MANAGER] EXECUTING: ", command);

        const child = spawnSync(command, {
          shell: true,
        });

        console.log(
          "[SCAN MANAGER] LOG FROM SCAN-MANAGER-ITEM: ",
          child.stdout.toString()
        );
        console.log(
          "[SCAN MANAGER] STATUS FROM SCAN-MANAGER-ITEM: ",
          child.status
        );

        const jobObj: Job | null = await jobDefine(dbSM).findByPk(job.data.id);
        if (!jobObj) {
          throw new Error("Empty job");
        }

        const entity: Entity | null = await new entityController(
          dbWS
        ).retrieveById(jobObj.entity_id);

        if (!entity) {
          throw new Error("Empty entity");
        }

        await entity.update({
          forcedScan: false,
        });

        try {
          const logsLocationUrl = await uploadLogs(
            jobObj.entity_id,
            job.data.id,
            child.stdout.toString()
          );
          console.log("[SCAN MANAGER] LOGS UPLOADED TO: ", logsLocationUrl);
        } catch (err) {
          console.log("[SCAN MANAGER] Error in logs uploading: ", err);
        }

        if (child.status === 0) {
          await job.moveToCompleted("completed", token, false);
        } else {
          await job.moveToFailed(new Error("error"), token);
        }
      } catch (e) {
        console.log(
          "[SCAN MANAGER] - Error in SCAN MANAGER WHILE-LOOP EXCEPTION: ",
          e
        );
      }
    }

    await worker.close();

    console.log("[SCAN MANAGER]: finish");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[SCAN MANAGER] - Error: ", err);
    process.exit(1);
  });

const cleanConsoleOutput = (consoleOutput: string) => {
  return consoleOutput
    .replace("/[32m/g", "")
    .replace("/[0m/g", "")
    .replace("//g", "");
};

const uploadLogs = async (
  entityId: number,
  jobId: string,
  logString: string
): Promise<string> => {
  const cleanedLogString = cleanConsoleOutput(logString);
  return await upload(
    cleanedLogString,
    entityId + "/" + jobId + "/" + "logs.txt"
  );
};
