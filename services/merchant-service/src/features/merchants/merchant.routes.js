const express = require("express") ;

const router = express.Router() ;

const { validateRequest } = require("../../middleware/validate-request") ;
const { merchantRegistrationSchema } = require("./validators/merchant.validator") ;
const { registerMerchant } = require("./merchant.controller") ;

router.post("/" , validateRequest(merchantRegistrationSchema) , registerMerchant) ;

module.exports = router ;