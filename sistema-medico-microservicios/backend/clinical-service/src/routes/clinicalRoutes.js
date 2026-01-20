const express = require('express');
const router = express.Router();
const clinicalController = require('../controllers/clinicalController');
const verifyToken = require('../middleware/authMiddleware');

// Todas las rutas protegidas
router.use(verifyToken);

// Rutas de Consultas
router.post('/consultas', verifyToken, clinicalController.registerConsulta);
router.put('/consultas/:id', verifyToken, clinicalController.updateConsulta);
router.delete('/consultas/:id', verifyToken, clinicalController.deleteConsulta);
router.get('/paciente/:pacienteId/consultas', verifyToken, clinicalController.getHistoria);

// Rutas de Exámenes
router.post('/examenes', verifyToken, clinicalController.registerExamen);
router.put('/examenes/:id', verifyToken, clinicalController.updateExamen);
router.delete('/examenes/:id', verifyToken, clinicalController.deleteExamen);
router.get('/paciente/:pacienteId/examenes', verifyToken, clinicalController.getExamenes);

module.exports = router;