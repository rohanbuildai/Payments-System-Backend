
const { test, assert } = require("@payment-gateway/testing");

const merchantRepository = require("../../src/features/merchants/merchant.repository");

const {
  registerMerchant
} = require("../../src/features/merchants/merchant.service");

const {
  MerchantError
} = require("../../src/features/merchants/errors/merchant.errors");

const merchantData = {
  business_name: "Tech Solutions",
  contact_name: "Rohan Singh",
  email: "rohan@example.com",
  phone: "+919876543210",
  business_type: "Technology"
};

async function withRepositoryStubs(stubs, callback) {
  const originals = {};

  for (const [methodName, implementation] of Object.entries(stubs)) {
    originals[methodName] = merchantRepository[methodName];
    merchantRepository[methodName] = implementation;
  }

  try {
    return await callback();
  } finally {
    for (const [methodName, original] of Object.entries(originals)) {
      merchantRepository[methodName] = original;
    }
  }
}

test("rejects an email that already exists", async () => {
  let createCalled = false;

  await withRepositoryStubs({
    findMerchantByEmail: async () => ({
      id: "existing-merchant"
    }),

    createMerchant: async () => {
      createCalled = true;
    }
  }, async () => {
    await assert.rejects(
      registerMerchant(merchantData),
      error => {
        assert.ok(error instanceof MerchantError);
        assert.equal(error.code, "MERCHANT_ALREADY_EXISTS");
        assert.equal(error.statusCode, 409);
        return true;
      }
    );
  });

  assert.equal(createCalled, false);
});

test("creates and returns a new merchant", async () => {
  const createdMerchant = {
    id: "merchant-uuid",
    ...merchantData,
    status: "PENDING"
  };

  let receivedCreateData;

  await withRepositoryStubs({
    findMerchantByEmail: async () => null,

    createMerchant: async data => {
      receivedCreateData = data;
      return createdMerchant;
    }
  }, async () => {
    const result = await registerMerchant(merchantData);

    assert.deepEqual(result, createdMerchant);
  });

  assert.deepEqual(receivedCreateData, merchantData);
});

test("translates merchant email unique-index violation", async () => {
  const databaseError = new Error("Duplicate email");

  databaseError.code = "23505";
  databaseError.constraint = "merchants_email_unique_idx";

  await withRepositoryStubs({
    findMerchantByEmail: async () => null,

    createMerchant: async () => {
      throw databaseError;
    }
  }, async () => {
    await assert.rejects(
      registerMerchant(merchantData),
      error => {
        assert.ok(error instanceof MerchantError);
        assert.equal(error.code, "MERCHANT_ALREADY_EXISTS");
        assert.equal(error.statusCode, 409);
        return true;
      }
    );
  });
});

test("propagates unrelated database errors unchanged", async () => {
  const databaseError = new Error("Database connection failed");
  databaseError.code = "ECONNREFUSED";

  await withRepositoryStubs({
    findMerchantByEmail: async () => {
      throw databaseError;
    }
  }, async () => {
    await assert.rejects(
      registerMerchant(merchantData),
      error => error === databaseError
    );
  });
});
