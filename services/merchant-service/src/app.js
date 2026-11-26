
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

  service.app.use((err, req, res, next) => {
    // Delegate if response headers have already been sent.
    if (res.headersSent) {
      return next(err);
    }

    const isClientError =
      Number.isInteger(err.statusCode) &&
      err.statusCode >= 400 &&
      err.statusCode < 500 &&
      typeof err.code === "string";

    if (isClientError) {
      logger.warn(
        {
          err,
          requestId: req.id
        },
        "Application request error"
      );

      return res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code,
          message: err.message
        }
      });
    }

    logger.error(
      {
        err,
        requestId: req.id
      },
      "Unhandled Merchant Service error"
    );

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
