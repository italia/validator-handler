"use strict";

import dotenv from "dotenv";
dotenv.config();
import { Sequelize } from "sequelize";
import { define as tokenDefine } from "../../database/models/token.js";
import { retrieveToken } from "./integrationController.js";
import { Token } from "../../types/models.js";

export class tokenController {
  db;

  constructor(db: Sequelize) {
    this.db = db;
  }

  create = async (): Promise<Token | null> => {
    try {
      const token = await retrieveToken();
      if (!token) {
        return null;
      }

      await tokenDefine(this.db).destroy({
        where: {},
        truncate: true,
      });

      return await tokenDefine(this.db).create({
        value: token.value,
        instanceUrl: token.instanceUrl,
      });
    } catch (e) {
      console.log("CREATE EXCEPTION", e.toString());
      return null;
    }
  };

  retrieve = async (): Promise<Token | null> => {
    try {
      const token: Token = await tokenDefine(this.db).findOne({
        order: [["id", "DESC"]],
      });

      if (!token) {
        return await this.create();
      }

      return token;
    } catch (e) {
      console.log("RETRIEVE EXCEPTION", e.toString());
      return null;
    }
  };
}
