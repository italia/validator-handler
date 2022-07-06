"use strict";

import { validate } from "./validate";
import { updatePreserveBody } from "../types/job";

const preserveUpdate = async (body: updatePreserveBody): Promise<boolean> => {
  const createBody = {
    type: "object",

    properties: {
      value: { type: "boolean", minLength: 1 },
      reason: { type: "string", minLength: 1 },
    },

    required: ["value", "reason"],
  };

  return await validate(body, createBody);
};

export { preserveUpdate };
