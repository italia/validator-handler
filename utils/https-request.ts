import https from "https";
import querystring from "querystring";

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

  headers = {
    ...headers,
    "Content-Length": Buffer.byteLength(payload),
  };

  return await call("POST", host, path, headers, payload);
};

const patch = async (host, path, headers, payload): Promise<response> => {
  headers = {
    ...headers,
    "Content-Length": Buffer.byteLength(payload),
  };

  return await call("PATCH", host, path, headers, payload);
};

const put = async (host, path, headers, payload): Promise<response> => {
  headers = {
    ...headers,
    "Content-Length": Buffer.byteLength(payload),
  };

  return await call("PUT", host, path, headers, payload);
};

const get = async (host, path, headers, params): Promise<response> => {
  const querystringVal = querystring.stringify(params);

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

const call = (method, host, path, headers, payload): Promise<response> =>
  new Promise((resolve, reject) => {
    const options = {
      host,
      path,
      method,
      mode: "cors",
      cache: "no-cache",
      headers,
    };

    const req = https.request(options, (res) => {
      let buffer = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (buffer += chunk));

      res.on("end", () => {
        let data = {};
        if (buffer) {
          data = JSON.parse(buffer);
        }

        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
        });
      });
    });

    req.on("error", (e) => reject(e.message));
    req.write(payload);
    req.end();
  });

export { post, patch, put, get, del };
