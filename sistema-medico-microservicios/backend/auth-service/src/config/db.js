// auth-service/src/config/db.js
const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false, // Usar true si estás en Azure
        trustServerCertificate: true // Importante para desarrollo local
    }
};

const getConnection = async () => {
    try {
        const pool = await sql.connect(config);
        return pool;
    } catch (error) {
        console.error('Error conectando a SQL Server (Auth):', error);
        throw error;
    }
};

module.exports = { getConnection, sql };