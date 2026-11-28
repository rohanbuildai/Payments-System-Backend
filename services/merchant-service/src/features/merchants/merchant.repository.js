
const { pool } = require("../../database/connection") ;

const findMerchantByEmail = async (email) => {
    const query = `
    SELECT id ,
        business_name ,
        contact_name ,
        email ,
        phone ,
        business_type ,
        status ,
        created_at ,
        updated_at
    FROM merchants
    WHERE LOWER(email) = $1`

    const value = [ email.toLowerCase() ] ;

    const result = await pool.query( query , value ) ;

    return result.rows[0] || null ;
}

const createMerchant = async ( { 
    business_name , contact_name , email , phone , business_type 
}, client = pool) => {
    const query = `
    INSERT INTO merchants (
        business_name ,
        contact_name ,
        email ,
        phone ,
        business_type)
    VALUES ($1,$2,$3,$4,$5)
    RETURNING id ,
        business_name , 
        contact_name , 
        email , 
        phone , 
        business_type , 
        status , 
        created_at , 
        updated_at`

    const values = [ business_name , contact_name , email , phone , business_type ] ;

    const result = await client.query( query , values ) ;

    return result.rows[0] || null ;
}

const createMerchantCredentials = async ({
    merchant_id,
    password_hash
}, client = pool) => {

    const query = `
        INSERT INTO merchant_credentials (
            merchant_id,
            password_hash
        )
        VALUES ($1, $2)
        RETURNING
            merchant_id,
            password_changed_at,
            created_at,
            updated_at
    `;

    const values = [
        merchant_id,
        password_hash
    ];

    const result = await client.query(query, values);

    return result.rows[0] || null;
};

const findMerchantById = async ( { merchantId } ) => {
    const query = `
    SELECT id ,
        business_name ,
        contact_name ,
        email ,
        phone ,
        business_type ,
        status ,
        created_at ,
        updated_at
    FROM merchants
    WHERE id = $1`

    const values = [ merchantId ] ;

    const result = await pool.query( query , values ) ;

    return result.rows[0] || null ;
}

module.exports = {
    findMerchantByEmail ,
    createMerchant ,
    findMerchantById ,
    createMerchantCredentials
}