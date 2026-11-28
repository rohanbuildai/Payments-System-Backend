
const { pool } = require("../../database/connection");
const merchantRepository = require("./merchant.repository");
const { MerchantError } = require("./errors/merchant.errors");
const { hashPassword } = require("../../security/password/password.service");
const { createLogger } = require("@payment-gateway/logger");

const logger = createLogger({
    serviceName: "merchant-service",
});

const registerMerchant = async (merchantData) => {
    let client = null;
    let transactionStarted = false;
    let destroyClient = false;

    try {
        const existingMerchant =
            await merchantRepository.findMerchantByEmail(merchantData.email);

        if (existingMerchant) {
            throw new MerchantError(
                "A merchant with this email already exists",
                "MERCHANT_ALREADY_EXISTS",
                409
            );
        }

        const hashedPassword = await hashPassword(merchantData.password);

        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        const merchant = await merchantRepository.createMerchant({
            business_name: merchantData.business_name,
            contact_name: merchantData.contact_name,
            email: merchantData.email,
            phone: merchantData.phone,
            business_type: merchantData.business_type
        }, client);

        await merchantRepository.createMerchantCredentials({
            merchant_id: merchant.id,
            password_hash: hashedPassword
        }, client);

        await client.query("COMMIT");
        transactionStarted = false;

        return merchant;

    } catch (error) {

        if (client && transactionStarted) {
            try {
                await client.query("ROLLBACK");
                transactionStarted = false;

            } catch (rollbackError) {
                destroyClient = true;

                logger.error(
                    {
                        err: rollbackError,
                        originalError: error
                    },
                    "Failed to rollback merchant registration transaction"
                );
            }
        }

        if (
            error.code === "23505" &&
            error.constraint === "merchants_email_unique_idx"
        ) {
            throw new MerchantError(
                "A merchant with this email already exists",
                "MERCHANT_ALREADY_EXISTS",
                409
            );
        }

        throw error;

    } finally {

        if (client) {
            client.release(destroyClient);
        }
    }
};

module.exports = {
    registerMerchant
};
