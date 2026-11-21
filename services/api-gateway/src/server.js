
const env = require("./config/env");

const { createLogger } = require("@payment-gateway/logger");
const { createHttpService } = require("@payment-gateway/service-runtime");

const logger = createLogger({
  serviceName: "api-gateway",
  level: env.LOG_LEVEL
});

const service = createHttpService({
  serviceName: "api-gateway",
  logger
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;

  shuttingDown = true;

  try {
    await service.shutdown(signal);
    process.exitCode = 0;
  } catch (error) {
    logger.error({ err: error }, "Gateway shutdown failed");
    process.exitCode = 1;
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

async function bootstrap() {
  try {
    await service.start({
      port: env.PORT
    });
  } catch (error) {
    logger.fatal({ err: error }, "Gateway startup failed");
    process.exitCode = 1;
  }
}

bootstrap();
