const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: { encrypt: false, trustServerCertificate: true }
};

const getConnection = async () => {
    try {
        return await sql.connect(config);
    } catch (error) {
        console.error('Error conectando a BD Clínica:', error);
        throw error;
    }
};

module.exports = { getConnection, sql };