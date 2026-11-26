
const validateRequest = (schema, source = "body") => {
  const allowedSources = ["body", "params", "query"];

  if (!allowedSources.includes(source)) {
    throw new Error(`Unsupported validation source: ${source}`);
  }

  return (req, res, next) => {
    const validationResult = schema.safeParse(req[source]);

    if (!validationResult.success) {
      const details = validationResult.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details
        }
      });
    }

    const validatedData = validationResult.data;

    req.validated = req.validated || {};
    req.validated[source] = validatedData;

    if (source === "body") {
      req.body = validatedData;
    }

    if (source === "params") {
      req.params = validatedData;
    }

    if (source === "query") {
      req.validatedQuery = validatedData;
    }

    next();
  };
};

module.exports = {
  validateRequest
};
