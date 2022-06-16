"use strict";
import { logger } from "../utils/logger";
import { define as jobDefine } from "../database/models/job";
import { dbRoot } from "../database/connection";
import { Op } from "sequelize";

const run = async () => {
  logger.info("[Cron]: Task run");

  //TODO: definire intervallo di tempo di cancellazione
  const firstTodayDate = new Date();
  const secondTodayDate = new Date();

  firstTodayDate.setDate(firstTodayDate.getDate() - 20);
  const isoStartDate = firstTodayDate.toISOString();
  console.log("START DATE", isoStartDate);

  secondTodayDate.setDate(secondTodayDate.getDate() - 18);
  const isoEndDate = secondTodayDate.toISOString();
  console.log("END DATE", isoEndDate);

  //TODO: stabilire se serve logging di quelli cancellati
  const jobs = await jobDefine(dbRoot).findAll({
    where: {
      updatedAt: {
        [Op.between]: [isoStartDate, isoEndDate],
      },
    },
  });

  //TODO: implementare await jobDefine(dbRoot).destroy(...) per cancellazione record

  console.log("JOBS", jobs);
};

export { run };
