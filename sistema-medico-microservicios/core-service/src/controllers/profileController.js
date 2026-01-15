const profileRepo = require('../repositories/profileRepository');

const createMedicoProfile = async (req, res) => {
    try {
        // req.user viene del middleware (Token decodificado)
        const { id } = req.user; 
        const { nombre, apellido, especialidad, licencia, telefono } = req.body;

        await profileRepo.createMedico({ usuarioId: id, nombre, apellido, especialidad, licencia, telefono });
        res.status(201).json({ message: 'Perfil de médico creado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al crear perfil' });
    }
};

const getMyPacientes = async (req, res) => {
    try {
        const { id } = req.user; // ID del Usuario (Medico)
        const pacientes = await profileRepo.getPacientesByMedico(id);
        res.json(pacientes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener pacientes' });
    }
};

const createPacienteProfile = async (req, res) => {
    try {
        const { id } = req.user; // Viene del token
        const { nombre, apellido, fechaNacimiento, identificacion, telefono } = req.body;

        await profileRepo.createPaciente({ 
            usuarioId: id, 
            nombre, 
            apellido, 
            fechaNacimiento, 
            identificacion, 
            telefono 
        });
        res.status(201).json({ message: 'Perfil de paciente creado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al crear perfil de paciente' });
    }
};

const getMyProfile = async (req, res) => {
    try {
        // req.user.id es extraído automáticamente del Token por tu authMiddleware
        const usuarioId = req.user.id; 
        
        // LLAMAMOS AL REPOSITORIO (Él se encarga de la base de datos)
        const perfil = await profileRepo.getPacienteByUsuarioId(usuarioId);
        
        if (perfil) {
            // Si existe el perfil, devolvemos el JSON al frontend
            res.json(perfil);
        } else {
            // Si el ID del token no existe en la tabla Pacientes
            res.status(404).json({ message: "Perfil de paciente no encontrado" });
        }
    } catch (error) {
        console.error("Error en getMyProfile:", error);
        res.status(500).json({ message: "Error interno del servidor al obtener el perfil" });
    }
};

module.exports = { createMedicoProfile, getMyPacientes, createPacienteProfile, getMyProfile };