"use strict";

import dotenv from "dotenv";
dotenv.config();
import { Sequelize } from "sequelize";

const db = new Sequelize(
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

export { db };
