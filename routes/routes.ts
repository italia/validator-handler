"use strict";

import dotenv from "dotenv";
dotenv.config();

import express from "express";
const router = express.Router();
import { userController } from "../controller/userController.js";
import { succesResponse, errorResponse } from "../utils/response.js";
import {
  emptyBodyType,
  loginBodyType,
  createEntityBodyType,
  updateEntityBodyType,
  updatePreserveBodyType,
} from "../types/api-request-body.js";
import {
  successResponseType,
  errorResponseType,
} from "../types/api-response-body.js";
import {
  generate as jwtGenerate,
  verify as jwtVerify,
  refreshToken as jwtRefreshToken,
  getToken,
} from "../auth/jwt.js";
import {
  create as entityCreateValidation,
  update as entityUpdateValidation,
} from "../validators/entity.js";
import { preserveUpdate as jobPreserveUpdateValidation } from "../validators/job.js";
import { entityController } from "../controller/entityController.js";
import { jobController } from "../controller/jobController.js";
import { dbWS } from "../database/connection.js";
import { allowedMunicipalitySubTypes } from "../database/models/entity.js";
import { Entity } from "../types/models.js";
import { readFileSync } from "fs";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { getFile } from "../controller/s3Controller.js";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @openapi
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *   schemas:
 *     Error:
 *       properties:
 *         status:
 *           type: string
 *         timestamp:
 *           type: integer
 *         error:
 *           type: object
 *           properties:
 *             code:
 *               type: integer
 *             message:
 *               type: string
 *     Token:
 *       properties:
 *         token:
 *           type: string
 *         expiresIn:
 *           type: integer
 *     Entity:
 *       properties:
 *         id:
 *           type: string
 *         external_id:
 *           type: string
 *         url:
 *           type: string
 *         enable:
 *           type: boolean
 *         type:
 *           type: string
 *         subtype:
 *           type: string
 *         status:
 *           type: boolean
 *         updateAt:
 *           type: string
 *         createdAt:
 *           type: string
 *     Job:
 *       properties:
 *         id:
 *           type: integer
 *         startAt:
 *           type: string
 *         endAt:
 *           type: string
 *         scanUrl:
 *           type: boolean
 *         type:
 *           type: string
 *         status:
 *           type: string
 *         s3HTMLUrl:
 *           type: string
 *         s3JSONUrl:
 *           type: string
 *         jsonResult:
 *           type: object
 *         preserve:
 *           type: boolean
 *         preserve_reason:
 *           type: string
 */

/**
 * @openapi
 * /api/login/token:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Genera un nuovo JWT token
 *     produces:
 *      - application/json
 *     requestBody:
 *       content:
 *          application/json:
 *            schema:
 *              type: object
 *              example:
 *                username: username
 *                password: password
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   $ref: '#/definitions/Token'
 *       "401":
 *         description: KO
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/definitions/Error'
 */
router.post(
  "/api/login/token",
  async (
    req: loginBodyType,
    res: successResponseType | errorResponseType
  ): Promise<void> => {
    try {
      const username: string = req.body.username;
      const password: string = req.body.password;

      if (!username || !password) {
        throw new Error("Empty username or password");
      }

      const userObj = await new userController(dbWS).auth(username, password);
      const token = await jwtGenerate(
        process.env.JWT_SECRET,
        userObj,
        Number(process.env.JWT_EXPIRATION_TIME)
      );

      return succesResponse(
        {
          token: token,
          expiresIn: Number(process.env.JWT_EXPIRATION_TIME),
        },
        res
      );
    } catch (error) {
      return errorResponse(0, error, 401, res);
    }
  }
);

/**
 * @openapi
 * /api/login/refresh:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Genera un nuovo token JWT partendo da uno valido esistente
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   "$ref": "#/definitions/Token"
 *       "401":
 *         description: KO
 *         content:
 *           application/json:
 *             schema:
 *               "$ref": "#/definitions/Error"
 */
router.post(
  "/api/login/refresh",
  async (
    req: emptyBodyType,
    res: successResponseType | errorResponseType
  ): Promise<void> => {
    try {
      const token = await getToken(req);
      await jwtVerify(process.env.JWT_SECRET, token);
      const newToken = await jwtRefreshToken(
        process.env.JWT_SECRET,
        Number(process.env.JWT_EXPIRATION_TIME),
        token
      );

      return succesResponse(
        {
          token: newToken,
          expiresIn: Number(process.env.JWT_EXPIRATION_TIME),
        },
        res
      );
    } catch (error) {
      return errorResponse(0, error, 401, res);
    }
  }
);

/**
 * @openapi
 * /api/entity/create:
 *   put:
 *     tags:
 *       - Entity
 *     summary: Crea una nuova Entity
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             example:
 *               external_id: external-code
 *               url: https://www.comune.cagliari.it/
 *               enable: true
 *               type: municipality
 *               subtype: informed-active-citizen
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   "$ref": "#/definitions/Entity"
 *       "500":
 *         description: KO
 *         content:
 *           application/json:
 *             schema:
 *               "$ref": "#/definitions/Error"
 */
router.put(
  "/api/entity/create",
  async (
    req: createEntityBodyType,
    res: successResponseType | errorResponseType
  ): Promise<void> => {
    try {
      await jwtVerify(process.env.JWT_SECRET, await getToken(req));
      await entityCreateValidation(req.body);

      const type = req.body.type;
      let subtype = req.body.subtype ?? "";

      if (
        type === "municipality" &&
        !allowedMunicipalitySubTypes.includes(subtype)
      ) {
        throw new Error("Invalid subtype for passed type");
      }

      if (type === "school") {
        subtype = null;
      }

      const result: Entity = await new entityController(dbWS).create(req.body);

      return succesResponse(result.toJSON(), res);
    } catch (error) {
      return errorResponse(0, error, 500, res);
    }
  }
);

/**
 * @openapi
 * /api/entity/{external_id}/update:
 *   post:
 *     tags:
 *       - Entity
 *     summary: Aggiorna URL o Enabling di una Entity esistente
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             example:
 *               url: https://www.comune.cagliari.it/
 *               enable: false
 *               status: true
 *               asseverationJobId: 1
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: external_id
 *         in: path
 *         schema:
 *           type: string
 *         required: true
 *         example: external-code
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   "$ref": "#/definitions/Entity"
 *       "500":
 *         description: KO
 *         content:
 *           application/json:
 *             schema:
 *               "$ref": "#/definitions/Error"
 */
router.post(
  "/api/entity/:external_id/update",
  async (
    req: updateEntityBodyType,
    res: successResponseType | errorResponseType
  ): Promise<void> => {
    try {
      await jwtVerify(process.env.JWT_SECRET, await getToken(req));
      await entityUpdateValidation(req.body);

      const result = await new entityController(dbWS).update(
        req.params.external_id,
        req.body
      );

      return succesResponse(result, res);
    } catch (error) {
      return errorResponse(0, error, 500, res);
    }
  }
);

/**
 * @openapi
 * /api/entity/{external_id}/retrieve:
 *   get:
 *     tags:
 *       - Entity
 *     summary: Restituisce una entity puntualmente
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: external_id
 *         in: path
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   "$ref": "#/definitions/Entity"
 *       "500":
 *         description: KO
 *         content:
 *           application/json:
 *             schema:
 *               "$ref": "#/definitions/Error"
 */
router.get(
  "/api/entity/:external_id/retrieve",
  async (
    req: emptyBodyType,
    res: successResponseType | errorResponseType
  ): Promise<void> => {
    try {
      await jwtVerify(process.env.JWT_SECRET, await getToken(req));

      const externalEntityId = req.params.external_id.toString();

      const result = await new entityController(dbWS).retrieve(
        externalEntityId
      );

      return succesResponse(result, res);
    } catch (error) {
      return errorResponse(0, error, 500, res);
    }
  }
);

/**
 * @openapi
 * /api/entity/{external_id}/job/list:
 *   get:
 *     tags:
 *       - Job
 *     summary: Restituisce la lista dei Job per una data Entity
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: dateFrom
 *         in: query
 *         schema:
 *           type: number
 *         description: NB - La data deve essere in formato ISO, es. 2022-05-19T14:45:00.602Z
 *         example: "2022-05-19T14:45:00.602Z"
 *       - name: dateTo
 *         in: query
 *         schema:
 *           type: number
 *         description: NB - La data deve essere in formato ISO, es. 2022-05-23T14:26:08.602Z
 *         example: "2022-05-23T14:26:08.602Z"
 *       - name: limit
 *         in: query
 *         schema:
 *           type: number
 *         description: Paginazione - quantità di JOB restituiti per pagina
 *         example: 10
 *       - name: page
 *         in: query
 *         schema:
 *           type: number
 *         description: Paginazione - pagina di JOB da visualizzare
 *         example: 5
 *       - name: external_id
 *         in: path
 *         schema:
 *           type: string
 *         required: true
 *         example: external-code
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       totalElements:
 *                         type: integer
 *                       currentPage:
 *                         type: integer
 *                       pages:
 *                         type: integer
 *                       jobs:
 *                         "$ref": "#/definitions/Job"
 *       "500":
 *         description: KO
 *         content:
 *           application/json:
 *             schema:
 *               "$ref": "#/definitions/Error"
 */
router.get(
  "/api/entity/:external_id/job/list",
  async (
    req: emptyBodyType,
    res: successResponseType | errorResponseType
  ): Promise<void> => {
    try {
      await jwtVerify(process.env.JWT_SECRET, await getToken(req));

      const externalEntityId = req.params.external_id.toString();
      const dateFrom = req.query.dateFrom;
      const dateTo = req.query.dateTo;

      const page =
        req.query.page === "0" || req.query.page === undefined
          ? "1"
          : req.query.page;
      const limit = req.query.limit ?? "0";

      const result = await new jobController(dbWS).list(
        externalEntityId,
        dateFrom,
        dateTo,
        page,
        limit
      );

      return succesResponse(result, res);
    } catch (error) {
      return errorResponse(0, error, 500, res);
    }
  }
);

/**
 * @openapi
 * /api/entity/{external_id}/job/{id}/results:
 *   get:
 *     tags:
 *       - Job
 *     summary: Restituisce i risultati della singola scansione (job) di una data entity
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: external_id
 *         description: Entity id
 *         in: path
 *         schema:
 *           type: string
 *         required: true
 *       - name: id
 *         description: Job id
 *         in: path
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               properties:
 *                 status:
 *                   type: string
 *                   example : "ok"
 *                 timestamp:
 *                   type: integer
 *                   example: 1733153829266
 *                 data:
 *                   properties:
 *                     audits:
 *                       properties:
 *                         municipality-legislation-accessibility-declaration-is-present:
 *                           type: object
 *                           properties:
 *                             score:
 *                               type: integer
 *                               example: 1
 *                             pagesItems:
 *                               type: object
 *                               properties:
 *                                 message:
 *                                   type: string
 *                                   example: ""
 *                                 headings:
 *                                   type: array
 *                                   items:
 *                                     type: string
 *                                     example: ["Testo del link", "Pagina di destinazione del link", "Pagina esistente", "La pagina contiene l'url del sito di origine", "È dichiarata la conformità alle specifiche WCAG 2.1"]
 *                                 pages:
 *                                   type: array
 *                                   items:
 *                                     type: object
 *                                     properties:
 *                                       link_name:
 *                                         type: string
 *                                         example: "Dichiarazione di accessibilità"
 *                                       link:
 *                                         type: string
 *                                         format: uri
 *                                         example: "https://form.agid.gov.it/view/456f9130-7655-11ef-8bbb-b18bddb46b52"
 *                                       existing_page:
 *                                         type: string
 *                                         example: "Sì"
 *                                       page_contains_correct_url:
 *                                         type: string
 *                                         example: "Sì"
 *                                       wcag:
 *                                         type: string
 *                                         example: "Sì"
 *                             pagesInError:
 *                               type: object
 *                               properties:
 *                                 message:
 *                                   type: string
 *                                   example: ""
 *                                 headings:
 *                                   type: array
 *                                   items:
 *                                     type: string
 *                                     example: []
 *                                 pages:
 *                                   type: array
 *                                   items:
 *                                     type: object
 *                             errorMessage:
 *                               type: string
 *                               example: ""
 *                             id:
 *                               type: string
 *                               example: "municipality-legislation-accessibility-declaration-is-present"
 *                             code:
 *                               type: string
 *                               example: "C.SI.3.2"
 *                             title:
 *                               type: string
 *                               example: "C.SI.3.2 - DICHIARAZIONE DI ACCESSIBILITÀ - Il sito comunale deve esporre la dichiarazione di accessibilità in conformità al modello e alle linee guida rese disponibili da AgID in ottemperanza alla normativa vigente in materia di accessibilità e con livelli di accessibilità contemplati nelle specifiche tecniche WCAG 2.1."
 *                             mainTitle:
 *                               type: string
 *                               example: "DICHIARAZIONE DI ACCESSIBILITÀ"
 *                             auditId:
 *                               type: string
 *                               example: "municipality-legislation-accessibility-declaration-is-present"
 *                             specificScore:
 *                               type: integer
 *                               example: 1
 *       "500":
 *         description: KO
 *         content:
 *           application/json:
 *             schema:
 *               "$ref": "#/definitions/Error"
 */
router.get(
  "/api/entity/:external_id/job/:id/results",
  async (
    req: emptyBodyType,
    res: successResponseType | errorResponseType
  ): Promise<void> => {
    try {
      await jwtVerify(process.env.JWT_SECRET, await getToken(req));

      const externalEntityId = parseInt(req.params.external_id);
      const jobId = parseInt(req.params.id);

      const jobObj = await new jobController(dbWS).getJobFromIdAndEntityId(
        jobId,
        externalEntityId
      );

      let s3JSONUrl = jobObj.s3_json_url;

      if (s3JSONUrl.startsWith("/")) {
        s3JSONUrl = s3JSONUrl.replace("/", "");
      }

      const result = await getFile(s3JSONUrl);

      return succesResponse(JSON.parse(result), res);
    } catch (error) {
      return errorResponse(0, error, 500, res);
    }
  }
);

/**
 * @openapi
 * /api/job/query:
 *   post:
 *     tags:
 *       - Job
 *     summary: Restituisce i risultati della ricerca effettuata sulle scansioni (Job)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: number
 *         description: Paginazione - quantità di JOB restituiti per pagina
 *         example: 10
 *       - name: page
 *         in: query
 *         schema:
 *           type: number
 *         description: Paginazione - pagina di JOB da visualizzare
 *         example: 5
 *       - name: countOnly
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Se true la query restituirà solo il conteggio dei risultati pertinenti
 *         example: true
 *       - in: body
 *         name: body
 *         required: true
 *         description: |
 *           **Struttura della Query**
 *
 *           **Operatori Logici**
 *
 *           Questi operatori combinano più condizioni. Le condizioni devono essere incluse in un array di oggetti
 *
 *           - **and**: Tutte devono essere vere affinché un record corrisponda.
 *             - Esempio: `{ "and" : [ { "scan_url" : "https://www.example.com" }, { "status" : "PASSED" } ] }`
 *
 *           - **or**: Affinché un record corrisponda almeno una delle condizioni al suo interno deve essere vera.
 *             - Esempio: `{ "or" : [ { "scan_url" : "https://www.example.com" }, { "status" : "PASSED" } ] }`
 *
 *           **Operatori di Confronto**
 *
 *           Ecco un elenco degli operatori di confronto che puoi utilizzare nella query:
 *
 *           - **ne**: Not Equal (Diverso da)
 *             - Esempio: `{ "scan_url" : { "ne" : "https://www.example.com" } }`
 *             - Controlla che il valore non sia uguale a quello specificato.
 *
 *           - **in**: Inclusione
 *             - Esempio: `{ "status" : { "in" : ["PASSED", "FAILED"] } }`
 *             - Controlla che il valore sia uno dei valori specificati nell'array.
 *
 *           - **notIn**: Esclusione
 *             - Esempio: `{ "status" : { "notIn" : ["PASSED", "FAILED"] } }`
 *             - Controlla che il valore non sia tra i valori specificati nell'array.
 *
 *           - **like**: Contiene
 *             - Esempio: `{ "scan_url" : { "like" : "%comune%" } }`
 *             - Controlla che il valore contenga una sottostringa specificata.
 *
 *           - **notLike**: Non contiene
 *             - Esempio: `{ "scan_url" : { "notLike" : "%comune%" } }`
 *             - Controlla che il valore non contenga una sottostringa specificata.
 *
 *           - **gte**: Maggiore o uguale a
 *             - Esempio: `{ "json_result.raccomandazioni.audits.municipality-metatag" : {"gte" : 0.5} }`
 *             - Controlla che il valore sia maggiore o uguale a quello specificato.
 *
 *           - **gt**: Maggiore di
 *             - Esempio: `{ "start_at" : {"gt" : "2024-12-01"} }`
 *             - Controlla che il valore sia maggiore di quello specificato.
 *
 *           - **lte**: Minore o uguale a
 *             - Esempio: `{ "end_at" : { "lte" : "2024-12-03"} }`
 *             - Controlla che il valore sia minore o uguale a quello specificato.
 *
 *           - **lt**: Minore di
 *             - Esempio: `{ "json_result.raccomandazioni.audits.municipality-metatag" : {"lt": 1} }`
 *             - Controlla che il valore sia minore di quello specificato.
 *
 *           - **not**: Negazione
 *             - Esempio: `{"not": { "type": "school" }}`
 *             - Nega la condizione specificata.
 *
 *         schema:
 *           type: object
 *           properties:
 *             and:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   json_result.cittadino-informato.groups.normativa.audits.municipality-license-and-attribution:
 *                     type: integer
 *                     example: 1
 *                   json_result.cittadino-informato.groups.esperienza-utente.audits.municipality-ux-ui-consistency-theme-version-check:
 *                     type: object
 *                     properties:
 *                       gte:
 *                         type: number
 *                         example: 0.5
 *                   start_at:
 *                     type: object
 *                     properties:
 *                       gte:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-11-27"
 *                   status:
 *                     type: string
 *                     example: "PASSED"
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       totalElements:
 *                         type: integer
 *                       currentPage:
 *                         type: integer
 *                       pages:
 *                         type: integer
 *                       jobs:
 *                         "$ref": "#/definitions/Job"
 *       "500":
 *         description: KO
 *         content:
 *           application/json:
 *             schema:
 *               "$ref": "#/definitions/Error"
 */
router.post(
  "/api/job/query",
  async (
    req: emptyBodyType,
    res: successResponseType | errorResponseType
  ): Promise<void> => {
    try {
      await jwtVerify(process.env.JWT_SECRET, await getToken(req));

      const page =
        req.query.page === "0" || req.query.page === undefined
          ? "0"
          : req.query.page;
      const limit = req.query.limit ?? "-1";
      const countOnly = req.query.countOnly
        ? req.query.countOnly == "true"
        : false;
      const result = await new jobController(dbWS).query(
        req.body,
        page as string,
        limit as string,
        countOnly
      );

      return succesResponse(result, res);
    } catch (error) {
      return errorResponse(0, error, 500, res);
    }
  }
);

/**
 * @openapi
 * /api/entity/{external_id}/job/{id}/preserve/update:
 *   post:
 *     tags:
 *       - Job
 *     summary: Aggiorna lo status di preserve di un Job
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             example:
 *               value: true
 *               reason: "prima scansione"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: external_id
 *         in: path
 *         schema:
 *           type: string
 *         required: true
 *         example: external-code
 *       - name: id
 *         in: path
 *         schema:
 *           type: integer
 *         required: true
 *         example: "38"
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   "$ref": "#/definitions/Job"
 *       "500":
 *         description: KO
 *         content:
 *           application/json:
 *             schema:
 *               "$ref": "#/definitions/Error"
 */
router.post(
  "/api/entity/:external_id/job/:id/preserve/update",
  async (
    req: updatePreserveBodyType,
    res: successResponseType | errorResponseType
  ): Promise<void> => {
    try {
      await jwtVerify(process.env.JWT_SECRET, await getToken(req));

      await jobPreserveUpdateValidation(req.body);
      const jobId = parseInt(req.params.id);
      const externalEntityId = req.params.external_id.toString();

      const result = await new jobController(dbWS).updatePreserve(
        externalEntityId,
        jobId,
        req.body
      );

      return succesResponse(result, res);
    } catch (error) {
      return errorResponse(0, error, 500, res);
    }
  }
);

router.get(
  "/api/info",
  async (req: emptyBodyType, res: successResponseType | errorResponseType) => {
    let packageJSON;
    try {
      packageJSON =
        JSON.parse(
          await readFileSync(
            path.resolve(__dirname, "../package.json")
          ).toString()
        ) ?? {};
    } catch (e) {
      packageJSON = null;
      errorResponse(0, { message: e.toString() }, 400, res);
    }

    const handlerVersion = packageJSON?.version ?? "";
    const validatorVersion =
      packageJSON?.dependencies["pa-website-validator-ng"]?.split("#")[1] ?? "";

    succesResponse(
      { handlerVersion: handlerVersion, validatorVersion: validatorVersion },
      res,
      200
    );
  }
);

// ** 404 ROUTE HANDLING **
router.get(
  "/api/*",
  (req: emptyBodyType, res: successResponseType | errorResponseType): void => {
    errorResponse(0, { message: "Not found" }, 404, res);
  }
);

router.post(
  "/api/*",
  (req: emptyBodyType, res: successResponseType | errorResponseType): void => {
    errorResponse(0, { message: "Not found" }, 404, res);
  }
);

router.delete(
  "/api/*",
  (req: emptyBodyType, res: successResponseType | errorResponseType): void => {
    errorResponse(0, { message: "Not found" }, 404, res);
  }
);

router.put(
  "/api/*",
  (req: emptyBodyType, res: successResponseType | errorResponseType): void => {
    errorResponse(0, { message: "Not found" }, 404, res);
  }
);

export default router;
