import {
  successResponseType,
  errorResponseType,
} from "../types/api-response-body";

const errorResponse = (
  error_code: number,
  errorObj: string | { message: string },
  http_code: number,
  res: errorResponseType
): void => {
  let message = "Generic error";

  if (typeof errorObj == "string") {
    message = errorObj;
  } else if (errorObj.message) {
    message = errorObj.message;
  }

  res.status(http_code).json({
    status: "ko",
    timestamp: Date.now(),
    error: {
      code: error_code,
      message: message,
    },
  });
};

const succesResponse = (
  response: unknown,
  res: successResponseType,
  http_code = 200,
  isHtml = false
): void => {
  if (isHtml) {
    res.writeHead(http_code, { "Content-Type": "text/html" });
    res.write(response);
    res.end();
  } else {
    res.status(http_code).json({
      status: "ok",
      timestamp: Date.now(),
      data: response,
    });
  }
};

export { errorResponse, succesResponse };
