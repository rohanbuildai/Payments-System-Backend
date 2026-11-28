
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const argon2 = require("argon2");

const {
    hashPassword,
    verifyPassword,
} = require("../../../src/security/password/password.service");

describe("Password Service", () => {
    const password = "SecurePassword@123";

    describe("hashPassword()", () => {
        it("should successfully hash a password", async () => {
            const hash = await hashPassword(password);

            assert.equal(typeof hash, "string");
            assert.ok(hash.length > 0);
            assert.ok(hash.startsWith("$argon2id$"));
        });

        it("should never store the plain password as the hash", async () => {
            const hash = await hashPassword(password);

            assert.notEqual(hash, password);
        });

        it("should generate different hashes for the same password", async () => {
            const firstHash = await hashPassword(password);
            const secondHash = await hashPassword(password);

            assert.notEqual(firstHash, secondHash);
        });

        it("should reject an empty password", async () => {
            await assert.rejects(
                hashPassword(""),
                { name: "TypeError" }
            );
        });

        it("should reject invalid password input", async () => {
            await assert.rejects(
                hashPassword(null),
                { name: "TypeError" }
            );

            await assert.rejects(
                hashPassword(12345),
                { name: "TypeError" }
            );
        });
    });

    describe("verifyPassword()", () => {
        it("should verify the correct password", async () => {
            const hash = await hashPassword(password);

            const result = await verifyPassword(password, hash);

            assert.equal(result, true);
        });

        it("should reject an incorrect password", async () => {
            const hash = await hashPassword(password);

            const result = await verifyPassword(
                "WrongPassword@123",
                hash
            );

            assert.equal(result, false);
        });

        it("should safely handle an invalid encoded hash", async () => {
            const result = await verifyPassword(
                password,
                "this-is-not-a-valid-argon2-hash"
            );

            assert.equal(result, false);
        });

        it("should return false for invalid verification inputs", async () => {
            assert.equal(await verifyPassword("", "some-hash"), false);
            assert.equal(await verifyPassword(password, ""), false);
            assert.equal(await verifyPassword(null, "some-hash"), false);
            assert.equal(await verifyPassword(password, null), false);
        });
    });
});
