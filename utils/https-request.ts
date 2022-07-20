import axios from "axios";

const call = async (method, host, path, headers, payload = null) => {
  if (!host || !path) {
    throw new Error("Empty host or path in Axios post form data");
  }

  let responseObj = {
    statusCode: 500,
    headers: null,
    data: { message: "Empty response from axios-request" },
  };

  try {
    const config = {
      method: method,
      url: host + path,
      headers: headers,
    };

    if (payload) {
      config["data"] = payload;
    }

    const res = await axios(config);

    responseObj = {
      statusCode: res.status,
      headers: res.headers,
      data: res.data,
    };
  } catch (e) {
    if (e.response) {
      responseObj = {
        statusCode: e.response.status,
        headers: e.response.headers,
        data: e.response.data,
      };
    }
  }

  return responseObj;
};

export { call };
