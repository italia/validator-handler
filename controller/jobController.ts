"use strict";
import dotenv from "dotenv";
dotenv.config();

import { Job } from "../types/models.js";
import { mappedJob, updatePreserveBody } from "../types/job.js";
import { Op, QueryTypes, Sequelize } from "sequelize";
import { entityController } from "./entityController.js";
import { preserveReasons } from "../database/models/job.js";
import { define as jobDefine } from "../database/models/job.js";
import { define as entityDefine } from "../database/models/entity.js";
import { Queue } from "bullmq";
import { preFilterPayload, jsonToSequelizeWhere } from "../utils/utils.js";

export class jobController {
  db: Sequelize;

  constructor(db: Sequelize) {
    this.db = db;
  }

  async getJobFromIdAndEntityId(id: number, entityId: number): Promise<Job> {
    return await jobDefine(this.db).findOne({
      where: {
        id: id,
        entity_id: entityId,
      },
    });
  }

  async getJobFromIdAndExternalEntityId(
    id: number,
    externalId: string,
  ): Promise<Job> {
    return await jobDefine(this.db).findOne({
      where: {
        id: id,
      },
      include: [
        {
          model: entityDefine(this.db),
          attributes: ["external_id"],
          required: true,
          where: {
            external_id: externalId,
          },
        },
      ],
    });
  }
  async list(
    entityExternalId: string,
    dateFrom,
    dateTo,
    page,
    limit,
  ): Promise<{
    totalElements: number;
    currentPage: number;
    pages: number;
    jobs: mappedJob[];
  }> {
    const returnValues = {
      totalElements: 0,
      currentPage: parseInt(page),
      pages: 0,
      jobs: [],
    };

    if ((Boolean(dateFrom) && !dateTo) || (!dateFrom && Boolean(dateTo))) {
      throw new Error("dateFrom and dateTo both must be passed or neither");
    }

    const entityObj = await new entityController(this.db).retrieve(
      entityExternalId,
    );

    let condition = {};
    if (Boolean(dateFrom) && Boolean(dateTo)) {
      condition = {
        where: {
          updatedAt: {
            [Op.between]: [dateFrom, dateTo],
          },
        },
      };
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    const countData: Job[] = await entityObj.getJobs(condition);
    const cont = countData.length;

    let pages = 1;

    if (limit > 0 && page >= 0) {
      pages = Math.ceil(cont / limit);
      const offset = limit * page;
      condition = {
        ...condition,
        ...{
          offset: offset,
          limit: limit,
        },
      };
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore - getJobs(): metodo autogenerato dall'ORM Sequelize dopo l'associazione
    const jobList: Job[] = await entityObj.getJobs(condition);

    const jobElements = [];
    jobList.forEach((job) => {
      const jobElement = job.toJSON();
      jobElements.push({
        id: jobElement.id,
        startAt: jobElement.start_at,
        endAt: jobElement.end_at,
        scanUrl: jobElement.scan_url,
        type: jobElement.type,
        status: jobElement.status,
        s3HTMLUrl: jobElement.s3_html_url,
        s3JSONUrl: jobElement.s3_json_url,
        s3CleanJSONUrl: jobElement.s3_clean_json_result_url,
        jsonResult: jobElement.json_result,
        preserve: jobElement.preserve,
      });
    });

    returnValues.totalElements = cont;
    returnValues.pages = pages;
    returnValues.currentPage = parseInt(page);
    returnValues.jobs = jobElements;

    return returnValues;
  }

  async updatePreserve(
    entityExternalId: string,
    jobId: number,
    updatePreserve: updatePreserveBody,
  ): Promise<Job> {
    const entityObj = await new entityController(this.db).retrieve(
      entityExternalId,
    );

    if (entityObj === null) {
      throw new Error("Entity not found");
    }

    if (!preserveReasons.includes(updatePreserve.reason)) {
      throw new Error("Preserve reason not valid");
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore - getJobs(): metodo autogenerato dall'ORM Sequelize dopo l'associazione
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
      preserve_reason: updatePreserve.reason,
    });
  }

  async cleanJobs(entityId: number): Promise<number[]> {
    const countJobPreserve = await jobDefine(this.db).count({
      where: {
        entity_id: entityId,
        preserve: true,
      },
    });

    const countJobNotPreserve = await jobDefine(this.db).count({
      where: {
        entity_id: entityId,
        preserve: false,
      },
    });

    const countJobToDelete =
      countJobPreserve +
      countJobNotPreserve -
      parseInt(process.env.JOB_AMOUNT_HISTORY);
    if (countJobToDelete <= 0) {
      return [];
    }

    const jobs = await jobDefine(this.db).findAll({
      where: {
        entity_id: entityId,
        preserve: false,
      },
      order: [["updatedAt", "ASC"]],
      limit: countJobToDelete,
    });

    const jobDeleted = [];
    for (const job of jobs) {
      jobDeleted.push(job.id);
      await job.destroy();
    }

    return jobDeleted;
  }

  async manageInProgressJobInError() {
    const jobsUpdated = [];

    try {
      const date = new Date();
      date.setHours(
        date.getHours() - parseInt(process.env.IN_PROGRESS_JOBS_IN_ERROR_HOURS),
      );

      const inProgressJobsInError: Job[] = await jobDefine(this.db).findAll({
        where: {
          status: "IN_PROGRESS",
          start_at: {
            [Op.lt]: date,
          },
        },
      });

      for (const job of inProgressJobsInError) {
        const result = await job.update({
          status: "ERROR",
          preserve: false,
          preserve_reason: null,
        });

        if (result) {
          jobsUpdated.push(result.id);
        }
      }

      return jobsUpdated;
    } catch (e) {
      console.log("EXCEPTION IN MANAGE IN PROGRESS JOBS: ", e.toString());
      return jobsUpdated;
    }
  }

  async managePendingJobs(queue: Queue) {
    const jobsUpdated = [];

    try {
      const date = new Date();
      date.setHours(
        date.getHours() - parseInt(process.env.CHECK_IN_PENDING_JOBS_HOURS),
      );

      const jobInQueue = await queue.getJobs();
      const ids = jobInQueue.map(function (obj) {
        return obj.data.id;
      });

      const inPendingJobs: Job[] = await jobDefine(this.db).findAll({
        where: {
          status: "PENDING",
          id: {
            [Op.notIn]: ids,
          },
          createdAt: {
            [Op.lt]: date,
          },
        },
      });

      const returnValues = [];
      for (const job of inPendingJobs) {
        await queue.add("job", { id: job.id });
        returnValues.push(job.id);
      }

      return returnValues;
    } catch (e) {
      console.log("EXCEPTION IN MANAGE PENDING JOBS: ", e.toString());
      return jobsUpdated;
    }
  }

  async entityHasJob(entityId: number) {
    const entityJobs: Job[] = await jobDefine(this.db).findAll({
      where: {
        entity_id: entityId,
      },
    });
    return entityJobs.length > 0;
  }

  async query(
    filters,
    page: string,
    limit: string,
    countOnly: boolean,
  ): Promise<
    | {
        totalElements: number;
        currentPage: number;
        pages: number;
        jobs: mappedJob[];
      }
    | { count: number }
  > {
    const returnValues = {
      totalElements: 0,
      currentPage: parseInt(page),
      pages: 0,
      jobs: [],
    };

    const includeEntity = {
      model: entityDefine(this.db),
      required: true,
    };

    if (filters.and && filters.and.length && filters.and.length > 0) {
      filters.and.forEach((el, index) => {
        if (el.external_id) {
          // eslint-disable-next-line
          // @ts-ignore
          includeEntity.where = {
            external_id: el.external_id,
          };
          filters.and.splice(index, 1);
        }
      });
    }

    if (filters.external_id) {
      // eslint-disable-next-line
      // @ts-ignore
      includeEntity.where = {
        external_id: filters.external_id,
      };

      delete filters.external_id;
    }

    preFilterPayload(filters);
    const sequelizeWhere = jsonToSequelizeWhere(filters);

    const totalCount = await jobDefine(this.db).count({
      where: sequelizeWhere,
      include: [includeEntity],
    });

    if (countOnly) return { count: totalCount };

    // eslint-disable-next-line
    // @ts-ignore
    includeEntity.attributes = ["external_id"];

    let queryObj = {};
    if (parseInt(limit) >= 0) {
      queryObj = {
        where: sequelizeWhere,
        offset: parseInt(page) * parseInt(limit),
        limit: parseInt(limit),
        include: [includeEntity],
      };
    } else {
      queryObj = {
        where: sequelizeWhere,
        include: [includeEntity],
      };
    }

    const jobs: Job[] = await jobDefine(this.db).findAll(queryObj);

    const returnJobs = [];
    jobs.forEach((item) => {
      // eslint-disable-next-line
      // @ts-ignore
      const { Entity, ...job } = item.dataValues;
      returnJobs.push({
        ...job,
        external_id: Entity.external_id ?? "",
      });
    });

    returnValues.totalElements = totalCount;
    returnValues.pages =
      parseInt(limit) >= 0 ? Math.ceil(totalCount / parseInt(limit)) : 1;
    returnValues.currentPage = parseInt(page);
    returnValues.jobs = returnJobs;

    return returnValues;
  }

  async countByStatus(type, status, dateFrom, dateTo) {
    return await jobDefine(this.db).count({
      where: {
        status,
        type,
        start_at: { [Op.gte]: dateFrom },
        end_at: { [Op.lte]: dateTo },
      },
    });
  }

  async moreFrequentAuditByScore(type: string, score = 1, dateFrom, dateTo) {
    let queryResults = null;

    if (!type) return [];

    let querySql = "";
    if (type == "municipality")
      querySql = `WITH municipality_extracted_scores AS (
        SELECT 
            audit_key,
            (audit_value)::float AS score
        FROM "Jobs",
        jsonb_each(json_result->'cittadino-informato'->'groups'->'normativa'->'audits') AS groups(audit_key, audit_value)
        WHERE type = :type AND start_at >= :dateFrom AND end_at <= :dateTo

        UNION ALL

        SELECT 
            audit_key,
            (audit_value)::float AS score
        FROM "Jobs",
        jsonb_each(json_result->'cittadino-informato'->'groups'->'sicurezza'->'audits') AS groups(audit_key, audit_value)
        WHERE type = :type AND start_at >= :dateFrom AND end_at <= :dateTo

        UNION ALL

        SELECT 
          audit_key,
          (audit_value)::float AS score
        FROM "Jobs",
        jsonb_each(json_result->'cittadino-informato'->'groups'->'funzionalita'->'audits') AS groups(audit_key, audit_value)
        WHERE type = :type AND start_at >= :dateFrom AND end_at <= :dateTo
        
        UNION ALL

        SELECT 
          audit_key,
          (audit_value)::float AS score
        FROM "Jobs",
        jsonb_each(json_result->'cittadino-informato'->'groups'->'esperienza-utente'->'audits') AS groups(audit_key, audit_value)
        WHERE type = :type AND start_at >= :dateFrom AND end_at <= :dateTo

        UNION ALL

        SELECT 
          audit_key,
          (audit_value)::float AS score
        FROM "Jobs",
        jsonb_each(json_result->'raccomandazioni'->'audits') AS groups(audit_key, audit_value)
        WHERE type = :type AND start_at >= :dateFrom AND end_at <= :dateTo 
      )
      SELECT 
          audit_key,
          score,
          COUNT(*)::int AS count
      FROM municipality_extracted_scores
      WHERE score = :score
      GROUP BY audit_key,score
      ORDER BY count DESC`;

    if (type == "school")
      querySql = `WITH school_extracted_scores AS (
        SELECT 
            audit_key,
            (audit_value)::float AS score
        FROM "Jobs",
        jsonb_each(json_result->'criteri-conformita'->'groups'->'esperienza-utente'->'audits') AS groups(audit_key, audit_value)
        WHERE type = :type AND start_at >= :dateFrom AND end_at <= :dateTo

        UNION ALL

        SELECT 
            audit_key,
            (audit_value)::float AS score
        FROM "Jobs",
        jsonb_each(json_result->'criteri-conformita'->'groups'->'normativa'->'audits') AS groups(audit_key, audit_value)
        WHERE type = :type AND start_at >= :dateFrom AND end_at <= :dateTo

        UNION ALL

        SELECT 
            audit_key,
            (audit_value)::float AS score
        FROM "Jobs",
        jsonb_each(json_result->'criteri-conformita'->'groups'->'sicurezza'->'audits') AS groups(audit_key, audit_value)
        WHERE type = :type AND start_at >= :dateFrom AND end_at <= :dateTo

        UNION ALL

        SELECT 
          audit_key,
          (audit_value)::float AS score
        FROM "Jobs",
        jsonb_each(json_result->'raccomandazioni'->'audits') AS groups(audit_key, audit_value)
        WHERE type = :type AND start_at >= :dateFrom AND end_at <= :dateTo 
    )
    SELECT 
        audit_key,
        score,
        COUNT(*)::int AS count
    FROM school_extracted_scores
    WHERE score = :score
    GROUP BY audit_key,score
    ORDER BY count DESC`;

    try {
      queryResults = await this.db.query(querySql, {
        type: QueryTypes.SELECT,
        replacements: { score, type, dateFrom, dateTo },
      });
    } catch (e) {
      console.log(e);
      queryResults = e.message;
    }

    return queryResults;
  }
}
