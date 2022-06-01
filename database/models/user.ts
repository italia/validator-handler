"use strict";

import { DataTypes, Sequelize } from "sequelize";
import { userModel } from "../../types/database";

const modelName = "User";
const roles: string[] = ["api-user"];

const structure: userModel = {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING,
    validate: {
      isIn: [roles],
    },
  },
};

const syncTable = (db: Sequelize) => {
  return define(db).sync({ alter: true });
};

const define = (db: Sequelize) => {
  return db.define(modelName, structure, {
    defaultScope: {
      attributes: { exclude: ["password"] },
    },
  });
};

export { modelName, syncTable, define };
