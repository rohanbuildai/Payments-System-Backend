
const test = require("node:test");
const assert = require("node:assert/strict");

const apiKeyService = require("../../src/features/api-keys/api-key.service");
const apiKeyController = require("../../src/features/api-keys/api-key.controller");


// --------------------------------------------------
// TEST HELPERS
// --------------------------------------------------

const createResponse = () => {
  const res = {
    statusCode: null,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      this.body = data;
      return this;
    }
  };

  return res;
};


// --------------------------------------------------
// GENERATE API KEY TESTS
// --------------------------------------------------

test("returns 201 for successful API key generation", async (t) => {
  let receivedArguments;

  t.mock.method(
    apiKeyService,
    "generateApiKey",
    async (args) => {
      receivedArguments = args;

      return {
        id: "key-123",
        name: "Development Key",
        key: "pg_test_public123_secret",
        environment: "TEST",
        status: "ACTIVE"
      };
    }
  );

  const req = {
    params: {
      merchantId: "merchant-123"
    },
    body: {
      name: "Development Key",
      environment: "TEST",
      expiresAt: null
    }
  };

  const res = createResponse();
  const next = () => {};

  await apiKeyController.generateApiKey(req, res, next);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, "API key generated successfully");

  assert.equal(
    res.body.data.apiKey.key,
    "pg_test_public123_secret"
  );

  assert.deepEqual(receivedArguments, {
    merchantId: "merchant-123",
    name: "Development Key",
    environment: "TEST",
    expiresAt: null
  });
});


// --------------------------------------------------
// GET API KEY BY ID TESTS
// --------------------------------------------------

test("returns 200 when API key is retrieved successfully", async (t) => {
  let receivedArguments;

  t.mock.method(
    apiKeyService,
    "getApiKeyById",
    async (args) => {
      receivedArguments = args;

      return {
        id: "key-123",
        name: "Development Key",
        key_prefix: "pg_test_public123",
        environment: "TEST",
        status: "ACTIVE"
      };
    }
  );

  const req = {
    params: {
      merchantId: "merchant-123",
      keyId: "key-123"
    }
  };

  const res = createResponse();
  const next = () => {};

  await apiKeyController.getApiKeyById(req, res, next);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, "API key retrieved successfully");

  assert.equal(res.body.data.apiKey.id, "key-123");

  assert.deepEqual(receivedArguments, {
    keyId: "key-123",
    merchantId: "merchant-123"
  });
});


// --------------------------------------------------
// GET ALL API KEYS TESTS
// --------------------------------------------------

test("returns 200 when merchant API keys are retrieved", async (t) => {
  let receivedArguments;

  const expectedKeys = [
    {
      id: "key-1",
      environment: "TEST",
      status: "ACTIVE"
    },
    {
      id: "key-2",
      environment: "LIVE",
      status: "ACTIVE"
    }
  ];

  t.mock.method(
    apiKeyService,
    "getApiKeysByMerchant",
    async (args) => {
      receivedArguments = args;
      return expectedKeys;
    }
  );

  const req = {
    params: {
      merchantId: "merchant-123"
    },
    validatedQuery: {}
  };

  const res = createResponse();
  const next = () => {};

  await apiKeyController.getApiKeysByMerchant(req, res, next);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, "API keys retrieved successfully");

  assert.deepEqual(res.body.data.apiKeys, expectedKeys);

  assert.deepEqual(receivedArguments, {
    merchantId: "merchant-123",
    filters: {}
  });
});

test("passes API key filters from query parameters to service", async (t) => {
  let receivedArguments;

  t.mock.method(
    apiKeyService,
    "getApiKeysByMerchant",
    async (args) => {
      receivedArguments = args;
      return [];
    }
  );

  const req = {
    params: {
      merchantId: "merchant-123"
    },
    validatedQuery: {
      environment: "TEST",
      status: "ACTIVE"
    }
  };

  const res = createResponse();
  const next = () => {};

  await apiKeyController.getApiKeysByMerchant(req, res, next);

  assert.deepEqual(receivedArguments, {
    merchantId: "merchant-123",
    filters: {
      environment: "TEST",
      status: "ACTIVE"
    }
  });
});


// --------------------------------------------------
// REVOKE API KEY TESTS
// --------------------------------------------------

test("returns 200 when API key is revoked successfully", async (t) => {
  let receivedArguments;

  t.mock.method(
    apiKeyService,
    "revokeApiKey",
    async (args) => {
      receivedArguments = args;

      return {
        id: "key-123",
        status: "REVOKED",
        revoked_at: new Date()
      };
    }
  );

  const req = {
    params: {
      merchantId: "merchant-123",
      keyId: "key-123"
    }
  };

  const res = createResponse();
  const next = () => {};

  await apiKeyController.revokeApiKey(req, res, next);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, "API key revoked successfully");
  assert.equal(res.body.data.apiKey.status, "REVOKED");

  assert.deepEqual(receivedArguments, {
    keyId: "key-123",
    merchantId: "merchant-123"
  });
});


// --------------------------------------------------
// ERROR HANDLING TESTS
// --------------------------------------------------

test("forwards API key generation errors to Express", async (t) => {
  const expectedError = new Error("Merchant not found");

  t.mock.method(
    apiKeyService,
    "generateApiKey",
    async () => {
      throw expectedError;
    }
  );

  const req = {
    params: {
      merchantId: "merchant-123"
    },
    body: {
      name: "Development Key",
      environment: "TEST"
    }
  };

  const res = createResponse();
  let forwardedError;

  const next = (error) => {
    forwardedError = error;
  };

  await apiKeyController.generateApiKey(req, res, next);

  assert.equal(forwardedError, expectedError);
});

test("forwards API key retrieval errors to Express", async (t) => {
  const expectedError = new Error("API key not found");

  t.mock.method(
    apiKeyService,
    "getApiKeyById",
    async () => {
      throw expectedError;
    }
  );

  const req = {
    params: {
      merchantId: "merchant-123",
      keyId: "unknown-key"
    }
  };

  const res = createResponse();
  let forwardedError;

  const next = (error) => {
    forwardedError = error;
  };

  await apiKeyController.getApiKeyById(req, res, next);

  assert.equal(forwardedError, expectedError);
});

test("forwards API key listing errors to Express", async (t) => {
  const expectedError = new Error("Database unavailable");

  t.mock.method(
    apiKeyService,
    "getApiKeysByMerchant",
    async () => {
      throw expectedError;
    }
  );

  const req = {
    params: {
      merchantId: "merchant-123"
    },
    query: {}
  };

  const res = createResponse();
  let forwardedError;

  const next = (error) => {
    forwardedError = error;
  };

  await apiKeyController.getApiKeysByMerchant(req, res, next);

  assert.equal(forwardedError, expectedError);
});

test("forwards API key revocation errors to Express", async (t) => {
  const expectedError = new Error("API key already revoked");

  t.mock.method(
    apiKeyService,
    "revokeApiKey",
    async () => {
      throw expectedError;
    }
  );

  const req = {
    params: {
      merchantId: "merchant-123",
      keyId: "key-123"
    }
  };

  const res = createResponse();
  let forwardedError;

  const next = (error) => {
    forwardedError = error;
  };

  await apiKeyController.revokeApiKey(req, res, next);

  assert.equal(forwardedError, expectedError);
});
