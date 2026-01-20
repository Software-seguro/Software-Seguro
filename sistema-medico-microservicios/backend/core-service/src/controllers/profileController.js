// src/controllers/profileController.js
const profileRepo = require('../repositories/profileRepository');
const { getConnection, sql } = require('../config/db');
const { registrarLog } = require('../utils/logger');

const createMedicoProfile = async (req, res) => {
    try {
        const { id } = req.user;
        const { nombre, apellido, identificacion, especialidad, numeroLicencia, telefono } = req.body;

        if (!numeroLicencia) {
            return res.status(400).json({ message: "El número de licencia es obligatorio para médicos." });
        }

        await profileRepo.createMedico({
            usuarioId: id,
            nombre,
            apellido,
            identificacion,
            especialidad,
            licencia: numeroLicencia,
            telefono
        });

        await registrarLog({
            nivel: 'INFO', servicio: 'CoreService', usuarioId: id, rolId: 1,
            accion: 'Crear_Perfil_Medico', detalles: { nombre, licencia: numeroLicencia }
        });

        res.status(201).json({ message: 'Perfil de médico creado' });
    } catch (error) {
        console.error("Error en createMedicoProfile:", error);
        res.status(500).json({ message: 'Error al crear perfil de médico' });
    }
};

const getMyPacientes = async (req, res) => {
    try {
        const { id } = req.user;
        const pacientes = await profileRepo.getPacientesByMedico(id);
        res.json(pacientes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener pacientes' });
    }
};

const createPacienteProfile = async (req, res) => {
    try {
        const { usuarioId, nombre, apellido, fechaNacimiento, identificacion, telefono } = req.body;
        const finalUserId = usuarioId || (req.user ? req.user.id : null);
        const creadorId = req.user ? req.user.id : finalUserId;

        // --- CAMBIO CLAVE: BUSQUEDA AUTOMÁTICA DE MÉDICO ---
        const medicoIdAsignado = await profileRepo.getAvailableMedico('Medicina General');

        if (!medicoIdAsignado) {
            return res.status(500).json({ message: "No hay médicos disponibles en el sistema para asignar." });
        }

        await profileRepo.createPaciente({ 
            usuarioId: finalUserId, 
            nombre, 
            apellido, 
            fechaNacimiento, 
            identificacion, 
            telefono,
            medicoId: medicoIdAsignado // Se asigna el ID 6 (o el que encuentre)
        });

        await registrarLog({
            nivel: 'INFO', servicio: 'CoreService', usuarioId: creadorId, 
            accion: 'Crear_Perfil_Paciente', 
            detalles: { 
                paciente: `${nombre} ${apellido}`, 
                medicoAsignado: medicoIdAsignado 
            }
        });
        
        res.status(201).json({ message: 'Perfil creado y asignado al Dr. ' + medicoIdAsignado });
    } catch (error) {
        console.error("ERROR EN CORE:", error);
        res.status(500).json({ message: error.message });
    }
};

const getMyProfile = async (req, res) => {
    try {
        const usuarioId = req.user.id;
        const rolId = req.user.rol; // Extraído del Token

        let perfil;
        if (rolId === 1) {
            perfil = await profileRepo.getMedicoByUsuarioId(usuarioId);
        } else {
            perfil = await profileRepo.getPacienteByUsuarioId(usuarioId);
        }

        if (perfil) {
            res.json(perfil);
        } else {
            res.status(404).json({ message: "Perfil no encontrado" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener el perfil" });
    }
};

const getMedicosList = async (req, res) => {
    try {
        const medicos = await profileRepo.getAllMedicos();
        res.json(medicos);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener médicos' });
    }
};

const updatePacienteProfile = async (req, res) => {
    try {
        const { id } = req.params; // ID del Paciente (ProfileID)
        const editorId = req.user.id; // ID del Usuario que hace el cambio (Admin o Médico)
        const rolEditor = req.user.rol;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        // 1. SNAPSHOT: Obtener los datos VIEJOS antes de editar
        const pool = await getConnection();
        const oldDataRes = await pool.request()
            .input('ID', sql.Int, id)
            .query('SELECT * FROM Pacientes WHERE PacienteID = @ID');
        
        const oldData = oldDataRes.recordset[0];

        // 2. EJECUTAR LA ACTUALIZACIÓN
        await profileRepo.updatePaciente(id, req.body);

        // 3. COMPARAR Y REGISTRAR LOG
        let accionLog = 'Editar_Paciente';
        let mensajeLog = 'Actualización de datos generales';

        // Detectamos si hubo reasignación de médico
        if (oldData && req.body.medicoId && oldData.MedicoID != req.body.medicoId) {
            accionLog = 'Reasignacion_Paciente';
            mensajeLog = `Paciente transferido del Médico ID ${oldData.MedicoID} al ${req.body.medicoId}`;
        }

        await registrarLog({
            nivel: 'WARNING', // Warning porque editar datos es sensible
            servicio: 'CoreService',
            usuarioId: editorId,
            rolId: rolEditor,
            ip: ip,
            accion: accionLog,
            detalles: {
                mensaje: mensajeLog,
                pacienteID: id,
                cambios: {
                    antes: {
                        medicoId: oldData?.MedicoID,
                        direccion: oldData?.Direccion,
                        telefono: oldData?.TelefonoContacto
                    },
                    despues: {
                        medicoId: req.body.medicoId,
                        direccion: req.body.direccion,
                        telefono: req.body.telefono
                    }
                }
            }
        });

        res.json({ message: 'Paciente actualizado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al actualizar paciente' });
    }
};

const validateRegistryData = async (req, res) => {
    try {
        const { identificacion, licencia, excludeUserId } = req.body;

        if (!identificacion) {
            return res.status(400).json({ message: "La identificación es obligatoria." });
        }

        const result = await profileRepo.checkUniqueData(identificacion, licencia, excludeUserId || 0);

        if (result.exists) {
            // Devolvemos 409 Conflict para que el frontend detecte el error
            return res.status(409).json({
                message: `El ${result.field} ya se encuentra registrado en nuestro sistema.`
            });
        }

        res.status(200).json({ message: 'Datos disponibles' });
    } catch (error) {
        console.error("Error en validateRegistryData:", error);
        res.status(500).json({ message: 'Error interno al validar los datos.' });
    }
};

module.exports = { createMedicoProfile, getMyPacientes, createPacienteProfile, getMyProfile, getMedicosList, updatePacienteProfile, validateRegistryData };