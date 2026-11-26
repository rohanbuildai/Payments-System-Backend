
const { test, assert, request } = require("@payment-gateway/testing");
const { before, beforeEach, after } = require("node:test");
const {
  randomUUID,
  randomBytes,
  createHash
} = require("node:crypto");

if (!process.env.MERCHANT_TEST_DATABASE_URL) {
  test("API key integration tests require MERCHANT_TEST_DATABASE_URL", {
    skip: "Configure a dedicated test database."
  }, () => {});
} else {
  const { createLogger } = require("@payment-gateway/logger");

  const { createMerchantApp } = require("../../src/app");

  const {
    pool,
    closeDatabaseConnection
  } = require("../../src/database/connection");

  const {
    createApiKey,
    findApiKeyByPrefix,
    findApiKeyById,
    findApiKeysByMerchant,
    revokeApiKey
  } = require("../../src/features/api-keys/api-key.repository");

  const logger = createLogger({
    serviceName: "api-key-integration-test",
    level: "silent"
  });

  const service = createMerchantApp({ logger });

  let merchantId;

  async function createTestMerchant(status = "ACTIVE") {
    const result = await pool.query(
      `INSERT INTO public.merchants
        (business_name, contact_name, email, phone, business_type, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        "Integration Tech",
        "Test Merchant",
        `merchant-${randomUUID()}@example.com`,
        "+919876543210",
        "Technology",
        status
      ]
    );

    return result.rows[0].id;
  }

  function createApiKeyPayload(overrides = {}) {
    const publicId = randomUUID().replaceAll("-", "").slice(0, 16);
    const secret = randomBytes(32).toString("base64url");

    return {
      merchant_id: merchantId,
      name: "Integration Test Key",
      key_prefix: `pg_test_${publicId}`,
      secret_hash: createHash("sha256").update(secret).digest("hex"),
      environment: "TEST",
      expires_at: null,
      ...overrides
    };
  }

  function createHttpApiKeyPayload(overrides = {}) {
    return {
      name: "HTTP Integration Key",
      environment: "TEST",
      ...overrides
    };
  }

  async function generateHttpApiKey(overrides = {}) {
    return request(service.app)
      .post(`/api/v1/merchants/${merchantId}/api-keys`)
      .send(createHttpApiKeyPayload(overrides));
  }

  before(async () => {
    await pool.query("SELECT 1");
  });

  beforeEach(async () => {
    await pool.query(
      "TRUNCATE TABLE public.merchant_api_keys, public.merchants CASCADE"
    );

    merchantId = await createTestMerchant();
  });

  after(async () => {
    await closeDatabaseConnection();
  });

  // ==========================================
  // REPOSITORY INTEGRATION TESTS
  // ==========================================

  test("creates an API key and persists its hash in PostgreSQL", async () => {
    const payload = createApiKeyPayload();

    const createdKey = await createApiKey(payload);

    assert.ok(createdKey.id);
    assert.equal(createdKey.merchant_id, merchantId);
    assert.equal(createdKey.name, payload.name);
    assert.equal(createdKey.key_prefix, payload.key_prefix);
    assert.equal(createdKey.environment, "TEST");
    assert.equal(createdKey.status, "ACTIVE");
    assert.equal(createdKey.secret_hash, undefined);

    const databaseResult = await pool.query(
      `SELECT id, merchant_id, key_prefix, secret_hash
       FROM public.merchant_api_keys
       WHERE id = $1`,
      [createdKey.id]
    );

    assert.equal(databaseResult.rowCount, 1);
    assert.equal(
      databaseResult.rows[0].secret_hash,
      payload.secret_hash
    );
  });

  test("finds an API key by its public prefix", async () => {
    const payload = createApiKeyPayload();

    await createApiKey(payload);

    const foundKey = await findApiKeyByPrefix({
      key_prefix: payload.key_prefix
    });

    assert.ok(foundKey);
    assert.equal(foundKey.key_prefix, payload.key_prefix);
    assert.equal(foundKey.secret_hash, payload.secret_hash);
  });

  test("returns null when an API key prefix does not exist", async () => {
    const foundKey = await findApiKeyByPrefix({
      key_prefix: "pg_test_nonexistent123"
    });

    assert.equal(foundKey, null);
  });

  test("finds an API key by ID and merchant ownership", async () => {
    const payload = createApiKeyPayload();
    const createdKey = await createApiKey(payload);

    const foundKey = await findApiKeyById({
      keyId: createdKey.id,
      merchantId
    });

    assert.ok(foundKey);
    assert.equal(foundKey.id, createdKey.id);
    assert.equal(foundKey.merchant_id, merchantId);
    assert.equal(foundKey.secret_hash, undefined);
  });

  test("does not return an API key belonging to another merchant", async () => {
    const payload = createApiKeyPayload();
    const createdKey = await createApiKey(payload);

    const anotherMerchantId = await createTestMerchant();

    const foundKey = await findApiKeyById({
      keyId: createdKey.id,
      merchantId: anotherMerchantId
    });

    assert.equal(foundKey, null);
  });

  test("returns merchant API keys without exposing secret hashes", async () => {
    const firstKey = await createApiKey(createApiKeyPayload());

    const secondKey = await createApiKey(
      createApiKeyPayload({
        name: "Second Integration Key",
        environment: "LIVE",
        key_prefix: `pg_live_${randomUUID().replaceAll("-", "").slice(0, 16)}`
      })
    );

    const keys = await findApiKeysByMerchant(merchantId);

    assert.equal(keys.length, 2);

    const returnedIds = keys.map(key => key.id);

    assert.ok(returnedIds.includes(firstKey.id));
    assert.ok(returnedIds.includes(secondKey.id));

    for (const key of keys) {
      assert.equal(key.secret_hash, undefined);
    }
  });

  test("filters merchant API keys by environment", async () => {
    await createApiKey(createApiKeyPayload());

    await createApiKey(
      createApiKeyPayload({
        environment: "LIVE",
        key_prefix: `pg_live_${randomUUID().replaceAll("-", "").slice(0, 16)}`
      })
    );

    const testKeys = await findApiKeysByMerchant(merchantId, {
      environment: "TEST"
    });

    assert.equal(testKeys.length, 1);
    assert.equal(testKeys[0].environment, "TEST");
  });

  test("filters merchant API keys by status", async () => {
    await createApiKey(createApiKeyPayload());

    const secondKey = await createApiKey(
      createApiKeyPayload({
        key_prefix: `pg_test_${randomUUID().replaceAll("-", "").slice(0, 16)}`
      })
    );

    await revokeApiKey(secondKey.id, merchantId);

    const activeKeys = await findApiKeysByMerchant(merchantId, {
      status: "ACTIVE"
    });

    const revokedKeys = await findApiKeysByMerchant(merchantId, {
      status: "REVOKED"
    });

    assert.equal(activeKeys.length, 1);
    assert.equal(revokedKeys.length, 1);
    assert.equal(activeKeys[0].status, "ACTIVE");
    assert.equal(revokedKeys[0].status, "REVOKED");
  });

  test("revokes an active API key and preserves its database record", async () => {
    const payload = createApiKeyPayload();
    const createdKey = await createApiKey(payload);

    const revokedKey = await revokeApiKey(
      createdKey.id,
      merchantId
    );

    assert.ok(revokedKey);
    assert.equal(revokedKey.status, "REVOKED");
    assert.ok(revokedKey.revoked_at);

    const databaseResult = await pool.query(
      `SELECT status, revoked_at
       FROM public.merchant_api_keys
       WHERE id = $1`,
      [createdKey.id]
    );

    assert.equal(databaseResult.rowCount, 1);
    assert.equal(databaseResult.rows[0].status, "REVOKED");
    assert.ok(databaseResult.rows[0].revoked_at);
  });

  test("does not revoke an already revoked API key twice", async () => {
    const createdKey = await createApiKey(createApiKeyPayload());

    const firstRevocation = await revokeApiKey(
      createdKey.id,
      merchantId
    );

    const secondRevocation = await revokeApiKey(
      createdKey.id,
      merchantId
    );

    assert.ok(firstRevocation);
    assert.equal(secondRevocation, null);
  });

  // ==========================================
  // HTTP INTEGRATION TESTS
  // ==========================================

  test("generates a TEST API key for a PENDING merchant", async () => {
    const pendingMerchantId = await createTestMerchant("PENDING");

    const response = await request(service.app)
      .post(`/api/v1/merchants/${pendingMerchantId}/api-keys`)
      .send(createHttpApiKeyPayload());

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);

    const apiKey = response.body.data.apiKey;

    assert.ok(apiKey.id);
    assert.equal(apiKey.environment, "TEST");
    assert.equal(apiKey.status, "ACTIVE");
    assert.ok(apiKey.key.startsWith("pg_test_"));
    assert.equal(apiKey.secret_hash, undefined);

    const databaseResult = await pool.query(
      `SELECT id, merchant_id, key_prefix, secret_hash
       FROM public.merchant_api_keys
       WHERE id = $1`,
      [apiKey.id]
    );

    assert.equal(databaseResult.rowCount, 1);
    assert.equal(databaseResult.rows[0].merchant_id, pendingMerchantId);
    assert.equal(databaseResult.rows[0].key_prefix, apiKey.key_prefix);

    const returnedSecret = apiKey.key.split("_").slice(3).join("_");

    assert.equal(
      databaseResult.rows[0].secret_hash,
      createHash("sha256").update(returnedSecret).digest("hex")
    );
  });

  test("rejects LIVE API key generation for a PENDING merchant", async () => {
    const pendingMerchantId = await createTestMerchant("PENDING");

    const response = await request(service.app)
      .post(`/api/v1/merchants/${pendingMerchantId}/api-keys`)
      .send(createHttpApiKeyPayload({
        environment: "LIVE"
      }));

    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, "API_KEY_NOT_ALLOWED");
  });

  test("generates a LIVE API key for an ACTIVE merchant", async () => {
    const response = await generateHttpApiKey({
      environment: "LIVE"
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);
    assert.equal(
      response.body.data.apiKey.environment,
      "LIVE"
    );
    assert.ok(
      response.body.data.apiKey.key.startsWith("pg_live_")
    );
  });

  test("rejects API key generation for a SUSPENDED merchant", async () => {
    const suspendedMerchantId = await createTestMerchant("SUSPENDED");

    const response = await request(service.app)
      .post(`/api/v1/merchants/${suspendedMerchantId}/api-keys`)
      .send(createHttpApiKeyPayload());

    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, "API_KEY_NOT_ALLOWED");
  });

  test("rejects API key generation for a REJECTED merchant", async () => {
    const rejectedMerchantId = await createTestMerchant("REJECTED");

    const response = await request(service.app)
      .post(`/api/v1/merchants/${rejectedMerchantId}/api-keys`)
      .send(createHttpApiKeyPayload());

    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, "API_KEY_NOT_ALLOWED");
  });

  test("rejects an invalid merchant UUID", async () => {
    const response = await request(service.app)
      .post("/api/v1/merchants/invalid-id/api-keys")
      .send(createHttpApiKeyPayload());

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
  });

  test("rejects an invalid API key request body", async () => {
    const response = await request(service.app)
      .post(`/api/v1/merchants/${merchantId}/api-keys`)
      .send({
        name: "A",
        environment: "INVALID"
      });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
  });

  test("lists API keys belonging to a merchant", async () => {
    await generateHttpApiKey();
    await generateHttpApiKey({
      name: "Second HTTP Key"
    });

    const response = await request(service.app)
      .get(`/api/v1/merchants/${merchantId}/api-keys`);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.apiKeys.length, 2);

    for (const apiKey of response.body.data.apiKeys) {
      assert.equal(apiKey.secret_hash, undefined);
    }
  });

  test("filters API keys by environment", async () => {
    await generateHttpApiKey();

    await generateHttpApiKey({
      name: "Live HTTP Key",
      environment: "LIVE"
    });

    const response = await request(service.app)
      .get(`/api/v1/merchants/${merchantId}/api-keys`)
      .query({
        environment: "LIVE"
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.apiKeys.length, 1);
    assert.equal(
      response.body.data.apiKeys[0].environment,
      "LIVE"
    );
  });

  test("filters API keys by status", async () => {
    await generateHttpApiKey();

    const secondResponse = await generateHttpApiKey({
      name: "Key To Revoke"
    });

    const keyId = secondResponse.body.data.apiKey.id;

    await request(service.app)
      .delete(`/api/v1/merchants/${merchantId}/api-keys/${keyId}`);

    const response = await request(service.app)
      .get(`/api/v1/merchants/${merchantId}/api-keys`)
      .query({
        status: "REVOKED"
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.apiKeys.length, 1);
    assert.equal(response.body.data.apiKeys[0].status, "REVOKED");
  });

  test("retrieves a specific API key by ID", async () => {
    const generatedResponse = await generateHttpApiKey();

    const keyId = generatedResponse.body.data.apiKey.id;

    const response = await request(service.app)
      .get(`/api/v1/merchants/${merchantId}/api-keys/${keyId}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.apiKey.id, keyId);
    assert.equal(response.body.data.apiKey.secret_hash, undefined);
  });

  test("does not retrieve another merchant's API key", async () => {
    const generatedResponse = await generateHttpApiKey();

    const keyId = generatedResponse.body.data.apiKey.id;
    const anotherMerchantId = await createTestMerchant();

    const response = await request(service.app)
      .get(`/api/v1/merchants/${anotherMerchantId}/api-keys/${keyId}`);

    assert.equal(response.status, 404);
    assert.equal(response.body.error.code, "API_KEY_NOT_FOUND");
  });

  test("returns 404 when retrieving a nonexistent API key", async () => {
    const response = await request(service.app)
      .get(`/api/v1/merchants/${merchantId}/api-keys/${randomUUID()}`);

    assert.equal(response.status, 404);
    assert.equal(response.body.error.code, "API_KEY_NOT_FOUND");
  });

  test("revokes an API key through the HTTP endpoint", async () => {
    const generatedResponse = await generateHttpApiKey();

    const keyId = generatedResponse.body.data.apiKey.id;

    const response = await request(service.app)
      .delete(`/api/v1/merchants/${merchantId}/api-keys/${keyId}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.apiKey.status, "REVOKED");

    const databaseResult = await pool.query(
      `SELECT status, revoked_at
       FROM public.merchant_api_keys
       WHERE id = $1`,
      [keyId]
    );

    assert.equal(databaseResult.rowCount, 1);
    assert.equal(databaseResult.rows[0].status, "REVOKED");
    assert.ok(databaseResult.rows[0].revoked_at);
  });

  test("rejects revoking an already revoked API key", async () => {
    const generatedResponse = await generateHttpApiKey();

    const keyId = generatedResponse.body.data.apiKey.id;

    const firstResponse = await request(service.app)
      .delete(`/api/v1/merchants/${merchantId}/api-keys/${keyId}`);

    const secondResponse = await request(service.app)
      .delete(`/api/v1/merchants/${merchantId}/api-keys/${keyId}`);

    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 409);
    assert.equal(
      secondResponse.body.error.code,
      "API_KEY_ALREADY_REVOKED"
    );
  });

  test("rejects invalid API key filters", async () => {
    const response = await request(service.app)
      .get(`/api/v1/merchants/${merchantId}/api-keys`)
      .query({
        environment: "INVALID"
      });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
  });
}
