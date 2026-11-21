
const pino = require("pino");
const { AsyncLocalStorage } = require("node:async_hooks");

const requestContext = new AsyncLocalStorage();

function runWithRequestContext(context, callback) {
  return requestContext.run(context, callback);
}

function getRequestContext() {
  return requestContext.getStore() || {};
}

function createLogger(options = {}) {
  const {
    serviceName,
    level = process.env.LOG_LEVEL || "info"
  } = options;

  if (!serviceName) {
    throw new Error("Logger requires a serviceName");
  }

  const logger = pino({
    level,

    base: {
      service: serviceName,
      environment: process.env.NODE_ENV || "development"
    },

    timestamp: pino.stdTimeFunctions.isoTime,

    serializers: {
      err: pino.stdSerializers.err
    },

    redact: {
      paths: [
        "password",
        "*.password",
        "authorization",
        "*.authorization",
        "cookie",
        "*.cookie",
        "token",
        "*.token",
        "accessToken",
        "*.accessToken",
        "refreshToken",
        "*.refreshToken",
        "apiKey",
        "*.apiKey",
        "secret",
        "*.secret"
      ],
      censor: "[REDACTED]"
    },

    mixin() {
      const context = getRequestContext();

      return {
        ...(context.requestId && {
          requestId: context.requestId
        })
      };
    }
  });

  return logger;
}

module.exports = {
  createLogger,
  runWithRequestContext,
  getRequestContext
};
