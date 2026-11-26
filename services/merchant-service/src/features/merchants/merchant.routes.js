const express = require("express") ;

const router = express.Router() ;

const { validateRequest } = require("../../middleware/validate-request") ;
const { merchantRegistrationSchema } = require("./validators/merchant.validator") ;
const { registerMerchant } = require("./merchant.controller") ;
const apiKeyRoutes = require("../api-keys/api-key.routes");

router.post("/" , validateRequest(merchantRegistrationSchema) , registerMerchant) ;
router.use("/:merchantId/api-keys", apiKeyRoutes);

module.exports = router ;