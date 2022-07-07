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
      subtype: {
        type: "string",
        enum: [
          "municipality-informed-citizen",
          "municipality-informed-active-citizen",
          "school-compliance-criteria",
        ],
      },
    },

    required: ["external_id", "url", "enable", "type", "subtype"],
  };

  return await validate(body, createBody);
};

const update = async (body: updateBody): Promise<boolean> => {
  const updateBody = {
    type: "object",

    properties: {
      url: { type: "string", minLength: 1 },
      enable: { type: "boolean", minLength: 1 },
      status: { type: "boolean", minLength: 1 },
    },

    anyOf: [
      {
        required: ["url"],
      },
      {
        required: ["enable"],
      },
      {
        required: ["status"],
      },
    ],
  };

  return await validate(body, updateBody);
};

export { create, update };
