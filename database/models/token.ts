"use strict";

import { Attributes, DataTypes, ModelAttributes, Sequelize } from "sequelize";
import { Token } from "../../types/models.js";

const modelName = "Token";

const structure: ModelAttributes<Token, Attributes<Token>> = {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  value: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  instanceUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
};

const syncTable = (db: Sequelize) => {
  return define(db).sync({ alter: true });
};

const define = (db: Sequelize) => {
  return db.define(modelName, structure);
};

export { modelName, syncTable, define };
