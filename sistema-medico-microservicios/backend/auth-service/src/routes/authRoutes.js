// authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verifyToken = require('../middleware/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-2fa', authController.verify2FA);
router.post('/forgot', authController.forgotPassword);
router.put('/users/:id', authController.adminUpdateUser);
router.delete('/users/:id', authController.deleteUserAuth);
router.post('/reset-password', authController.resetPassword);
router.post('/verify-password', verifyToken, authController.verifyPassword);

module.exports = router;