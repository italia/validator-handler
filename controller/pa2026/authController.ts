"use strict";

import dotenv from "dotenv";
dotenv.config();

import querystring from "querystring";
import { Sequelize } from "sequelize";
import { define as tokenDefine } from "../../database/models/token";
import { post } from "../../utils/https-request";
import { response } from "../../types/https-request";
import { Token } from "../../types/models";
import { integrationTokenInfo } from "../../types/token";

export class authController {
  db;

  constructor(db: Sequelize) {
    this.db = db;
  }

  async getTokenFromDB(): Promise<Token[]> {
    return await tokenDefine(this.db).findAll({
      order: [["updatedAt", "DESC"]],
      limit: 1,
    });
  }

  async updateToken(): Promise<Token | null> {
    const tokens = await this.getTokenFromDB();

    let tokenInfo: integrationTokenInfo;
    if (tokens.length <= 0) {
      console.log("TOKEN CREATED");

      tokenInfo = await this.retrieveToken();

      return await tokenDefine(this.db).create({
        value: tokenInfo.value,
        instanceUrl: tokenInfo.instanceUrl,
        expirationDate:
          parseInt(tokenInfo.creationDate) +
          parseInt(process.env.PA2026_AUTH_TOKEN_DURATION),
      });
    }

    const expirationDate = new Date(tokens[0].expirationDate).getTime();
    const currentDate = Date.now();

    if (currentDate > expirationDate) {
      console.log("TOKEN UPDATED");

      tokenInfo = await this.retrieveToken();

      return await tokens[0].update({
        value: tokenInfo.value,
        instanceUrl: tokenInfo.instanceUrl,
        expirationDate:
          parseInt(tokenInfo.creationDate) +
          parseInt(process.env.PA2026_AUTH_TOKEN_DURATION),
      });
    }

    return null;
  }

  async retrieveToken(): Promise<integrationTokenInfo> {
    const result: response = await post(
      process.env.PA2026_HOST,
      process.env.PA2026_AUTH_PATH,
      {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      querystring.stringify({
        grant_type: process.env.PA2026_AUTH_GRANT_TYPE,
        client_id: process.env.PA2026_AUTH_CLIENT_ID,
        client_secret: process.env.PA2026_AUTH_CLIENT_SECRET,
        username: process.env.PA2026_AUTH_USERNAME,
        password: process.env.PA2026_AUTH_PASSWORD,
      })
    );

    if (!result || result?.statusCode !== 200 || !result?.data) {
      throw new Error(
        "Error in retrieve token from PA2026: " + JSON.stringify(result)
      );
    }

    const tokenCreationDate: string = result.data.issued_at ?? "";
    const accessToken: string = result.data.access_token ?? "";
    const instanceUrl: string = result.data.instance_url ?? "";

    if (!tokenCreationDate || !accessToken || !instanceUrl) {
      throw new Error(
        "Error in retrieve information from PA2026 response: " +
          JSON.stringify(result.data)
      );
    }

    return {
      creationDate: tokenCreationDate,
      value: accessToken,
      instanceUrl: instanceUrl,
    };
  }
}
