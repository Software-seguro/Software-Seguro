// src/routes/profileRoutes.js
const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const adminController = require('../controllers/adminController');
const verifyToken = require('../middleware/authMiddleware');

// Protegemos las rutas con verifyToken
router.post('/medicos', verifyToken, profileController.createMedicoProfile);
router.get('/pacientes', verifyToken, profileController.getMyPacientes);
router.post('/pacientes', verifyToken, profileController.createPacienteProfile);
router.get('/me', verifyToken, profileController.getMyProfile);
router.get('/lista-medicos', verifyToken, profileController.getMedicosList); // Para llenar el select
router.put('/pacientes/:id', verifyToken, profileController.updatePacienteProfile); // Para editar
router.get('/admin/all', verifyToken, adminController.getAllData);
router.put('/admin/medicos/:id', verifyToken, adminController.updateMedico);
router.delete('/admin/medicos/:id', verifyToken, adminController.deleteMedicoCheck);
router.delete('/admin/pacientes/:id', verifyToken, adminController.deletePacienteFull);
router.post('/validate-registry', profileController.validateRegistryData);
router.put('/admin/users/:id/unlock', verifyToken, adminController.unlockUserAccount);

module.exports = router;