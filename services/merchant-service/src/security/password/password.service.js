
const argon2 = require("argon2");

const hashPassword = async (password) => {
    if (typeof password !== "string" || password.length === 0) {
        throw new TypeError("Password must be a non-empty string");
    }

    const hash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
    });

    return hash;
};

const verifyPassword = async (password, passwordHash) => {
    if (
        typeof password !== "string" ||
        password.length === 0 ||
        typeof passwordHash !== "string" ||
        passwordHash.length === 0
    ) {
        return false;
    }

    try {
        return await argon2.verify(passwordHash, password);
        } catch (err) {
       
        if (
            err instanceof TypeError ||
            err.code === "ERR_ARGON2_DECODING_FAIL" ||
            err.code === "ERR_ARGON2_INVALID_HASH"
        ) {
            return false;
        }

        // Unexpected errors must propagate.
        throw err;
    }
};

module.exports = {
    hashPassword,
    verifyPassword,
};
