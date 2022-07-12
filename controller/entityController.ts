"use strict";

import { createBody, updateBody } from "../types/entity";
import { define as entityDefine } from "../database/models/entity";
import { Sequelize } from "sequelize";

export class entityController {
  db;

  constructor(db: Sequelize) {
    this.db = db;
  }

  async retrieve(entityExternalId: string) {
    return await entityDefine(this.db).findOne({
      where: {
        external_id: entityExternalId,
      },
    });
  }

  async retrieveByPk(entityId: number) {
    return await entityDefine(this.db).findByPk(entityId);
  }

  async create(entityCreateBody: createBody) {
    const entity = await this.retrieve(entityCreateBody.external_id);
    if (entity !== null) {
      throw new Error("Entity already exists for the passed id");
    }

    const result = await entityDefine(this.db).create({
      external_id: entityCreateBody.external_id,
      url: entityCreateBody.url,
      enable: entityCreateBody.enable,
      asseverationJobId: entityCreateBody.asseverationJobId,
      type: entityCreateBody.type,
      subtype: entityCreateBody.subtype,
    });

    return result.toJSON();
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
      updateObj = {
        ...updateObj,
        ...{ asseverationJobId: entityUpdateBody.asseverationJobId },
      };
    }

    const result = await entity.update(updateObj);

    return result.toJSON();
  }
}
