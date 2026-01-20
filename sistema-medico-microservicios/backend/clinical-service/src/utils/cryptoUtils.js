const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-cbc';
// La llave debe ser de 32 caracteres exactos (256 bits)
const ENCRYPTION_KEY = process.env.CLINICAL_ENCRYPTION_KEY || '12345678901234567890123456789012'; 
const IV_LENGTH = 16; // Para AES, siempre es 16

const encrypt = (text) => {
    if (!text) return text;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    // Retornamos iv:texto_cifrado en formato hex
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

const decrypt = (text) => {
    if (!text || !text.includes(':')) return text;
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        console.error("Error al descifrar:", error);
        return "[Error de cifrado]";
    }
};

module.exports = { encrypt, decrypt };