// authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot', authController.forgotPassword);
router.put('/users/:id', authController.adminUpdateUser);
router.delete('/users/:id', authController.deleteUserAuth);

module.exports = router;