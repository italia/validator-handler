"use strict";

import { Attributes, DataTypes, ModelAttributes, Sequelize } from "sequelize";
import { Entity } from "../../types/models";
import { define as jobDefine } from "./job";

const primaryKey = "id";
const modelName = "Entity";
const allowedTypes = ["school", "municipality"] as const;
const allowedMunicipalitySubTypes = [
  "informed-citizen",
  "informed-active-citizen",
];

const structure: ModelAttributes<Entity, Attributes<Entity>> = {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  external_id: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  enable: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  asseverationJobId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [[...allowedTypes]],
    },
  },
  subtype: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isIn: [[...allowedMunicipalitySubTypes]],
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

export {
  primaryKey,
  modelName,
  allowedTypes,
  syncTable,
  define,
  allowedMunicipalitySubTypes,
};
