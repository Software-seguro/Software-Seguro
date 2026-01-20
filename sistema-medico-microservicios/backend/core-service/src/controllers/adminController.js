// core-service/src/controllers/adminController.js
const adminRepo = require('../repositories/adminRepository');
const { getConnection, sql } = require('../config/db'); 
const { registrarLog } = require('../utils/logger');

const getAllData = async (req, res) => {
    try {
        // Ejecutamos las 3 consultas en paralelo para mayor velocidad
        const [medicos, pacientes, auditoria] = await Promise.all([
            adminRepo.getAllMedicos(),
            adminRepo.getAllPacientes(),
            adminRepo.getAuditLogs()
        ]);

        res.json({ medicos, pacientes, auditoria });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ message: 'Error obteniendo datos' }); 
    }
};

const updateMedico = async (req, res) => {
    const { id } = req.params;
    const adminId = req.user ? req.user.id : null;
    try {
        const pool = await getConnection();
        const snapshot = await pool.request()
            .input('ID', sql.Int, id)
            .query('SELECT * FROM Medicos WHERE MedicoID = @ID');
        const datosAnteriores = snapshot.recordset[0];
        
        // Validación de licencia única
        const exists = await adminRepo.checkLicense(req.body.licencia, id);
        if (exists) return res.status(400).json({ message: 'El número de licencia ya está registrado en otro médico.' });

        await adminRepo.updateMedico(id, req.body);

        await registrarLog({
            nivel: 'WARNING',
            servicio: 'CoreService',
            usuarioId: adminId,
            rolId: 3,
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            accion: 'Admin_Editar_Medico',
            detalles: { 
                idAfectado: id,
                cambios: {
                    anterior: datosAnteriores,
                    nuevo: req.body 
                }
            }
        });
        res.json({ message: 'Médico actualizado' });
    } catch (e) { res.status(500).json({ message: 'Error actualizando médico' }); }
};

const deleteMedicoCheck = async (req, res) => {
    const { id } = req.params;
    const adminId = req.user ? req.user.id : null;
    try {
        // Verificar si tiene pacientes antes de borrar
        const pacientes = await adminRepo.getPatientsByMedico(id);
        if (pacientes.length > 0) {
            // 409 Conflict: Enviamos la lista de pacientes afectados
            return res.status(409).json({ 
                message: 'No se puede eliminar: El médico tiene pacientes asignados.', 
                pacientes: pacientes 
            });
        }
        
        const pool = await getConnection();
        const snapshot = await pool.request()
            .input('ID', sql.Int, id)
            .query('SELECT * FROM Medicos WHERE MedicoID = @ID');
        const datosEliminados = snapshot.recordset[0];

        await adminRepo.deleteMedico(id);

        if (datosEliminados) {
            await registrarLog({
                nivel: 'CRITICAL',
                servicio: 'CoreService',
                usuarioId: adminId,
                rolId: 3,
                ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
                accion: 'Admin_Eliminar_Medico',
                detalles: { 
                    mensaje: 'Médico eliminado permanentemente',
                    datos: datosEliminados 
                }
            });
        }
        res.json({ message: 'Médico eliminado correctamente' });
    } catch (e) { res.status(500).json({ message: 'Error eliminando médico' }); }
};

const deletePacienteFull = async (req, res) => {
    const { id } = req.params;
    const adminId = req.user ? req.user.id : null;
    try {
        const pool = await getConnection();
        const snapshot = await pool.request()
            .input('ID', sql.Int, id)
            .query('SELECT * FROM Pacientes WHERE PacienteID = @ID');
        const datosEliminados = snapshot.recordset[0];

        await adminRepo.deletePaciente(id);

        if (datosEliminados) {
            await registrarLog({
                nivel: 'CRITICAL',
                servicio: 'CoreService',
                usuarioId: adminId,
                rolId: 3,
                ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
                accion: 'Admin_Eliminar_Paciente',
                detalles: { 
                    mensaje: 'Paciente y TODO su historial clínico eliminados',
                    datos: datosEliminados 
                }
            });
        }
        res.json({ message: 'Paciente eliminado de Core' });
    } catch (e) { res.status(500).json({ message: 'Error eliminando paciente' }); }
};

const unlockUserAccount = async (req, res) => {
    const adminId = req.user ? req.user.id : null;
    try {
        const { id } = req.params;
        await adminRepo.unlockUser(id);

        await registrarLog({
            nivel: 'SECURITY',
            servicio: 'CoreService',
            usuarioId: adminId,
            rolId: 3,
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            accion: 'Admin_Desbloquear_Usuario',
            detalles: { usuarioDesbloqueadoId: id }
        });

        res.json({ message: 'Cuenta desbloqueada y contador reiniciado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al desbloquear cuenta.' });
    }
};

module.exports = { getAllData, updateMedico, deleteMedicoCheck, deletePacienteFull, unlockUserAccount };