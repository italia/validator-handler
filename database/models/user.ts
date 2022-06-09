"use strict";

import { Attributes, DataTypes, ModelAttributes, Sequelize } from "sequelize";
import { User } from "../../types/models";

const modelName = "User";
const roles: string[] = ["api-user"];

const structure: ModelAttributes<User, Attributes<User>> = {
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
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
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
