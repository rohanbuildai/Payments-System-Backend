
const { createApiKey,findApiKeyById,findApiKeysByMerchant,revokeApiKey: revokeApiKeyInDatabase } = require("./api-key.repository");

const { findMerchantById } = require("../merchants/merchant.repository");

const {
  generatePublicId,
  generateSecret,
  hashSecret
} = require("./utils/api-key-generator");

const { ApiKeyError } = require("./errors/api-key.errors");


const generateApiKey = async ({
  merchantId,
  name,
  environment,
  expiresAt
}) => {

  const existingMerchant = await findMerchantById({
    merchantId
  });

  if (!existingMerchant) {
    throw new ApiKeyError(
      "Merchant not found",
      "MERCHANT_NOT_FOUND",
      404
    );
  }

  const isPendingMerchant = existingMerchant.status === "PENDING";
  const isActiveMerchant = existingMerchant.status === "ACTIVE";

  const canGenerateTestKey =
    isPendingMerchant || isActiveMerchant;

  const canGenerateLiveKey =
    isActiveMerchant;

  if (
    (environment === "TEST" && !canGenerateTestKey) ||
    (environment === "LIVE" && !canGenerateLiveKey)
  ) {
    throw new ApiKeyError(
      "Merchant is not authorized to generate an API key for this environment",
      "API_KEY_NOT_ALLOWED",
      403
    );
  }

  const publicId = generatePublicId();
  const secret = generateSecret();

  const keyPrefix = `pg_${environment.toLowerCase()}_${publicId}`;

  const hashedSecret = hashSecret(secret);

  const savedApiKey = await createApiKey({
    merchant_id: merchantId,
    name,
    key_prefix: keyPrefix,
    secret_hash: hashedSecret,
    environment,
    expires_at: expiresAt ?? null
  });

  return {
    ...savedApiKey,
    key: `${keyPrefix}_${secret}`
  };
};

const getApiKeyById = async ({ keyId, merchantId }) => {
  const apiKey = await findApiKeyById({
    keyId,
    merchantId
  });

  if (!apiKey) {
    throw new ApiKeyError(
      "API key not found",
      "API_KEY_NOT_FOUND",
      404
    );
  }

  return apiKey;
};

const getApiKeysByMerchant = async ({
  merchantId,
  filters = {}
}) => {
  const apiKeys = await findApiKeysByMerchant(
    merchantId,
    filters
  );

  return apiKeys;
};


const revokeApiKey = async ({ keyId, merchantId }) => {

  const existingApiKey = await findApiKeyById({
    keyId,
    merchantId
  });

  if (!existingApiKey) {
    throw new ApiKeyError(
      "API key not found",
      "API_KEY_NOT_FOUND",
      404
    );
  }

  if (existingApiKey.status === "REVOKED") {
    throw new ApiKeyError(
      "API key has already been revoked",
      "API_KEY_ALREADY_REVOKED",
      409
    );
  }

  const revokedApiKey = await revokeApiKeyInDatabase(
    keyId,
    merchantId
  );

  if (!revokedApiKey) {
    throw new ApiKeyError(
      "API key could not be revoked because its state changed",
      "API_KEY_REVOCATION_CONFLICT",
      409
    );
  }

  return revokedApiKey;
};

module.exports = {
  generateApiKey ,
  getApiKeyById ,
  getApiKeysByMerchant ,
  revokeApiKey
};
