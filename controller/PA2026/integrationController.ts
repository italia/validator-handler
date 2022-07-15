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

//TODO: Terza query --> GetEntityInEndProcess (entità che sono in processo finale) --> Mi verrà ritornato l'externalID, IDCrawler, IDJobAsseverato e STATUS della entity di PA2026 (status di processo)
//TODO: Se lo status è completato prendo il campo IDJobAsseverato e vado inserirlo nella Entity in questione (vado in update) --> Prendo il JOB (solo se esiste) e lo metto in PRESERVE con la reason "asseverato" --> Si fa poi una chiamata di Update passando l'externalID (con un flag da passare a TRUE)
//TODO: Se lo status è != completato (sarà un listato TBD) l'IDJobAsseverato sarà NULL --> Il campo enable della Entity diventa FALSE

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

  //TODO: dopo aver creato l'entity sul DB chiamare PA2026 e passare l'ID della Entity e l'externalID
  async create(): Promise<Entity[] | []> {
    const createResult = await this.executeQueryAPI(createQuery);

    if (!createResult || createResult?.statusCode !== 200 || !createResult?.data) {
      throw new Error("PA2026 update API failed: " + JSON.stringify(createResult));
    }

    const records = createResult.data.records;
    if (records.length < 0) {
      return [];
    }

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

      //TODO: Verificare se esiste
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

  //TODO: arrivano tutte le PA che hanno URL diverso rispetto quello dell'ultima scansione --> Update dell'URL nella Entity --> Fare sempre l'update
  async update(): Promise<Entity[] | []> {
    const updateResult = await this.executeQueryAPI(createQuery);

    if (!updateResult || updateResult?.statusCode !== 200 || !updateResult?.data) {
      throw new Error("PA2026 update API failed: " + JSON.stringify(updateResult));
    }

    const records = updateResult.data.records;
    if (records.length < 0) {
      return [];
    }

    const updatedEntities: Entity[] = [];
    for (const record of records) {
      const externalId = record.Id ?? "";
      const url = record.Url_Sito_Internet__c ?? "";

      if (!externalId || !url) {
        continue;
      }

      const entityToUpdate: Entity = await new entityController(
        this.db
      ).retrieve(externalId);
      if (!entityToUpdate) {
        continue;
      }

      const updatedEntity: Entity = await entityToUpdate.update({
        url: url
      });

      if (!updatedEntity) {
        continue;
      }

      updatedEntities.push(updatedEntity);
    }

    return updatedEntities;
  }

  async push () {

  }

  async endProcess() {

  }
}
