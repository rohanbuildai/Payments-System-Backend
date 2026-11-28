
const { test, assert } = require("@payment-gateway/testing");
const { pool } = require("../../../src/database/connection");

const merchantRepository = require("../../../src/features/merchants/merchant.repository");

const {
    registerMerchant
} = require("../../../src/features/merchants/merchant.service");

const {
    MerchantError
} = require("../../../src/features/merchants/errors/merchant.errors");

const merchantData = {
    business_name: "Tech Solutions",
    contact_name: "Rohan Singh",
    email: "rohan@example.com",
    phone: "+919876543210",
    business_type: "Technology",
    password: "SecurePassword@123"
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

async function withPoolClient(client, callback) {
    const originalConnect = pool.connect;
    pool.connect = async () => client;

    try {
        return await callback();
    } finally {
        pool.connect = originalConnect;
    }
}

function createFakeClient({ failRollback = false } = {}) {
    const queries = [];
    const releaseCalls = [];

    const client = {
        query: async query => {
            const normalizedQuery = query.trim().toUpperCase();
            queries.push(normalizedQuery);

            if (normalizedQuery === "ROLLBACK" && failRollback) {
                throw new Error("Rollback failed");
            }

            return { rows: [], rowCount: 0 };
        },

        release: destroy => {
            releaseCalls.push(destroy);
        }
    };

    return { client, queries, releaseCalls };
}

test("rejects an email that already exists without opening a transaction", async () => {
    const { client, queries, releaseCalls } = createFakeClient();
    let connectCalled = false;
    let createMerchantCalled = false;

    await withPoolClient(client, async () => {
        const originalConnect = pool.connect;

        pool.connect = async () => {
            connectCalled = true;
            return client;
        };

        try {
            await withRepositoryStubs({
                findMerchantByEmail: async () => ({
                    id: "existing-merchant"
                }),

                createMerchant: async () => {
                    createMerchantCalled = true;
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
        } finally {
            pool.connect = originalConnect;
        }
    });

    assert.equal(connectCalled, false);
    assert.equal(createMerchantCalled, false);
    assert.deepEqual(queries, []);
    assert.deepEqual(releaseCalls, []);
});

test("creates merchant and credentials in one transaction and returns only the merchant", async () => {
    const { client, queries, releaseCalls } = createFakeClient();

    const createdMerchant = {
        id: "merchant-uuid",
        business_name: merchantData.business_name,
        contact_name: merchantData.contact_name,
        email: merchantData.email,
        phone: merchantData.phone,
        business_type: merchantData.business_type,
        status: "PENDING"
    };

    let receivedMerchantData;
    let receivedCredentialsData;
    let merchantClient;
    let credentialsClient;

    await withPoolClient(client, async () => {
        await withRepositoryStubs({
            findMerchantByEmail: async () => null,

            createMerchant: async (data, transactionClient) => {
                receivedMerchantData = data;
                merchantClient = transactionClient;
                return createdMerchant;
            },

            createMerchantCredentials: async (data, transactionClient) => {
                receivedCredentialsData = data;
                credentialsClient = transactionClient;

                return {
                    merchant_id: data.merchant_id
                };
            }
        }, async () => {
            const result = await registerMerchant(merchantData);

            assert.deepEqual(result, createdMerchant);
            assert.equal(result.password, undefined);
            assert.equal(result.password_hash, undefined);
        });
    });

    assert.deepEqual(receivedMerchantData, {
        business_name: merchantData.business_name,
        contact_name: merchantData.contact_name,
        email: merchantData.email,
        phone: merchantData.phone,
        business_type: merchantData.business_type
    });

    assert.equal(receivedMerchantData.password, undefined);
    assert.equal(receivedMerchantData.password_hash, undefined);

    assert.equal(receivedCredentialsData.merchant_id, createdMerchant.id);
    assert.match(receivedCredentialsData.password_hash, /^\$argon2id\$/);
    assert.notEqual(receivedCredentialsData.password_hash, merchantData.password);

    assert.equal(merchantClient, client);
    assert.equal(credentialsClient, client);

    assert.deepEqual(queries, ["BEGIN", "COMMIT"]);
    assert.deepEqual(releaseCalls, [false]);
});

test("translates merchant email unique-index violation and rolls back", async () => {
    const { client, queries, releaseCalls } = createFakeClient();

    const databaseError = new Error("Duplicate email");
    databaseError.code = "23505";
    databaseError.constraint = "merchants_email_unique_idx";

    await withPoolClient(client, async () => {
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

    assert.deepEqual(queries, ["BEGIN", "ROLLBACK"]);
    assert.deepEqual(releaseCalls, [false]);
});

test("rolls back merchant insertion when credentials insertion fails", async () => {
    const { client, queries, releaseCalls } = createFakeClient();
    const credentialsError = new Error("Credentials insert failed");

    const createdMerchant = {
        id: "merchant-uuid",
        business_name: merchantData.business_name,
        email: merchantData.email,
        status: "PENDING"
    };

    await withPoolClient(client, async () => {
        await withRepositoryStubs({
            findMerchantByEmail: async () => null,

            createMerchant: async () => createdMerchant,

            createMerchantCredentials: async () => {
                throw credentialsError;
            }
        }, async () => {
            await assert.rejects(
                registerMerchant(merchantData),
                error => error === credentialsError
            );
        });
    });

    assert.deepEqual(queries, ["BEGIN", "ROLLBACK"]);
    assert.deepEqual(releaseCalls, [false]);
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

test("destroys the database client when rollback fails", async () => {
    const { client, queries, releaseCalls } = createFakeClient({
        failRollback: true
    });

    const credentialsError = new Error("Credentials insert failed");

    await withPoolClient(client, async () => {
        await withRepositoryStubs({
            findMerchantByEmail: async () => null,

            createMerchant: async () => ({
                id: "merchant-uuid",
                status: "PENDING"
            }),

            createMerchantCredentials: async () => {
                throw credentialsError;
            }
        }, async () => {
            await assert.rejects(
                registerMerchant(merchantData),
                error => error === credentialsError
            );
        });
    });

    assert.deepEqual(queries, ["BEGIN", "ROLLBACK"]);
    assert.deepEqual(releaseCalls, [true]);
});
