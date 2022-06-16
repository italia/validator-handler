"use strict";

import winston from "winston";

const options = {
  file: {
    level: "info",
    filename: "./logs/handler.log",
    handleExceptions: true,
    json: true,
    colorize: false,
    format: winston.format.combine(
      winston.format.timestamp({ format: "MMM-DD-YYYY HH:mm:ss" }),
      winston.format.align(),
      winston.format.printf(
        (info) => `${info.level} - ${[info.timestamp]}: ${info.message}`
      )
    ),
  },
};

const logger = winston.createLogger({
  levels: winston.config.npm.levels,
  transports: [new winston.transports.File(options.file)],
  exitOnError: false,
});

export { logger };
