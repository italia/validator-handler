"use strict";

import { validate } from "./validate.js";
import { updatePreserveBody } from "../types/job.js";
import { preserveReasons } from "../database/models/job.js";

const preserveUpdate = async (body: updatePreserveBody): Promise<boolean> => {
  const createBody = {
    type: "object",

    properties: {
      value: { type: "boolean", minLength: 1 },
      reason: { type: "string", minLength: 1, enum: preserveReasons },
    },

    required: ["value", "reason"],
  };

  return await validate(body, createBody);
};

export { preserveUpdate };
