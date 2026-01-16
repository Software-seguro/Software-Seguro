// adminRepository.js
const { getConnection, sql } = require('../config/db');

const getAllMedicos = async () => {
    const pool = await getConnection();
    const result = await pool.request().query(`
        SELECT 
            m.*, 
            u.Email,
            u.Activo 
        FROM DB_Core.dbo.Medicos m
        INNER JOIN DB_Auth.dbo.Usuarios u ON m.UsuarioID = u.UsuarioID
    `);
    return result.recordset; 
};

const getAllPacientes = async () => {
    const pool = await getConnection();
    const result = await pool.request().query(`
        SELECT 
            p.*, 
            u.Email,
            u.Activo,
            m.Nombre as NombreMedico, 
            m.Apellido as ApellidoMedico
        FROM DB_Core.dbo.Pacientes p
        INNER JOIN DB_Auth.dbo.Usuarios u ON p.UsuarioID = u.UsuarioID
        LEFT JOIN DB_Core.dbo.Medicos m ON p.MedicoID = m.MedicoID
    `);
    return result.recordset; 
};

// Validar si la licencia ya existe en OTRO médico
const checkLicense = async (licencia, excludeId) => {
    const pool = await getConnection();
    const result = await pool.request()
        .input('Licencia', sql.NVarChar, licencia)
        .input('ExcludeID', sql.Int, excludeId)
        .query('SELECT COUNT(*) as Count FROM Medicos WHERE NumeroLicencia = @Licencia AND MedicoID != @ExcludeID');
    return result.recordset[0].Count > 0;
};

const updateMedico = async (id, data) => {
    const pool = await getConnection();
    await pool.request()
        .input('ID', sql.Int, id)
        .input('Nombre', sql.NVarChar, data.nombre)
        .input('Apellido', sql.NVarChar, data.apellido)
        .input('Identificacion', sql.NVarChar, data.identificacion)
        .input('Especialidad', sql.NVarChar, data.especialidad)
        .input('Licencia', sql.NVarChar, data.licencia)
        .input('Telefono', sql.NVarChar, data.telefono)
        .query('UPDATE Medicos SET Nombre=@Nombre, Apellido=@Apellido, Identificacion=@Identificacion, Especialidad=@Especialidad, NumeroLicencia=@Licencia, Telefono=@Telefono WHERE MedicoID=@ID');
};

const getPatientsByMedico = async (medicoId) => {
    const pool = await getConnection();
    const result = await pool.request()
        .input('MedicoID', sql.Int, medicoId)
        .query('SELECT * FROM Pacientes WHERE MedicoID = @MedicoID');
    return result.recordset;
};

const deleteMedico = async (id) => {
    const pool = await getConnection();
    await pool.request().input('ID', sql.Int, id).query('DELETE FROM Medicos WHERE MedicoID = @ID');
};

const deletePaciente = async (id) => {
    const pool = await getConnection();
    await pool.request().input('ID', sql.Int, id).query('DELETE FROM Pacientes WHERE PacienteID = @ID');
};

const unlockUser = async (usuarioId) => {
    const pool = await getConnection();
    await pool.request()
        .input('ID', sql.Int, usuarioId)
        .query(`
            UPDATE DB_Auth.dbo.Usuarios 
            SET Activo = 1, IntentosFallidos = 0 
            WHERE UsuarioID = @ID
        `);
};

module.exports = { getAllMedicos, getAllPacientes, checkLicense, updateMedico, getPatientsByMedico, deleteMedico, deletePaciente, unlockUser };