"use strict";

import dotenv from "dotenv";
dotenv.config();

import { Sequelize } from "sequelize";

export class integrationController {
  db;

  constructor(db: Sequelize) {
    this.db = db;
  }
}
