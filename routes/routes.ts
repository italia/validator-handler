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

router.put(
  "/api/entity/create",
  async (
    req: createEntityBodyType,
    res: successResponseType | errorResponseType
  ): Promise<void> => {
    try {
      await jwtVerify(process.env.JWT_SECRET, await getToken(req));
      await entityCreateValidation(req.body);

      const result = await new entityController(dbWS).create(req.body);

      return succesResponse(result, res);
    } catch (error) {
      return errorResponse(0, error, 500, res);
    }
  }
);

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

      const result = await new jobController(dbWS).list(
        externalEntityId,
        dateFrom,
        dateTo
      );

      return succesResponse(result, res);
    } catch (error) {
      return errorResponse(0, error, 500, res);
    }
  }
);

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
    succesResponse({ version: "1.0.0" }, res, 200);
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
