// core-service/src/config/db.js
const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

const getConnection = async () => {
    try {
        const pool = await sql.connect(config);
        return pool;
    } catch (error) {
        console.error('Error conectando a SQL Server (Core):', error);
        throw error;
    }
};

module.exports = { getConnection, sql };