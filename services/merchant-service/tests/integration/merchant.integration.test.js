
const { test, assert, request } = require("@payment-gateway/testing");
const { before, beforeEach, after } = require("node:test");
const { randomUUID } = require("node:crypto");

if (!process.env.MERCHANT_TEST_DATABASE_URL) {
  test("merchant integration tests require MERCHANT_TEST_DATABASE_URL", {
    skip: "Configure a dedicated test database."
  }, () => {});
} else {
  const { createLogger } = require("@payment-gateway/logger");

  const {
    createMerchantApp
  } = require("../../src/app");

  const {
    pool,
    closeDatabaseConnection
  } = require("../../src/database/connection");

  const logger = createLogger({
    serviceName: "merchant-service-integration-test",
    level: "silent"
  });

  const service = createMerchantApp({ logger });

  function createMerchantPayload(overrides = {}) {
    return {
      business_name: "Integration Tech",
      contact_name: "Test Merchant",
      email: `merchant-${randomUUID()}@example.com`,
      phone: "+919876543210",
      business_type: "Technology",
      ...overrides
    };
  }

  before(async () => {
    await pool.query("SELECT 1");
  });

  beforeEach(async () => {
    await pool.query(
      "TRUNCATE TABLE public.merchant_api_keys, public.merchants CASCADE"
    );
  });

  after(async () => {
    await closeDatabaseConnection();
  });

  test("creates a merchant and persists it in PostgreSQL", async () => {
    const payload = createMerchantPayload();

    const response = await request(service.app)
      .post("/api/v1/merchants")
      .send(payload);

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.merchant.email, payload.email);
    assert.equal(response.body.data.merchant.status, "PENDING");
    assert.ok(response.body.data.merchant.id);

    const databaseResult = await pool.query(
      "SELECT id, email, status FROM public.merchants WHERE id = $1",
      [response.body.data.merchant.id]
    );

    assert.equal(databaseResult.rowCount, 1);
    assert.equal(databaseResult.rows[0].email, payload.email);
    assert.equal(databaseResult.rows[0].status, "PENDING");
  });

  test("rejects duplicate email regardless of casing", async () => {
    const payload = createMerchantPayload({
      email: "duplicate@example.com"
    });

    const firstResponse = await request(service.app)
      .post("/api/v1/merchants")
      .send(payload);

    const secondResponse = await request(service.app)
      .post("/api/v1/merchants")
      .send({
        ...payload,
        email: "DUPLICATE@EXAMPLE.COM"
      });

    assert.equal(firstResponse.status, 201);
    assert.equal(secondResponse.status, 409);

    assert.equal(
      secondResponse.body.error.code,
      "MERCHANT_ALREADY_EXISTS"
    );
  });

  test("rejects invalid email and phone values", async () => {
    const response = await request(service.app)
      .post("/api/v1/merchants")
      .send(createMerchantPayload({
        email: "not-an-email",
        phone: "9876543210"
      }));

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");

    assert.ok(
      response.body.error.details.some(item => item.field === "email")
    );

    assert.ok(
      response.body.error.details.some(item => item.field === "phone")
    );
  });

  test("rejects client-controlled merchant status", async () => {
    const response = await request(service.app)
      .post("/api/v1/merchants")
      .send(createMerchantPayload({
        status: "ACTIVE"
      }));

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
  });

  test("concurrent registrations create at most one merchant", async () => {
    const payload = createMerchantPayload({
      email: "concurrent@example.com"
    });

    const responses = await Promise.all([
      request(service.app)
        .post("/api/v1/merchants")
        .send(payload),

      request(service.app)
        .post("/api/v1/merchants")
        .send(payload)
    ]);

    const statuses = responses
      .map(response => response.status)
      .sort();

    assert.deepEqual(statuses, [201, 409]);

    const databaseResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM public.merchants
       WHERE LOWER(email) = $1`,
      [payload.email]
    );

    assert.equal(databaseResult.rows[0].count, 1);
  });

  test("readiness returns 200 when PostgreSQL is reachable", async () => {
    const response = await request(service.app)
      .get("/health/ready");

    assert.equal(response.status, 200);
    assert.equal(response.body.status, "ready");
  });
}
