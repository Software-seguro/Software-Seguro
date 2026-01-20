// auth-service/src/repositories/userRepository.js
const { getConnection, sql } = require('../config/db');

const createUser = async (email, passwordHash, rolId) => {
    const pool = await getConnection();
    const result = await pool.request()
        .input('Email', sql.NVarChar, email)
        .input('PasswordHash', sql.NVarChar, passwordHash)
        .input('RolID', sql.Int, rolId)
        .query(`
            INSERT INTO Usuarios (Email, PasswordHash, RolID)
            OUTPUT INSERTED.UsuarioID, INSERTED.Email, INSERTED.RolID
            VALUES (@Email, @PasswordHash, @RolID)
        `);
    return result.recordset[0];
};

const findUserByEmail = async (email) => {
    const pool = await getConnection();
    const result = await pool.request()
        .input('Email', sql.NVarChar, email)
        .query('SELECT * FROM Usuarios WHERE Email = @Email');
    return result.recordset[0]; // Retorna undefined si no existe
};

const updatePassword = async (email, newPasswordHash) => {
    const pool = await getConnection();
    const result = await pool.request()
        .input('Email', sql.NVarChar, email)
        .input('PasswordHash', sql.NVarChar, newPasswordHash)
        .query(`
            UPDATE Usuarios 
            SET PasswordHash = @PasswordHash 
            WHERE Email = @Email
        `);
    // result.rowsAffected[0] nos dice cuántas filas cambió. Si es 0, el email no existe.
    return result.rowsAffected[0] > 0;
};

module.exports = { createUser, findUserByEmail, updatePassword };