import https from "https";
import querystring from "querystring";
import axios from "axios"

import { response } from "../types/https-request";

/**
 *  payload = JSON.stringify(payload) --> JSON BODY
 *  payload = querystring.stringify(payload) --> X-WWW BODY
 **/

const post = async (
  host,
  path,
  headers,
  payload,
  params = {}
): Promise<response> => {
  const querystringVal = querystring.stringify(params);

  if (querystringVal) {
    path = path + "?" + querystringVal;
  }

  return await call("POST", host, path, headers, payload);
};

const patch = async (host, path, headers, payload): Promise<response> => {

  return await call("PATCH", host, path, headers, payload);
};

const put = async (host, path, headers, payload): Promise<response> => {

  return await call("PUT", host, path, headers, payload);
};

const get = async (host, path, headers, params): Promise<response> => {
  const querystringVal = await querystring.stringify(params);

  if (querystringVal) {
    path = path + "?" + querystringVal;
  }

  return await call("GET", host, path, headers, "");
};

const del = async (host, path, headers, params): Promise<response> => {
  const querystringVal = querystring.stringify(params);

  if (querystringVal) {
    path = path + "?" + querystringVal;
  }

  return await call("DELETE", host, path, headers, "");
};

const call = async (method, host, path, headers, payload) : Promise<any> => {
    if (!Boolean(host) || !Boolean(path)) {
      throw new Error ('Empty host or path in Axios post form data')
    }

    let responseObj = {
      statusCode: 500,
      headers: null,
      data: { message: 'Empty response from axios-request' }
    }

    try {
      const config = {
        method: method,
        url: host + path,
        data: payload,
        headers: headers
      }

      console.log('CONFIG', config)


      const res = await axios(config)

      console.log('RES', res)

      process.exit(0)
      responseObj = {
        statusCode: res.status,
        headers: res.headers,
        data: res.data
      }
    } catch(e) {
      if (e.response) {
        responseObj = {
          statusCode: e.response.status,
          headers: e.response.headers,
          data: e.response.data
        }
      }
    }

    return responseObj
  };

export { post, patch, put, get, del };
