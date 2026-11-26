const crypto = require("crypto") ;

const generatePublicId = () => {

    const publicId = crypto.randomBytes(8).toString('hex');

    return publicId ;
}

const generateSecret = () => {

    const secret = crypto.randomBytes(32).toString('base64url');

    return secret ;
}

const hashSecret = ( secret ) => {

    const hash = crypto.createHash('sha256').update(secret).digest('hex');

    return hash ;
}

module.exports = {
    generatePublicId ,
    generateSecret ,
    hashSecret
}