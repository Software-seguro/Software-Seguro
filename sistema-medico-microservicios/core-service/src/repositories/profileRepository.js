// core-service/src/repositories/profileRepository.js
const { getConnection, sql } = require('../config/db');

const createMedico = async (data) => {
    const pool = await getConnection();
    const result = await pool.request()
        .input('UsuarioID', sql.Int, data.usuarioId)
        .input('Nombre', sql.NVarChar, data.nombre)
        .input('Apellido', sql.NVarChar, data.apellido)
        .input('Especialidad', sql.NVarChar, data.especialidad)
        .input('NumeroLicencia', sql.NVarChar, data.licencia)
        .input('Telefono', sql.NVarChar, data.telefono)
        .query(`
            INSERT INTO Medicos (UsuarioID, Nombre, Apellido, Especialidad, NumeroLicencia, Telefono)
            VALUES (@UsuarioID, @Nombre, @Apellido, @Especialidad, @NumeroLicencia, @Telefono)
        `);
    return result;
};

const getPacientesByMedico = async (medicoUsuarioId) => {
    // Primero necesitamos saber el ID interno de Medico basado en su UsuarioID
    const pool = await getConnection();
    const medico = await pool.request()
        .input('UsuarioID', sql.Int, medicoUsuarioId)
        .query('SELECT MedicoID FROM Medicos WHERE UsuarioID = @UsuarioID');
    
    if (medico.recordset.length === 0) return [];
    
    const medicoId = medico.recordset[0].MedicoID;

    // Ahora buscamos sus pacientes
    const result = await pool.request()
        .input('MedicoID', sql.Int, medicoId)
        .query('SELECT * FROM Pacientes WHERE MedicoID = @MedicoID');
    
    return result.recordset;
};

const createPaciente = async (data) => {
    const pool = await getConnection();
    const result = await pool.request()
        .input('UsuarioID', sql.Int, data.usuarioId)
        .input('MedicoID', sql.Int, 1) // OJO: Por defecto asignamos al Médico ID 1 (Juan Perez) temporalmente
        .input('Nombre', sql.NVarChar, data.nombre)
        .input('Apellido', sql.NVarChar, data.apellido)
        .input('FechaNacimiento', sql.Date, data.fechaNacimiento)
        .input('Identificacion', sql.NVarChar, data.identificacion)
        .input('TelefonoContacto', sql.NVarChar, data.telefono)
        .query(`
            INSERT INTO Pacientes (UsuarioID, MedicoID, Nombre, Apellido, FechaNacimiento, Identificacion, TelefonoContacto)
            VALUES (@UsuarioID, @MedicoID, @Nombre, @Apellido, @FechaNacimiento, @Identificacion, @TelefonoContacto)
        `);
    return result;
};

module.exports = { createMedico, getPacientesByMedico, createPaciente };