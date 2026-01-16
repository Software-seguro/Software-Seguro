const { getConnection, sql } = require('../config/db');

const registrarLog = async ({ nivel, servicio, usuarioId, rolId, ip, accion, detalles }) => {
    try {
        const pool = await getConnection();
        // Usamos Cross-Database Query (DB_Logs.dbo.Auditoria)
        await pool.request()
            .input('Nivel', sql.NVarChar, nivel)
            .input('Servicio', sql.NVarChar, servicio)
            .input('UsuarioID', sql.Int, usuarioId || null)
            .input('RolID', sql.Int, rolId || null)
            .input('IP', sql.NVarChar, ip || 'Unknown')
            .input('Accion', sql.NVarChar, accion)
            .input('Detalles', sql.NVarChar, JSON.stringify(detalles))
            .query(`
                INSERT INTO DB_Logs.dbo.Auditoria 
                (FechaHora, ServicioOrigen, Nivel, UsuarioID, RolID, IPOrigen, Accion, Detalles)
                VALUES (GETDATE(), @Servicio, @Nivel, @UsuarioID, @RolID, @IP, @Accion, @Detalles)
            `);
    } catch (error) {
        // Si falla el log, lo mostramos en consola pero NO detenemos la app
        console.error("FALLO AUDITORIA:", error);
    }
};

module.exports = { registrarLog };