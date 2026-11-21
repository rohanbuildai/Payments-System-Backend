
const express = require("express");
const helmet = require("helmet");
const { randomUUID } = require("node:crypto");

const {
  runWithRequestContext
} = require("@payment-gateway/logger");

function createHttpService({
  serviceName,
  logger,
  readinessCheck = async () => true
}) {
  if (!serviceName || !logger) {
    throw new Error("serviceName and logger are required");
  }

  const app = express();

  app.disable("x-powered-by");

  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  // Request ID and HTTP logging middleware
  app.use((req, res, next) => {
    const incomingId = req.get("x-request-id");

    const requestId =
      incomingId && incomingId.length <= 128
        ? incomingId
        : randomUUID();

    res.setHeader("x-request-id", requestId);

    runWithRequestContext({ requestId }, () => {
      const startedAt = process.hrtime.bigint();

      res.on("finish", () => {
        const durationMs =
          Number(process.hrtime.bigint() - startedAt) / 1e6;

        logger.info(
          {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: Number(durationMs.toFixed(2))
          },
          "HTTP request completed"
        );
      });

      next();
    });
  });

  // Liveness: process is running
  app.get("/health/live", (req, res) => {
    res.status(200).json({
      status: "alive",
      service: serviceName
    });
  });

  // Readiness: service is ready to receive traffic
  app.get("/health/ready", async (req, res, next) => {
    try {
      const ready = await readinessCheck();

      if (!ready) {
        return res.status(503).json({
          status: "not_ready",
          service: serviceName
        });
      }

      return res.status(200).json({
        status: "ready",
        service: serviceName
      });
    } catch (error) {
      next(error);
    }
  });

  // Centralized error handler
  app.use((err, req, res, next) => {
    logger.error({ err }, "Unhandled HTTP request error");

    if (res.headersSent) {
      return next(err);
    }

    return res.status(err.statusCode || 500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      }
    });
  });

  let server;
  let shutdownPromise;

  function start({ port, host = "0.0.0.0" }) {
    if (server) {
      throw new Error(`${serviceName} is already running`);
    }

    return new Promise((resolve, reject) => {
      server = app.listen(port, host);

      server.once("error", reject);

      server.once("listening", () => {
        logger.info(
          { host, port },
          `${serviceName} started successfully`
        );

        resolve(server);
      });
    });
  }

  function shutdown(signal = "MANUAL") {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = new Promise((resolve, reject) => {
      if (!server) {
        return resolve();
      }

      logger.info({ signal }, "Graceful shutdown initiated");

      const forceCloseTimer = setTimeout(() => {
        logger.warn("Graceful shutdown timed out; closing connections");
        server.closeAllConnections();
      }, 10000);

      forceCloseTimer.unref();

      server.close((error) => {
        clearTimeout(forceCloseTimer);

        if (error) {
          logger.error({ err: error }, "HTTP server shutdown failed");
          return reject(error);
        }

        logger.info("HTTP server closed successfully");
        resolve();
      });
    });

    return shutdownPromise;
  }

  return {
    app,
    start,
    shutdown
  };
}

module.exports = {
  createHttpService
};
