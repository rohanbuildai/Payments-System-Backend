
const { test, assert } = require("@payment-gateway/testing");

const {
    generatePublicId,
    generateSecret,
    hashSecret
} = require("../../src/features/api-keys/utils/api-key-generator");

// Public ID tests

test("generates a public ID with exactly 16 hexadecimal characters", () => {
    const publicId = generatePublicId();

    assert.match(publicId, /^[a-f0-9]{16}$/);
});

test("generates unique public IDs", () => {
    const firstId = generatePublicId();
    const secondId = generatePublicId();

    assert.notStrictEqual(firstId, secondId);
});

// Secret generation tests

test("generates a valid secret representing 32 random bytes", () => {
    const secret = generateSecret();

    const decodedSecret = Buffer.from(secret, "base64url");

    assert.strictEqual(decodedSecret.length, 32);
    assert.strictEqual(decodedSecret.toString("base64url"), secret);
});

test("generates unique secrets", () => {
    const firstSecret = generateSecret();
    const secondSecret = generateSecret();

    assert.notStrictEqual(firstSecret, secondSecret);
});

// Secret hashing tests

test("generates a 64-character hexadecimal SHA-256 hash", () => {
    const secret = generateSecret();
    const hash = hashSecret(secret);

    assert.match(hash, /^[a-f0-9]{64}$/);
});

test("generates the same hash for the same secret", () => {
    const secret = "test_secret_123";

    const firstHash = hashSecret(secret);
    const secondHash = hashSecret(secret);

    assert.strictEqual(firstHash, secondHash);
});

test("generates different hashes for different secrets", () => {
    const firstHash = hashSecret("secret_one");
    const secondHash = hashSecret("secret_two");

    assert.notStrictEqual(firstHash, secondHash);
});

test("does not return the original secret as its hash", () => {
    const secret = generateSecret();
    const hash = hashSecret(secret);

    assert.notStrictEqual(hash, secret);
});
