"use strict";

import { DataTypes, Sequelize } from "sequelize";
import { entityModel } from "../../types/database";
import { define as jobDefine } from "./job";

const primaryKey = "id";
const modelName = "Entity";
const allowedTypes: string[] = ["school", "municipality"];

const structure: entityModel = {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  external_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  enable: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [allowedTypes],
    },
  },
};

const syncTable = (db: Sequelize) => {
  return db.define(modelName, structure).sync({ alter: true });
};

const define = (db: Sequelize, join = true) => {
  const entityDefineObj = db.define(modelName, structure);

  if (join) {
    entityDefineObj.hasMany(jobDefine(db,false), { foreignKey: "entity_id" });
  }

  return entityDefineObj;
};

export { primaryKey, modelName, allowedTypes, syncTable, define };
