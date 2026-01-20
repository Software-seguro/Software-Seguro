const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const verifyToken = require('../middleware/authMiddleware');

// Protegemos el historial con el token
router.get('/historial/:u1/:u2', verifyToken, chatController.getChatHistory);

module.exports = router;