
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  generateApiKeySchema,
  listApiKeysSchema,
  apiKeyParamsSchema,
  apiKeyResourceParamsSchema
} = require("../../../src/features/api-keys/validators/api-key.validation");

describe("generateApiKeySchema", () => {
  const validPayload = {
    name: "Production Key",
    environment: "LIVE"
  };

  test("accepts a valid TEST API key payload", () => {
    const result = generateApiKeySchema.safeParse({
      ...validPayload,
      environment: "TEST"
    });

    assert.equal(result.success, true);
  });

  test("accepts a valid LIVE API key payload", () => {
    const result = generateApiKeySchema.safeParse(validPayload);

    assert.equal(result.success, true);
  });

  test("trims whitespace from the API key name", () => {
    const result = generateApiKeySchema.safeParse({
      ...validPayload,
      name: "  Production Key  "
    });

    assert.equal(result.success, true);
    assert.equal(result.data.name, "Production Key");
  });

  test("rejects a name shorter than 2 characters", () => {
    const result = generateApiKeySchema.safeParse({
      ...validPayload,
      name: "A"
    });

    assert.equal(result.success, false);
  });

  test("rejects a name longer than 100 characters", () => {
    const result = generateApiKeySchema.safeParse({
      ...validPayload,
      name: "A".repeat(101)
    });

    assert.equal(result.success, false);
  });

  test("rejects an invalid environment", () => {
    const result = generateApiKeySchema.safeParse({
      ...validPayload,
      environment: "DEVELOPMENT"
    });

    assert.equal(result.success, false);
  });

  test("accepts a valid expiration datetime with timezone offset", () => {
    const result = generateApiKeySchema.safeParse({
      ...validPayload,
      expiresAt: "2027-12-31T23:59:59+05:30"
    });

    assert.equal(result.success, true);
  });

  test("accepts null expiration", () => {
    const result = generateApiKeySchema.safeParse({
      ...validPayload,
      expiresAt: null
    });

    assert.equal(result.success, true);
  });

  test("accepts an omitted expiration", () => {
    const result = generateApiKeySchema.safeParse(validPayload);

    assert.equal(result.success, true);
  });

  test("rejects an invalid expiration datetime", () => {
    const result = generateApiKeySchema.safeParse({
      ...validPayload,
      expiresAt: "not-a-date"
    });

    assert.equal(result.success, false);
  });

  test("rejects unknown fields", () => {
    const result = generateApiKeySchema.safeParse({
      ...validPayload,
      status: "ACTIVE",
      secret_hash: "some-hash"
    });

    assert.equal(result.success, false);
  });
});

describe("listApiKeysSchema", () => {
  test("accepts valid environment and status filters", () => {
    const result = listApiKeysSchema.safeParse({
      environment: "TEST",
      status: "ACTIVE"
    });

    assert.equal(result.success, true);
  });

  test("accepts an empty filter object", () => {
    const result = listApiKeysSchema.safeParse({});

    assert.equal(result.success, true);
  });

  test("accepts environment filter independently", () => {
    const result = listApiKeysSchema.safeParse({
      environment: "LIVE"
    });

    assert.equal(result.success, true);
  });

  test("accepts status filter independently", () => {
    const result = listApiKeysSchema.safeParse({
      status: "REVOKED"
    });

    assert.equal(result.success, true);
  });

  test("rejects an invalid environment filter", () => {
    const result = listApiKeysSchema.safeParse({
      environment: "DEVELOPMENT"
    });

    assert.equal(result.success, false);
  });

  test("rejects an invalid status filter", () => {
    const result = listApiKeysSchema.safeParse({
      status: "EXPIRED"
    });

    assert.equal(result.success, false);
  });

  test("rejects unknown query parameters", () => {
    const result = listApiKeysSchema.safeParse({
      environment: "TEST",
      merchantId: "some-id"
    });

    assert.equal(result.success, false);
  });
});

describe("apiKeyParamsSchema", () => {
  test("accepts a valid merchant UUID", () => {
    const result = apiKeyParamsSchema.safeParse({
      merchantId: "550e8400-e29b-41d4-a716-446655440000"
    });

    assert.equal(result.success, true);
  });

  test("rejects an invalid merchant UUID", () => {
    const result = apiKeyParamsSchema.safeParse({
      merchantId: "invalid-merchant-id"
    });

    assert.equal(result.success, false);
  });

  test("rejects missing merchantId", () => {
    const result = apiKeyParamsSchema.safeParse({});

    assert.equal(result.success, false);
  });

  test("rejects unknown route parameters", () => {
    const result = apiKeyParamsSchema.safeParse({
      merchantId: "550e8400-e29b-41d4-a716-446655440000",
      extra: "unexpected"
    });

    assert.equal(result.success, false);
  });
});

describe("apiKeyResourceParamsSchema", () => {
  const validParams = {
    merchantId: "550e8400-e29b-41d4-a716-446655440000",
    keyId: "650e8400-e29b-41d4-a716-446655440000"
  };

  test("accepts valid merchant and API key UUIDs", () => {
    const result = apiKeyResourceParamsSchema.safeParse(validParams);

    assert.equal(result.success, true);
  });

  test("rejects an invalid merchant UUID", () => {
    const result = apiKeyResourceParamsSchema.safeParse({
      ...validParams,
      merchantId: "invalid-id"
    });

    assert.equal(result.success, false);
  });

  test("rejects an invalid API key UUID", () => {
    const result = apiKeyResourceParamsSchema.safeParse({
      ...validParams,
      keyId: "invalid-id"
    });

    assert.equal(result.success, false);
  });

  test("rejects missing keyId", () => {
    const result = apiKeyResourceParamsSchema.safeParse({
      merchantId: validParams.merchantId
    });

    assert.equal(result.success, false);
  });

  test("rejects unknown route parameters", () => {
    const result = apiKeyResourceParamsSchema.safeParse({
      ...validParams,
      extra: "unexpected"
    });

    assert.equal(result.success, false);
  });
});
