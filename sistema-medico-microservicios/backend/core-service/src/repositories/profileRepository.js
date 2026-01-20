// core-service/src/repositories/profileRepository.js
const { getConnection, sql } = require('../config/db');

const createMedico = async (data) => {
    const pool = await getConnection();
    const result = await pool.request()
        .input('UsuarioID', sql.Int, data.usuarioId)
        .input('Nombre', sql.NVarChar, data.nombre)
        .input('Apellido', sql.NVarChar, data.apellido)
        .input('Identificacion', sql.NVarChar, data.identificacion)
        .input('Especialidad', sql.NVarChar, data.especialidad)
        .input('NumeroLicencia', sql.NVarChar, data.licencia)
        .input('Telefono', sql.NVarChar, data.telefono)
        .query(`
            INSERT INTO Medicos (UsuarioID, Nombre, Apellido, Identificacion, Especialidad, NumeroLicencia, Telefono)
            VALUES (@UsuarioID, @Nombre, @Apellido, @Identificacion, @Especialidad, @NumeroLicencia, @Telefono)
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
    await pool.request()
        .input('UsuarioID', sql.Int, data.usuarioId)
        .input('MedicoID', sql.Int, data.medicoId) 
        .input('Nombre', sql.NVarChar, data.nombre)
        .input('Apellido', sql.NVarChar, data.apellido)
        .input('FechaNacimiento', sql.Date, data.fechaNacimiento)
        .input('Identificacion', sql.NVarChar, data.identificacion)
        .input('TelefonoContacto', sql.NVarChar, data.telefono) // Aquí mapeamos data.telefono a la columna SQL
        .query(`
            INSERT INTO Pacientes (UsuarioID, MedicoID, Nombre, Apellido, FechaNacimiento, Identificacion, TelefonoContacto)
            VALUES (@UsuarioID, @MedicoID, @Nombre, @Apellido, @FechaNacimiento, @Identificacion, @TelefonoContacto)
        `);
};

// Busca un médico por especialidad o simplemente el primero que encuentre
const getAvailableMedico = async (especialidad = 'Medicina General') => {
    const pool = await getConnection();
    
    // Intentamos buscar uno de Medicina General
    let result = await pool.request()
        .input('Esp', sql.NVarChar, especialidad)
        .query('SELECT TOP 1 MedicoID FROM Medicos WHERE Especialidad = @Esp');

    // Si no hay de Medicina General, traemos cualquier médico disponible
    if (result.recordset.length === 0) {
        result = await pool.request().query('SELECT TOP 1 MedicoID FROM Medicos');
    }

    return result.recordset.length > 0 ? result.recordset[0].MedicoID : null;
};

const getPacienteByUsuarioId = async (usuarioId) => {
    const pool = await getConnection();
    const result = await pool.request()
        .input('UsuarioID', sql.Int, usuarioId)
        .query(`
            SELECT 
                p.*, 
                m.UsuarioID as MedicoUsuarioID, 
                m.Nombre as NombreMedico 
            FROM Pacientes p    
            JOIN Medicos m ON p.MedicoID = m.MedicoID
            WHERE p.UsuarioID = @UsuarioID
        `);
    return result.recordset[0]; // Retorna el primer resultado o undefined
};

// Obtener lista de todos los médicos (para el dropdown de transferencia)
const getAllMedicos = async () => {
    const pool = await getConnection();
    const result = await pool.request()
        .query('SELECT MedicoID, Nombre, Apellido, Especialidad FROM Medicos');
    return result.recordset;
};

// Actualizar datos del paciente (incluye reasignación de médico)
const updatePaciente = async (id, data) => {
    const pool = await getConnection();
    const result = await pool.request()
        .input('ID', sql.Int, id)
        .input('MedicoID', sql.Int, data.medicoId)
        .input('Nombre', sql.NVarChar, data.nombre)
        .input('Apellido', sql.NVarChar, data.apellido)
        .input('FechaNacimiento', sql.Date, data.fechaNacimiento)
        .input('Identificacion', sql.NVarChar, data.identificacion)
        .input('TipoSangre', sql.NVarChar, data.tipoSangre)
        .input('Direccion', sql.NVarChar, data.direccion)
        .input('TelefonoContacto', sql.NVarChar, data.telefono)
        .input('Alergias', sql.NVarChar, data.alergias)
        .query(`
            UPDATE Pacientes
            SET MedicoID = @MedicoID,
                Nombre = @Nombre,
                Apellido = @Apellido,
                FechaNacimiento = @FechaNacimiento,
                Identificacion = @Identificacion,
                TipoSangre = @TipoSangre,
                Direccion = @Direccion,
                TelefonoContacto = @TelefonoContacto,
                Alergias = @Alergias
            WHERE PacienteID = @ID
        `);
    return result;
};

const checkUniqueData = async (identificacion, licencia, excludeUserId = 0) => {
    const pool = await getConnection();

    // 1. Verificar Identificación en Médicos Y Pacientes simultáneamente
    const idCheck = await pool.request()
        .input('Identificacion', sql.NVarChar, identificacion)
        .input('ExcludeID', sql.Int, excludeUserId)
        .query(`
            SELECT 'Cédula' as Campo FROM Medicos WHERE Identificacion = @Identificacion AND UsuarioID != @ExcludeID
            UNION ALL
            SELECT 'Cédula' as Campo FROM Pacientes WHERE Identificacion = @Identificacion AND UsuarioID != @ExcludeID
        `);

    if (idCheck.recordset.length > 0) {
        return { exists: true, field: 'Identificación (Cédula)' };
    }

    // 2. Verificar Licencia (Solo si se envió una y no es null/vacío)
    if (licencia && licencia.trim() !== "") {
        const licCheck = await pool.request()
            .input('Licencia', sql.NVarChar, licencia)
            .input('ExcludeID', sql.Int, excludeUserId)
            .query(`SELECT 'Licencia' as Campo FROM Medicos WHERE NumeroLicencia = @Licencia AND UsuarioID != @ExcludeID`);

        if (licCheck.recordset.length > 0) {
            return { exists: true, field: 'Número de Licencia' };
        }
    }

    return { exists: false };
};

const getMedicoByUsuarioId = async (usuarioId) => {
    const pool = await getConnection();
    const result = await pool.request()
        .input('UsuarioID', sql.Int, usuarioId)
        .query('SELECT * FROM Medicos WHERE UsuarioID = @UsuarioID');
    return result.recordset[0];
};

module.exports = {
    createMedico,
    getPacientesByMedico,
    createPaciente,
    getPacienteByUsuarioId,
    getAllMedicos,
    updatePaciente,
    checkUniqueData,
    getMedicoByUsuarioId,
    getAvailableMedico 
};