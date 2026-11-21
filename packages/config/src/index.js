
const path = require("path");
const dotenv = require("dotenv");
const { z } = require("zod");

const envPath = path.resolve(__dirname, "../../../.env");

const result = dotenv.config({ path: envPath });

if (result.error && result.error.code !== "ENOENT") {
  throw result.error;
}

function loadEnv(schema) {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const errors = parsed.error.issues
      .map((issue) => {
        const field = issue.path.join(".") || "environment";
        return `${field}: ${issue.message}`;
      })
      .join("\n");

    throw new Error(
      `Environment configuration validation failed:\n${errors}`
    );
  }

  return parsed.data;
}

module.exports = {
  loadEnv,
  z
};
