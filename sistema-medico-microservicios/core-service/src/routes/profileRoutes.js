const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const verifyToken = require('../middleware/authMiddleware');

// Protegemos las rutas con verifyToken
router.post('/medicos', verifyToken, profileController.createMedicoProfile);
router.get('/pacientes', verifyToken, profileController.getMyPacientes);
router.post('/pacientes', verifyToken, profileController.createPacienteProfile);
router.get('/me', verifyToken, profileController.getMyProfile);

module.exports = router;