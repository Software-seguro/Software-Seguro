const { getConnection, sql } = require('../config/db');
const { encrypt, decrypt } = require('../utils/cryptoUtils');

// --- CONSULTAS ---
const createConsulta = async (data) => {
    const pool = await getConnection();
    const result = await pool.request()
        .input('PacienteID', sql.Int, data.pacienteId)
        .input('MedicoID', sql.Int, data.medicoId)
        .input('FechaConsulta', sql.DateTime, data.fecha || new Date())
        .input('MotivoConsulta', sql.NVarChar, encrypt(data.motivo))
        .input('Sintomas', sql.NVarChar, encrypt(data.sintomas))
        .input('Diagnostico', sql.NVarChar, encrypt(data.diagnostico))
        .input('Tratamiento', sql.NVarChar, encrypt(data.tratamiento))
        .input('NotasAdicionales', sql.NVarChar, encrypt(data.notas))
        .query(`
            INSERT INTO Consultas (PacienteID, MedicoID, FechaConsulta, MotivoConsulta, Sintomas, Diagnostico, Tratamiento, NotasAdicionales)
            VALUES (@PacienteID, @MedicoID, @FechaConsulta, @MotivoConsulta, @Sintomas, @Diagnostico, @Tratamiento, @NotasAdicionales)
        `);
    return result;
};

const updateConsulta = async (id, data) => {
    const pool = await getConnection();
    const result = await pool.request()
        .input('ID', sql.Int, id)
        .input('FechaConsulta', sql.DateTime, data.fecha)
        .input('MotivoConsulta', sql.NVarChar, encrypt(data.motivo))
        .input('Sintomas', sql.NVarChar, encrypt(data.sintomas))
        .input('Diagnostico', sql.NVarChar, encrypt(data.diagnostico))
        .input('Tratamiento', sql.NVarChar, encrypt(data.tratamiento))
        .input('NotasAdicionales', sql.NVarChar, encrypt(data.notas))
        .query(`
            UPDATE Consultas 
            SET FechaConsulta = @FechaConsulta, MotivoConsulta = @MotivoConsulta, Sintomas = @Sintomas, 
                Diagnostico = @Diagnostico, Tratamiento = @Tratamiento, NotasAdicionales = @NotasAdicionales
            WHERE ConsultaID = @ID
        `);
    return result;
};

const deleteConsulta = async (id) => {
    const pool = await getConnection();
    // Opcional: Borrar exámenes hijos primero si no hay CASCADE definido en SQL
    // await pool.request().input('ID', sql.Int, id).query('DELETE FROM Examenes WHERE ConsultaID = @ID');
    return await pool.request().input('ID', sql.Int, id).query('DELETE FROM Consultas WHERE ConsultaID = @ID');
};

const getConsultasByPaciente = async (pacienteId) => {
    const pool = await getConnection();
    const result = await pool.request()
        .input('PacienteID', sql.Int, pacienteId)
        .query('SELECT * FROM Consultas WHERE PacienteID = @PacienteID ORDER BY FechaConsulta DESC');
    return result.recordset.map(decryptConsulta);
};

// --- EXÁMENES ---
const createExamen = async (data) => {
    const pool = await getConnection();
    // FechaRealizacion espera YYYY-MM-DD. Si viene full ISO, cortamos la parte de tiempo.
    const fechaRealizacion = data.fecha ? new Date(data.fecha).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    const result = await pool.request()
        .input('ConsultaID', sql.Int, data.consultaId || null)
        .input('PacienteID', sql.Int, data.pacienteId)
        .input('TipoExamen', sql.NVarChar, data.tipo)
        .input('FechaRealizacion', sql.Date, fechaRealizacion)
        .input('RutaArchivo', sql.NVarChar, encrypt(data.rutaArchivo || ''))
        .input('Observaciones', sql.NVarChar, encrypt(data.observaciones))
        .query(`
            INSERT INTO Examenes (ConsultaID, PacienteID, TipoExamen, FechaRealizacion, RutaArchivo, ObservacionesResultados, FechaSubida)
            VALUES (@ConsultaID, @PacienteID, @TipoExamen, @FechaRealizacion, @RutaArchivo, @Observaciones, GETDATE())
        `);
    return result;
};

const updateExamen = async (id, data) => {
    const pool = await getConnection();
    const fechaRealizacion = data.fecha ? new Date(data.fecha).toISOString().split('T')[0] : null;

    return await pool.request()
        .input('ID', sql.Int, id)
        .input('TipoExamen', sql.NVarChar, data.tipo)
        .input('FechaRealizacion', sql.Date, fechaRealizacion)
        .input('RutaArchivo', sql.NVarChar, encrypt(data.rutaArchivo))
        .input('Observaciones', sql.NVarChar, encrypt(data.observaciones))
        .query(`
            UPDATE Examenes 
            SET TipoExamen = @TipoExamen, FechaRealizacion = @FechaRealizacion, 
                RutaArchivo = @RutaArchivo, ObservacionesResultados = @Observaciones 
            WHERE ExamenID = @ID
        `);
};

const deleteExamen = async (id) => {
    const pool = await getConnection();
    return await pool.request().input('ID', sql.Int, id).query('DELETE FROM Examenes WHERE ExamenID = @ID');
};

const getExamenesByPaciente = async (pacienteId) => {
    const pool = await getConnection();
    const result = await pool.request()
        .input('PacienteID', sql.Int, pacienteId)
        .query('SELECT * FROM Examenes WHERE PacienteID = @PacienteID ORDER BY FechaRealizacion DESC');
    return result.recordset.map(e => ({
        ...e,
        RutaArchivo: decrypt(e.RutaArchivo), // DESCIFRAR
        ObservacionesResultados: decrypt(e.ObservacionesResultados) // DESCIFRAR
    }));
};

const getConsultaById = async (id) => {
    const pool = await getConnection();
    const result = await pool.request()
        .input('ID', sql.Int, id)
        .query('SELECT * FROM Consultas WHERE ConsultaID = @ID');
    return result.recordset[0] ? decryptConsulta(result.recordset[0]) : null;
};

const getExamenById = async (id) => {
    const pool = await getConnection();
    const result = await pool.request()
        .input('ID', sql.Int, id)
        .query('SELECT * FROM Examenes WHERE ExamenID = @ID');
    const e = result.recordset[0];
    return e ? { ...e, RutaArchivo: decrypt(e.RutaArchivo), ObservacionesResultados: decrypt(e.ObservacionesResultados) } : null;
};

// Función auxiliar para descifrar un objeto consulta
const decryptConsulta = (c) => ({
    ...c,
    MotivoConsulta: decrypt(c.MotivoConsulta),
    Sintomas: decrypt(c.Sintomas),
    Diagnostico: decrypt(c.Diagnostico),
    Tratamiento: decrypt(c.Tratamiento),
    NotasAdicionales: decrypt(c.NotasAdicionales)
});

module.exports = { createConsulta, updateConsulta, deleteConsulta, getConsultasByPaciente, createExamen, updateExamen, deleteExamen, getExamenesByPaciente, getConsultaById, getExamenById };