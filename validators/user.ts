"use strict";
import { validate } from "./validate.js";

const create = async (body: object): Promise<boolean> => {
  const createBody = {
    type: "object",

    properties: {
      username: { type: "string", minLength: 4 },
      password: {
        type: "string",
        minLength: 8,
        pattern:
          "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?]).+$",
      },
    },

    required: ["username", "password"],
  };

  return await validate(body, createBody);
};

const update = async (body: object): Promise<boolean> => {
  const updateBody = {
    type: "object",

    properties: {
      username: { type: "string", minLength: 1 },
      password: {
        type: "string",
        minLength: 8,
        pattern:
          "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?]).+$",
      },
      role: { type: "string", minLength: 1 },
    },

    required: ["username"],
  };

  return await validate(body, updateBody);
};

const changePassword = async (body: object): Promise<boolean> => {
  const changePasswordBody = {
    type: "object",

    properties: {
      oldPassword: { type: "string", minLength: 1 },
      newPassword: {
        type: "string",
        minLength: 8,
        pattern:
          "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?]).+$",
      },
    },

    required: ["oldPassword", "newPassword"],
  };

  const isValid = await validate(body, changePasswordBody);

  // eslint-disable-next-line
  // @ts-ignore
  if (changePasswordBody.oldPassword == changePasswordBody.newPassword) {
    throw new Error("New password must be different from old one");
  }
  return isValid;
};

export { create, update, changePassword };
