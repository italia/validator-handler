'use strict'

import * as jsonschema from "jsonschema"
import { ValidatorResult } from "jsonschema"
import { mapValidationErrors } from "../utils/utils"
import { createBody, updateBody } from "../types/entity"

const validate = async (body: object, expectedBody: object): Promise<boolean> => {
    const result: ValidatorResult = jsonschema.validate(body, expectedBody)
    if (result.errors.length > 0) {
        throw new Error('Error in body validation: ' + await mapValidationErrors(result.errors))
    }

    return true
}

const create = async (body: createBody): Promise<boolean> => {
    const createBody = {
        "type": "object",

        "properties": {
            "external_id":  {"type": "string", "minLength": 1},
            "url":          {"type": "string", "minLength": 1},
            "enable":       {"type": "boolean", "minLength": 1},
            "type":         {"type": "string", "minLength": 1, "enum": ['school', 'municipality']}
        },

        "required": ["external_id", "url", "enable", "type"]
    }

    return await validate(body, createBody)
}

const update = async (body: updateBody): Promise<boolean> => {
    const updateBody = {
        "type": "object",

        "properties": {
            "external_id":  {"type": "string", "minLength": 1},
            "url":          {"type": "string", "minLength": 1},
            "enable":       {"type": "boolean", "minLength": 1},
        },

        "required": ["external_id", "url", "enable"]
    }

    return await validate(body, updateBody)
}

export { create, update }