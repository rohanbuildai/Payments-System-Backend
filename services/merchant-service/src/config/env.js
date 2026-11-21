
const { loadEnv, z } = require("@payment-gateway/config");

const env = loadEnv(
  z.object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    PORT: z.coerce
      .number()
      .int()
      .min(1)
      .max(65535)
      .default(3001),

    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),

    MERCHANT_DATABASE_URL: z.string().url()
  })
);

module.exports = env;
