// adminController.js
const adminRepo = require('../repositories/adminRepository');

const getAllData = async (req, res) => {
    try {
        const medicos = await adminRepo.getAllMedicos();
        const pacientes = await adminRepo.getAllPacientes();
        res.json({ medicos, pacientes });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ message: 'Error obteniendo datos' }); 
    }
};

const updateMedico = async (req, res) => {
    try {
        // Validación de licencia única
        const exists = await adminRepo.checkLicense(req.body.licencia, req.params.id);
        if (exists) return res.status(400).json({ message: 'El número de licencia ya está registrado en otro médico.' });

        await adminRepo.updateMedico(req.params.id, req.body);
        res.json({ message: 'Médico actualizado' });
    } catch (e) { res.status(500).json({ message: 'Error actualizando médico' }); }
};

const deleteMedicoCheck = async (req, res) => {
    try {
        // Verificar si tiene pacientes antes de borrar
        const pacientes = await adminRepo.getPatientsByMedico(req.params.id);
        if (pacientes.length > 0) {
            // 409 Conflict: Enviamos la lista de pacientes afectados
            return res.status(409).json({ 
                message: 'No se puede eliminar: El médico tiene pacientes asignados.', 
                pacientes: pacientes 
            });
        }
        
        await adminRepo.deleteMedico(req.params.id);
        res.json({ message: 'Médico eliminado correctamente' });
    } catch (e) { res.status(500).json({ message: 'Error eliminando médico' }); }
};

const deletePacienteFull = async (req, res) => {
    try {
        await adminRepo.deletePaciente(req.params.id);
        res.json({ message: 'Paciente eliminado de Core' });
    } catch (e) { res.status(500).json({ message: 'Error eliminando paciente' }); }
};

module.exports = { getAllData, updateMedico, deleteMedicoCheck, deletePacienteFull };