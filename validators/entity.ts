"use strict";

import { validate } from "./validate.js";
import { createBody, updateBody } from "../types/entity.js";

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
        enum: ["informed-citizen", "informed-active-citizen"],
      },
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
      asseverationJobId: { type: "string", minLength: 1 },
      subtype: { type: "string", minLength: 1 },
      forcedScan: { type: "boolean", minLength: 1 },
    },

    anyOf: [
      {
        required: ["url"],
      },
      {
        required: ["enable"],
      },
      {
        required: ["asseverationJobId"],
      },
      {
        required: ["subtype"],
      },
      {
        required: ["forcedScan"],
      },
    ],
  };

  return await validate(body, updateBody);
};

export { create, update };
