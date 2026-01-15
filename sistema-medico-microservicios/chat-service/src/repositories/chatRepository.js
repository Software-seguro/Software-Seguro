const { getConnection, sql } = require('../config/db');

const saveMessage = async (data) => {
    try {
        const pool = await getConnection();
        await pool.request()
            .input('UsuarioID', sql.Int, data.userId) 
            .input('ReceptorID', sql.Int, data.receptorId) // <--- NUEVO
            .input('NombreUsuario', sql.NVarChar, data.username)
            .input('Contenido', sql.NVarChar, data.text)
            .input('RolID', sql.Int, data.rol) 
            .query(`
                INSERT INTO Mensajes (UsuarioID, ReceptorID, NombreUsuario, Contenido, RolID, FechaEnvio)
                VALUES (@UsuarioID, @ReceptorID, @NombreUsuario, @Contenido, @RolID, GETDATE())
            `);
    } catch (error) {
        console.error('Error guardando mensaje en SQL:', error);
    }
};

const getRecentMessages = async (u1, u2) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('u1', sql.Int, u1)
            .input('u2', sql.Int, u2)
            .query(`
                SELECT 
                    NombreUsuario as username, 
                    Contenido as text, 
                    RolID as rol, 
                    FechaEnvio, 
                    UsuarioID as userId,
                    ReceptorID as receptorId  -- <--- ¡ESTO FALTABA!
                FROM Mensajes
                WHERE (UsuarioID = @u1 AND ReceptorID = @u2)
                   OR (UsuarioID = @u2 AND ReceptorID = @u1)
                ORDER BY FechaEnvio ASC
            `);
        return result.recordset;
    } catch (error) {
        console.error('Error en getRecentMessages:', error);
        return [];
    }
};

module.exports = { saveMessage, getRecentMessages };    