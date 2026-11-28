
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
            password: "SecurePassword@123",
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

    test("creates a merchant and persists its password hash separately", async () => {
        const payload = createMerchantPayload();

        const response = await request(service.app)
            .post("/api/v1/merchants")
            .send(payload);

        assert.equal(response.status, 201);
        assert.equal(response.body.success, true);
        assert.equal(response.body.data.merchant.email, payload.email);
        assert.equal(response.body.data.merchant.status, "PENDING");
        assert.ok(response.body.data.merchant.id);

        // Credentials must never be exposed in the API response.
        assert.equal(response.body.data.merchant.password, undefined);
        assert.equal(response.body.data.merchant.password_hash, undefined);
        assert.equal(response.body.data.password, undefined);
        assert.equal(response.body.data.password_hash, undefined);

        const merchantResult = await pool.query(
            `SELECT id, email, status
             FROM public.merchants
             WHERE id = $1`,
            [response.body.data.merchant.id]
        );

        assert.equal(merchantResult.rowCount, 1);
        assert.equal(merchantResult.rows[0].email, payload.email);
        assert.equal(merchantResult.rows[0].status, "PENDING");

        const credentialsResult = await pool.query(
            `SELECT merchant_id, password_hash
             FROM public.merchant_credentials
             WHERE merchant_id = $1`,
            [response.body.data.merchant.id]
        );

        assert.equal(credentialsResult.rowCount, 1);
        assert.equal(
            credentialsResult.rows[0].merchant_id,
            response.body.data.merchant.id
        );
        assert.match(credentialsResult.rows[0].password_hash, /^\$argon2id\$/);
        assert.notEqual(
            credentialsResult.rows[0].password_hash,
            payload.password
        );
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

        const countResult = await pool.query(
            `SELECT COUNT(*)::int AS count
             FROM public.merchants
             WHERE LOWER(email) = $1`,
            ["duplicate@example.com"]
        );

        assert.equal(countResult.rows[0].count, 1);

        const credentialsCount = await pool.query(
            `SELECT COUNT(*)::int AS count
             FROM public.merchant_credentials mc
             JOIN public.merchants m ON m.id = mc.merchant_id
             WHERE LOWER(m.email) = $1`,
            ["duplicate@example.com"]
        );

        assert.equal(credentialsCount.rows[0].count, 1);
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

    test("rejects passwords shorter than 12 characters", async () => {
        const response = await request(service.app)
            .post("/api/v1/merchants")
            .send(createMerchantPayload({
                password: "Short123!"
            }));

        assert.equal(response.status, 400);
        assert.equal(response.body.error.code, "VALIDATION_ERROR");

        assert.ok(
            response.body.error.details.some(item => item.field === "password")
        );
    });

    test("rejects a missing password", async () => {
        const payload = createMerchantPayload();
        delete payload.password;

        const response = await request(service.app)
            .post("/api/v1/merchants")
            .send(payload);

        assert.equal(response.status, 400);
        assert.equal(response.body.error.code, "VALIDATION_ERROR");

        assert.ok(
            response.body.error.details.some(item => item.field === "password")
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

    test("concurrent registrations create at most one merchant and credential", async () => {
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

        const merchantCount = await pool.query(
            `SELECT COUNT(*)::int AS count
             FROM public.merchants
             WHERE LOWER(email) = $1`,
            [payload.email]
        );

        assert.equal(merchantCount.rows[0].count, 1);

        const credentialsCount = await pool.query(
            `SELECT COUNT(*)::int AS count
             FROM public.merchant_credentials mc
             JOIN public.merchants m ON m.id = mc.merchant_id
             WHERE LOWER(m.email) = $1`,
            [payload.email]
        );

        assert.equal(credentialsCount.rows[0].count, 1);
    });

    test("readiness returns 200 when PostgreSQL is reachable", async () => {
        const response = await request(service.app)
            .get("/health/ready");

        assert.equal(response.status, 200);
        assert.equal(response.body.status, "ready");
    });
}
