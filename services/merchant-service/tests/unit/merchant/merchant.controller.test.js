
const { test, assert } = require("@payment-gateway/testing");

const merchantService = require("../../../src/features/merchants/merchant.service");

const {
  registerMerchant
} = require("../../../src/features/merchants/merchant.controller");

const {
  MerchantError
} = require("../../../src/features/merchants/errors/merchant.errors");

function createResponse() {
  return {
    statusCode: null,
    body: null,

    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },

    json(body) {
      this.body = body;
      return this;
    }
  };
}

async function withServiceStub(implementation, callback) {
  const original = merchantService.registerMerchant;

  merchantService.registerMerchant = implementation;

  try {
    return await callback();
  } finally {
    merchantService.registerMerchant = original;
  }
}

test("returns 201 for successful registration", async () => {
  const merchant = {
    id: "merchant-uuid",
    status: "PENDING"
  };

  const req = {
    body: {
      email: "rohan@example.com"
    }
  };

  const res = createResponse();

  await withServiceStub(
    async () => merchant,
    async () => {
      await registerMerchant(req, res, () => {});
    }
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.data.merchant, merchant);
});

test("returns known merchant errors", async () => {
  const merchantError = new MerchantError(
    "A merchant with this email already exists",
    "MERCHANT_ALREADY_EXISTS",
    409
  );

  const res = createResponse();

  await withServiceStub(
    async () => {
      throw merchantError;
    },
    async () => {
      await registerMerchant({ body: {} }, res, () => {});
    }
  );

  assert.equal(res.statusCode, 409);
  assert.equal(
    res.body.error.code,
    "MERCHANT_ALREADY_EXISTS"
  );
});

test("forwards unexpected errors to Express", async () => {
  const unexpectedError = new Error("Unexpected failure");

  const res = createResponse();

  let forwardedError;

  await withServiceStub(
    async () => {
      throw unexpectedError;
    },
    async () => {
      await registerMerchant(
        { body: {} },
        res,
        error => {
          forwardedError = error;
        }
      );
    }
  );

  assert.equal(forwardedError, unexpectedError);
  assert.equal(res.statusCode, null);
});
