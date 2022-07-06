"use strict";

import { Attributes, DataTypes, ModelAttributes, Sequelize } from "sequelize";
import { Entity } from "../../types/models";
import { define as jobDefine } from "./job";

const primaryKey = "id";
const modelName = "Entity";
const allowedTypes = ["school", "municipality"] as const;

const structure: ModelAttributes<Entity, Attributes<Entity>> = {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
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
  status: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [[...allowedTypes]],
    },
  },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
};

const syncTable = (db: Sequelize) => {
  return db.define(modelName, structure).sync({ alter: true });
};

const define = (db: Sequelize, join = true) => {
  const entityDefineObj = db.define(modelName, structure);

  if (join) {
    entityDefineObj.hasMany(jobDefine(db, false), { foreignKey: "entity_id" });
  }

  return entityDefineObj;
};

export { primaryKey, modelName, allowedTypes, syncTable, define };
