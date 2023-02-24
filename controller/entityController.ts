"use strict";

import { createBody, updateBody } from "../types/entity";
import { define as entityDefine } from "../database/models/entity";
import { Sequelize } from "sequelize";
import { jobController } from "./jobController";
import { dbWS } from "../database/connection";
import { Entity } from "../types/models";

export class entityController {
  db;

  constructor(db: Sequelize) {
    this.db = db;
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
