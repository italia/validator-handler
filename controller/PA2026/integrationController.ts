"use strict";

import dotenv from "dotenv";
dotenv.config();
import { Sequelize } from "sequelize";
import { authController } from "./authController";
import { Entity, Token } from "../../types/models";
import { get } from "../../utils/https-request";
import { entityController } from "../entityController";
import { allowedMunicipalitySubTypes } from "../../database/models/entity";

const createQuery =
  "SELECT id, Url_Sito_Internet__c, Codice_amministrativo__c, Pacchetto_1_4_1__c, ID_Crawler__c " +
  "FROM outfunds__Funding_Request__c " +
  "WHERE outfunds__Status__c ='Finanziata' " +
  "AND outfunds__FundingProgram__r.RecordType.DeveloperName='Misura_141' " +
  "AND Url_Sito_Internet__c !=null " +
  "AND ID_Crawler__c=null " +
  "AND Attivita_completata__c= true";

const updateQuery =
  "SELECT id, Url_Sito_Internet__c, Codice_amministrativo__c, Pacchetto_1_4_1__c, ID_Crawler__c " +
  "FROM outfunds__Funding_Request__c " +
  "WHERE outfunds__Status__c ='Finanziata' " +
  "AND outfunds__FundingProgram__r.RecordType.DeveloperName='Misura_141' " +
  "AND Url_Sito_Internet__c !=null " +
  "AND ID_Crawler__c !=null " +
  "AND Attivita_completata__c= true";

export class integrationController {
  db;

  constructor(db: Sequelize) {
    this.db = db;
  }

  async executeQueryAPI(query: string) {
    const tokens: Token[] = await new authController(this.db).getTokenFromDB();
    if (tokens.length <= 0) {
      throw new Error("Token not found in database");
    }

    const instanceUrl = tokens[0].instanceUrl.replace("https://", "");
    const tokenValue = tokens[0].value;
    if (!instanceUrl || !tokenValue) {
      throw new Error("Instance URL or Token value not found in Token obj");
    }

    const host = instanceUrl;
    const path = process.env.PA2025_QUERY_PATH;
    const headers = {
      Authorization: "Bearer " + tokenValue,
    };

    return await get(host, path, headers, { q: query });
  }

  async createOrUpdate(operation: string): Promise<Entity[] | []> {
    let query;
    switch (operation) {
      case "create":
        query = createQuery;
        break;
      case "update":
        query = updateQuery;
        break;
    }

    const result = await this.executeQueryAPI(query);

    if (!result || result?.statusCode !== 200 || !result?.data) {
      throw new Error("PA2026 update API failed: " + JSON.stringify(result));
    }

    const records = result.data.records;
    if (records.length < 0) {
      return [];
    }

    let returnValues: Entity[] = [];
    if (operation === "create") {
      returnValues = await this.create(records);
    } else if (operation === "update") {
      returnValues = await this.update(records);
    }

    return returnValues;
  }

  async create(records): Promise<Entity[] | []> {
    const createdEntities: Entity[] = [];
    for (const record of records) {
      const externalId = record.Id ?? "";
      const url = record.Url_Sito_Internet__c ?? "";
      const packet = record?.Pacchetto_1_4_1__c ?? "";

      if (!externalId || !url) {
        continue;
      }

      let type;
      let subtype;
      if (packet === "Cittadino Informato") {
        type = "municipality";
        subtype = allowedMunicipalitySubTypes[0];
      } else if (packet === "Cittadino Attivo e Informato") {
        type = "municipality";
        subtype = allowedMunicipalitySubTypes[1];
      } else {
        type = "school";
        subtype = null;
      }

      const newEntity: Entity = await new entityController(this.db).create({
        external_id: externalId,
        url: url,
        enable: true,
        type: type,
        subtype: subtype,
      });

      if (!newEntity) {
        continue;
      }

      createdEntities.push(newEntity);
    }

    return createdEntities;
  }

  async update(records): Promise<Entity[] | []> {
    const updatedEntities: Entity[] = [];
    for (const record of records) {
      const externalId = record.Id ?? "";

      if (!externalId) {
        continue;
      }

      const entityToUpdate: Entity = await new entityController(
        this.db
      ).retrieve(externalId);
      if (!entityToUpdate) {
        continue;
      }

      const updatedEntity: Entity = await entityToUpdate.update({});

      if (!updatedEntity) {
        continue;
      }

      updatedEntities.push(updatedEntity);
    }

    return updatedEntities;
  }
}
