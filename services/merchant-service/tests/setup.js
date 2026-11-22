
if (
  process.env.GITHUB_ACTIONS === "true" &&
  !process.env.MERCHANT_TEST_DATABASE_URL
) {
  throw new Error(
    "CI requires MERCHANT_TEST_DATABASE_URL"
  );
}

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

process.env.MERCHANT_DATABASE_URL =
  process.env.MERCHANT_TEST_DATABASE_URL ||
  "postgresql://merchant_test:merchant_test@127.0.0.1:5433/merchant_service_test_db";
