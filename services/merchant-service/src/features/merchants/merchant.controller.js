
const merchantService = require("./merchant.service");

const { MerchantError } = require("./errors/merchant.errors");

const registerMerchant = async (req, res, next) => {
  try {
    const merchantData = req.body;

    const createdMerchant = await merchantService.registerMerchant(merchantData);

    return res.status(201).json({
      success: true,
      message: "Merchant registered successfully",
      data: {
        merchant: createdMerchant,
      },
    });

  } catch (error) {
    if (error instanceof MerchantError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    return next(error);
  }
};

module.exports = {
  registerMerchant,
};
