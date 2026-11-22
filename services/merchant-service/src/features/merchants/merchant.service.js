const merchantRepository = require("./merchant.repository");
const { MerchantError } = require("./errors/merchant.errors") ;

const registerMerchant = async (merchantData) => {
    try {

        const existingMerchant = await merchantRepository.findMerchantByEmail(merchantData.email) ;

        if (existingMerchant) {
            throw new MerchantError("A merchant with this email already exists",
                "MERCHANT_ALREADY_EXISTS",409) ;
        }

        const merchant = await merchantRepository.createMerchant({
            business_name: merchantData.business_name,
            contact_name: merchantData.contact_name,
            email: merchantData.email,
            phone: merchantData.phone,
            business_type: merchantData.business_type,
        });

        return merchant ;

    } catch (error) {

        if (
        error.code === "23505" &&
        error.constraint === "merchants_email_unique_idx"
        ) {
        throw new MerchantError(
            "A merchant with this email already exists",
            "MERCHANT_ALREADY_EXISTS",
            409
        );
        }

     
        throw error;
    }

}

module.exports = {
    registerMerchant
}