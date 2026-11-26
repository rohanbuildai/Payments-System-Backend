
const express = require("express");

const router = express.Router({ mergeParams: true });

const { validateRequest } = require("../../middleware/validate-request");

const {
  generateApiKey,
  getApiKeyById,
  getApiKeysByMerchant,
  revokeApiKey
} = require("./api-key.controller");

const {
  generateApiKeySchema,
  listApiKeysSchema,
  apiKeyParamsSchema,
  apiKeyResourceParamsSchema
} = require("./validators/api-key.validation");

router.post(
  "/",
  validateRequest(apiKeyParamsSchema, "params"),
  validateRequest(generateApiKeySchema, "body"),
  generateApiKey
);

router.get(
  "/",
  validateRequest(apiKeyParamsSchema, "params"),
  validateRequest(listApiKeysSchema, "query"),
  getApiKeysByMerchant
);

router.get(
  "/:keyId",
  validateRequest(apiKeyResourceParamsSchema, "params"),
  getApiKeyById
);

router.delete(
  "/:keyId",
  validateRequest(apiKeyResourceParamsSchema, "params"),
  revokeApiKey
);

module.exports = router;
