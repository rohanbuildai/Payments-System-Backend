const { z } = require("@payment-gateway/config");

const merchantRegistrationSchema = z
  .object({
    business_name: z.string().trim().min(2).max(150),
    contact_name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(255),
    phone: z
      .string()
      .trim()
      .regex(/^\+[1-9][0-9]{1,14}$/)
      .max(16),

    business_type: z.string().trim().min(2).max(50),
    password : z.string().min(12).max(128)
  })
  .strict();

module.exports = {
  merchantRegistrationSchema,
};