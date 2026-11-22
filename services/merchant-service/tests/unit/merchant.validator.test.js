
const { test, assert } = require("@payment-gateway/testing");

const {
  merchantRegistrationSchema
} = require("../../src/features/merchants/validators/merchant.validator");

const validMerchant = {
  business_name: "Tech Solutions",
  contact_name: "Rohan Singh",
  email: "rohan@example.com",
  phone: "+919876543210",
  business_type: "Technology"
};

test("accepts valid merchant registration data", () => {
  const result = merchantRegistrationSchema.safeParse(validMerchant);

  assert.equal(result.success, true);
  assert.deepEqual(result.data, validMerchant);
});

test("trims strings and normalizes email", () => {
  const result = merchantRegistrationSchema.safeParse({
    ...validMerchant,
    business_name: "  Tech Solutions  ",
    contact_name: "  Rohan Singh  ",
    email: "  ROHAN@EXAMPLE.COM  "
  });

  assert.equal(result.success, true);
  assert.equal(result.data.business_name, "Tech Solutions");
  assert.equal(result.data.contact_name, "Rohan Singh");
  assert.equal(result.data.email, "rohan@example.com");
});

test("rejects invalid email", () => {
  const result = merchantRegistrationSchema.safeParse({
    ...validMerchant,
    email: "abc.com"
  });

  assert.equal(result.success, false);
  assert.ok(result.error.issues.some(
    issue => issue.path[0] === "email"
  ));
});

test("rejects phone outside E.164 format", () => {
  const result = merchantRegistrationSchema.safeParse({
    ...validMerchant,
    phone: "9876543210"
  });

  assert.equal(result.success, false);
  assert.ok(result.error.issues.some(
    issue => issue.path[0] === "phone"
  ));
});

test("rejects missing required fields", () => {
  const { email, ...missingEmail } = validMerchant;

  const result = merchantRegistrationSchema.safeParse(missingEmail);

  assert.equal(result.success, false);
  assert.ok(result.error.issues.some(
    issue => issue.path[0] === "email"
  ));
});

test("rejects unknown properties such as status", () => {
  const result = merchantRegistrationSchema.safeParse({
    ...validMerchant,
    status: "ACTIVE"
  });

  assert.equal(result.success, false);
  assert.ok(result.error.issues.some(
    issue => issue.code === "unrecognized_keys"
  ));
});

test("rejects non-string values without coercion", () => {
  const result = merchantRegistrationSchema.safeParse({
    ...validMerchant,
    business_name: 123
  });

  assert.equal(result.success, false);
  assert.ok(result.error.issues.some(
    issue => issue.path[0] === "business_name"
  ));
});

test("enforces business name length limits", () => {
  const tooShort = merchantRegistrationSchema.safeParse({
    ...validMerchant,
    business_name: "A"
  });

  const tooLong = merchantRegistrationSchema.safeParse({
    ...validMerchant,
    business_name: "A".repeat(151)
  });

  assert.equal(tooShort.success, false);
  assert.equal(tooLong.success, false);
});
