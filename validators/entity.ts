"use strict";

import { validate } from "./validate";
import { createBody, updateBody } from "../types/entity";

const create = async (body: createBody): Promise<boolean> => {
  const createBody = {
    type: "object",

    properties: {
      external_id: { type: "string", minLength: 1 },
      url: { type: "string", minLength: 1 },
      enable: { type: "boolean", minLength: 1 },
      type: { type: "string", minLength: 1, enum: ["school", "municipality"] },
    },

    required: ["external_id", "url", "enable", "type"],
  };

  return await validate(body, createBody);
};

const update = async (body: updateBody): Promise<boolean> => {
  const updateBody = {
    type: "object",

    properties: {
      url: { type: "string", minLength: 1 },
      enable: { type: "boolean", minLength: 1 },
    },

    anyOf: [
      {
        required: ["url"],
      },
      {
        required: ["enable"],
      },
    ],
  };

  return await validate(body, updateBody);
};

export { create, update };