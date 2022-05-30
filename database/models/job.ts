"use strict";

import { DataTypes } from "sequelize";
import { jobModel } from "../../types/database";
import { db } from "../connection";
import { define as entityDefine } from "./entity";

const modelName = "Job";
const statusAllowedValues: string[] = [
  "IN_PROGRESS",
  "PENDING",
  "ERROR",
  "PASSED",
  "FAILED",
];

const structure: jobModel = {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  entity_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "Entities",
      key: "id",
    },
  },
  start_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  end_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  spawn_code: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  scan_url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [["school", "municipality"]],
    },
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [statusAllowedValues],
    },
  },
  s3_html_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  s3_json_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  json_result: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  preserve: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
  },
};

const syncTable = () => {
  return db.define(modelName, structure).sync({ alter: true });
};

const define = (join = true) => {
  const jobDefineObj = db.define(modelName, structure);

  if (join) {
    jobDefineObj.belongsTo(entityDefine(), { foreignKey: "entity_id" });
  }

  return jobDefineObj;
};

export { modelName, statusAllowedValues, syncTable, define };
