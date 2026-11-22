
class MerchantError extends Error {
  constructor(message, code, statusCode = 409) {
    super(message);

    this.name = "MerchantError";
    this.code = code;
    this.statusCode = statusCode;

    Error.captureStackTrace?.(this, MerchantError);
  }
}

module.exports = {
  MerchantError,
};
