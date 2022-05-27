import * as jsonschema from "jsonschema"
import { mapValidationErrors } from "../utils/utils"
import { ValidatorResult } from "jsonschema"

const create = async (body): Promise<boolean> => {
    const expectedBody = {
        "type": "object",
        "properties": {
            "id": {"type": "string", "minLength": 1},
            "url": {"type": "string", "minLength": 1},
            "enable": {"type": "boolean", "minLength": 1},
            "type": {"type": "string", "minLength": 1, "enum": ['school', 'municipality']}
        },

        "required": ["id", "url", "enable", "type"]
    }

    const result: ValidatorResult = jsonschema.validate(body, expectedBody)
    if (result.errors.length > 0) {
        throw new Error('Error in body validation: ' + await mapValidationErrors(result.errors))
    }

    return true
}

export { create }