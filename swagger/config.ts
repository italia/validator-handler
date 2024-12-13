import dotenv from "dotenv";
dotenv.config();

export const swaggerDefinition = {
  openapi: "3.0.1",
  info: {
    title: "Validator Handler API",
    version: "1.0.2",
    description: "Documentation of the API exposed by the validator handler.",
  },
  host: process.env.HOST,
  basePath: "/",
  definitions: {
    Error: {
      properties: {
        status: {
          type: "string",
        },
        timestamp: {
          type: "integer",
        },
        error: {
          type: "object",
          properties: {
            code: {
              type: "integer",
            },
            message: {
              type: "string",
            },
          },
        },
      },
    },
    Token: {
      properties: {
        token: {
          type: "string",
        },
        expiresIn: {
          type: "integer",
        },
      },
    },
    Entity: {
      properties: {
        id: {
          type: "string",
        },
        external_id: {
          type: "string",
        },
        url: {
          type: "string",
        },
        enable: {
          type: "boolean",
        },
        asseverationJobId: {
          type: "string",
        },
        type: {
          type: "string",
        },
        subtype: {
          type: "string",
        },
        status: {
          type: "boolean",
        },
        updateAt: {
          type: "string",
        },
        createdAt: {
          type: "string",
        },
      },
    },
    Job: {
      properties: {
        id: {
          type: "integer",
        },
        startAt: {
          type: "string",
        },
        endAt: {
          type: "string",
        },
        scanUrl: {
          type: "boolean",
        },
        type: {
          type: "string",
        },
        status: {
          type: "string",
        },
        s3HTMLUrl: {
          type: "string",
        },
        s3JSONUrl: {
          type: "string",
        },
        jsonResult: {
          type: "object",
        },
        preserve: {
          type: "boolean",
        },
        preserve_reason: {
          type: "string",
        },
      },
    },
  },
};

export const options = {
  swaggerDefinition: swaggerDefinition,
  apis: ["./routes/*.ts", "./routes/*.js"],
};
