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

module.exports = { createMedicoProfile, getMyPacientes, createPacienteProfile };