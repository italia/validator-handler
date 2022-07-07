import dotenv from "dotenv";
dotenv.config();

export const swaggerDefinition = {
  swagger: "2.0",
  info: {
    title: "Validator Handler API",
    version: "1.0.0",
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
  },
};

export const options = {
  swaggerDefinition: swaggerDefinition,
  apis: ["./routes/*.ts", "./routes/*.js"],
};
