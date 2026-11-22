
const { createHttpService } = require("@payment-gateway/service-runtime");
const { createLogger } = require("@payment-gateway/logger");

const env = require("./config/env");
const merchantRoutes = require("./features/merchants/merchant.routes");
const { checkDatabaseConnection } = require("./database/connection");

const SERVICE_NAME = "merchant-service";

function createMerchantApp({
  logger: suppliedLogger,
  readinessCheck = checkDatabaseConnection
} = {}) {
  const logger = suppliedLogger || createLogger({
    serviceName: SERVICE_NAME,
    level: env.LOG_LEVEL
  });

  const service = createHttpService({
    serviceName: SERVICE_NAME,
    logger,
    readinessCheck: async () => Boolean(await readinessCheck())
  });

  service.app.use("/api/v1/merchants", merchantRoutes);

  // Register error handler after application routes.
  service.app.use((err, req, res, next) => {
    logger.error({ err }, "Unhandled Merchant Service error");

    if (res.headersSent) {
      return next(err);
    }

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      }
    });
  });

  return service;
}

module.exports = {
  createMerchantApp
};
