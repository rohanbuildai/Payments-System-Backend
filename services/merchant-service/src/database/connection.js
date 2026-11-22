
const { Pool } = require("pg");

const env = require("../config/env");
const { createLogger } = require("@payment-gateway/logger");

const logger = createLogger({
  serviceName: "merchant-service",
  level: env.LOG_LEVEL
});

const pool = new Pool({
  connectionString: env.MERCHANT_DATABASE_URL,

  max: 10,

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 5000,

  application_name: "merchant-service"
});

pool.on("error", (error) => {
  logger.error(
    { err: error },
    "Unexpected PostgreSQL pool error"
  );
});

async function checkDatabaseConnection() {
  const result = await pool.query(`
    SELECT
      current_database() AS database,
      current_user AS database_user,
      NOW() AS server_time
  `);

  return result.rows[0];
}

async function closeDatabaseConnection() {
  await pool.end();

  logger.info("PostgreSQL connection pool closed");
}

module.exports = {
  pool,
  checkDatabaseConnection,
  closeDatabaseConnection
};
