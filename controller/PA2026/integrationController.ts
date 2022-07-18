"use strict";

import dotenv from "dotenv";
dotenv.config();
import { Sequelize } from "sequelize";
import { authController } from "./authController";
import { Entity, Token } from "../../types/models";
import { get, patch, post } from "../../utils/https-request";
import { entityController } from "../entityController";
import { allowedMunicipalitySubTypes } from "../../database/models/entity";

const createQuery =
  "SELECT id,Url_Sito_Internet__c, Codice_amministrativo__c, Pacchetto_1_4_1__c, ID_Crawler__c " +
  "FROM outfunds__Funding_Request__c " +
  "WHERE outfunds__Status__c ='Finanziata' " +
  "AND outfunds__FundingProgram__r.RecordType.DeveloperName='Misura_141' " +
  "AND Url_Sito_Internet__c !=null " +
  "AND ID_Crawler__c=null " +
  "AND Attivita_completata__c= true "

const updateQuery =
  "SELECT id,Url_Sito_Internet__c, Codice_amministrativo__c, Pacchetto_1_4_1__c, ID_Crawler__c " +
  "FROM outfunds__Funding_Request__c " +
  "WHERE outfunds__Status__c ='Finanziata' " +
  "AND outfunds__FundingProgram__r.RecordType.DeveloperName='Misura_141' " +
  "AND Url_Sito_Internet__c !=null " +
  "AND ID_Crawler__c!=null " +
  "AND Stato_Progetto__c= ’COMPLETATO’ " +
  "AND Controllo_URL__c=false "

const finalProcessQuery =
  "SELECT id, Codice_amministrativo__c, ID_Crawler__c, ID_Crawler_Job_definitiva__c, Stato_Progetto__c " +
  "FROM outfunds__Funding_Request__c " +
  "WHERE Stato_Progetto__c IN ('IN VERIFICA', 'RESPINTO', 'IN LIQUIDAZIONE', 'LIQUIDATO', 'ANNULLATO', 'RINUNCIATO') " +
  "AND Progetto_Terminato__c=false "

//TODO: Terza query --> GetEntityInEndProcess (entità che sono in processo finale) --> Mi verrà ritornato l'externalID, IDCrawler, IDJobAsseverato e STATUS della entity di PA2026 (status di processo)
//TODO: Se lo status è completato prendo il campo IDJobAsseverato e vado inserirlo nella Entity in questione (vado in update) --> Prendo il JOB (solo se esiste) e lo metto in PRESERVE con la reason "asseverato" --> Si fa poi una chiamata di Update passando l'externalID (con un flag da passare a TRUE)
//TODO: Se lo status è != completato (sarà un listato TBD) l'IDJobAsseverato sarà NULL --> Il campo enable della Entity diventa FALSE

export class integrationController {
  db;

  constructor(db: Sequelize) {
    this.db = db;
  }

  async getIntegrationValues () {
    const tokens: Token[] = await new authController(this.db).getTokenFromDB();
    if (tokens.length <= 0) {
      throw new Error("Token not found in database");
    }

    const instanceUrl = tokens[0].instanceUrl.replace("https://", "");
    const tokenValue = tokens[0].value;
    if (!instanceUrl || !tokenValue) {
      throw new Error("Instance URL or Token value not found in Token obj");
    }

    return {
      instanceUrl: instanceUrl,
      token: tokenValue
    }
  }

  async executeQueryAPI(query: string) {
    const integrationValues = await this.getIntegrationValues()

    return await get(
      integrationValues.instanceUrl,
      process.env.PA2026_QUERY_PATH,
      {
      Authorization: "Bearer " + integrationValues.token
      },
      { q: query }
    );
  }

  async createCrawlerRecord(entityId: number, entityExternalId: string) {
    const integrationValues = await this.getIntegrationValues()

    return await patch(
      integrationValues.instanceUrl,
      process.env.PA2026_QUERY_PATH.replace('{entity_external_id}', entityExternalId),
      {
        Authorization: "Bearer " + integrationValues.token
      },
      JSON.stringify({ ID_Crawler__c: entityId.toString() })
    )
  }

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

      const entityExists = await new entityController(this.db).retrieve(externalId)
      if (entityExists) {
        continue;
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

      const createCrawlerResult = await this.createCrawlerRecord(newEntity.id, newEntity.external_id)
      console.log('CREATE CRAWLER RECORD RESPONSE: ', createCrawlerResult?.statusCode, createCrawlerResult?.data)
      if (!createCrawlerResult || createCrawlerResult?.statusCode < 200 || createCrawlerResult?.statusCode > 204) {
        continue;
        //TODO: Eliminare entity appena creata?
      }

      createdEntities.push(newEntity);
    }

    return createdEntities;
  }

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

  async pushFirstCheckSchool (cleanSchoolJsonBody: object, entityExternalId: string, entityId: number, scanUrl: string) {
    const integrationValues = await this.getIntegrationValues()

    const statusComplianceCriteria = cleanSchoolJsonBody["criteri-conformita"].status
    const statusComplianceCriteriaUserExperience = cleanSchoolJsonBody["criteri-conformita"].groups["esperienza-utente"].status
    const idCrawlerJob = entityId.toString()
    const statusLegislation = cleanSchoolJsonBody["criteri-conformita"].groups["normativa"].status
    const statusPerformance = cleanSchoolJsonBody["criteri-conformita"].groups["prestazioni"].status
    const statusRecomandation = cleanSchoolJsonBody["raccomandazioni"].status
    const statusSecurity = cleanSchoolJsonBody["criteri-conformita"].groups["sicurezza"].status
    const userExperienceDescription = JSON.stringify(cleanSchoolJsonBody["criteri-conformita"].groups["esperienza-utente"].failAudit)
    const legislationDescription = JSON.stringify(cleanSchoolJsonBody["criteri-conformita"].groups["normativa"].failAudit)
    const reccomandationDescription = JSON.stringify(cleanSchoolJsonBody["raccomandazioni"].failAudit)
    const securityDescription = JSON.stringify(cleanSchoolJsonBody["criteri-conformita"].groups["sicurezza"].failAudit)

    const generalStatus = statusComplianceCriteria &&
      statusComplianceCriteriaUserExperience &&
      statusLegislation &&
      statusPerformance &&
      statusRecomandation &&
      statusSecurity

      let body = {
        Criteri_Conformita_1__c: statusComplianceCriteria,
        Esperienza_Utente_1__c: statusComplianceCriteriaUserExperience,
        ID_Crawler_Job_1__c: idCrawlerJob,
        Normativa_1__c:	statusLegislation,
        Prestazioni_1__c:	statusPerformance,
        Raccomandazioni_1__c:	statusRecomandation,
        Sicurezza_1__c: statusSecurity,
        Status_Generale_1__c:	generalStatus,
        URL_Scansione_1__c: scanUrl,

        Esperienza_Utente_Descrizione__c: userExperienceDescription,
        Normativa_Descrizione__c: legislationDescription,
        Raccomandazioni_Descrizione__c: reccomandationDescription,
        Sicurezza_Descrizione__c: securityDescription,


        Criteri_Conformita_n__c: statusComplianceCriteria,
        Esperienza_Utente_n__c: statusComplianceCriteriaUserExperience,
        ID_Crawler_Job_n__c: idCrawlerJob,
        Normativa_n__c: statusLegislation,
        Prestazioni_n__c: statusPerformance,
        Raccomandazioni_n__c: statusRecomandation,
        Sicurezza_n__c: statusSecurity,
        Status_Generale_n__c:	generalStatus,
        URL_Scansione_n__c: scanUrl,

        Esperienza_Utente_n_Descrizione__c: userExperienceDescription,
        Normativa_n_Descrizione__c: legislationDescription,
        Raccomandazioni_n_Descrizione__c: reccomandationDescription,
        Sicurezza_n_Descrizione__c: securityDescription
    }

    return await patch(
      integrationValues.instanceUrl,
      process.env.PA2026_QUERY_PATH.replace('{entity_external_id}', entityExternalId),
      {
        Authorization: "Bearer " + integrationValues.token
      },
      JSON.stringify(body)
    )
  }

  async pushFirstCheckMunicipality (cleanMunicipalityJsonBody: object, entityExternalId: string) {
  }

  async pushNCheck () {

  }

  async endProcess() {

  }
}
