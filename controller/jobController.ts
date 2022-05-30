"use strict";

import { Entity } from "../types/models";
import { Job } from "../types/models";
import { mappedJob, updatePreserveBody } from "../types/job";
import { Model, Op } from "sequelize";
import { retrieve as entityRetrieve } from "./entityController";

const list = async (
  entityExternalId: string,
  dateFrom,
  dateTo
): Promise<mappedJob[]> => {
  const returnValues = [];

  if ((Boolean(dateFrom) && !dateTo) || (!dateFrom && Boolean(dateTo))) {
    throw new Error("dateFrom and dateTo both must be passed or neither");
  }

  const entityObj: Model<Entity, Entity> = await entityRetrieve(
    entityExternalId
  );

  if (entityObj === null) {
    return returnValues;
  }

  let betweenCondition = {};
  if (Boolean(dateFrom) && Boolean(dateTo)) {
    betweenCondition = {
      where: {
        updatedAt: {
          [Op.between]: [dateFrom, dateTo],
        },
      },
    };
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore - getJobs(): metodo autogenerato dall'ORM Sequelize dopo l'associazione
  const jobList: Job[] = await entityObj.getJobs(betweenCondition);

  jobList.forEach((job) => {
    const jobElement = job.toJSON();
    returnValues.push({
      id: jobElement.id,
      startAt: jobElement.start_at,
      endAt: jobElement.end_at,
      scanUrl: jobElement.scan_url,
      type: jobElement.type,
      status: jobElement.status,
      s3HTMLUrl: jobElement.s3_html_url,
      s3JSONUrl: jobElement.s3_json_url,
      jsonResult: jobElement.json_result,
      preserve: jobElement.preserve,
    });
  });

  return returnValues;
};

const updatePreserve = async (
  entityExternalId: string,
  jobId: number,
  updatePreserve: updatePreserveBody
): Promise<Job> => {
  const entityObj: Model<Entity, Entity> = await entityRetrieve(
    entityExternalId
  );

  if (entityObj === null) {
    throw new Error("Entity not found");
  }

  //@ts-ignore
  const jobObjs: Job[] = await entityObj.getJobs({
    where: {
      id: jobId,
    },
  });

  if (jobObjs.length > 1) {
    throw new Error("Multiple job found for the passed ids");
  }

  if (jobObjs.length <= 0) {
    throw new Error("Job not found");
  }

  return await jobObjs[0].update({
    preserve: updatePreserve.value,
  });
};

export { list, updatePreserve };
