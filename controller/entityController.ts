"use strict";

import { createBody, updateBody } from "../types/entity.js";
import { define as entityDefine } from "../database/models/entity.js";
import { Sequelize } from "sequelize";
import { jobController } from "./jobController.js";
import { dbWS } from "../database/connection.js";
import { Entity } from "../types/models.js";
import { allowedTypes } from "../database/models/entity.js";

export class entityController {
  db;

  constructor(db: Sequelize) {
    this.db = db;
  }

  async list(
    type: string,
    page,
    limit
  ): Promise<{
    totalElements: number;
    currentPage: number;
    pages: number;
    entities: Entity[];
  }> {
    const returnValues = {
      totalElements: 0,
      currentPage: parseInt(page),
      pages: 0,
      entities: [],
    };

    let queryObj = {};
    if (allowedTypes.includes(type as "school" | "municipality")) {
      queryObj = {
        where: {
          type,
        },
      };
    }

    const totalCount = await entityDefine(this.db).count(queryObj);

    if (parseInt(limit) >= 0) {
      queryObj = {
        ...queryObj,
        offset: parseInt(page) * parseInt(limit),
        limit: parseInt(limit),
      };
    }

    const entities: Entity[] = await entityDefine(this.db).findAll(queryObj);

    returnValues.totalElements = totalCount;
    returnValues.pages =
      parseInt(limit) >= 0 ? Math.ceil(totalCount / parseInt(limit)) : 1;
    returnValues.currentPage = parseInt(page);
    returnValues.entities = entities;

    return returnValues;
  }

  async retrieve(entityExternalId: string): Promise<Entity> {
    return await entityDefine(this.db).findOne({
      where: {
        external_id: entityExternalId,
      },
    });
  }

  async retrieveById(id: number): Promise<Entity> {
    return await entityDefine(this.db).findOne({
      where: {
        id: id,
      },
    });
  }

  async retrieveByPk(entityId: number) {
    return await entityDefine(this.db).findByPk(entityId);
  }

  async create(entityCreateBody: createBody): Promise<Entity> {
    const entity: Entity = await this.retrieve(entityCreateBody.external_id);
    if (entity !== null) {
      throw new Error("Entity already exists for the passed id");
    }

    return await entityDefine(this.db).create({
      external_id: entityCreateBody.external_id,
      url: entityCreateBody.url,
      enable: entityCreateBody.enable,
      type: entityCreateBody.type,
      subtype: entityCreateBody.subtype,
      forcedScan: entityCreateBody.forcedScan,
    });
  }

  async update(entityExternalId: string, entityUpdateBody: updateBody) {
    const entity = await this.retrieve(entityExternalId);
    if (entity === null) {
      throw new Error("Entity does not exists");
    }

    let updateObj = {};

    if ("url" in entityUpdateBody) {
      updateObj = { ...updateObj, ...{ url: entityUpdateBody.url } };
    }

    if ("enable" in entityUpdateBody) {
      updateObj = { ...updateObj, ...{ enable: entityUpdateBody.enable } };
    }

    if ("asseverationJobId" in entityUpdateBody) {
      const result = await new jobController(dbWS).updatePreserve(
        entityExternalId,
        parseInt(entityUpdateBody.asseverationJobId),
        {
          value: true,
          reason: "scansione asseverata",
        }
      );

      if (result) {
        updateObj = {
          ...updateObj,
          ...{ asseverationJobId: entityUpdateBody.asseverationJobId },
        };
      }
    }

    if ("subtype" in entityUpdateBody) {
      updateObj = { ...updateObj, ...{ subtype: entityUpdateBody.subtype } };
    }

    const result = await entity.update(updateObj);

    return result.toJSON();
  }
}
