
class ApiKeyError extends Error {
  constructor(message, code, statusCode = 400) {
    super(message);

    this.name = "ApiKeyError";
    this.code = code;
    this.statusCode = statusCode;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { ApiKeyError };