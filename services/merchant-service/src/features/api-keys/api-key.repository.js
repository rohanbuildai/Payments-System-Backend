const { pool } = require("../../database/connection") ;

const createApiKey = async ( 
    { merchant_id ,
    name ,
    key_prefix ,
    secret_hash ,
    environment ,
    expires_at }
) => {

    const query = `
        INSERT INTO merchant_api_keys(
                merchant_id ,
                name ,
                key_prefix ,
                secret_hash ,
                environment ,
                expires_at)
        VALUES ( $1,$2,$3,$4,$5,$6 )
        RETURNING id, 
            merchant_id, 
            key_prefix, 
            environment, 
            status, 
            created_at, 
            expires_at, 
            revoked_at, 
            last_used_at, 
            name`
    
    const values = [
        merchant_id ,
        name ,
        key_prefix ,
        secret_hash ,
        environment ,
        expires_at
    ]

    const result = await pool.query( query, values ) ;

    return result.rows[0] || null ;
}

const findApiKeyByPrefix = async ({
    key_prefix
}) => {

    const query = `
        SELECT id, 
            merchant_id, 
            key_prefix, 
            secret_hash, 
            environment, 
            status, 
            created_at, 
            expires_at, 
            revoked_at, 
            last_used_at, 
            name
        FROM merchant_api_keys
        WHERE key_prefix = $1`
    
    const values = [ key_prefix ] ;

    const result = await pool.query( query, values ) ;

    return result.rows[0] || null ;
}

const findApiKeyById = async ({
    keyId, 
    merchantId
}) => {

    const query = `
        SELECT id, 
            merchant_id, 
            key_prefix, 
            environment, 
            status, 
            created_at, 
            expires_at, 
            revoked_at, 
            last_used_at, 
            name
        FROM merchant_api_keys
        WHERE id = $1
        AND merchant_id = $2`
    
    const values = [ keyId, merchantId ] ;

    const result = await pool.query( query, values ) ;

    return result.rows[0] || null ;
}

const findApiKeysByMerchant = async (
    merchantId ,
    filters = {}
) => {

    const { environment, status } = filters;

    const conditions = ["merchant_id = $1"];
    const values = [merchantId];

    if (environment) {
        values.push(environment);
        conditions.push(`environment = $${values.length}`);
    }

    if (status) {
        values.push(status);
        conditions.push(`status = $${values.length}`);
    }

    const result = await pool.query(
        `
        SELECT
            id,
            merchant_id,
            name,
            key_prefix,
            environment,
            status,
            created_at,
            expires_at,
            revoked_at,
            last_used_at
        FROM merchant_api_keys
        WHERE ${conditions.join(" AND ")}
        ORDER BY created_at DESC
        `,
        values
    );

    return result.rows;
}

const revokeApiKey = async (
    keyId, 
    merchantId
) => {

    const query = `
        UPDATE merchant_api_keys
        SET status = 'REVOKED' ,
            revoked_at = NOW()
        WHERE id = $1
        AND merchant_id = $2
        AND status = 'ACTIVE'
        RETURNING id,
            merchant_id,
            name,
            key_prefix,
            environment,
            status,
            created_at,
            expires_at,
            revoked_at,
            last_used_at`
    
    const values = [ keyId, merchantId ] ;

    const result = await pool.query( query, values ) ;

    return result.rows[0] || null ;
}

module.exports = {
    createApiKey ,
    findApiKeyById ,
    findApiKeyByPrefix ,
    findApiKeysByMerchant ,
    revokeApiKey
}