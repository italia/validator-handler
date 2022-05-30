'use strict'

import { ValidatorResult } from "jsonschema"
import * as jsonschema from "jsonschema"
import { mapValidationErrors } from "../utils/utils"

const validate = async (body: object, expectedBody: object): Promise<boolean> => {
    const result: ValidatorResult = jsonschema.validate(body, expectedBody)
    if (result.errors.length > 0) {
        throw new Error('Error in body validation: ' + await mapValidationErrors(result.errors))
    }

    return true
}

export { validate }