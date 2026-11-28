
const test = require("node:test");
const assert = require("node:assert/strict");

const apiKeyRepository = require("../../../src/features/api-keys/api-key.repository");
const merchantRepository = require("../../../src/features/merchants/merchant.repository");
const apiKeyGenerator = require("../../../src/features/api-keys/utils/api-key-generator");

const servicePath = require.resolve(
  "../../../src/features/api-keys/api-key.service"
);

const loadService = (t, overrides = {}) => {
  const {
    findMerchantById = async () => ({
      id: "merchant-123",
      status: "PENDING"
    }),

    
    createApiKey = async (values) => ({
    id: "key-123",
    merchant_id: values.merchant_id,
    name: values.name,
    key_prefix: values.key_prefix,
    environment: values.environment,
    status: "ACTIVE"    
    }),


    findApiKeyById = async () => ({
      id: "key-123",
      merchant_id: "merchant-123",
      status: "ACTIVE",
      environment: "TEST"
    }),

    findApiKeysByMerchant = async () => [],

    revokeApiKey = async () => ({
      id: "key-123",
      merchant_id: "merchant-123",
      status: "REVOKED"
    }),

    generatePublicId = () => "public123",
    generateSecret = () => "test-secret",
    hashSecret = () => "hashed-test-secret"
  } = overrides;

  t.mock.method(
    merchantRepository,
    "findMerchantById",
    findMerchantById
  );

  t.mock.method(
    apiKeyRepository,
    "createApiKey",
    createApiKey
  );

  t.mock.method(
    apiKeyRepository,
    "findApiKeyById",
    findApiKeyById
  );

  t.mock.method(
    apiKeyRepository,
    "findApiKeysByMerchant",
    findApiKeysByMerchant
  );

  t.mock.method(
    apiKeyRepository,
    "revokeApiKey",
    revokeApiKey
  );

  t.mock.method(
    apiKeyGenerator,
    "generatePublicId",
    generatePublicId
  );

  t.mock.method(
    apiKeyGenerator,
    "generateSecret",
    generateSecret
  );

  t.mock.method(
    apiKeyGenerator,
    "hashSecret",
    hashSecret
  );

  delete require.cache[servicePath];

  return require(servicePath);
};


// --------------------------------------------------
// GENERATE API KEY TESTS
// --------------------------------------------------

test("PENDING merchant can generate TEST API key", async (t) => {
  const service = loadService(t);

  const result = await service.generateApiKey({
    merchantId: "merchant-123",
    name: "Development Key",
    environment: "TEST"
  });

  assert.equal(result.environment, "TEST");
  assert.equal(result.key, "pg_test_public123_test-secret");
  assert.equal(result.key_prefix, "pg_test_public123");
});

test("PENDING merchant cannot generate LIVE API key", async (t) => {
  const service = loadService(t);

  await assert.rejects(
    service.generateApiKey({
      merchantId: "merchant-123",
      name: "Live Key",
      environment: "LIVE"
    }),
    {
      code: "API_KEY_NOT_ALLOWED",
      statusCode: 403
    }
  );
});

test("ACTIVE merchant can generate LIVE API key", async (t) => {
  const service = loadService(t, {
    findMerchantById: async () => ({
      id: "merchant-123",
      status: "ACTIVE"
    })
  });

  const result = await service.generateApiKey({
    merchantId: "merchant-123",
    name: "Production Key",
    environment: "LIVE"
  });

  assert.equal(result.environment, "LIVE");
  assert.equal(result.key, "pg_live_public123_test-secret");
  assert.equal(result.key_prefix, "pg_live_public123");
});

test("SUSPENDED merchant cannot generate API keys", async (t) => {
  const service = loadService(t, {
    findMerchantById: async () => ({
      id: "merchant-123",
      status: "SUSPENDED"
    })
  });

  await assert.rejects(
    service.generateApiKey({
      merchantId: "merchant-123",
      name: "Test Key",
      environment: "TEST"
    }),
    {
      code: "API_KEY_NOT_ALLOWED",
      statusCode: 403
    }
  );
});

test("REJECTED merchant cannot generate API keys", async (t) => {
  const service = loadService(t, {
    findMerchantById: async () => ({
      id: "merchant-123",
      status: "REJECTED"
    })
  });

  await assert.rejects(
    service.generateApiKey({
      merchantId: "merchant-123",
      name: "Test Key",
      environment: "TEST"
    }),
    {
      code: "API_KEY_NOT_ALLOWED",
      statusCode: 403
    }
  );
});

test("Cannot generate API key for a nonexistent merchant", async (t) => {
  const service = loadService(t, {
    findMerchantById: async () => null
  });

  await assert.rejects(
    service.generateApiKey({
      merchantId: "unknown-merchant",
      name: "Test Key",
      environment: "TEST"
    }),
    {
      code: "MERCHANT_NOT_FOUND",
      statusCode: 404
    }
  );
});

test("API key secret is hashed before database persistence", async (t) => {
  let persistedValues;

  const service = loadService(t, {
    createApiKey: async (values) => {
      persistedValues = values;

      return {
        id: "key-123",
        merchant_id: values.merchant_id,
        name: values.name,
        key_prefix: values.key_prefix,
        environment: values.environment,
        status: "ACTIVE"
      };
    }
  });

  await service.generateApiKey({
    merchantId: "merchant-123",
    name: "Development Key",
    environment: "TEST"
  });

  assert.equal(
    persistedValues.secret_hash,
    "hashed-test-secret"
  );

  assert.notEqual(
    persistedValues.secret_hash,
    "test-secret"
  );
});

test("API key generation supports optional expiration", async (t) => {
  let persistedValues;

  const service = loadService(t, {
    createApiKey: async (values) => {
      persistedValues = values;

      return {
        id: "key-123",
        ...values
      };
    }
  });

  await service.generateApiKey({
    merchantId: "merchant-123",
    name: "Development Key",
    environment: "TEST",
    expiresAt: null
  });

  assert.equal(persistedValues.expires_at, null);
});


// --------------------------------------------------
// GET API KEY BY ID TESTS
// --------------------------------------------------

test("Can retrieve an API key belonging to a merchant", async (t) => {
  const service = loadService(t);

  const result = await service.getApiKeyById({
    keyId: "key-123",
    merchantId: "merchant-123"
  });

  assert.equal(result.id, "key-123");
  assert.equal(result.status, "ACTIVE");
});

test("Returns error when API key does not exist", async (t) => {
  const service = loadService(t, {
    findApiKeyById: async () => null
  });

  await assert.rejects(
    service.getApiKeyById({
      keyId: "unknown-key",
      merchantId: "merchant-123"
    }),
    {
      code: "API_KEY_NOT_FOUND",
      statusCode: 404
    }
  );
});


// --------------------------------------------------
// GET API KEYS BY MERCHANT TESTS
// --------------------------------------------------

test("Can retrieve all API keys belonging to a merchant", async (t) => {
  const expectedKeys = [
    { id: "key-1", environment: "TEST" },
    { id: "key-2", environment: "LIVE" }
  ];

  const service = loadService(t, {
    findApiKeysByMerchant: async () => expectedKeys
  });

  const result = await service.getApiKeysByMerchant({
    merchantId: "merchant-123"
  });

  assert.deepEqual(result, expectedKeys);
});

test("Passes environment and status filters to repository", async (t) => {
  let receivedMerchantId;
  let receivedFilters;

  const service = loadService(t, {
    findApiKeysByMerchant: async (merchantId, filters) => {
      receivedMerchantId = merchantId;
      receivedFilters = filters;

      return [];
    }
  });

  await service.getApiKeysByMerchant({
    merchantId: "merchant-123",
    filters: {
      environment: "TEST",
      status: "ACTIVE"
    }
  });

  assert.equal(receivedMerchantId, "merchant-123");

  assert.deepEqual(receivedFilters, {
    environment: "TEST",
    status: "ACTIVE"
  });
});


// --------------------------------------------------
// REVOKE API KEY TESTS
// --------------------------------------------------

test("Can successfully revoke an active API key", async (t) => {
  const service = loadService(t);

  const result = await service.revokeApiKey({
    keyId: "key-123",
    merchantId: "merchant-123"
  });

  assert.equal(result.id, "key-123");
  assert.equal(result.status, "REVOKED");
});

test("Cannot revoke a nonexistent API key", async (t) => {
  const service = loadService(t, {
    findApiKeyById: async () => null
  });

  await assert.rejects(
    service.revokeApiKey({
      keyId: "unknown-key",
      merchantId: "merchant-123"
    }),
    {
      code: "API_KEY_NOT_FOUND",
      statusCode: 404
    }
  );
});

test("Cannot revoke an already revoked API key", async (t) => {
  const service = loadService(t, {
    findApiKeyById: async () => ({
      id: "key-123",
      merchant_id: "merchant-123",
      status: "REVOKED"
    })
  });

  await assert.rejects(
    service.revokeApiKey({
      keyId: "key-123",
      merchantId: "merchant-123"
    }),
    {
      code: "API_KEY_ALREADY_REVOKED",
      statusCode: 409
    }
  );
});

test("Handles concurrent API key revocation", async (t) => {
  const service = loadService(t, {
    revokeApiKey: async () => null
  });

  await assert.rejects(
    service.revokeApiKey({
      keyId: "key-123",
      merchantId: "merchant-123"
    }),
    {
      code: "API_KEY_REVOCATION_CONFLICT",
      statusCode: 409
    }
  );
});
