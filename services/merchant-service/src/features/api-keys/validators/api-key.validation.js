const { z } = require("@payment-gateway/config") ;

const generateApiKeySchema = z.object({
    name : z.string().trim().min(2).max(100) ,
    environment : z.enum(["TEST","LIVE"]) ,
    expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict() ;

const listApiKeysSchema = z.object({
    environment : z.enum(["TEST","LIVE"]).optional() ,
    status : z.enum(["ACTIVE","REVOKED"]).optional() ,

}).strict() ;

const apiKeyParamsSchema = z.object({
    merchantId : z.string().uuid() ,

}).strict() ;

const apiKeyResourceParamsSchema = z.object({
    merchantId : z.string().uuid() ,
    keyId : z.string().uuid() ,
}).strict() ;

module.exports = {
    generateApiKeySchema ,
    listApiKeysSchema ,
    apiKeyParamsSchema ,
    apiKeyResourceParamsSchema
}