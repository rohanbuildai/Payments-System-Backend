
const validateRequest = (registrationSchema) => {
  return (req, res, next) => {
    const validationResult = registrationSchema.safeParse(req.body);

    if (!validationResult.success) {
      const details = validationResult.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details,
        },
      });
    }

    req.body = validationResult.data;

    next();
  };
};

module.exports = {
  validateRequest,
};
