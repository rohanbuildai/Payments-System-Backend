
const apiKeyService = require("./api-key.service");

const generateApiKey = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const { name, environment, expiresAt } = req.body;

    const apiKey = await apiKeyService.generateApiKey({
      merchantId,
      name,
      environment,
      expiresAt
    });

    return res.status(201).json({
      success: true,
      message: "API key generated successfully",
      data: {
        apiKey
      }
    });

  } catch (error) {
    next(error);
  }
};

const getApiKeyById = async (req, res, next) => {
  try {
    const { merchantId, keyId } = req.params;

    const apiKey = await apiKeyService.getApiKeyById({
      keyId,
      merchantId
    });

    return res.status(200).json({
      success: true,
      message: "API key retrieved successfully",
      data: {
        apiKey
      }
    });

  } catch (error) {
    next(error);
  }
};

const getApiKeysByMerchant = async (req, res, next) => {
  try {
    const { merchantId } = req.params;

    const filters = req.validatedQuery || {};

    const apiKeys = await apiKeyService.getApiKeysByMerchant({
      merchantId,
      filters
    });

    return res.status(200).json({
      success: true,
      message: "API keys retrieved successfully",
      data: {
        apiKeys
      }
    });

  } catch (error) {
    next(error);
  }
};

const revokeApiKey = async (req, res, next) => {
  try {
    const { merchantId, keyId } = req.params;

    const apiKey = await apiKeyService.revokeApiKey({
      keyId,
      merchantId
    });

    return res.status(200).json({
      success: true,
      message: "API key revoked successfully",
      data: {
        apiKey
      }
    });

  } catch (error) {
    next(error);
  }
};


module.exports = {
  generateApiKey,
  getApiKeyById,
  getApiKeysByMerchant,
  revokeApiKey
};
