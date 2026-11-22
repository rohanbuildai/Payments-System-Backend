
const { createLogger } = require("@payment-gateway/logger");

const env = require("./config/env");
const { createMerchantApp } = require("./app");
const { closeDatabaseConnection } = require("./database/connection");

const logger = createLogger({
  serviceName: "merchant-service",
  level: env.LOG_LEVEL
});

const service = createMerchantApp({ logger });

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  try {
    await service.shutdown(signal);
    await closeDatabaseConnection();

    logger.info("Merchant Service shutdown completed");
  } catch (error) {
    logger.error(
      { err: error },
      "Merchant Service shutdown failed"
    );

    process.exitCode = 1;
  }
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

service.start({ port: env.PORT }).catch(async (error) => {
  logger.fatal(
    { err: error },
    "Merchant Service startup failed"
  );

  process.exitCode = 1;

  try {
    await closeDatabaseConnection();
  } catch (shutdownError) {
    logger.error(
      { err: shutdownError },
      "Database cleanup after startup failure failed"
    );
  }
});
