
const { test, assert, request } = require("@payment-gateway/testing");

const {
  createHttpService
} = require("../src");

const { createLogger } = require("@payment-gateway/logger");

const logger = createLogger({
  serviceName: "test-service",
  level: "silent"
});

test("GET /health/live should return 200", async () => {
  const service = createHttpService({
    serviceName: "test-service",
    logger
  });

  const response = await request(service.app)
    .get("/health/live");

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "alive");
  assert.equal(response.body.service, "test-service");
});

test("GET /health/ready should return 200 when ready", async () => {
  const service = createHttpService({
    serviceName: "test-service",
    logger,
    readinessCheck: async () => true
  });

  const response = await request(service.app)
    .get("/health/ready");

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ready");
});

test("GET /health/ready should return 503 when not ready", async () => {
  const service = createHttpService({
    serviceName: "test-service",
    logger,
    readinessCheck: async () => false
  });

  const response = await request(service.app)
    .get("/health/ready");

  assert.equal(response.status, 503);
  assert.equal(response.body.status, "not_ready");
});

test("HTTP requests should receive a request ID", async () => {
  const service = createHttpService({
    serviceName: "test-service",
    logger
  });

  const response = await request(service.app)
    .get("/health/live");

  assert.ok(response.headers["x-request-id"]);
});

test("HTTP requests should preserve a valid incoming request ID", async () => {
  const service = createHttpService({
    serviceName: "test-service",
    logger
  });

  const response = await request(service.app)
    .get("/health/live")
    .set("x-request-id", "test-request-123");

  assert.equal(
    response.headers["x-request-id"],
    "test-request-123"
  );
});
