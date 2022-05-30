'use strict'

import dotenv  from "dotenv"
dotenv.config()

import express from 'express'
const router = express.Router()
import { auth } from "../controller/userController"
import { succesResponse, errorResponse } from "../utils/response"
import { emptyBodyType, loginBodyType, createEntityBodyType, updateEntityBodyType } from "../types/api-request-body"
import { successResponseType, errorResponseType } from "../types/api-response-body"
import { generate as jwtGenerate, verify as jwtVerify, refreshToken as jwtRefreshToken, getToken } from "../auth/jwt"
import { create as entityCreateValidation, update as entityUpdateValidation } from "../validators/entity"
import { create as entityCreate, update as entityUpdate, retrieve as entityRetrieve, jobList as entityJobList } from "../controller/entityController"

router.post('/api/login/token', async (req: loginBodyType, res: successResponseType | errorResponseType) : Promise<void> => {
    try {
        const username: string = req.body.username
        const password: string = req.body.password

        if (!Boolean(username) || !Boolean(password)) {
            throw new Error('Empty username or password')
        }

        const userObj = await auth(username, password)
        const token   = await jwtGenerate(process.env.JWT_SECRET, userObj, Number(process.env.JWT_EXPIRATION_TIME))

        return succesResponse({
            token: token,
            expiresIn: Number(process.env.JWT_EXPIRATION_TIME)
        }, res)
    } catch (error) {
        return errorResponse(0, error, 401, res)
    }
})

router.post('/api/login/refresh', async (req: emptyBodyType, res: successResponseType | errorResponseType) : Promise<void> => {
    try {
        const token = await getToken(req)
        await jwtVerify(process.env.JWT_SECRET, token)
        const newToken = await jwtRefreshToken(process.env.JWT_SECRET, Number(process.env.JWT_EXPIRATION_TIME), token)

        return succesResponse({
            token: newToken,
            expiresIn: Number(process.env.JWT_EXPIRATION_TIME),
        }, res)
    } catch (error) {
        return errorResponse(0, error, 401, res)
    }
})

router.put('/api/entity/create', async (req: createEntityBodyType, res: successResponseType | errorResponseType) : Promise<void> => {
    try {
        await jwtVerify(process.env.JWT_SECRET, await getToken(req))
        await entityCreateValidation(req.body)

        const result = await entityCreate(req.body)

        return succesResponse(result, res)
    } catch (error) {
        return errorResponse(0, error, 401, res)
    }
})

router.post('/api/entity/:external_id/update', async (req: updateEntityBodyType, res: successResponseType | errorResponseType) : Promise<void> => {
    try {
        await jwtVerify(process.env.JWT_SECRET, await getToken(req))
        await entityUpdateValidation(req.body)

        const result = await entityUpdate(req.params.external_id, req.body)

        return succesResponse(result, res)
    } catch (error) {
        return errorResponse(0, error, 401, res)
    }
})

router.get('/api/entity/:external_id/retrieve', async (req: emptyBodyType, res: successResponseType | errorResponseType) : Promise<void> => {
    try {
        await jwtVerify(process.env.JWT_SECRET, await getToken(req))

        const externalEntityId = req.params.external_id.toString()

        const result = await entityRetrieve(externalEntityId) ?? {}

        return succesResponse(result, res)
    } catch (error) {
        return errorResponse(0, error, 401, res)
    }
})

router.get('/api/entity/:external_id/job/list', async (req: emptyBodyType, res: successResponseType | errorResponseType) : Promise<void> => {
    try {
        await jwtVerify(process.env.JWT_SECRET, await getToken(req))

        const externalEntityId = req.params.external_id.toString()
        const dateFrom         = req.query.dateFrom
        const dateTo           = req.query.dateTo

        const result = await entityJobList(externalEntityId, dateFrom, dateTo) ?? {}

        return succesResponse(result, res)
    } catch (error) {
        return errorResponse(0, error, 401, res)
    }
})


router.get('/api/info', (req: emptyBodyType, res: successResponseType | errorResponseType) : void => {
    succesResponse({ version: '1.0.0' }, res, 200)
})

// ** 404 ROUTE HANDLING **
router.get('/api/*', (req: emptyBodyType, res: successResponseType | errorResponseType) : void => {
    errorResponse(0, { message: 'Not found' }, 404, res)
})

router.post('/api/*', (req: emptyBodyType, res: successResponseType | errorResponseType) : void => {
    errorResponse(0, { message: 'Not found' }, 404, res)
})

router.delete('/api/*', (req: emptyBodyType, res: successResponseType | errorResponseType) : void => {
    errorResponse(0, { message: 'Not found' }, 404, res)
})

router.put('/api/*', (req: emptyBodyType, res: successResponseType | errorResponseType) : void => {
    errorResponse(0, { message: 'Not found' }, 404, res)
})

export default router