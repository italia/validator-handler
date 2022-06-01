"use strict";

import dotenv from "dotenv";
dotenv.config();
import { Sequelize } from "sequelize";

const dbRoot = new Sequelize(
  process.env.DATABASE_NAME,
  process.env.DATABASE_USERNAME,
  process.env.DATABASE_PASSWORD,
  {
    port: parseInt(process.env.DATABASE_PORT),
    host: process.env.DATABASE_HOST,
    dialect: "postgres",
    logging: process.env.DB_DEBUG === "true",
  }
);

const dbWS = new Sequelize(
  process.env.DATABASE_NAME,
  process.env.DATABASE_WS_USERNAME,
  process.env.DATABASE_WS_PASSWORD,
  {
    port: parseInt(process.env.DATABASE_PORT),
    host: process.env.DATABASE_HOST,
    dialect: "postgres",
    logging: process.env.DB_DEBUG === "true",
  }
);

const dbQM = new Sequelize(
  process.env.DATABASE_NAME,
  process.env.DATABASE_QM_USERNAME,
  process.env.DATABASE_QM_PASSWORD,
  {
    port: parseInt(process.env.DATABASE_PORT),
    host: process.env.DATABASE_HOST,
    dialect: "postgres",
    logging: process.env.DB_DEBUG === "true",
  }
);

const dbSM = new Sequelize(
  process.env.DATABASE_NAME,
  process.env.DATABASE_SM_USERNAME,
  process.env.DATABASE_SM_PASSWORD,
  {
    port: parseInt(process.env.DATABASE_PORT),
    host: process.env.DATABASE_HOST,
    dialect: "postgres",
    logging: process.env.DB_DEBUG === "true",
  }
);

export { dbWS, dbQM, dbSM, dbRoot };
