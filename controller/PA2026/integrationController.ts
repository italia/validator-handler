"use strict";

import dotenv from "dotenv";
dotenv.config();

import { get, patch, post } from "../../utils/https-request";
import { response } from "../../types/https-request";
import querystring from "querystring";
import { tokenController } from "./tokenController";
import { dbWS } from "../../database/connection";

const retrieveToken = async () => {
  try {
    const result: response = await post(
      process.env.PA2026_HOST,
      process.env.PA2026_AUTH_PATH,
      {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      querystring.stringify({
        grant_type: process.env.PA2026_AUTH_GRANT_TYPE,
        client_id: process.env.PA2026_AUTH_CLIENT_ID,
        client_secret: process.env.PA2026_AUTH_CLIENT_SECRET,
        username: process.env.PA2026_AUTH_USERNAME,
        password: process.env.PA2026_AUTH_PASSWORD,
      })
    );

    if (result?.statusCode === 200) {
      return {
        value: result.data.access_token ?? "",
        instanceUrl: result.data.instance_url ?? "",
      };
    }

    return null;
  } catch (e) {
    return null;
  }
};

const callQuery = async (query: string, retry = 3) => {
  if (retry <= 0) {
    return null;
  }

  try {
    let tokenValues = await new tokenController(dbWS).retrieve();

    const result = await get(
      tokenValues.instanceUrl,
      process.env.PA2026_QUERY_PATH,
      {
        Authorization: "Bearer " + tokenValues.value,
      },
      { q: query }
    );

    if (result?.statusCode === 200) {
      return result.data;
    } else if (result?.statusCode === 401) {
      await new tokenController(dbWS).create();
    }
  } catch (e) {}

  return await callQuery(query, retry - 1);
};

const callPatch = async (body: object, path: string, retry = 3) => {
  if (retry <= 0) {
    return null;
  }

  try {
    let tokenValues = await new tokenController(dbWS).retrieve();

    const result = await patch(
      tokenValues.instanceUrl,
      path,
      {
        Authorization: "Bearer " + tokenValues.value,
        "Content-Type": "application/json",
      },
      JSON.stringify(body)
    );

    if (result?.statusCode >= 200 && result?.statusCode <= 204) {
      return result?.data ?? {};
    } else if (result?.statusCode === 401) {
      await new tokenController(dbWS).create();
    }
  } catch (e) {}

  return await callPatch(body, path, retry - 1);
};

export { retrieveToken, callQuery, callPatch };
