
const { test, mock } = require("node:test");
const assert = require("node:assert/strict");

const { pool } = require("../../../src/database/connection");

const {
    createApiKey,
    findApiKeyByPrefix,
    findApiKeyById,
    findApiKeysByMerchant,
    revokeApiKey
} = require("../../../src/features/api-keys/api-key.repository");

const sampleApiKey = {
    id: "key-uuid-123",
    merchant_id: "merchant-uuid-123",
    name: "Production Backend",
    key_prefix: "pg_live_a81f92c4d73e1b05",
    environment: "LIVE",
    status: "ACTIVE",
    created_at: new Date(),
    expires_at: null,
    revoked_at: null,
    last_used_at: null
};

// 1. Create API key

test("creates an API key successfully", async (t) => {
    const queryMock = t.mock.method(
        pool,
        "query",
        async () => ({
            rows: [sampleApiKey]
        })
    );

    const input = {
        merchant_id: sampleApiKey.merchant_id,
        name: sampleApiKey.name,
        key_prefix: sampleApiKey.key_prefix,
        secret_hash: "a".repeat(64),
        environment: "LIVE",
        expires_at: null
    };

    const result = await createApiKey(input);

    assert.strictEqual(result.id, sampleApiKey.id);
    assert.strictEqual(result.name, sampleApiKey.name);
    assert.strictEqual(result.status, "ACTIVE");

    assert.strictEqual(queryMock.mock.callCount(), 1);

    const [query, values] = queryMock.mock.calls[0].arguments;

    assert.match(query, /INSERT INTO merchant_api_keys/i);
    assert.deepStrictEqual(values, [
        input.merchant_id,
        input.name,
        input.key_prefix,
        input.secret_hash,
        input.environment,
        input.expires_at
    ]);

    // The returned record must not expose the secret hash.
    assert.strictEqual(result.secret_hash, undefined);
});

// 2. Find API key by prefix

test("finds an API key using its prefix", async (t) => {
    const queryMock = t.mock.method(
        pool,
        "query",
        async () => ({
            rows: [{
                ...sampleApiKey,
                secret_hash: "a".repeat(64)
            }]
        })
    );

    const result = await findApiKeyByPrefix({
        key_prefix: sampleApiKey.key_prefix
    });

    assert.strictEqual(result.key_prefix, sampleApiKey.key_prefix);
    assert.strictEqual(result.secret_hash, "a".repeat(64));

    const [query, values] = queryMock.mock.calls[0].arguments;

    assert.match(query, /WHERE key_prefix = \$1/i);
    assert.deepStrictEqual(values, [sampleApiKey.key_prefix]);
});

// 3. Return null when prefix doesn't exist

test("returns null when API key prefix does not exist", async (t) => {
    t.mock.method(
        pool,
        "query",
        async () => ({
            rows: []
        })
    );

    const result = await findApiKeyByPrefix({
        key_prefix: "nonexistent_prefix"
    });

    assert.strictEqual(result, null);
});

// 4. Find API key by ID and merchant ID

test("finds an API key using both key ID and merchant ID", async (t) => {
    const queryMock = t.mock.method(
        pool,
        "query",
        async () => ({
            rows: [sampleApiKey]
        })
    );

    const result = await findApiKeyById({
        keyId: sampleApiKey.id,
        merchantId: sampleApiKey.merchant_id
    });

    assert.strictEqual(result.id, sampleApiKey.id);
    assert.strictEqual(result.merchant_id, sampleApiKey.merchant_id);

    const [query, values] = queryMock.mock.calls[0].arguments;

    assert.match(query, /WHERE id = \$1/i);
    assert.match(query, /AND merchant_id = \$2/i);

    assert.deepStrictEqual(values, [
        sampleApiKey.id,
        sampleApiKey.merchant_id
    ]);

    // Management lookup must not expose the secret hash.
    assert.strictEqual(result.secret_hash, undefined);
});

// 5. List API keys with filters

test("lists merchant API keys with environment and status filters", async (t) => {
    const queryMock = t.mock.method(
        pool,
        "query",
        async () => ({
            rows: [sampleApiKey]
        })
    );

    const merchantId = sampleApiKey.merchant_id;

    const result = await findApiKeysByMerchant(merchantId, {
        environment: "LIVE",
        status: "ACTIVE"
    });

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].merchant_id, merchantId);

    const [query, values] = queryMock.mock.calls[0].arguments;

    assert.match(query, /merchant_id = \$1/i);
    assert.match(query, /environment = \$2/i);
    assert.match(query, /status = \$3/i);
    assert.match(query, /ORDER BY created_at DESC/i);

    assert.deepStrictEqual(values, [
        merchantId,
        "LIVE",
        "ACTIVE"
    ]);

    // Listing must never expose secret hashes.
    assert.strictEqual(result[0].secret_hash, undefined);
});

// 6. Revoke an active API key

test("revokes an active API key", async (t) => {
    const revokedApiKey = {
        ...sampleApiKey,
        status: "REVOKED",
        revoked_at: new Date()
    };

    const queryMock = t.mock.method(
        pool,
        "query",
        async () => ({
            rows: [revokedApiKey]
        })
    );

    const result = await revokeApiKey(
        sampleApiKey.id,
        sampleApiKey.merchant_id
    );

    assert.strictEqual(result.status, "REVOKED");
    assert.ok(result.revoked_at instanceof Date);

    const [query, values] = queryMock.mock.calls[0].arguments;

    assert.match(query, /UPDATE merchant_api_keys/i);
    assert.match(query, /status = 'REVOKED'/i);
    assert.match(query, /revoked_at = NOW\(\)/i);
    assert.match(query, /status = 'ACTIVE'/i);
    assert.match(query, /RETURNING/i);

    assert.deepStrictEqual(values, [
        sampleApiKey.id,
        sampleApiKey.merchant_id
    ]);
});

// 7. Already revoked or nonexistent key

test("returns null when an API key cannot be revoked", async (t) => {
    const queryMock = t.mock.method(
        pool,
        "query",
        async () => ({
            rows: []
        })
    );

    const result = await revokeApiKey(
        sampleApiKey.id,
        sampleApiKey.merchant_id
    );

    assert.strictEqual(result, null);

    const [query] = queryMock.mock.calls[0].arguments;

    assert.match(query, /status = 'ACTIVE'/i);
});
