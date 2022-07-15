"use strict";
import { logger } from "../utils/logger";
import { tokenController } from "../controller/pa2026AuthController";
import { dbWS } from "../database/connection";

const run = async () => {
  try {
    await logger.info("[PA2026 Token Cron]: Task start");
    logger.info(
      "[PA2026 Token Cron]: Token info: " +
        JSON.stringify(
          (await new tokenController(dbWS).updateToken()) ?? "no action"
        )
    );
    await logger.info("[PA2026 Token Cron]: Task finish");
  } catch (e) {
    await logger.info("[PA2026 Token Cron]: Exception: " + JSON.stringify(e));
    console.log("[PA2026 Token Cron]: Exception: ", e);
  }
};

export { run };
