import express from 'express'
const router = express.Router()
import { succesResponse, errorResponse } from "../utils/response"
import { emptyBodyType } from "../types/api-request-body"
import { successResponseType, errorResponseType } from "../types/api-response-body"

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