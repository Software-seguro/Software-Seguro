// clinical-service/src/controllers/clinicalController.js
const clinicalRepo = require('../repositories/clinicalRepository');
const { registrarLog } = require('../utils/logger');

// --- CONSULTAS ---

const registerConsulta = async (req, res) => {
    try {
        const medicoId = req.user.rol === 1 ? req.user.id : req.body.medicoId; 
        
        await clinicalRepo.createConsulta({ ...req.body, medicoId });

        res.status(201).json({ message: 'Consulta registrada correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al registrar consulta' });
    }
};

const updateConsulta = async (req, res) => {
    const { id } = req.params;
    const editorId = req.user.id; // Médico que edita
    
    try {
        // 1. OBTENER DATOS ANTES DE CAMBIAR (SNAPSHOT)
        const datosAnteriores = await clinicalRepo.getConsultaById(id);
        
        if (!datosAnteriores) return res.status(404).json({ message: 'Consulta no encontrada' });

        // 2. EJECUTAR ACTUALIZACIÓN
        await clinicalRepo.updateConsulta(id, req.body);

        // 3. REGISTRAR AUDITORÍA (ANTES vs DESPUÉS)
        await registrarLog({
            nivel: 'WARNING', // Warning porque alterar historia clínica es delicado
            servicio: 'ClinicalService',
            usuarioId: editorId,
            rolId: req.user.rol,
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            accion: 'Editar_Consulta',
            detalles: { 
                idConsulta: id,
                cambios: {
                    anterior: datosAnteriores,
                    nuevo: req.body 
                }
            }
        });

        res.json({ message: 'Consulta actualizada' });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ message: 'Error actualizando consulta' }); 
    }
};

const deleteConsulta = async (req, res) => {
    const { id } = req.params;
    const editorId = req.user.id;

    try {
        // 1. OBTENER DATOS ANTES DE BORRAR
        const datosEliminados = await clinicalRepo.getConsultaById(id);

        if (!datosEliminados) return res.status(404).json({ message: 'Consulta no encontrada' });

        // 2. ELIMINAR
        try {
            await clinicalRepo.deleteConsulta(id);
        } catch (sqlError) {
            // Error 547 en SQL Server es "Foreign Key Violation"
            if (sqlError.number === 547) {
                return res.status(409).json({ 
                    message: 'No se puede eliminar la consulta porque tiene exámenes asociados. Elimine los exámenes primero.' 
                });
            }
            throw sqlError; // Si es otro error, que lo atrape el catch general
        }

        // 3. LOG DETALLADO: Guardamos qué se borró exactamente
        // Formateamos un mensaje resumen para lectura rápida
        const resumen = `Consulta del ${new Date(datosEliminados.FechaConsulta).toLocaleDateString()} - Motivo: ${datosEliminados.MotivoConsulta}`;

        await registrarLog({
            nivel: 'CRITICAL',
            servicio: 'ClinicalService',
            usuarioId: editorId,
            rolId: req.user.rol,
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            accion: 'Eliminar_Consulta',
            detalles: { 
                mensaje: `Se eliminó: ${resumen}`, // Mensaje legible
                datosRecuperables: datosEliminados   // Objeto completo JSON por seguridad
            }
        });

        res.json({ message: 'Consulta eliminada' });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ message: 'Error eliminando consulta' }); 
    }
};

// Obtener Historial (Consultas)
const getHistoria = async (req, res) => {
    try {
        const { pacienteId } = req.params;
        const consultas = await clinicalRepo.getConsultasByPaciente(pacienteId);
        res.json(consultas);
    } catch (error) {
        res.status(500).json({ message: 'Error obteniendo historia' });
    }
};

// --- EXÁMENES ---

// Crear Examen
const registerExamen = async (req, res) => {
    try {
        await clinicalRepo.createExamen(req.body);
        res.status(201).json({ message: 'Examen registrado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al registrar examen' });
    }
};

// Obtener Exámenes
const getExamenes = async (req, res) => {
    try {
        const { pacienteId } = req.params;
        const examenes = await clinicalRepo.getExamenesByPaciente(pacienteId);
        res.json(examenes);
    } catch (error) {
        res.status(500).json({ message: 'Error obteniendo exámenes' });
    }
};

const updateExamen = async (req, res) => {
    const { id } = req.params;
    const editorId = req.user.id;

    try {
        // 1. SNAPSHOT
        const datosAnteriores = await clinicalRepo.getExamenById(id);
        
        if (!datosAnteriores) return res.status(404).json({ message: 'Examen no encontrado' });

        // 2. UPDATE
        await clinicalRepo.updateExamen(id, req.body);

        // 3. LOG
        await registrarLog({
            nivel: 'WARNING',
            servicio: 'ClinicalService',
            usuarioId: editorId,
            rolId: req.user.rol,
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            accion: 'Editar_Examen',
            detalles: { 
                idExamen: id,
                cambios: {
                    anterior: datosAnteriores,
                    nuevo: req.body 
                }
            }
        });

        res.json({ message: 'Examen actualizado' });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ message: 'Error actualizando examen' }); 
    }
};



const deleteExamen = async (req, res) => {
    const { id } = req.params;
    const editorId = req.user.id;

    try {
        // 1. SNAPSHOT
        const datosEliminados = await clinicalRepo.getExamenById(id);

        if (!datosEliminados) return res.status(404).json({ message: 'Examen no encontrado' });

        // 2. DELETE
        await clinicalRepo.deleteExamen(id);

        // 3. LOG
        const resumen = `${datosEliminados.TipoExamen} (${new Date(datosEliminados.FechaRealizacion).toLocaleDateString()})`;

        await registrarLog({
            nivel: 'CRITICAL',
            servicio: 'ClinicalService',
            usuarioId: editorId,
            rolId: req.user.rol,
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            accion: 'Eliminar_Examen',
            detalles: { 
                mensaje: `Se eliminó el examen: ${resumen}`,
                datosRecuperables: datosEliminados 
            }
        });

        res.json({ message: 'Examen eliminado' });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ message: 'Error eliminando examen' }); 
    }
};

module.exports = { 
    registerConsulta, getHistoria, updateConsulta, deleteConsulta,
    registerExamen, getExamenes, updateExamen, deleteExamen 
};