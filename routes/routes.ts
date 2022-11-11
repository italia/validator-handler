"use strict";

import dotenv from "dotenv";
dotenv.config();

import express from "express";
const router = express.Router();
import { userController } from "../controller/userController";
import { succesResponse, errorResponse } from "../utils/response";
import {
  emptyBodyType,
  loginBodyType,
  createEntityBodyType,
  updateEntityBodyType,
  updatePreserveBodyType,
} from "../types/api-request-body";
import {
  successResponseType,
  errorResponseType,
} from "../types/api-response-body";
import {
  generate as jwtGenerate,
  verify as jwtVerify,
  refreshToken as jwtRefreshToken,
  getToken,
} from "../auth/jwt";
import {
  create as entityCreateValidation,
  update as entityUpdateValidation,
} from "../validators/entity";
import { preserveUpdate as jobPreserveUpdateValidation } from "../validators/job";
import { entityController } from "../controller/entityController";
import { jobController } from "../controller/jobController";
import { dbWS } from "../database/connection";
import { allowedMunicipalitySubTypes } from "../database/models/entity";
import { Entity } from "../types/models";

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
 *               subtype: municipality-informed-active-citizen
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
 *                     "$ref": "#/definitions/Job"
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
  (req: emptyBodyType, res: successResponseType | errorResponseType): void => {
    succesResponse({ version: "1.1.8" }, res, 200);
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
